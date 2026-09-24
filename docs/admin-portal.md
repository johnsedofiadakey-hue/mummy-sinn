# Staff admin portal

`/admin` is a staff-only surface for the public catalog, the homepage promotion and the kitchen's public settings. Students remain guest-only: nothing here adds customer accounts, and no guest route changed its behaviour.

## How access works

| Layer | What it does |
| --- | --- |
| Firebase Auth (email/password) | Staff sign in on `/admin/sign-in`. The browser keeps no Firebase session (`inMemoryPersistence`); it exchanges one fresh ID token for a cookie and signs out locally. |
| `POST /api/admin/session` | Verifies the ID token (fresh sign-in, not revoked), then loads `staff/{uid}` and its `roles`. **Only active staff with at least one active role get a cookie.** |
| Session cookie `__session` | httpOnly, `SameSite=Strict`, `Secure` in production, 8-hour lifetime. It's named `__session` because Firebase Hosting/App Hosting forward only that cookie. |
| Every page and API call | Re-verifies the cookie (including revocation) and re-reads `staff/{uid}` + roles, so deactivating someone cuts them off on their next click. Each page checks its own permission because layouts don't re-run on client navigation. |
| Mutations | Same-origin check (`Origin` + `Sec-Fetch-Site`), then the permission, then server-side validation, then a Firestore transaction that also writes the `auditLogs` entry. |
| Sign out | Clears the cookie and revokes the user's refresh tokens, which invalidates their session cookies everywhere. |

Authorisation is **default deny** (`src/lib/admin/permissions.ts`). Unknown permission strings, missing or inactive roles, inactive staff, and a `staff` document whose `authUid` doesn't match all grant nothing. There's no wildcard.

### Permissions

| Permission | Allows |
| --- | --- |
| `dashboard.read` | Dashboard snapshot (counts and states only, no customer data). |
| `menu.read` / `menu.write` | View / create, edit, archive and toggle dishes. |
| `promotions.read` / `promotions.write` | View / create, edit, pause and activate the homepage promotion. |
| `settings.read` / `settings.write` | View / change `acceptingOrders`, `asapEnabled`, public notice, support phone. |
| `uploads.write` | Upload images. Also needs `menu.write` (dish photos) or `promotions.write` (promotion images). |

Suggested roles: **owner** gets all eight. **kitchen-lead** gets `dashboard.read`, `menu.read`, `menu.write`, `uploads.write`, `settings.read` and `settings.write`. **viewer** gets `dashboard.read` and `menu.read`.

## Bootstrapping the first staff member (project owner, Firebase Console)

The app never creates staff or roles for you. A project owner does this once:

1. **Enable Email/Password sign-in:** Firebase Console → Authentication → Sign-in method → Email/Password → Enable. Leave "Email link" off.
2. **Create the staff login:** Authentication → Users → Add user, with the staff member's work email and a strong password. Copy the **User UID**.
3. **Create the role:** Firestore → Start collection `roles` → Document ID `owner`:
   ```text
   name:        "Owner"                (string)
   isActive:    true                   (boolean)
   permissions: ["dashboard.read", "menu.read", "menu.write", "promotions.read",
                 "promotions.write", "settings.read", "settings.write", "uploads.write"]   (array of strings)
   ```
4. **Create the staff record:** Collection `staff` → Document ID = **the User UID from step 2**:
   ```text
   authUid:     "<the same UID>"       (string)
   displayName: "Ama Mensah"           (string)
   roleIds:     ["owner"]              (array of strings)
   isActive:    true                   (boolean)
   ```
5. Sign in at `/admin/sign-in`.

To remove someone, set `staff/{uid}.isActive` to `false`. They lose access on their next request. You can also disable the user in Authentication.

## Server configuration

The admin routes use the Firebase Admin SDK, server-side only.

- **Firebase App Hosting / Cloud Run:** Application Default Credentials work automatically. Set `FIREBASE_STORAGE_BUCKET` (e.g. `mummy-sinn.firebasestorage.app`). The service account needs Firestore, Firebase Auth admin and Storage object admin access.
- **Local development:** run `gcloud auth application-default login` and set `GOOGLE_CLOUD_PROJECT=mummy-sinn` in `.env.local`. Alternatively, set `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL` and `FIREBASE_ADMIN_PRIVATE_KEY` (never commit them).
- **Firebase Storage** must be enabled for the project (Console → Storage). New default buckets require the Blaze plan.

Without Admin credentials, `/admin` shows "not connected", and the student app keeps using its bundled sample data.

## Seeding the catalog (optional, project owner)

The admin portal manages dishes but not categories or option groups yet. To load the current sample catalog into an empty project:

```bash
GOOGLE_CLOUD_PROJECT=mummy-sinn npx tsx scripts/seed-catalog.mts --project mummy-sinn --confirm
```

It only creates documents that don't exist, so it's safe to re-run, and it never touches staff, roles, orders or payments.

## What students see

`src/lib/public-content.ts` reads the catalog, `settings/public` and the live homepage promotion server-side, and exposes only display fields. Admin writes call `revalidateTag("public-content")`. Otherwise pages refresh within 60 seconds. With Firestore unconfigured, empty or unreachable, the student app falls back to its bundled sample catalog and built-in hero.

**Wired so far:** Home (promotion, catalog, kitchen state), Menu, and the dish page. **Still on sample data:** Cart re-quote, Checkout's delivery-hall list and fees, product-page "kitchen closed" state, and preorder slots. The trusted server quote (`src/lib/server/catalog-quote.ts`) already reads Firestore, so those screens are the next integration step.

## Rules

- `firestore.rules`: guest reads unchanged, except that promotions are now public only when `kind == "homepage"` and active. Promo-code promotions stay private. `staff`, `roles`, `auditLogs` and `menuItemSlugs` are explicitly closed to all browsers, including signed-in staff.
- `storage.rules`: browsers may read only `public/menu-images/<uuid>.<jpg|png|webp>` and `public/promotions/<uuid>.<…>`, and nothing may be written from a browser.

These rules are **not deployed automatically.** After review:

```bash
firebase deploy --only firestore:rules,storage --project mummy-sinn
```

## Tests

| Command | Covers |
| --- | --- |
| `npm test` | Unit: default-deny permissions, inactive and mismatched staff, invalid menu data, GHS→pesewas, promotion windows, settings, upload type, size and signature checks, path generation. |
| `npm run test:emulator` | Auth, Firestore and Storage emulators on a `demo-` project: real session cookies, inactive staff, revocation, forbidden permissions, slug collisions (including seeded items), audited writes, single active promotion, Firestore and Storage rules. |
| `npm run test:e2e` | After `npm run build`: runs `next start` against the emulators and drives the HTTP API end to end, covering guest and cross-origin denial, the viewer role, create, upload, availability, promotion and kitchen-closed shown on Home, audit log and sign-out. |

The emulator tests need Java 21+. Put `openjdk@21` first on your `PATH`, e.g. `export PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH`.
