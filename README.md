# Mummy's Inn — Campus Food PWA

Phase 1 of a delivery-first campus kitchen platform. The student experience is deliberately **guest-only**: students never create an account or use Firebase Auth. They select food, choose ASAP or preorder delivery, provide name/phone/hall/block/room or landmark, pay, and track an order using its reference and locally stored session.

The visual app is mobile-first, installable, and designed as a focused layer over a future Kitchen, Dispatch/Rider, Admin, Inventory and procurement platform.

## What is included

- Next.js 15, TypeScript and Tailwind CSS foundation.
- Firebase Hosting/App Hosting-compatible config.
- Firebase web client and server-only Admin SDK placeholders.
- PWA web manifest and a deliberately small offline app-shell service worker.
- Firebase-safe rules starting point: public menu reads only; all order/payment/operations writes denied to browsers.
- Mobile student screens: Home, Menu, Product customization, preorder slots, cart, checkout and live-style tracking.
- Guest checkout inputs: name, phone, hall/hostel, block, room/landmark and delivery instructions.
- Explicit ASAP/preorder choices and preorder-capacity UI.
- Paystack-ready provider interface with no secret values in browser code.
- Trusted checkout quote API that server-validates prices, modifiers, location, availability and preorder capacity before payment is started.
- Full Phase 1 Firestore data model and order state contract in [docs/firestore-data-model.md](docs/firestore-data-model.md).

## Run locally

Prerequisites: Node.js 20+ and a Firebase project when you are ready to connect live services.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The visual flow currently uses local sample menu and slots, so it stays runnable until Firebase content is configured.

Check the production bundle before a deployment:

```bash
npm run typecheck
npm run build
```

## Firebase configuration

Create a Web app in Firebase and copy its configuration into `.env.local` using the `NEXT_PUBLIC_FIREBASE_*` values in `.env.example`. These browser app identifiers are not secrets; security comes from Firestore, Storage and backend rules.

For trusted server actions and Cloud Functions/App Hosting, configure one of:

- Application Default Credentials (preferred in Firebase-managed server environments); or
- `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, and `FIREBASE_ADMIN_PRIVATE_KEY` locally.

Do **not** put Paystack secret keys, Firebase service-account JSON, webhook secrets, or private keys in `NEXT_PUBLIC_*` values or commit them.

## Deployment

### Firebase App Hosting (recommended for the Next.js app)

1. Create/select the Firebase project.
2. Replace `YOUR_FIREBASE_PROJECT_ID` in `.firebaserc` or run `firebase use --add`.
3. Connect this repository to Firebase App Hosting in the Firebase console and set the environment variables there as server/environment secrets.
4. Deploy through the connected branch workflow.

### Firebase Hosting framework integration

```bash
npm install -g firebase-tools
firebase login
firebase use YOUR_FIREBASE_PROJECT_ID
firebase deploy --only hosting
```

Deploy Firestore rules deliberately and separately, after reviewing them:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

The included rule set intentionally blocks direct guest order writes. Do not loosen it for checkout; implement trusted server routes or Cloud Functions first.

## Trusted checkout foundation

The project now includes a server-only `POST /api/orders/quote` boundary. It calculates the quote from canonical Firestore records rather than trusting browser prices or selected options. Without Firebase Admin credentials it deliberately returns `503` and does not fall back to local sample data.

The integration fields and remaining atomic reservation, payment and webhook work are documented in [docs/trusted-checkout-integration.md](docs/trusted-checkout-integration.md).

The server routes for pending orders, Paystack initialization/webhooks, reservation expiry and token-scoped tracking are present, but they remain inert until the live environment variables and canonical Firestore data are configured. Keep `DEMO_MODE` enabled until the end-to-end test checklist has passed.

## Architecture notes

```text
Student PWA (guest) ──▶ trusted order/payment layer ──▶ Firestore
                                                      ├── Kitchen PWA (staff auth)
                                                      ├── Dispatch/Rider PWA (staff auth)
                                                      └── Admin + Inventory (staff auth)
```

The boundaries are intentional:

- Customer UI only sees public catalog/availability and a safe tracking view.
- Guest personal delivery details are transaction data, not a customer profile.
- The server validates all prices, modifiers, promo eligibility, capacity, stock and payment results.
- Paystack is only initialized and verified server-side. Webhook verification, order creation and stock reservations must be idempotent.
- Operations modules can be added under `src/app/(staff)/` later without sharing student routing or permissions.

## Next implementation milestone

Phase 2 should connect the local sample repositories to Firestore and implement the trusted checkout workflow: create an idempotent pending order, reserve slot/stock in a transaction, initialize Paystack, verify its webhook, then feed only paid orders into the kitchen queue.
