"use client";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard, LockKeyhole, MapPin, PackageOpen, Phone, Plus, Minus, Smartphone, UserRound, XCircle } from "lucide-react";
import { cartLinePrice, fulfilmentProblem, useCart } from "@/components/cart-provider";
import { FulfilmentSummary } from "@/components/fulfilment-summary";
import { HallPicker } from "@/components/hall-picker";
import { BackLink, DemoNotice, Skeleton } from "@/components/ui";
import { DEMO_MODE } from "@/lib/demo";
import { deliveryLocations, money, publicSettings } from "@/lib/mock-data";
import { displayGhPhone, normaliseGhPhone } from "@/lib/phone";
import { forgetDetails, loadDeviceOrders, loadSavedDetails, readJson, removeKey, saveDetails, saveDeviceOrder, writeJson, type DeviceOrder } from "@/lib/device-storage";
import { useNow, useOnline } from "@/lib/use-online";

type Network = "mtn" | "telecel" | "at";
const NETWORKS: { id: Network; name: string }[] = [{ id: "mtn", name: "MTN MoMo" }, { id: "telecel", name: "Telecel Cash" }, { id: "at", name: "AT Money" }];
type Form = { locationId: string; block: string; room: string; instructions: string; name: string; phone: string; receiptEmail: string; method: "mobile_money" | "card"; network: Network | ""; momoSame: boolean; momoNumber: string; remember: boolean };
type FailReason = "declined" | "timeout" | "abandoned";
type Stage = { kind: "form" } | { kind: "creating" } | { kind: "awaiting"; startedAt: number } | { kind: "failed"; reason: FailReason };
type Draft = { attemptId: string; stage: Stage; form: Form };
type Errors = Partial<Record<"hall" | "room" | "name" | "phone" | "receipt-email" | "network" | "momo-number", string>>;

const DRAFT_KEY = "mi-checkout";
const PROMPT_SECONDS = 120;
const EMPTY: Form = { locationId: "", block: "", room: "", instructions: "", name: "", phone: "", receiptEmail: "", method: "mobile_money", network: "", momoSame: true, momoNumber: "", remember: false };
const newAttemptId = () => crypto.randomUUID();

export default function CheckoutPage() {
  const router = useRouter(); const online = useOnline(); const now = useNow();
  const { lines, subtotal, clear, hydrated, fulfilment, requote, updateQuantity } = useCart();
  const [form, setForm] = useState<Form>(EMPTY);
  const [stage, setStage] = useState<Stage>({ kind: "form" });
  const [attemptId, setAttemptId] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [typing, setTyping] = useState(false);
  const [placedElsewhere, setPlacedElsewhere] = useState<DeviceOrder | null>(null);
  const inFlight = useRef(false); const placing = useRef(false);

  const hall = deliveryLocations.find((location) => location.id === form.locationId);
  const deliveryFee = hall?.deliveryFee ?? 0;
  const total = subtotal + deliveryFee;
  const timingProblem = now ? fulfilmentProblem(fulfilment, now) : null;
  const pending = stage.kind === "creating" || stage.kind === "awaiting";

  // Restore this tab's draft (survives reload, cleared when the tab closes), else opt-in saved details.
  useEffect(() => {
    if (!hydrated || restored) return;
    const draft = readJson<Draft>("session", DRAFT_KEY);
    if (draft?.form) {
      setForm({ ...EMPTY, ...draft.form }); setAttemptId(draft.attemptId);
      const s = draft.stage;
      if (s.kind === "awaiting") setStage(Date.now() - s.startedAt > PROMPT_SECONDS * 1000 ? { kind: "failed", reason: "timeout" } : s);
      else if (s.kind === "creating") setStage({ kind: "failed", reason: "abandoned" });
      else setStage(s);
    } else {
      const saved = loadSavedDetails();
      if (saved) setForm({ ...EMPTY, ...saved, remember: true });
      setAttemptId(newAttemptId());
    }
    const { priceChanged, removed } = requote();
    if (removed.length) setBanner(`${removed.join(", ")} sold out and ${removed.length === 1 ? "was" : "were"} removed. Please check your order.`);
    else if (priceChanged.length) setBanner(`Prices changed for ${priceChanged.join(", ")}. Please check your total.`);
    setRestored(true);
  }, [hydrated, restored, requote]);
  useEffect(() => { if (restored && lines.length) writeJson("session", DRAFT_KEY, { attemptId, stage, form } satisfies Draft); }, [restored, attemptId, stage, form, lines.length]);

  // An order finished in another tab empties this cart; say so instead of showing a bare empty state.
  useEffect(() => {
    if (!hydrated || lines.length || placing.current) return;
    const recent = loadDeviceOrders()[0];
    if (recent && Date.now() - Date.parse(recent.createdAt) < 10 * 60_000) setPlacedElsewhere(recent);
  }, [hydrated, lines.length]);

  // Guard against leaving mid-payment (reload, close, Android back).
  useEffect(() => {
    if (!pending) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    const onPop = () => { if (window.confirm("Your payment is still in progress. Leave this page?")) { window.removeEventListener("popstate", onPop); window.history.back(); } else window.history.pushState(null, ""); };
    window.history.pushState(null, "");
    window.addEventListener("beforeunload", beforeUnload); window.addEventListener("popstate", onPop);
    return () => { window.removeEventListener("beforeunload", beforeUnload); window.removeEventListener("popstate", onPop); };
  }, [pending]);

  const update = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    const errorKey = ({ locationId: "hall", room: "room", name: "name", phone: "phone", receiptEmail: "receipt-email", network: "network", momoNumber: "momo-number" } as Record<string, keyof Errors>)[key];
    if (errorKey && errors[errorKey]) setErrors((current) => ({ ...current, [errorKey]: undefined }));
  };

  const validate = (): Errors => {
    const next: Errors = {};
    if (!form.locationId) next.hall = "Choose your hall or hostel.";
    if (!form.room.trim()) next.room = "Add a room number or a landmark the rider can find.";
    if (!form.name.trim()) next.name = "Add the name the rider should ask for.";
    if (!normaliseGhPhone(form.phone)) next.phone = "Enter a Ghana mobile number, e.g. 024 123 4567.";
    if (form.receiptEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.receiptEmail)) next["receipt-email"] = "Enter a valid email address.";
    if (!DEMO_MODE && !form.receiptEmail) next["receipt-email"] = "Add an email for secure payment and your receipt.";
    if (form.method === "mobile_money") {
      if (!form.network) next.network = "Choose your Mobile Money network.";
      if (!form.momoSame && !normaliseGhPhone(form.momoNumber)) next["momo-number"] = "Enter the Mobile Money number, e.g. 055 123 4567.";
    }
    return next;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current || stage.kind !== "form") return;
    const found = validate(); setErrors(found);
    const first = (["hall", "room", "name", "phone", "receipt-email", "network", "momo-number"] as const).find((key) => found[key]);
    if (first) { document.getElementById(first === "network" ? "network-mtn" : first)?.focus(); return; }
    if (!online) { setBanner("You're offline. Your cart and details are saved, so try again when you're connected."); return; }
    if (timingProblem || !publicSettings.acceptingOrders) return;
    inFlight.current = true; setBanner(null);
    if (form.remember) saveDetails({ locationId: form.locationId, block: form.block, room: form.room, name: form.name, phone: form.phone }); else forgetDetails();
    setStage({ kind: "creating" });
    if (DEMO_MODE) { window.setTimeout(() => { setStage({ kind: "awaiting", startedAt: Date.now() }); inFlight.current = false; }, 900); return; }
    try {
      const livePayload = { idempotencyKey: attemptId, trackingToken: attemptId.replaceAll("-", ""), lines: lines.map((line) => ({ menuItemId: line.menuItem.id, optionIds: line.selectedOptions.map((option) => option.id), quantity: line.quantity, ...(line.note ? { note: line.note } : {}) })), fulfilment: fulfilment.type === "PREORDER" ? { type: "PREORDER", preorderSlotId: fulfilment.slotId } : { type: "ASAP" }, delivery: { locationId: form.locationId, block: form.block, roomOrLandmark: form.room, instructions: form.instructions, name: form.name, phone: form.phone }, payment: form.method === "mobile_money" ? { method: "mobile_money", mobileMoney: { provider: form.network, phone: form.momoSame ? form.phone : form.momoNumber } } : { method: "card" } };
      const orderResponse = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(livePayload) }); const order = await orderResponse.json();
      if (!orderResponse.ok || !order.trackingToken) throw new Error(order.message ?? "We couldn't create your order.");
      const paymentResponse = await fetch("/api/payments/initialize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId: order.orderId, trackingToken: order.trackingToken, receiptEmail: form.receiptEmail }) }); const payment = await paymentResponse.json();
      if (!paymentResponse.ok || !payment.authorizationUrl) throw new Error(payment.message ?? "We couldn't start payment.");
      window.location.assign(payment.authorizationUrl);
    } catch (error) { setBanner(error instanceof Error ? error.message : "We couldn't start payment. Your cart is still safe."); setStage({ kind: "form" }); inFlight.current = false; }
  };

  const retry = () => { if (!online) { setBanner("You're offline. Reconnect, then try again."); return; } setStage({ kind: "awaiting", startedAt: Date.now() }); };
  const changeMethod = () => { setStage({ kind: "form" }); setAttemptId(newAttemptId()); };

  const approve = useCallback(() => {
    placing.current = true;
    const random = crypto.getRandomValues(new Uint32Array(2));
    const order: DeviceOrder = {
      trackingToken: crypto.randomUUID().replaceAll("-", ""), orderNumber: `MI-${1000 + (random[0] % 9000)}`, createdAt: new Date().toISOString(), demo: DEMO_MODE,
      itemsSummary: lines.map((line) => `${line.quantity}× ${line.menuItem.name}`).join(", "), itemCount: lines.reduce((sum, line) => sum + line.quantity, 0), total,
      fulfilmentLabel: fulfilment.type === "ASAP" ? `ASAP · about ${publicSettings.asapWindow}` : fulfilment.label, orderType: fulfilment.type,
      hallName: hall?.name ?? "", block: form.block.trim(), room: form.room.trim(),
      pin: String(random[1] % 10000).padStart(4, "0"), paymentStatus: "SUCCESSFUL", fulfillmentStatus: fulfilment.type === "ASAP" ? "CONFIRMED" : "SCHEDULED",
    };
    saveDeviceOrder(order); removeKey("session", DRAFT_KEY);
    setStage({ kind: "form" }); // lifts the leave-page guard before navigating
    clear(); router.replace(`/orders/${order.trackingToken}`);
  }, [lines, total, fulfilment, hall, form.block, form.room, clear, router]);

  if (!hydrated || !restored) return <div className="min-h-screen space-y-4 px-5 pt-[max(1.25rem,env(safe-area-inset-top))]" aria-busy="true"><Skeleton className="h-12 w-48" /><Skeleton className="h-48" /><Skeleton className="h-40" /></div>;
  if (!lines.length) return <div className="min-h-screen px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
    <header className="flex items-center gap-3"><BackLink href="/menu" label="Back to menu" /><h1 className="text-2xl font-black">Checkout</h1></header>
    <div className="grid min-h-[60vh] place-items-center text-center"><div>
      {placedElsewhere ? <><span aria-hidden className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-leaf/15 text-leaf"><CheckCircle2 size={31}/></span><h2 className="mt-5 text-xl font-black">Order {placedElsewhere.orderNumber} is already placed</h2><p className="mt-1 text-sm text-stone-600">It was completed in another tab.</p><Link href={`/orders/${placedElsewhere.trackingToken}`} className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-coral px-5 font-black text-white">Track your order</Link></>
        : <><span aria-hidden className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-coral/10 text-coral"><PackageOpen size={31}/></span><h2 className="mt-5 text-xl font-black">Your cart is empty</h2><Link href="/menu" className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-coral px-5 font-black text-white">Browse the menu</Link></>}
    </div></div>
  </div>;

  if (stage.kind === "awaiting" || stage.kind === "failed") return <PaymentStatus stage={stage} form={form} total={total} online={online} banner={banner}
    onApprove={approve} onFail={(reason) => setStage({ kind: "failed", reason })} onRetry={retry} onChangeMethod={changeMethod} />;

  const payLabel = DEMO_MODE ? `Place demo order · ${money(total)}` : `Pay ${money(total)}`;
  const blockedReason = !publicSettings.acceptingOrders ? "The kitchen is closed right now." : timingProblem;

  return <div className="min-h-screen px-4 pb-32 pt-[max(1rem,env(safe-area-inset-top))]">
    <header className="relative flex min-h-10 items-center justify-center"><span className="absolute left-0"><BackLink href="/cart" label="Back to cart" /></span><div className="absolute inset-x-12 text-center"><h1 className="text-[17px] font-black tracking-[-.03em]">Checkout</h1></div></header>
    {banner && <p role="alert" className="mt-4 rounded-2xl bg-mango/20 p-4 text-sm font-bold">{banner}</p>}

    <details open className="group mt-3 rounded-[14px] bg-white p-2.5 shadow-sm">
      <summary className="flex min-h-7 cursor-pointer list-none items-center justify-between text-[13px] font-black"><span>Your order ({lines.reduce((sum, line) => sum + line.quantity, 0)} item{lines.length === 1 && lines[0].quantity === 1 ? "" : "s"})</span><Link href="/cart" onClick={(event) => event.stopPropagation()} className="text-[11px] font-bold text-coral">Edit</Link></summary>
      <ul className="mt-1.5 space-y-2 border-t border-stone-100 pt-2 text-sm">{lines.map((line) => <li key={line.id} className="flex items-center justify-between gap-2"><span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg"><Image src={line.menuItem.imageUrl} alt="" fill sizes="44px" className="object-cover"/></span><span className="min-w-0 flex-1"><b className="block truncate text-[11px] leading-3">{line.menuItem.name}</b><small className="block truncate text-[9px] text-stone-500">{line.selectedOptions.map((option) => option.name).join(" · ")}</small><strong className="text-[11px] text-ink">{money(cartLinePrice(line) * line.quantity)}</strong></span><span className="flex items-center rounded-full bg-[#fafafa] text-[11px] font-bold"><button type="button" onClick={() => updateQuantity(line.id, line.quantity - 1)} aria-label={`One less ${line.menuItem.name}`} className="grid h-7 w-7 place-items-center"><Minus size={12}/></button><b className="min-w-4 text-center">{line.quantity}</b><button type="button" onClick={() => updateQuantity(line.id, line.quantity + 1)} aria-label={`One more ${line.menuItem.name}`} className="grid h-7 w-7 place-items-center"><Plus size={12}/></button></span></li>)}</ul>
    </details>
    <div className="mt-3"><FulfilmentSummary returnTo="/checkout" /></div>

    <form noValidate className="mt-4 space-y-4" onSubmit={submit} onFocus={(event) => { if (event.target instanceof HTMLInputElement && event.target.type !== "checkbox") setTyping(true); }} onBlur={() => setTyping(false)}>
      <section>
        <h2 className="mb-1.5 flex items-center gap-2 text-[13px] font-black"><MapPin size={17} className="text-coral"/> Where should we bring it?</h2><p className="mb-2 text-[10px] text-stone-500">We deliver to all halls and hostels around campus</p>
        <div className="space-y-2 rounded-[14px] bg-white p-2.5 shadow-sm">
          <HallPicker value={form.locationId} onChange={(id) => update("locationId", id)} error={errors.hall} />
          <div className="grid grid-cols-2 gap-2">
            <Field id="block" label="Block" placeholder="Block B" value={form.block} onChange={(v) => update("block", v)} autoComplete="address-line2" />
            <Field id="room" label="Room / Landmark" placeholder="Room 204" value={form.room} onChange={(v) => update("room", v)} error={errors.room} />
          </div>
          <details className="text-[10px] text-stone-500"><summary className="min-h-8 cursor-pointer content-center font-semibold">Add delivery instructions (optional)</summary><Field id="instructions" label="Instructions" placeholder="Call when outside the lobby" value={form.instructions} onChange={(v) => update("instructions", v)} maxLength={140} /></details>
        </div>
      </section>

      <section>
        <h2 className="mb-1.5 flex items-center gap-2 text-[13px] font-black"><UserRound size={17} className="text-coral"/> Who&apos;s receiving it?</h2>
        <div className="grid grid-cols-2 gap-2 rounded-[14px] bg-white p-2.5 shadow-sm">
          <Field id="name" icon={<UserRound size={14}/>} label="Name" placeholder="Kofi Mensah" value={form.name} onChange={(v) => update("name", v)} error={errors.name} autoComplete="name" />
          <Field id="phone" icon={<Phone size={14}/>} label="Phone number" placeholder="024 123 4567" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(v) => update("phone", v)} error={errors.phone} />
          {!DEMO_MODE && <div className="col-span-2"><Field id="receipt-email" label="Email for payment receipt" hint="Used by Paystack for secure payment and your receipt. Not saved to this phone." placeholder="you@example.com" type="email" inputMode="email" autoComplete="email" value={form.receiptEmail} onChange={(v) => update("receiptEmail", v)} error={errors["receipt-email"]} /></div>}
        </div>
      </section>

      <section>
        <h2 id="pay-heading" className="mb-2 flex items-center gap-2 text-[13px] font-black"><CreditCard size={17} className="text-coral"/> Payment method</h2>
        <div role="radiogroup" aria-labelledby="pay-heading" className="grid grid-cols-2 gap-2">
          <PayTile active={form.method === "mobile_money"} onClick={() => update("method", "mobile_money")} icon={<Smartphone size={20} aria-hidden className="text-coral" />} title="Mobile Money" sub="MTN, Telecel, AT" />
          <PayTile active={form.method === "card"} onClick={() => update("method", "card")} icon={<CreditCard size={20} aria-hidden className="text-ink" />} title="Card" sub="Visa, Mastercard" />
        </div>
        {form.method === "mobile_money" ? <div className="mt-3 space-y-4 rounded-app bg-white p-4 shadow-lift">
          <div>
            <span id="network-label" className="mb-1.5 block text-xs font-extrabold text-stone-600">Network</span>
            <div role="radiogroup" aria-labelledby="network-label" aria-describedby={errors.network ? "network-error" : undefined} className="grid grid-cols-3 gap-2">
              {NETWORKS.map((network) => <button key={network.id} id={`network-${network.id}`} type="button" role="radio" aria-checked={form.network === network.id} onClick={() => update("network", network.id)} className={`min-h-12 rounded-xl border-2 px-2 text-xs font-black ${form.network === network.id ? "border-coral bg-white text-ink" : "border-transparent bg-cream text-stone-700"}`}>{network.name}</button>)}
            </div>
            {errors.network && <p id="network-error" className="mt-1.5 text-xs font-bold text-[#b3321f]">{errors.network}</p>}
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm font-bold"><input type="checkbox" checked={form.momoSame} onChange={(event) => update("momoSame", event.target.checked)} className="h-5 w-5 accent-coral" />Pay with the receiver&apos;s number</label>
          {!form.momoSame && <Field id="momo-number" label="Mobile Money number" hint="You'll approve the payment on this phone." placeholder="055 123 4567" type="tel" inputMode="tel" value={form.momoNumber} onChange={(v) => update("momoNumber", v)} error={errors["momo-number"]} />}
        </div> : <p className="mt-3 rounded-2xl bg-white p-4 text-sm text-stone-700 shadow-lift">You&apos;ll enter your card details on Paystack&apos;s secure page. Mummy&apos;s Inn never sees your card number.</p>}
      </section>

      <section className="rounded-app bg-white p-4 shadow-lift">
        <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" checked={form.remember} onChange={(event) => update("remember", event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-coral" /><span><b className="block">Remember my delivery details on this phone</b><span className="text-stone-600">Saved only on this device. Leave off on a shared phone.</span></span></label>
        {loadSavedDetails() && <button type="button" onClick={() => { forgetDetails(); update("remember", false); }} className="mt-1 min-h-11 text-sm font-black text-coral">Forget saved details</button>}
      </section>

      <section className="rounded-[18px] bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-black">Order summary</h2><div className="space-y-1.5 text-sm text-stone-600"><div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div><div className="flex justify-between"><span>Delivery{hall ? ` to ${hall.name}` : ""}</span><span>{hall ? money(deliveryFee) : "Choose your hall"}</span></div></div>
        <div className="mt-3 flex justify-between border-t border-stone-100 pt-3 text-lg font-black"><span>Total</span><span className="text-coral">{money(total)}</span></div>
        <p className="mt-2 flex items-center gap-2 rounded-lg bg-[#eaf6ec] px-2 py-1.5 text-[10px] font-semibold text-leaf"><LockKeyhole size={12} aria-hidden /> {DEMO_MODE ? "A delivery PIN is shown after the demo payment." : "Your delivery PIN arrives after payment."}</p>
      </section>

      {blockedReason && <p role="alert" className="rounded-2xl bg-coral/10 p-4 text-sm font-bold text-[#b3321f]">{blockedReason}</p>}
      {!typing && <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] border-t border-stone-100 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button type="submit" disabled={pending || Boolean(blockedReason) || !online} className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-coral px-5 font-black text-white shadow-float disabled:bg-stone-300 disabled:text-stone-600 disabled:shadow-none">
          {stage.kind === "creating" ? "Creating your order…" : !online ? "You're offline" : payLabel}
        </button>
      </div>}
    </form>
  </div>;
}

function PaymentStatus({ stage, form, total, online, banner, onApprove, onFail, onRetry, onChangeMethod }: {
  stage: Extract<Stage, { kind: "awaiting" | "failed" }>; form: Form; total: number; online: boolean; banner: string | null;
  onApprove: () => void; onFail: (reason: FailReason) => void; onRetry: () => void; onChangeMethod: () => void;
}) {
  const [left, setLeft] = useState(PROMPT_SECONDS);
  const momo = form.method === "mobile_money";
  const payer = normaliseGhPhone(form.momoSame ? form.phone : form.momoNumber);
  const network = NETWORKS.find((entry) => entry.id === form.network)?.name ?? "Mobile Money";
  useEffect(() => {
    if (stage.kind !== "awaiting" || !momo) return;
    const tick = () => { const remaining = PROMPT_SECONDS - Math.floor((Date.now() - stage.startedAt) / 1000); setLeft(Math.max(0, remaining)); if (remaining <= 0) onFail("timeout"); };
    tick(); const id = window.setInterval(tick, 1000); return () => window.clearInterval(id);
  }, [stage, momo, onFail]);

  const failCopy: Record<FailReason, { title: string; body: string }> = {
    declined: { title: "Payment didn't go through", body: momo ? "The payment was declined or cancelled on your phone. Check your balance or PIN and try again." : "Your card was declined. Try again or use Mobile Money." },
    timeout: { title: "We didn't get a response", body: "The approval prompt expired. Try again and approve it within 2 minutes." },
    abandoned: { title: "Payment wasn't finished", body: momo ? "The payment was cancelled before it finished." : "The Paystack page was closed before payment finished." },
  };

  return <div className="flex min-h-screen flex-col px-5 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))]">
    {DEMO_MODE && <DemoNotice><b>Demo payment.</b> Nothing is charged. Use the demo buttons below to try each outcome.</DemoNotice>}
    {banner && <p role="alert" className="mt-4 rounded-2xl bg-mango/20 p-4 text-sm font-bold">{banner}</p>}
    {stage.kind === "awaiting" ? <section aria-live="polite" className="flex flex-1 flex-col items-center justify-center py-10 text-center">
      <span className="grid h-24 w-24 place-items-center rounded-full bg-coral/15 text-coral"><Smartphone size={40} aria-hidden className="animate-pulse-soft" /></span>
      <h1 className="mt-6 text-2xl font-black">{momo ? "Check your phone" : "Finish paying on Paystack"}</h1>
      <p className="mt-2 max-w-[300px] text-stone-700">{momo ? <>Approve <b>{money(total)}</b> on <b>{payer ? displayGhPhone(payer) : "your phone"}</b> with your {network} PIN.</> : <>Complete your card payment of <b>{money(total)}</b> in the Paystack window.</>}</p>
      {momo && <p className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-black tabular-nums shadow-sm" aria-label={`${left} seconds left to approve`}>{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} left</p>}
      {momo && <details className="mt-6 w-full max-w-[340px] rounded-2xl bg-white p-4 text-left text-sm shadow-sm"><summary className="min-h-11 cursor-pointer content-center font-black">Didn&apos;t get a prompt?</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-stone-700"><li>MTN: dial <b>*170#</b> and open <b>My Approvals</b>.</li><li>Other networks: open your MoMo menu and look for pending approvals.</li><li>Make sure your phone has signal and the number above is right.</li></ul></details>}
      <button onClick={() => onFail("abandoned")} className="mt-6 min-h-11 text-sm font-black text-coral">Cancel and change payment</button>
    </section> : <section role="alert" className="flex flex-1 flex-col items-center justify-center py-10 text-center">
      <span className="grid h-24 w-24 place-items-center rounded-full bg-coral/15 text-[#b3321f]"><XCircle size={42} aria-hidden /></span>
      <h1 className="mt-6 text-2xl font-black">{failCopy[stage.reason].title}</h1>
      <p className="mt-2 max-w-[300px] text-stone-700">{failCopy[stage.reason].body}</p>
      <p className="mt-2 text-sm font-bold text-stone-600">Your cart and delivery details are saved.</p>
      <div className="mt-6 grid w-full max-w-[340px] gap-3">
        <button onClick={onRetry} disabled={!online} className="min-h-14 rounded-2xl bg-coral font-black text-white shadow-float disabled:bg-stone-300 disabled:text-stone-600">{online ? `Try again · ${money(total)}` : "You're offline"}</button>
        <button onClick={onChangeMethod} className="min-h-14 rounded-2xl bg-white font-black text-ink shadow-sm">Change payment method</button>
      </div>
    </section>}
    {DEMO_MODE && stage.kind === "awaiting" && <div className="rounded-app border border-dashed border-stone-300 p-4">
      <p className="text-xs font-extrabold uppercase tracking-wider text-stone-600">Demo: simulate the result</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={onApprove} className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-leaf text-sm font-black text-white"><CheckCircle2 size={16} aria-hidden /> Approved</button>
        <button onClick={() => onFail("declined")} className="min-h-12 rounded-xl bg-white text-sm font-black">Declined</button>
        <button onClick={() => onFail("timeout")} className="min-h-12 rounded-xl bg-white text-sm font-black">No response</button>
        <button onClick={() => onFail("abandoned")} className="min-h-12 rounded-xl bg-white text-sm font-black">{momo ? "Cancelled" : "Closed page"}</button>
      </div>
    </div>}
  </div>;
}

function PayTile({ active, onClick, icon, title, sub }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; sub: string }) {
  return <button type="button" role="radio" aria-checked={active} onClick={onClick} className={`flex min-h-[55px] items-center gap-2 rounded-[10px] border p-2.5 text-left ${active ? "border-coral bg-white shadow-sm" : "border-stone-100 bg-white"}`}><span className="shrink-0">{icon}</span><span><b className="block text-[10px]">{title}</b><small className="block text-[8px] text-stone-600">{sub}</small></span><span className={`ml-auto h-3.5 w-3.5 rounded-full border ${active ? "border-coral bg-coral ring-2 ring-white" : "border-stone-300"}`}/></button>;
}

function Field({ id, label, hint, error, value, onChange, icon, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & { id: string; label: string; hint?: string; error?: string; value: string; onChange: (value: string) => void; icon?: React.ReactNode }) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return <div>
    <label htmlFor={id} className="mb-1.5 block text-xs font-extrabold text-stone-600">{label}</label>
    <div className="relative">{icon && <span aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-500">{icon}</span>}<input id={id} {...props} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={describedBy} className={`min-h-[43px] w-full rounded-[10px] bg-cream ${icon ? "pl-8 pr-2" : "px-3"} text-[12px] font-semibold outline-none placeholder:text-stone-500 focus:ring-2 focus:ring-coral ${error ? "ring-2 ring-[#b3321f]" : ""}`} /></div>
    {hint && !error && <p id={`${id}-hint`} className="mt-1.5 text-xs text-stone-600">{hint}</p>}
    {error && <p id={`${id}-error`} className="mt-1.5 text-xs font-bold text-[#b3321f]">{error}</p>}
  </div>;
}
