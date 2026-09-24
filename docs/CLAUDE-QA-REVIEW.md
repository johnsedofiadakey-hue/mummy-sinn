# Mummy's Inn student PWA: independent QA review

**Reviewer:** Claude (independent QA, read-only)
**Date:** 2026-09-23
**Scope:** Student guest UI only. No Firebase rules, Admin SDK, payment adapter, data-model, deployment or secret changes are proposed. Every patch below touches `src/app/**`, `src/components/**` or `public/sw.js` only.
**Method:** Full source read of every student route and component, plus a live run at 375×812 (`next dev`).

**Verified live:**
- Choosing Qty 3 on a product produces **3 separate cart lines of qty 1**.
- Hard-loading `/cart` or `/checkout` returns server HTML that says the cart is empty ("Nothing delicious here yet" / "Your cart is empty"), which then flips to the real cart after hydration.
- Most buttons have no accessible name.

**Legend:**
- **[BLOCKER]** is a production/blocking requirement. It must be fixed before real students pay.
- **[UX]** is a correctness or usability fix that matters for launch quality.
- **[VISUAL]** is a visual suggestion only and is optional.

---

## 1. Screen-by-screen audit

### Global shell (`layout.tsx`, `globals.css`, `bottom-nav.tsx`, `public/sw.js`)
| # | Finding | Type |
|---|---|---|
| G1 | `viewport.maximumScale: 1` blocks pinch-zoom. This fails WCAG 1.4.4 and hurts students with low vision or cracked screens. | [BLOCKER] |
| G2 | The service worker is **cache-first for every same-origin GET**, and it never deletes old caches. HTML, RSC payloads and `/orders/*` are frozen at first visit. Once real data exists, students will see stale menus, prices, slot capacity and order status. | [BLOCKER] |
| G3 | The bottom-nav "Orders" tab is hard-coded to `/orders/MI-1042`. Every student lands on the same fake order. | [BLOCKER] (placeholder leak) |
| G4 | Nav labels are 10px, and inactive items use `text-stone-400` on white (about 2.5:1 contrast). No `aria-current`. The cart badge count is not announced. | [UX] |
| G5 | The font is Arial. Brand direction asks for Satoshi/Inter. | [VISUAL] |
| G6 | Icon-only controls have no `aria-label`: back chevrons, bell, trash, +/−, copy PIN. | [UX] |
| G7 | There is no offline or poor-network indicator anywhere. | [UX] |

### Home (`src/app/page.tsx`)
| # | Finding | Type |
|---|---|---|
| H1 | "Good afternoon" is static. It is wrong for most of the day. | [UX] |
| H2 | "Delivering to Pentagon Hostel ⌄" looks like a picker but does nothing. It also implies a saved profile, which conflicts with the guest-only model. It should read the hall the student last chose **on this device** (opt-in), or say "Choose your hall". | [UX] |
| H3 | The bell button has no function. Guests have no notification inbox, so remove it or replace it with "Track order" when a recent order exists on this device. | [UX] |
| H4 | ASAP "25–35 min" is hard-coded. There is no "kitchen closed / not accepting orders / ASAP paused" state, although `settings/public.acceptingOrders` and `asapEnabled` exist in the contract. | [BLOCKER] (UI must render closed state before launch) |
| H5 | The "Campus lunch deal" badge promises a deal that doesn't exist. | [UX] (misleading copy) |
| H6 | The "Quick meals under GHS 30" prices bypass `money()`, so the format is inconsistent: `GHS 28` vs `GHS 28.00`. | [VISUAL] |
| H7 | The search bars are links styled as inputs. That's acceptable on Home. Menu has no real search (see M1). | [UX] |

### Menu (`src/app/menu/page.tsx`, `ui.tsx`)
| # | Finding | Type |
|---|---|---|
| M1 | The search field is a `<div>`. It looks tappable but nothing happens. | [UX] |
| M2 | The category filter uses `?category=` server navigation, so each tap is a network round-trip. On weak campus Wi-Fi this feels broken. Filter on the client instead; the menu is small. | [UX] |
| M3 | `isAvailable` is ignored. Sold-out items render and can be ordered. | [BLOCKER] (the UI must show sold out once real data flows) |
| M4 | There is no empty state for a category with zero items. | [UX] |
| M5 | Category pills are about 36px tall, below the 44px target. | [UX] |
| M6 | The ⊕ on FoodCard looks like quick-add but opens the detail page. Either make it quick-add for items without required modifiers, or drop the ⊕. | [VISUAL] |
| M7 | The star ratings (4.9 etc.) are fabricated. Hide them until real ratings exist. | [UX] |

### Product detail (`menu/[slug]/page.tsx`, `product-configurator.tsx`)
| # | Finding | Type |
|---|---|---|
| P1 | **Quantity creates duplicate lines.** `for (i < quantity) add(...)` makes N lines of qty 1 (verified). | [BLOCKER] |
| P2 | **Preorder is broken end-to-end.** The "📅 Preorder" button calls `router.push('/preorder')`, which drops the item. The preorder page never stores the chosen slot, `orderType` can never become `PREORDER`, and `preorderSlotId` is never passed to `add()`. | [BLOCKER] |
| P3 | Required groups aren't enforced. Tapping the selected "Medium" deselects it, leaving a required single-choice group empty, and Add is still enabled. | [BLOCKER] |
| P4 | Multi-select at `max` has surprising behaviour. Picking a 4th extra when 3 are selected **wipes all three** and keeps only the new one. It should block with a hint ("Up to 3"). | [UX] |
| P5 | The back button is at `top-5` with no safe-area inset, so it sits under the notch or status bar in standalone mode. `router.back()` on a deep link (e.g. a shared WhatsApp link) exits the app. Fall back to `/menu`. | [UX] |
| P6 | Options lack `role="radio"`/`"checkbox"` and `aria-checked`. | [UX] |
| P7 | The header price shows the base price while the CTA shows the configured total. That's fine. The CTA should say "Add 2 to order". | [VISUAL] |

### Preorder (`src/app/preorder/page.tsx`)
| # | Finding | Type |
|---|---|---|
| R1 | The selected slot is lost on navigation (see P2). The slot choice should be **cart-level**, not line-level: one order has one `orderType` and one `preorderSlotId` per the data model. | [BLOCKER] |
| R2 | The "Choose your meal" CTA appears inline under the list, which can be below the fold on small phones. Make it a sticky bottom CTA like the other screens. | [UX] |
| R3 | Times have no AM/PM ("1:00 – 1:30"), and past slots for "Today" are not hidden. | [UX] |
| R4 | There's no cut-off copy ("Order by 11:30 for this slot") and no note that spots aren't held until payment. | [UX] |
| R5 | The day toggle and slot buttons lack `aria-pressed`/radio semantics. | [UX] |
| R6 | "3 spots left" in coral works well. Keep it. | (none) |

### Cart (`src/app/cart/page.tsx`)
| # | Finding | Type |
|---|---|---|
| C1 | On a hard reload, server HTML shows the empty-cart state before hydration swaps in the cart (verified). On slow 3G that's seconds of "Nothing delicious here yet". | [UX] |
| C2 | The +/− targets are 28px and the trash icon is 17px with no padding. Both are well below 44px, and trash is right next to the item name. | [UX] |
| C3 | Remove has no undo. | [UX] |
| C4 | There's no cart-level delivery-time summary ("⚡ ASAP · 25–35 min" or "📅 Tomorrow 12:30–1:00 · Change"). Mixed ASAP and preorder lines are possible today. | [BLOCKER] (ties to R1) |
| C5 | The "Got a promo code?" card has no input. It reads as a broken feature. Hide it until promos ship. | [UX] |
| C6 | The delivery fee is hard-coded `5` in cart and checkout. It should come from the selected hall (`deliveryLocations.deliveryFeePesewas`), with "Delivery fee set at next step" until one is chosen. | [UX] (display only; server stays authoritative) |
| C7 | The cart stores a full `menuItem` snapshot, price included, in localStorage with no version. Stale prices can survive a menu change. The UI should re-quote on checkout load and show "Price updated" if it differs. | [UX] |
| C8 | `JSON.parse(localStorage…)` has no try/catch. A corrupt value crashes the whole app shell. | [BLOCKER] (small fix) |

### Checkout (`src/app/checkout/page.tsx`)
| # | Finding | Type |
|---|---|---|
| K1 | **The inputs are uncontrolled and never read.** Name, phone, hall and room are discarded. | [BLOCKER] |
| K2 | Hall/Hostel is free text. The contract has `deliveryLocations`, so it should be a picker (searchable list of halls/hostels) plus Block plus Room/landmark. Free text breaks batching and fees. | [BLOCKER] |
| K3 | There is no Ghana phone validation. Use 10 digits starting `02`/`05` (or `+233` then 9 digits), with `inputMode="tel"` and `autoComplete="tel"`. There are no error messages at all. | [BLOCKER] |
| K4 | Mobile Money doesn't ask for the **network** (MTN MoMo / Telecel Cash / AT Money) or the **MoMo number**. The MoMo number can differ from the receiver's phone, so offer "Same as receiver" as the default. Paystack needs both. | [BLOCKER] |
| K5 | "Pay GHS X" and "Secured by Paystack" are shown, but the demo takes no payment and routes to a fixed `MI-1042`. This breaks the "don't claim real payment" rule. Show a visible **Demo checkout: no payment taken** banner until Phase 2. | [BLOCKER] |
| K6 | `clear()` runs **before** any payment result. In production the cart must survive until the server confirms payment, so a failed or abandoned MoMo prompt can retry without rebuilding the order. | [BLOCKER] |
| K7 | Duplicate-tap protection is state-only. Two taps in one frame can both call `pay()`. Add a `useRef` in-flight guard. Phase 2 must also send one idempotency key per checkout attempt (the server owns this). | [BLOCKER] |
| K8 | There are no payment states. MoMo in Ghana is a **push prompt**, so the UI needs "Check your phone: approve GHS X with your MoMo PIN", a countdown or resend, a "Didn't get a prompt?" help option (dial `*170#` for MTN approvals), and failed, abandoned or timed-out states with Retry and "Change payment method". | [BLOCKER] (UI states; the verification itself stays server-side) |
| K9 | The empty-cart fallback is unstyled (a bare link and text). | [UX] |
| K10 | There is no order summary on the checkout page (items, time slot, hall). Students pay without seeing what they're paying for. | [UX] |
| K11 | The sticky Pay button is `bottom-5` over the form, and on iOS the keyboard pushes it over inputs. Add `pb-[calc(env(safe-area-inset-bottom)+6rem)]` to the form and hide the CTA while an input is focused (optional). | [UX] |
| K12 | There's no "Remember my delivery details on this phone" opt-in (default **off**) and no "Forget" option. Without it, repeat guests retype everything. With it on by default, it would be a privacy leak on shared phones. | [UX] |

### Tracking (`src/app/orders/[id]/page.tsx`)
| # | Finding | Type |
|---|---|---|
| T1 | Every `/orders/<anything>` shows Pentagon Hostel, Block B, Room 204 and **PIN 5921**. In production, tracking must be reachable only via an unguessable token link (`trackingToken`), never a sequential order number. The UI should mask the room ("Rm 2••") and hide the PIN behind a tap-to-reveal. | [BLOCKER] (UI side of the privacy boundary) |
| T2 | "On track", the pulsing dot and "Estimated arrival 12:30 – 1:00 PM" imply live data. Add a demo label until the realtime feed exists. | [BLOCKER] |
| T3 | There are no states for `AWAITING_PAYMENT`, `PAYMENT_FAILED`, `CANCELLED`, `DELIVERY_FAILED`, `CUSTOMER_UNREACHABLE` or `REFUND_PENDING`, although all are in the contract. | [BLOCKER] |
| T4 | The Copy PIN button does nothing and has no label. | [UX] |
| T5 | There's no "Save this link / add to home screen" nudge, and no WhatsApp share. Since guests have no account, losing the link loses the order. | [UX] |
| T6 | There's no support/call-kitchen action, and no "Last updated 2 min ago" line for weak networks. | [UX] |
| T7 | There's no bottom nav and back goes to Home. That's acceptable. | (none) |

---

## 2. Prioritised implementation plan

### P0: must ship before real payments (all UI-only)
1. **Fix quantity → single line** (P1). Change `add()` to accept `quantity`, and merge identical lines (same item, same options).
2. **Cart-level delivery timing** (P2, R1, C4). Put `fulfilment: { type: "ASAP" } | { type: "PREORDER", slotId, label }` in the cart provider. Preorder page sets it and routes to `/menu`. Product page shows the current choice with "Change". Cart and checkout show it.
3. **Enforce required modifier groups** (P3). A single-select required group can't be deselected, and Add stays disabled until `min` is met.
4. **Controlled checkout form with validation** (K1–K4): hall picker from `deliveryLocations` (mock list for now), Ghana phone rule, MoMo network plus MoMo number, inline errors, and focus on the first error.
5. **Honesty labels** (K5, T2). Add a "Demo, no payment taken / sample tracking" banner, driven by one `DEMO_MODE` flag so Phase 2 removes it in one place.
6. **Don't clear the cart before confirmation, and add a ref in-flight guard** (K6, K7).
7. **Payment state screens** (K8): pending MoMo prompt, failed, abandoned, retry. Build them against a UI-local state machine the Phase 2 server can drive.
8. **Tracking privacy UI** (T1, T3). Mask the room, add tap-to-reveal PIN, cover every exception status, and remove the hard-coded `MI-1042` from nav (G3). The "Orders" tab should list orders from this device (localStorage list of `{orderNumber, trackingToken, createdAt}`), with an empty state.
9. **Hydration-safe cart and safe parse** (C1, C8). Add a `hydrated` flag with a skeleton, and wrap the parse in try/catch.
10. **Service worker strategy** (G2). Use network-first for navigations and `/orders/*`, stale-while-revalidate for `/_next/static` and images, a versioned cache with cleanup in `activate`, and never cache non-GET or cross-origin payment requests.
11. **Re-enable zoom** (G1).
12. **Closed / sold-out states** (H4, M3), driven by `settings/public` and `isAvailable`.

### P1: launch quality
- 44px touch targets: cart +/−, trash, category pills (C2, M5).
- `aria-label` on every icon button. Add `role`/`aria-checked` on options and slots. Add `aria-current` on nav (G6, P6, R5).
- Client-side category filter plus a working search input with a "No results for 'x'" state (M1, M2, M4).
- Sticky preorder CTA. AM/PM times. Hide past slots. Cut-off copy (R2–R4).
- Checkout order summary. Hall-based delivery fee display (K10, C6).
- Undo on remove (C3). Re-quote on checkout load (C7).
- Safe-area back button with a `/menu` fallback (P5).
- An offline banner. Disable Pay while offline, with the message "You're offline. We'll keep your cart." (G7).
- Remove fake UI: bell, dead promo card, fake ratings, fake "deal" badge, static greeting, and the non-functional hall picker (H1–H3, H5, C5, M7).
- An opt-in "Remember my details on this phone" setting with a Forget button (K12).
- Tracking: working copy PIN, "Last updated" line, save/share link, and call the kitchen (T4–T6).

### P2: polish
- Satoshi/Inter via `next/font` (G5). Use `GH₵` or keep `GHS` consistently through `money()` (H6).
- FoodCard quick-add for items with no required choices (M6).
- "Add 2 to order" CTA copy (P7).
- Keyboard-aware sticky CTA on checkout (K11).
- Nav contrast and 11–12px labels (G4).

---

## 3. Manual test matrix

Run on: (a) Android Chrome, low-end (2GB RAM), installed PWA; (b) iOS Safari plus Add to Home Screen; (c) desktop Chrome DevTools "Slow 3G" and "Offline". Unless stated otherwise, start with localStorage cleared.

| ID | Area | Steps | Expected | Today |
|---|---|---|---|---|
| A1 | ASAP happy path | Home → ASAP → item → keep defaults → Add → Cart → Checkout → valid details → MoMo → Pay | Single line, ASAP shown in cart and checkout, pending-prompt screen, then tracking | ⚠ Passes visually; no prompt state |
| A2 | ASAP while kitchen closed | Set `acceptingOrders=false` (mock) → open Home | Closed banner, ASAP disabled, preorder offered | ❌ No closed state |
| A3 | ASAP paused, preorder open | `asapEnabled=false` | ASAP chip disabled with reason | ❌ |
| B1 | Preorder slot select | Home → Preorder → Today → 12:30 slot → Choose meal → add item → Cart | Cart shows "📅 Today 12:30–1:00 PM · Change" | ❌ Slot lost; line shows ASAP |
| B2 | Fully booked slot | Tap the 1:30 slot | Disabled, announced as "Fully booked" by screen reader | ⚠ Disabled; no announcement semantics |
| B3 | Switch day | Pick a Today slot → switch to Tomorrow | Selection cleared, Tomorrow slots listed | ✅ |
| B4 | Past slot | Set device time 14:10 → Preorder Today | Past slots hidden or "Closed" | ❌ |
| B5 | Slot fills during checkout | Select slot with 1 spot → (mock) capacity 0 → Pay | Clear "That slot just filled. Pick another" with cart intact | ❌ |
| B6 | ASAP + preorder mixing | Add an ASAP item, then set preorder and add another | A single cart timing prompts "Switch whole order to preorder?" | ❌ Mixed lines allowed |
| C1 | Quantity | Product → + to 3 → Add | One line, qty 3, total 3× | ❌ Three lines (verified) |
| C2 | Merge identical | Add same item and options twice | One line, qty 2 | ❌ |
| C3 | Different options | Add Mild, then Hot | Two lines | ✅ |
| C4 | Decrement to 0 | Cart − on qty 1 | Line removed, undo toast | ⚠ Removed, no undo |
| C5 | Trash mis-tap | Tap near the item name on a 360px device | No accidental delete | ⚠ Small target |
| C6 | Required modifier | Tap the selected "Medium" | Stays selected (radio) | ❌ Deselects; Add still enabled |
| C7 | Max extras | Select 3 extras, tap a 4th | Blocked with "Up to 3" | ❌ Clears the other 3 |
| C8 | Reload cart | Add items → hard reload /cart on Slow 3G | Skeleton, then cart; no "empty" flash | ❌ Empty flash (verified in SSR HTML) |
| C9 | Corrupt storage | `localStorage['mi-cart']='{'` → reload | Cart resets gracefully | ❌ Crash |
| D1 | Required fields | Submit with an empty hall/room/name/phone | Inline errors, focus on first | ⚠ Native bubbles only; values not captured |
| D2 | Phone formats | `0241234567` ✅, `+233241234567` ✅, `24123` ❌, `0301234567` (landline) ❌, spaces `024 123 4567` ✅ | Normalised to E.164 | ❌ No validation |
| D3 | Hall picker | Type "pent" | Filters to Pentagon; fee updates | ❌ Free text |
| D4 | Landmark only | Hall + no block + "Behind the chapel" | Accepted (block optional) | ✅ |
| D5 | Remember details | Opt in → order → new order | Prefilled; "Forget" clears it | ❌ Not built |
| D6 | Shared-phone privacy | Default (opt-out) → order → new session | Nothing prefilled | ✅ (trivially) |
| E1 | MoMo selection | Choose MoMo | Network (MTN/Telecel/AT) and MoMo number required; "Same as receiver" default | ❌ |
| E2 | Card selection | Choose Card | Explains redirect to Paystack card page; no card fields in our UI | ⚠ No copy |
| E3 | Selection a11y | Screen reader on the payment tiles | Announced as radio, "selected" | ❌ |
| F1 | Payment declined | (mock) FAILED | "Payment didn't go through" with Retry / Change method; cart and details kept | ❌ Not built |
| F2 | Prompt ignored | (mock) pending for 120s | Timeout screen with Retry and *170# hint | ❌ |
| F3 | Abandon card | Close the Paystack tab | Returns to pending, then abandoned, with Retry | ❌ |
| F4 | Reload while pending | Reload during pending | Resumes pending for the same order; no new order | ❌ |
| F5 | Back button while pending | Android back | Confirm "Payment in progress, leave?" | ❌ |
| G1 | Double tap Pay | Rapid 2–5 taps or a double-click | One request, one order | ⚠ State guard only |
| G2 | Enter key submit | Press Enter in the phone field while submitting | No second submit | ✅ (disabled default button) |
| G3 | Two tabs | Checkout in 2 tabs, pay in both | Second tab told "Already placed", links to order | ❌ |
| H1 | Tracking link | Open the token URL on another device | Order shows; room masked; PIN hidden until tap | ❌ Any ID shows full details |
| H2 | Guessed ID | `/orders/MI-1043` | "We couldn't find that order" | ❌ Shows sample data |
| H3 | Orders tab | Fresh device → Orders | Empty state "No orders on this phone yet" | ❌ Hard-coded order |
| H4 | Exception statuses | Mock each: failed, cancelled, unreachable, refund pending | Distinct, clear copy and next step | ❌ |
| H5 | Copy PIN | Tap copy | Copied toast | ❌ No-op |
| I1 | Offline browse | Load once → go offline → Home/Menu | Shell and menu from cache; offline banner | ⚠ Loads; no banner; images missing |
| I2 | Offline pay | Offline → Pay | Blocked with "You're offline"; cart kept | ❌ Demo "succeeds" and clears cart |
| I3 | Stale deploy | Deploy a menu price change → revisit installed PWA | New price within 1 load | ❌ Cache-first forever |
| I4 | Slow 3G category tap | Tap pills on Slow 3G | Instant filter | ❌ Server round-trip |
| I5 | Tracking freshness | Status changes → revisit | New status, not a cached page | ❌ Cache-first |
| J1 | Zoom | Pinch on any screen | Zooms | ❌ Blocked |
| J2 | TalkBack/VoiceOver sweep | Swipe through each screen | Every control named; order of reading logical | ❌ Unnamed buttons (verified) |
| J3 | Notch / standalone | iPhone installed PWA → product page | Back button clear of the status bar | ❌ |
| J4 | Large text | OS font size 200% | No clipped CTAs or overlapping sticky bars | Untested; please run |

---

## 4. Minimal patch suggestions (student UI only)

These are suggestions for Codex to adapt. None touches Firebase, payment adapters, rules or the data model.

### 4.1 Cart provider: quantity, merge, cart-level timing, safe hydration
```tsx
// src/components/cart-provider.tsx
"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CartLine, MenuItem, ModifierOption } from "@/types/domain";

export type Fulfilment = { type: "ASAP" } | { type: "PREORDER"; slotId: string; label: string };
type CartContextValue = {
  lines: CartLine[]; count: number; subtotal: number; hydrated: boolean; fulfilment: Fulfilment;
  setFulfilment: (f: Fulfilment) => void;
  add: (item: MenuItem, selectedOptions: ModifierOption[], quantity: number) => void;
  updateQuantity: (id: string, quantity: number) => void; remove: (id: string) => void; clear: () => void;
};
const KEY = "mi-cart-v2";
const CartContext = createContext<CartContextValue | null>(null);
const linePrice = (line: CartLine) => line.menuItem.price + line.selectedOptions.reduce((sum, option) => sum + option.priceAdjustment, 0);
const optionKey = (options: ModifierOption[]) => options.map((o) => o.id).sort().join("|");

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [fulfilment, setFulfilment] = useState<Fulfilment>({ type: "ASAP" });
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (saved?.lines) setLines(saved.lines);
      if (saved?.fulfilment) setFulfilment(saved.fulfilment);
    } catch { localStorage.removeItem(KEY); }
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) try { localStorage.setItem(KEY, JSON.stringify({ lines, fulfilment })); } catch {} }, [lines, fulfilment, hydrated]);
  const value = useMemo<CartContextValue>(() => ({
    lines, fulfilment, hydrated, setFulfilment,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: lines.reduce((sum, line) => sum + linePrice(line) * line.quantity, 0),
    add: (menuItem, selectedOptions, quantity) => setLines((current) => {
      const match = current.find((l) => l.menuItem.id === menuItem.id && optionKey(l.selectedOptions) === optionKey(selectedOptions));
      if (match) return current.map((l) => l === match ? { ...l, quantity: l.quantity + quantity } : l);
      return [...current, { id: crypto.randomUUID(), menuItem, selectedOptions, quantity, orderType: fulfilment.type, preorderSlotId: fulfilment.type === "PREORDER" ? fulfilment.slotId : undefined }];
    }),
    updateQuantity: (id, quantity) => setLines((current) => quantity < 1 ? current.filter((line) => line.id !== id) : current.map((line) => line.id === id ? { ...line, quantity } : line)),
    remove: (id) => setLines((current) => current.filter((line) => line.id !== id)),
    clear: () => setLines([]),
  }), [lines, fulfilment, hydrated]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
export const useCart = () => { const context = useContext(CartContext); if (!context) throw new Error("useCart must be used within CartProvider"); return context; };
export const cartLinePrice = linePrice;
```
> `CartLine.orderType`/`preorderSlotId` are kept for type compatibility. The source of truth becomes `fulfilment`. Codex decides whether to drop the per-line fields when the order contract is wired.

### 4.2 Product configurator: single add, required groups, max cap
```tsx
// in ProductConfigurator
const { add, fulfilment } = useCart();
const choose = (option: ModifierOption, group: ModifierGroup) => setSelected((current) => {
  const ids = new Set(group.options.map((o) => o.id));
  const inGroup = current.filter((o) => ids.has(o.id));
  const isOn = inGroup.some((o) => o.id === option.id);
  if (group.max === 1) return isOn && group.required ? current : [...current.filter((o) => !ids.has(o.id)), ...(isOn ? [] : [option])];
  if (isOn) return current.filter((o) => o.id !== option.id);
  return inGroup.length >= group.max ? current : [...current, option]; // show "Up to {max}" hint when blocked
});
const missing = item.modifierGroups.filter((g) => selected.filter((o) => g.options.some((x) => x.id === o.id)).length < g.min);
// Preorder tile → router.push(`/preorder?return=/menu/${item.slug}`) instead of losing the item
// CTA:
<button disabled={missing.length > 0} onClick={() => { add(item, selected, quantity); router.push("/cart"); }} …>
  {missing.length ? `Choose ${missing[0].name.toLowerCase()}` : `Add ${quantity} to order`}
</button>
```

### 4.3 Checkout: in-flight guard and no premature clear
```tsx
const inFlight = useRef(false);
const pay = async () => {
  if (inFlight.current) return;
  if (!validate()) return;               // sets field errors + focuses first
  if (!navigator.onLine) return setBanner("You're offline. Your cart is safe, try again when connected.");
  inFlight.current = true; setStatus("creating");
  // DEMO_MODE: simulate; Phase 2 replaces with the trusted createOrder call.
  // Do NOT clear() here; clear only when the tracking page receives paymentStatus SUCCESSFUL.
};
```

### 4.4 Ghana phone helper (UI validation only; the server re-validates)
```ts
export function normaliseGhPhone(raw: string): string | null {
  const d = raw.replace(/[\s-]/g, "");
  const m = d.match(/^(?:\+?233|0)([25]\d{8})$/);
  return m ? `+233${m[1]}` : null;
}
```

### 4.5 Zoom
```ts
// layout.tsx
export const viewport: Viewport = { themeColor: "#ff5f45", width: "device-width", initialScale: 1 };
```

### 4.6 Service worker (network-first navigations, versioned)
```js
const CACHE = "mummys-inn-v2";
const SHELL = ["/", "/menu", "/manifest.webmanifest"];
self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL))); });
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  if (req.mode === "navigate" || url.pathname.startsWith("/orders/") || req.headers.get("RSC")) {
    e.respondWith(fetch(req).then((res) => { if (res.ok && !url.pathname.startsWith("/orders/")) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("/"))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => { const net = fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; }); return hit || net; }));
});
```

### 4.7 Tracking privacy (presentation only)
```tsx
const maskRoom = (room: string) => room.length <= 2 ? "••" : `${room.slice(0, -2)}••`;
const [showPin, setShowPin] = useState(false);
<button aria-label={showPin ? "Hide delivery PIN" : "Show delivery PIN"} onClick={() => setShowPin((v) => !v)} className="min-h-11 …">
  {showPin ? pin : "••••"}
</button>
```

---

## 5. Boundary check
- No customer accounts, Auth or profiles are introduced. "Remember my details" is opt-in and device-local.
- No payment verification, Firestore writes, capacity reservation or pricing authority moves to the browser. All UI states are driven by a future server response.
- Hall/Block/Room is kept as the campus-native address. No generic map or address form.
- The demo is labelled as a demo until Phase 2.

---

## 6. Implementation status (2026-09-23)

All P0, P1 and P2 items above are implemented, except Satoshi (Inter is loaded via `next/font`; Satoshi would need self-hosted font files). The changes are UI-only; Firebase rules, the Admin SDK, `src/lib/payments/provider.ts`, `src/types/domain.ts` and the data-model docs are untouched.

**New files:**
- `src/lib/demo.ts`: the single `DEMO_MODE` switch.
- `src/lib/slots.ts`: AM/PM windows, 30-minute cut-off, slot state.
- `src/lib/phone.ts`: Ghana number checks.
- `src/lib/device-storage.ts`: safe storage, opt-in saved details, orders kept on this phone.
- `src/lib/use-online.ts`
- `src/components/fulfilment-summary.tsx`
- `src/components/hall-picker.tsx`
- `src/components/menu-browser.tsx`
- `src/components/home-client.tsx`
- `src/components/order-tracking.tsx`
- `src/components/offline-banner.tsx`
- `src/app/orders/page.tsx`

**Sample data** (`src/lib/mock-data.ts`):
- Added sample `deliveryLocations` and `publicSettings`, plus two 6 PM windows.
- Suya kebab is marked sold out, to show that state.
- Fake ratings are removed.
- The broken sobolo photo (404 from Unsplash) is replaced.

**For Phase 2:**
- Replace the simulated `setTimeout` in `checkout/page.tsx` `submit()` with the trusted `createOrder` call, sending `attemptId` as the idempotency key.
- Drive `PaymentStatus` from the server's payment result.
- Serve `/orders/[token]` from the server instead of `device-storage`.
- Then set `DEMO_MODE = false`.

**QA helper:**
- `/orders/<token>?status=CUSTOMER_UNREACHABLE` previews any fulfilment status (only while `DEMO_MODE`).
- The demo payment screen has Approved, Declined, No response and Cancelled buttons.
