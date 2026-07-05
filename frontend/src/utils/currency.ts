// Centralized currency configuration. iStylist is launching in Nigeria, so
// all money values are displayed in Naira. To expand to another market
// later, only this file needs to change (plus, ideally, a per-user/region
// lookup instead of a single constant).
export const CURRENCY = {
  code: 'NGN',
  symbol: '\u20A6', // ₦
  locale: 'en-NG',
};

/**
 * Formats a numeric amount using the app's configured currency, e.g.
 * formatCurrency(15000) -> "₦15,000".
 */
export function formatCurrency(amount: number | string | undefined | null): string {
  const num = Number(amount);
  const safeNum = Number.isFinite(num) ? num : 0;
  return `${CURRENCY.symbol}${safeNum.toLocaleString(CURRENCY.locale, {
    maximumFractionDigits: 0,
  })}`;
}

/**
 * Some provider records use a tier indicator (e.g. "$$", "$$$") instead of a
 * real amount. This swaps any "$" characters for the configured currency
 * symbol so nothing shows USD, while preserving the relative tier meaning.
 */
export function formatPriceRange(range?: string | null): string {
  if (!range) return CURRENCY.symbol;
  return range.replace(/\$/g, CURRENCY.symbol);
}
