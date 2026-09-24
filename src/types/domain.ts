export type OrderType = "ASAP" | "PREORDER";
export type PaymentStatus = "PENDING" | "SUCCESSFUL" | "FAILED" | "ABANDONED" | "REFUNDED";
export type FulfillmentStatus =
  | "AWAITING_PAYMENT" | "PAYMENT_CONFIRMED" | "CONFIRMED" | "SCHEDULED"
  | "QUEUED_FOR_KITCHEN" | "PREPARING" | "READY_FOR_PACKING" | "PACKING"
  | "PACKED" | "AWAITING_DISPATCH" | "RIDER_ASSIGNED" | "OUT_FOR_DELIVERY"
  | "DELIVERED" | "PAYMENT_FAILED" | "CANCELLED" | "DELIVERY_FAILED"
  | "CUSTOMER_UNREACHABLE" | "REFUND_PENDING" | "REFUNDED";

export interface Category { id: string; name: string; emoji: string; sortOrder: number; isActive: boolean; }
export interface ModifierOption { id: string; name: string; priceAdjustment: number; isDefault?: boolean; }
export interface ModifierGroup { id: string; name: string; required: boolean; min: number; max: number; options: ModifierOption[]; }
export interface MenuItem {
  id: string; slug: string; name: string; description: string; price: number; categoryId: string;
  imageUrl: string; prepMinutes: number; rating?: number; badge?: string; isAvailable: boolean;
  modifierGroups: ModifierGroup[]; tags?: string[];
}
export interface CartLine {
  id: string; menuItem: MenuItem; quantity: number; selectedOptions: ModifierOption[]; note?: string;
  orderType: OrderType; preorderSlotId?: string;
}
export interface PreorderSlot {
  id: string; serviceDate: string; label: string; startsAt: string; endsAt: string;
  availableCapacity: number; totalCapacity: number; isOpen: boolean;
}
export interface DeliveryDetails { name: string; phone: string; locationId: string; block: string; roomOrLandmark: string; instructions?: string; }
export interface PaymentIntentInput { orderId: string; email?: string; amountPesewas: number; phone: string; channel: "mobile_money" | "card"; }
export interface PaymentIntent { reference: string; authorizationUrl?: string; status: "pending"; }
