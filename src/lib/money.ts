export function formatMoneyCents(
  amountCents: number | null | undefined,
  currency?: string | null,
) {
  void currency;
  if (amountCents == null) return "-";

  const amount = amountCents / 100;

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `EUR ${amount.toFixed(2)}`;
  }
}
