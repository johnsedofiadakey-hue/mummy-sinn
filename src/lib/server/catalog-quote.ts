import "server-only";
import type { DocumentSnapshot, Firestore, Transaction } from "firebase-admin/firestore";
import { adminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { CheckoutError, type CheckoutInput, type FulfilmentInput } from "@/lib/server/checkout-contract";

type Option = { id: string; name: string; priceAdjustmentPesewas?: number };
type ModifierGroup = { id: string; name: string; min: number; max: number; options: Option[] };
type ServerMenuItem = { name: string; pricePesewas: number; isAvailable: boolean; modifierGroups?: ModifierGroup[]; capacityUnits?: number };
type ServerLocation = { name: string; deliveryFeePesewas: number; isActive: boolean };
type ServerSettings = { acceptingOrders: boolean; asapEnabled: boolean };
type ServerSlot = { isOpen: boolean; serviceDate: string; startsAt: string; endsAt: string; totalCapacity: number; reservedCapacity?: number };

export type ServerQuote = {
  currency: "GHS"; subtotalPesewas: number; deliveryFeePesewas: number; totalPesewas: number;
  deliveryLocation: { id: string; name: string }; fulfilment: FulfilmentInput; preorderCapacityUnits: number;
  lines: { menuItemId: string; name: string; quantity: number; unitPricePesewas: number; lineTotalPesewas: number; selectedOptions: Option[]; capacityUnits: number }[];
};

const asObject = (value: unknown) => value && typeof value === "object" ? value as Record<string, unknown> : {};
const int = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
const string = (value: unknown) => typeof value === "string" ? value : "";
const menu = (value: unknown): ServerMenuItem | null => { const data = asObject(value); const pricePesewas = int(data.pricePesewas); return pricePesewas === null || !string(data.name) || typeof data.isAvailable !== "boolean" ? null : { name: string(data.name), pricePesewas, isAvailable: data.isAvailable, modifierGroups: Array.isArray(data.modifierGroups) ? data.modifierGroups as ModifierGroup[] : [], capacityUnits: int(data.capacityUnits) ?? 1 }; };
const location = (value: unknown): ServerLocation | null => { const data = asObject(value); const deliveryFeePesewas = int(data.deliveryFeePesewas); return deliveryFeePesewas === null || !string(data.name) || typeof data.isActive !== "boolean" ? null : { name: string(data.name), deliveryFeePesewas, isActive: data.isActive }; };
const settings = (value: unknown): ServerSettings | null => { const data = asObject(value); return typeof data.acceptingOrders !== "boolean" || typeof data.asapEnabled !== "boolean" ? null : { acceptingOrders: data.acceptingOrders, asapEnabled: data.asapEnabled }; };
const slot = (value: unknown): ServerSlot | null => { const data = asObject(value); const totalCapacity = int(data.totalCapacity); return totalCapacity === null || typeof data.isOpen !== "boolean" || !string(data.serviceDate) || !string(data.startsAt) || !string(data.endsAt) ? null : { isOpen: data.isOpen, serviceDate: string(data.serviceDate), startsAt: string(data.startsAt), endsAt: string(data.endsAt), totalCapacity, reservedCapacity: int(data.reservedCapacity) ?? 0 }; };
export function checkoutRuntimeReady() { return isFirebaseAdminConfigured(); }

type CheckoutDocuments = { settings: DocumentSnapshot; location: DocumentSnapshot; menuItems: DocumentSnapshot[]; slot?: DocumentSnapshot };
async function readDocuments(input: CheckoutInput, read: (path: string) => Promise<DocumentSnapshot>): Promise<CheckoutDocuments> {
  const reads = [read("settings/public"), read(`deliveryLocations/${input.delivery.locationId}`), ...input.lines.map((line) => read(`menuItems/${line.menuItemId}`))];
  if (input.fulfilment.type === "PREORDER") reads.push(read(`preorderSlots/${input.fulfilment.preorderSlotId}`));
  const snapshots = await Promise.all(reads);
  return { settings: snapshots[0], location: snapshots[1], menuItems: snapshots.slice(2, 2 + input.lines.length), ...(input.fulfilment.type === "PREORDER" ? { slot: snapshots[2 + input.lines.length] } : {}) };
}

function calculateQuote(input: CheckoutInput, documents: CheckoutDocuments): ServerQuote {
  const liveSettings = settings(documents.settings.data());
  if (!liveSettings?.acceptingOrders) throw new CheckoutError("KITCHEN_CLOSED", 409, "The kitchen is not accepting orders right now.");
  if (input.fulfilment.type === "ASAP" && !liveSettings.asapEnabled) throw new CheckoutError("ASAP_PAUSED", 409, "ASAP delivery is paused. Choose a preorder time.");
  const deliveryLocation = location(documents.location.data());
  if (!deliveryLocation?.isActive) throw new CheckoutError("DELIVERY_LOCATION_UNAVAILABLE", 409, "That delivery location is not available right now.");
  const lines = input.lines.map((line, index) => {
    const item = menu(documents.menuItems[index].data());
    if (!item?.isAvailable) throw new CheckoutError("ITEM_UNAVAILABLE", 409, "One of your items is sold out. Refresh your cart.");
    const groups = item.modifierGroups ?? []; const validOptions = groups.flatMap((group) => group.options);
    const selectedOptions = line.optionIds.map((id) => validOptions.find((option) => option.id === id)).filter((option): option is Option => Boolean(option));
    if (selectedOptions.length !== line.optionIds.length) throw new CheckoutError("INVALID_OPTION", 409, "An item choice is no longer available.");
    for (const group of groups) { const count = selectedOptions.filter((option) => group.options.some((allowed) => allowed.id === option.id)).length; if (count < group.min || count > group.max) throw new CheckoutError("INVALID_MODIFIER_SELECTION", 409, `Check your ${group.name} choice.`); }
    const unitPricePesewas = item.pricePesewas + selectedOptions.reduce((sum, option) => sum + (int(option.priceAdjustmentPesewas) ?? 0), 0);
    return { menuItemId: line.menuItemId, name: item.name, quantity: line.quantity, unitPricePesewas, lineTotalPesewas: unitPricePesewas * line.quantity, selectedOptions, capacityUnits: (item.capacityUnits ?? 1) * line.quantity };
  });
  const preorderCapacityUnits = lines.reduce((sum, line) => sum + line.capacityUnits, 0);
  if (input.fulfilment.type === "PREORDER") { const liveSlot = slot(documents.slot?.data()); if (!liveSlot?.isOpen || (liveSlot.reservedCapacity ?? 0) + preorderCapacityUnits > liveSlot.totalCapacity) throw new CheckoutError("SLOT_UNAVAILABLE", 409, "That delivery window has just filled up. Choose another one."); }
  const subtotalPesewas = lines.reduce((sum, line) => sum + line.lineTotalPesewas, 0);
  return { currency: "GHS", subtotalPesewas, deliveryFeePesewas: deliveryLocation.deliveryFeePesewas, totalPesewas: subtotalPesewas + deliveryLocation.deliveryFeePesewas, deliveryLocation: { id: input.delivery.locationId, name: deliveryLocation.name }, fulfilment: input.fulfilment, preorderCapacityUnits, lines };
}

/** Recalculates a cart from canonical Firestore documents; never trust browser prices or names. */
export async function quoteCheckout(input: CheckoutInput, firestore: Firestore = adminDb): Promise<ServerQuote> {
  if (!checkoutRuntimeReady()) throw new CheckoutError("CHECKOUT_NOT_CONFIGURED", 503, "Checkout is being configured. Please try again later.");
  return calculateQuote(input, await readDocuments(input, (path) => firestore.doc(path).get()));
}

/** Repeats the same reads inside the reservation transaction, closing price and capacity races. */
export async function quoteCheckoutInTransaction(input: CheckoutInput, firestore: Firestore, transaction: Transaction): Promise<ServerQuote> {
  return calculateQuote(input, await readDocuments(input, (path) => transaction.get(firestore.doc(path))));
}
