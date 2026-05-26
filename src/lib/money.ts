export function formatMoneyCents(
  amountCents: number | null | undefined,
  currency?: string | null,
) {
  if (amountCents == null) return "-";

  const amount = amountCents / 100;
  const resolvedCurrency = currency?.trim().toUpperCase() || "EUR";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: resolvedCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${resolvedCurrency} ${amount.toFixed(2)}`;
  }
}

export function moneyMajorToCents(amount: string | number | null | undefined) {
  if (amount === null || amount === undefined || amount === "") return null;
  const parsed = typeof amount === "number" ? amount : Number.parseFloat(amount);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

export function moneyCentsToMajorString(amountCents: number | null | undefined) {
  if (amountCents == null) return "";
  const amount = amountCents / 100;
  return Number.isInteger(amount) ? String(amount) : String(amount);
}
