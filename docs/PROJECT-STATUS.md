# Mummy's Inn — project status

## Project location

`/Users/truth/Developer/mummys-inn-campus-pwa`

## Completed: Phase 1 foundation

- Next.js, TypeScript, Tailwind and PWA setup.
- Firebase Hosting/App Hosting-compatible config plus Firebase client/Admin placeholders.
- Guest-only student PWA: Home, Menu, Product Detail, preorder slots, Cart, Checkout and Order Tracking.
- ASAP and preorder choices.
- Paystack provider interface with server-only integration boundary.
- Firestore collection contract, indexes, secure public-read rules and complete order state model.
- Local sample data, production build and type-check passing.

## Not live yet

- No Firebase project/configuration has been connected.
- No deployment has occurred.
- No real menu, locations, prices, operating windows, delivery fees or food imagery have been supplied.
- Checkout is an interface demonstration only; it does not create a Firestore order, reserve a slot/stock, or take payment.
- The order tracking page is a presentation model, not a real-time order feed.

## Recommended work split

| Owner | Workstream | Why it is isolated |
| --- | --- | --- |
| Codex | Student PWA UI/UX, Firebase integration and trusted order engine | One owner maintains the approved visual direction while also protecting the security-critical payment, Firestore and capacity boundaries. |
| Claude | Not assigned | The student UI is intentionally owned by Codex. A later independent QA review is optional only after the UI is feature-complete. |
| John / Mummy's Inn | Operational inputs | The product needs confirmed campus, delivery zones, hours, menu, pricing, fulfilment timing, Paystack account and delivery rules before live checkout can be activated. |

## Next milestone: trusted guest checkout

1. Create and configure the Firebase project and environment values.
2. Seed real public menu, categories, delivery locations and operating settings.
3. Implement server-side quote validation and an idempotent `createOrder` path.
4. Atomically reserve preorder capacity and inventory.
5. Integrate Paystack initialization and webhook verification through server-only code.
6. Expose a privacy-safe tokenized tracking route and live state updates.
7. Test success, failed, abandoned and duplicate-payment recovery paths before release.

## Later product phases

1. Kitchen queue and packing view.
2. Dispatch batches and rider PWA.
3. Staff Firebase Auth and default-deny role permissions.
4. Admin menu/operations portal.
5. Inventory, recipes, purchasing, suppliers and stock movement ledger.
