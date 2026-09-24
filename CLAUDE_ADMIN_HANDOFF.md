# Mummy's Inn — Admin Portal Build Handoff

## Mission

Build the first secure, usable **Mummy's Inn Admin Portal** in this existing Next.js 15 + TypeScript + Tailwind + Firebase repository. It must let authorised staff manage the public catalog and homepage promotion without giving customers an account or weakening any existing financial, order, inventory, or payment boundaries.

## Non-negotiable boundaries

- **Students remain guest-only.** Do not add customer login, profiles, Firebase customer Auth, or customer identity collections.
- Admin access is staff-only and must use Firebase Auth. Do not use a front-end-only password check.
- Enforce authorisation on the server for every admin mutation. UI hiding is not authorisation.
- Use a default-deny role model based on `staff/{authUid}` and `roles` documents. An inactive staff member must have no access.
- Do not expose Firebase Admin credentials, service-account material, Paystack secret keys, webhook secrets, or any private keys in browser code or source control.
- Do not loosen guest Firestore rules to make the portal work. Keep guest catalog reads read-only and operational/financial data inaccessible to browsers.
- Do not build direct browser writes for orders, payments, stock reservations, capacity, fulfilment, delivery batches, or audit logs. These stay trusted-server operations.
- Preserve existing guest routes and `DEMO_MODE`. Do not claim that a real payment occurs.

## Scope for this slice

Create a staff-admin surface at `/admin` with these modules:

1. **Sign in / access gate**
   - Firebase email/password sign-in for staff only.
   - Signed-in staff identity loaded from `staff/{uid}`.
   - Block missing/inactive/unauthorised staff with a clear access-denied state and sign-out action.
   - Route guard and server mutation guard.

2. **Dashboard**
   - Operational snapshot using only safe, authorised data: open/closed ordering state, active menu count, unavailable menu count, active promotion state, and next preorder-slot capacity.
   - Keep this read-only in the first slice; do not expose customer delivery details as dashboard samples.

3. **Menu manager**
   - List categories and menu items.
   - Create/edit/archive a menu item with name, slug, description, category, GHS price, prep time, availability, badge, image URL, and modifier-group selection.
   - Validate all input server-side. Price arithmetic must use pesewas in writes, even if the UI shows GHS.
   - Prevent accidental slug collision.
   - Record every write in `auditLogs` with actor UID, action, entity information, before/after safe snapshots, and request ID.

4. **Image upload**
   - Upload images only through an authorised server route/action to Firebase Storage.
   - Restrict file type, file size, path, and filename generation. Do not trust client-supplied paths.
   - Store the resulting delivery URL/path against the menu item only after upload succeeds.
   - Add Storage rules that deny public writes and permit reads only for the intended public food-image path. Do not create a broad public bucket.

5. **Homepage promotion manager**
   - Create/edit/pause one active homepage promotion.
   - Fields: title, subtitle, price label, target menu item, image, active date window, active state, sort/priority.
   - Ensure the student Home page reads this promotion from the safe public Firebase document with a graceful static fallback while no promotion is configured.

6. **Settings**
   - Staff with `settings.write` can change safe public settings only: `acceptingOrders`, `asapEnabled`, public notice, and support phone.
   - Each change requires server validation and an audit entry.

## Recommended structure

```text
src/app/admin/
  page.tsx                       # protected dashboard
  sign-in/page.tsx
  menu/page.tsx
  menu/new/page.tsx
  menu/[id]/page.tsx
  promotions/page.tsx
  settings/page.tsx
src/app/api/admin/
  session/
  menu-items/
  menu-items/[id]/
  promotions/
  settings/
  uploads/
src/lib/admin/
  permissions.ts                 # server-side default deny
  validation.ts
  repository.ts                  # trusted server reads/writes
src/components/admin/
```

You may choose equivalent route/action conventions, but keep client components thin and use server-only Firebase Admin SDK access for authorisation and writes.

## Data contracts

Existing intended Firestore collections are documented in `docs/firestore-data-model.md`. Continue to use:

- `categories`, `menuItems`, `modifiers`, `promotions`, `preorderSlots`, `deliveryLocations`, `settings/public`
- `staff`, `roles`, `auditLogs`

Add only the minimum fields necessary for a safe promotion document. Do not change order/payment/inventory contracts in this task.

## Required delivery checklist

- No secrets committed. Update `.env.example` only with public identifiers or variable names, never values.
- Add clearly documented staff bootstrap instructions that require Firebase Console/project-owner action to create the first Auth staff user and corresponding `staff/{uid}` role document.
- Add Firestore and Storage rules. Do not deploy them automatically.
- Add tests or executable checks for permission denial, invalid menu data, slug collision, upload validation, and inactive staff.
- Run `npm run typecheck` and `npm run build`.
- Preserve the current mobile student PWA and verify Home, Menu, Cart, Checkout, and Orders still build.
- Report code changes, test results, Firestore/Storage rules changes, and any remaining production prerequisites separately.

## Acceptance criteria

An authorised administrator can sign in, create or change a menu item, upload its food image, toggle availability, change the homepage promotion, and change the kitchen-open setting. The Home screen reflects published catalog/promotion/settings changes safely. A guest, an inactive staff member, or a non-permitted staff member cannot read or mutate admin records. Every admin write produces an audit record.
