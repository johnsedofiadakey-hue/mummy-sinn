"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartLine, MenuItem, ModifierOption } from "@/types/domain";
import { menuItems, publicSettings } from "@/lib/mock-data";
import { findSlot, localDay, slotState } from "@/lib/slots";
import { readJson, writeJson } from "@/lib/device-storage";

/** One delivery time per order: the data model has a single orderType/preorderSlotId per order. */
export type Fulfilment = { type: "ASAP" } | { type: "PREORDER"; slotId: string; label: string; chosenOn: string };
export type RequoteResult = { priceChanged: string[]; removed: string[] };

type CartContextValue = {
  lines: CartLine[]; count: number; subtotal: number; hydrated: boolean; fulfilment: Fulfilment;
  setFulfilment: (fulfilment: Fulfilment) => void;
  add: (item: MenuItem, selectedOptions: ModifierOption[], quantity: number) => void;
  updateQuantity: (id: string, quantity: number) => void;
  remove: (id: string) => void; undoRemove: () => void; lastRemoved: CartLine | null;
  requote: () => RequoteResult; clear: () => void;
};
type SavedCart = { lines: CartLine[]; fulfilment: Fulfilment };

const KEY = "mi-cart-v2";
const CartContext = createContext<CartContextValue | null>(null);
const linePrice = (line: CartLine) => line.menuItem.price + line.selectedOptions.reduce((sum, option) => sum + option.priceAdjustment, 0);
const optionKey = (options: ModifierOption[]) => options.map((option) => option.id).sort().join("|");
const withFulfilment = (line: CartLine, fulfilment: Fulfilment): CartLine => ({ ...line, orderType: fulfilment.type, preorderSlotId: fulfilment.type === "PREORDER" ? fulfilment.slotId : undefined });

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [fulfilment, setFulfilmentState] = useState<Fulfilment>({ type: "ASAP" });
  const [hydrated, setHydrated] = useState(false);
  const [removed, setRemoved] = useState<{ line: CartLine; index: number } | null>(null);

  useEffect(() => {
    const saved = readJson<SavedCart>("local", KEY);
    if (saved && Array.isArray(saved.lines)) setLines(saved.lines);
    if (saved?.fulfilment) setFulfilmentState(saved.fulfilment);
    setHydrated(true);
    // Keep tabs in step: an order placed in one tab empties the cart in the others.
    const sync = (event: StorageEvent) => {
      if (event.key !== KEY) return;
      const next = readJson<SavedCart>("local", KEY);
      setLines(next?.lines ?? []); setFulfilmentState(next?.fulfilment ?? { type: "ASAP" });
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => { if (hydrated) writeJson("local", KEY, { lines, fulfilment } satisfies SavedCart); }, [lines, fulfilment, hydrated]);

  const setFulfilment = useCallback((next: Fulfilment) => { setFulfilmentState(next); setLines((current) => current.map((line) => withFulfilment(line, next))); }, []);

  /** Refresh stored snapshots against the current catalogue. The server still re-prices at order time. */
  const requote = useCallback((): RequoteResult => {
    const result: RequoteResult = { priceChanged: [], removed: [] };
    const next: CartLine[] = [];
    for (const line of lines) {
      const current = menuItems.find((item) => item.id === line.menuItem.id);
      if (!current || !current.isAvailable) { result.removed.push(line.menuItem.name); continue; }
      const options = line.selectedOptions.map((option) => current.modifierGroups.flatMap((group) => group.options).find((entry) => entry.id === option.id)).filter((option): option is ModifierOption => Boolean(option));
      if (current.price !== line.menuItem.price || optionKey(options) !== optionKey(line.selectedOptions) || options.some((option, i) => option.priceAdjustment !== line.selectedOptions[i]?.priceAdjustment)) result.priceChanged.push(current.name);
      next.push({ ...line, menuItem: current, selectedOptions: options });
    }
    if (result.priceChanged.length || result.removed.length) setLines(next);
    return result;
  }, [lines]);

  const value = useMemo<CartContextValue>(() => ({
    lines, fulfilment, hydrated, setFulfilment, requote, lastRemoved: removed?.line ?? null,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: lines.reduce((sum, line) => sum + linePrice(line) * line.quantity, 0),
    add: (menuItem, selectedOptions, quantity) => setLines((current) => {
      const match = current.find((line) => line.menuItem.id === menuItem.id && optionKey(line.selectedOptions) === optionKey(selectedOptions));
      if (match) return current.map((line) => line.id === match.id ? { ...line, quantity: line.quantity + quantity } : line);
      return [...current, withFulfilment({ id: crypto.randomUUID(), menuItem, selectedOptions, quantity, orderType: "ASAP" }, fulfilment)];
    }),
    updateQuantity: (id, quantity) => {
      if (quantity < 1) { const index = lines.findIndex((line) => line.id === id); if (index >= 0) setRemoved({ line: lines[index], index }); }
      setLines((current) => quantity < 1 ? current.filter((line) => line.id !== id) : current.map((line) => line.id === id ? { ...line, quantity } : line));
    },
    remove: (id) => {
      const index = lines.findIndex((line) => line.id === id);
      if (index >= 0) setRemoved({ line: lines[index], index });
      setLines((current) => current.filter((line) => line.id !== id));
    },
    undoRemove: () => {
      if (!removed) return;
      setLines((current) => { const next = [...current]; next.splice(Math.min(removed.index, next.length), 0, withFulfilment(removed.line, fulfilment)); return next; });
      setRemoved(null);
    },
    clear: () => { setLines([]); setRemoved(null); setFulfilmentState({ type: "ASAP" }); },
  }), [lines, fulfilment, hydrated, setFulfilment, requote, removed]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => { const context = useContext(CartContext); if (!context) throw new Error("useCart must be used within CartProvider"); return context; };
export const cartLinePrice = linePrice;

/** Why the chosen delivery time can't be used right now, or null when it's fine. */
export function fulfilmentProblem(fulfilment: Fulfilment, now: Date): string | null {
  if (fulfilment.type === "ASAP") return publicSettings.asapEnabled ? null : "ASAP delivery is paused right now. Pick a preorder time instead.";
  const slot = findSlot(fulfilment.slotId);
  if (!slot || fulfilment.chosenOn !== localDay(now)) return "Your delivery window has passed. Pick a new time.";
  const state = slotState(slot, now);
  if (state === "full") return "That delivery window just filled up. Pick another time.";
  if (state === "closed") return "Orders for that window have closed. Pick another time.";
  return null;
}
