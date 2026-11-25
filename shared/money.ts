// Amount-due rules (ADR 0005). Money is integer cents. Browser-safe.
import type { SessionType } from "./config-schema";
import type { AmountDueKind } from "./models";

export function formatUsd(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, "0");
  return `${sign}$${dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${rest}`;
}
/** "$250" when whole dollars, else "$250.50". */
export function formatUsdShort(cents: number): string {
  return cents % 100 === 0 ? formatUsd(cents).replace(".00", "") : formatUsd(cents);
}
export function priceLabel(t: Pick<SessionType, "priceFromCents" | "priceUnit">): string {
  return `from ${formatUsdShort(t.priceFromCents)}${t.priceUnit === "hour" ? "/hour" : ""}`;
}

export interface AmountDueResult {
  amountCents: number;
  kind: AmountDueKind;
  estimatedTotalCents?: number;
}

type MoneyType = Pick<SessionType, "priceFromCents" | "priceUnit" | "deposit">;

/** Estimated total for per-hour types (price x hours), undefined for per-session types. */
export function estimatedTotalCents(t: MoneyType, durationMin: number): number | undefined {
  return t.priceUnit === "hour" ? Math.round((t.priceFromCents * durationMin) / 60) : undefined;
}

export function computeAmountDue(t: MoneyType, durationMin: number): AmountDueResult {
  const est = estimatedTotalCents(t, durationMin);
  const base = est !== undefined ? { estimatedTotalCents: est } : {};
  const d = t.deposit;
  switch (d.kind) {
    case "flat":
      return { amountCents: d.amountCents, kind: "deposit", ...base };
    case "percent":
      return {
        amountCents: Math.round((d.percent / 100) * (est ?? t.priceFromCents)),
        kind: t.priceUnit === "hour" ? "estimated_deposit" : "deposit",
        ...base,
      };
    case "full":
      return { amountCents: est ?? t.priceFromCents, kind: "full", ...base };
    case "none":
      return { amountCents: 0, kind: "none", ...base };
  }
}

/** Card wording (story 001 #2). */
export function depositCardText(t: MoneyType): string {
  const d = t.deposit;
  switch (d.kind) {
    case "flat":
      return `${formatUsdShort(d.amountCents)} non-refundable retainer to book`;
    case "percent":
      return `${d.percent}% of estimated total`;
    case "full":
      return "Paid in full at booking";
    case "none":
      return "No retainer needed";
  }
}
/** Short wording for the policy sentence "A non-refundable retainer of {{depositText}} ...". */
export function depositSummaryText(t: MoneyType): string {
  const d = t.deposit;
  switch (d.kind) {
    case "flat":
      return formatUsdShort(d.amountCents);
    case "percent":
      return `${d.percent}% of the estimated total`;
    case "full":
      return "the full session fee";
    case "none":
      return "$0 (none needed)";
  }
}

/**
 * The payment link for a booking: a single URL or a map keyed by duration. Non-production may override it.
 * Stripe links get client_reference_id=<reference> (ADR 0005). Never adds the client's email.
 */
export function resolvePaymentLink(
  t: Pick<SessionType, "depositPaymentLink" | "deposit">,
  durationMin: number,
  reference: string,
  overrideUrl?: string | null,
): string | null {
  if (t.deposit.kind === "none") return null;
  const raw =
    overrideUrl ||
    (typeof t.depositPaymentLink === "string" ? t.depositPaymentLink : (t.depositPaymentLink?.[String(durationMin)] ?? null));
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    if (url.hostname === "buy.stripe.com") url.searchParams.set("client_reference_id", reference);
    return url.toString();
  } catch {
    return null;
  }
}
