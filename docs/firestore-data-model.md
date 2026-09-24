# Firestore data model

This is the Phase 1 contract. All client-visible menu reads are public and read-only. Guest checkout, stock reservation, payment verification, staff activity and all order updates are trusted server / Cloud Function operations in Phase 2.

## Core customer collections

| Collection | Key fields | Purpose |
| --- | --- | --- |
| `categories` | `name`, `emoji`, `sortOrder`, `isActive` | Menu grouping. |
| `menuItems` | `name`, `slug`, `categoryId`, `price`, `imageUrl`, `modifierGroupIds`, `recipeId`, `isAvailable`, `prepMinutes`, `capacityUnits` | A sellable dish, drink, combo or snack. Price values are GHS decimals in display models; server uses pesewas for payment arithmetic. |
| `modifiers` | `name`, `selectionType`, `min`, `max`, `options[]`, `isActive` | Protein, spice, extras and add-on choices. Snapshot selected options onto the order. |
| `preorderSlots` | `serviceDate`, `startsAt`, `endsAt`, `totalCapacity`, `reservedCapacity`, `deliveryCapacity`, `isOpen` | Time-window capacity. Available capacity is calculated by trusted code as the minimum kitchen, inventory and delivery capacity. |
| `deliveryLocations` | `name`, `campusId`, `deliveryFeePesewas`, `isActive`, `sortOrder` | Campus-native halls and hostels—not generic maps addresses. |
| `orders` | `orderNumber`, `trackingToken`, `customerSnapshot`, `items[]`, `totals`, `delivery`, `orderType`, `preorderSlotId`, `paymentStatus`, `fulfillmentStatus`, `deliveryPinHash`, `createdAt` | Immutable transactional order snapshot. Store only operational guest details required for the order. |
| `payments` | `orderId`, `provider`, `providerReference`, `amountPesewas`, `currency`, `status`, `verifiedAt`, `rawEventRef` | One or more payment attempts per order; webhook verification is authoritative. |
| `promotions` | `code`, `type`, `value`, `startsAt`, `endsAt`, `eligibility`, `usageLimit`, `isActive` | Controlled promos and scheduled offers. |
| `settings/public` | `acceptingOrders`, `asapEnabled`, `minimumOrderPesewas`, `notice`, `supportPhone` | Safe student-visible operational settings. |

## Operations and ERP collections

| Collection | Key fields | Purpose |
| --- | --- | --- |
| `staff` | `authUid`, `displayName`, `roleIds`, `isActive`, `locationIds` | Firebase Auth identity only for staff. No customer identities are stored here. |
| `roles` | `name`, `permissions[]`, `scope` | Default-deny role/permission policy. |
| `inventoryItems` | `name`, `sku`, `unit`, `onHand`, `reserved`, `reorderPoint`, `averageCostPesewas`, `locationId` | Ingredient, drink, packaging or consumable stock. `available = onHand - reserved`. |
| `recipes` | `menuItemId`, `ingredients[]`, `yieldQuantity`, `version`, `isActive` | Ingredient consumption per sellable unit. Keep versioned snapshots on orders/production records. |
| `stockMovements` | `inventoryItemId`, `type`, `quantity`, `unitCostPesewas`, `referenceType`, `referenceId`, `performedBy`, `createdAt` | Append-only stock ledger: receive, reserve, release, consume, waste, adjustment, transfer. |
| `riders` | `staffId`, `phone`, `availability`, `currentBatchId`, `isActive` | Delivery staff extension. |
| `deliveryBatches` | `locationId`, `orderIds`, `riderId`, `status`, `startedAt`, `completedAt` | Nearby delivered orders grouped for dispatch. |
| `suppliers` | `name`, `contacts[]`, `itemsSupplied`, `isActive` | Vendor master record. |
| `purchaseOrders` | `supplierId`, `status`, `items[]`, `expectedAt`, `receivedAt`, `createdBy` | Procurement lifecycle: draft → sent → partial → received/cancelled. |
| `auditLogs` | `actorId`, `action`, `entityType`, `entityId`, `before`, `after`, `requestId`, `createdAt` | Append-only sensitive-operation record. Avoid recording payment credentials or unnecessary customer data. |

## Order state contract

`paymentStatus`: `PENDING`, `SUCCESSFUL`, `FAILED`, `ABANDONED`, `REFUNDED`.

`fulfillmentStatus` normal path:

`AWAITING_PAYMENT → PAYMENT_CONFIRMED → CONFIRMED → SCHEDULED/QUEUED_FOR_KITCHEN → PREPARING → READY_FOR_PACKING → PACKING → PACKED → AWAITING_DISPATCH → RIDER_ASSIGNED → OUT_FOR_DELIVERY → DELIVERED`

Exceptions: `PAYMENT_FAILED`, `CANCELLED`, `DELIVERY_FAILED`, `CUSTOMER_UNREACHABLE`, `REFUND_PENDING`, `REFUNDED`.

Only trusted backend code can change payment, inventory reservation, capacity or fulfillment state. Every state transition should append an order event, update its staff-visible queue index, and create an `auditLogs` entry when it is a staff or financial action.

## Required trusted checkout transaction

1. Validate menu, modifiers, price, delivery zone and slot server-side.
2. Atomically reserve preorder capacity and stock (or return a live availability error).
3. Create an order at `AWAITING_PAYMENT` with an idempotency key.
4. Initialize Paystack through server-only code.
5. Verify the Paystack webhook signature; independently re-verify the transaction.
6. Mark payment successful, then move the order into the kitchen queue. Release reservations on failure/expiry/cancellation.

## Admin portal additions

See [admin-portal.md](admin-portal.md). These are the only new or changed shapes. Order, payment and inventory contracts are unchanged.

| Collection | Fields | Notes |
| --- | --- | --- |
| `staff/{authUid}` | `authUid`, `displayName`, `roleIds[]`, `isActive` | Document ID **must** equal the Firebase Auth UID. Inactive means no access. |
| `roles/{roleId}` | `name`, `permissions[]`, `isActive` | Permissions: `dashboard.read`, `menu.read`, `menu.write`, `promotions.read`, `promotions.write`, `settings.read`, `settings.write`, `uploads.write`. |
| `menuItems/{id}` | adds `isArchived`, `imagePath`, `modifierGroupIds[]`, `modifierGroups[]` snapshot (with `priceAdjustmentPesewas`), `sortOrder` | Written only by the admin API. `pricePesewas` is an integer. No staff UID is stored on public documents. |
| `menuItemSlugs/{slug}` | `menuItemId` | Reservation document that makes slugs unique atomically. Server-only. |
| `promotions/{id}` (homepage) | `kind: "homepage"`, `title`, `subtitle`, `priceLabel`, `targetMenuItemId`, `imageUrl`, `imagePath`, `startsAt`, `endsAt` (nullable), `isActive`, `priority` | At most one active; activating one pauses the others in the same transaction. Only `kind == "homepage" && isActive` is publicly readable. |
| `settings/public` | `acceptingOrders`, `asapEnabled`, `notice`, `supportPhone` (E.164) | The admin portal merges only these four fields. |
| `auditLogs/{id}` | `actorType: "staff"`, `actorId`, `action`, `entityType`, `entityId`, `before`, `after`, `requestId`, `createdAt` | Written in the same transaction as the change. `before` and `after` are whitelisted safe snapshots. |
