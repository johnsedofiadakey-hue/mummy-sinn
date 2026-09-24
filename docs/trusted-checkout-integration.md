# Trusted checkout integration

The student PWA never writes orders, payments, preorder slots or inventory directly. This server boundary is the start of the live order engine.

## Implemented now

- `POST /api/orders/quote` parses untrusted browser input and rejects malformed idempotency keys, cart lines, modifier selections, delivery details, Ghana mobile numbers and Mobile Money details.
- The quote reads canonical Firestore menu, settings, delivery-location and preorder-slot records. It recalculates all prices in pesewas, rejects unavailable dishes, validates required/maximum modifiers, checks kitchen/ASAP status, and checks a preorder slot’s current capacity.
- `GET /api/checkout/status` reports only whether Firebase Admin credentials are present. It reveals no configuration values or secrets.
- `POST /api/orders` repeats the quote inside a Firestore transaction, creates one idempotent pending order, and holds preorder capacity for 12 minutes.
- `POST /api/payments/initialize` starts a Paystack checkout only for a valid pending order and returns its secure authorization URL.
- `POST /api/payments/paystack/webhook` verifies the raw Paystack signature, independently verifies the transaction, then moves only a confirmed payment into the kitchen-ready order state.
- `POST /api/internal/expire-reservations` is scheduler-only and releases expired unpaid preorder holds.
- `GET /api/orders/track/{trackingToken}` returns the token-authorized student tracking view, without payment data, phone number or internal order records.

Neither endpoint enables live ordering by itself. The browser does not call them until Firebase content, trusted order creation and Paystack configuration are complete.

## Canonical Firestore fields needed for checkout

These fields are server-side amounts and must be stored as integer pesewas—not decimal GHS floats.

```text
settings/public
  acceptingOrders: boolean
  asapEnabled: boolean

menuItems/{menuItemId}
  name: string
  isAvailable: boolean
  pricePesewas: integer
  capacityUnits: integer (default 1)
  modifierGroups: [{
    id, name, min, max,
    options: [{ id, name, priceAdjustmentPesewas }]
  }]

deliveryLocations/{locationId}
  name: string
  isActive: boolean
  deliveryFeePesewas: integer

preorderSlots/{slotId}
  isOpen: boolean
  serviceDate: YYYY-MM-DD
  startsAt: HH:mm
  endsAt: HH:mm
  totalCapacity: integer
  reservedCapacity: integer
```

## Required next server operations

1. **Atomic create/reserve transaction.** Re-read the quote inputs within one Firestore transaction, create one pending order keyed by the idempotency key, then reserve the required preorder capacity and (when enabled) recipe inventory. A failed/expired payment must release these holds.
2. **Paystack initialization.** Start the transaction only after the order/reservation succeeds. Paystack’s backend initialization endpoint uses the amount in subunits and a server-only secret key; do not expose it to the PWA.
3. **Webhook verification.** Verify the raw body’s `x-paystack-signature` with HMAC SHA-512, independently verify the Paystack transaction amount/reference, and make successful delivery-to-kitchen processing idempotent.
4. **Tracking read route.** Look up by a hash of the unguessable tracking token; return only the safe order fields needed by the student.
5. **Reservation expiry.** Schedule a trusted job to release unpaid slot/stock holds and mark abandoned payment attempts. Do not rely on a browser timer.

## Receipt email

The checkout screen now includes an email-for-receipt field. It is deliberately not retained as a browser “remember me” detail. It becomes required only when `DEMO_MODE` is turned off for the live Paystack flow; no fallback or invented email address is used.

## Live configuration still required

Set the Firebase Admin variables, `PAYSTACK_SECRET_KEY`, `INTERNAL_TASK_SECRET`, and the public HTTPS `NEXT_PUBLIC_APP_URL` in Firebase App Hosting. Add the Paystack webhook URL:

```text
https://YOUR_DOMAIN/api/payments/paystack/webhook
```

Then schedule the reservation-expiry endpoint with a trusted scheduler carrying `Authorization: Bearer INTERNAL_TASK_SECRET`. Do not expose this secret to the browser.

## Safe local checks

```bash
# No Firebase Admin credentials: expected 503 and {"ready":false}
curl http://localhost:3000/api/checkout/status

# Malformed client payload: expected 400, before any Firestore read
curl -X POST http://localhost:3000/api/orders/quote \
  -H 'content-type: application/json' \
  --data '{"idempotencyKey":"invalid"}'
```
