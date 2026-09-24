// UI-side check only. The trusted server re-validates every number before it reaches Paystack or a rider.
/** Accepts 024 123 4567, 0241234567, +233 24 123 4567 or 233241234567. Returns E.164 (+233…) or null. */
export function normaliseGhPhone(raw: string): string | null {
  const digits = raw.replace(/[\s\-().]/g, "");
  const match = digits.match(/^(?:\+?233|0)([25]\d{8})$/);
  return match ? `+233${match[1]}` : null;
}

/** +233241234567 → 024 123 4567 */
export function displayGhPhone(e164: string) {
  const local = `0${e164.slice(4)}`;
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}
