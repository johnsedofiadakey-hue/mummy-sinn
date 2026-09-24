# Claude handoff — reserved for later independent QA review

The student UI is owned by Codex. Keep this optional handoff for a later independent QA review only; it must not change Firebase security rules, Admin SDK code, payment interfaces, data-model contracts, deployment configuration, or secrets.

## Copy-ready prompt

```text
You are collaborating on an existing Next.js/TypeScript/Tailwind student campus-food PWA called Mummy's Inn.

Repository: /Users/truth/Developer/mummys-inn-campus-pwa

Product context:
- It is a delivery-only campus kitchen, not a dine-in restaurant.
- Students order as guests. There are no customer accounts, profiles, Firebase Auth or sign-in flows.
- The flow is Food → time (ASAP or preorder) → hall/hostel delivery details → payment → tracking.
- Staff/admin authentication, payment verification, Firestore writes, capacity reservations and inventory logic are intentionally future trusted-server work. Do not weaken these boundaries.

Your scope is only the student PWA interface quality and a practical QA plan.

First, inspect the codebase, especially:
- src/app/page.tsx
- src/app/menu/page.tsx
- src/app/menu/[slug]/page.tsx
- src/app/preorder/page.tsx
- src/app/cart/page.tsx
- src/app/checkout/page.tsx
- src/app/orders/[id]/page.tsx
- src/components/
- README.md and docs/firestore-data-model.md

Then deliver:
1. A concise screen-by-screen UX audit focused on one-thumb usability, student comprehension, Ghanaian payment expectations, touch targets, visual hierarchy, guest privacy, empty/error states, accessibility and weak-network resilience.
2. A prioritized implementation plan with P0/P1/P2 items. Clearly distinguish a visual suggestion from a production/blocking requirement.
3. A manual test matrix covering ASAP, preorder slot availability, cart edits, delivery address validation, mobile money/card selection, payment failure/recovery, browser reload, duplicate-tap protection, tracking access, and offline/poor-network behavior.
4. If you recommend code changes, provide minimal patch suggestions only for the student UI. Do not implement backend/payment/Firebase changes and do not add customer accounts.

Acceptance standard:
- Preserve the lively, layered, app-like mobile visual direction.
- Preserve large touch targets, sticky CTAs, bottom navigation and quick scanning.
- Do not substitute generic ecommerce patterns for campus-specific hall/block/room delivery.
- Do not claim that the demo checkout has real payment or real-time tracking.
```

## What to return to Codex

Ask Claude to return its P0/P1/P2 list and test matrix as Markdown. Codex can then implement the approved UI-only changes while preserving the Firebase and payment boundary.
