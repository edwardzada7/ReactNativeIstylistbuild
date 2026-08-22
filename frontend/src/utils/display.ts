export function formatRating(rating: number | string | null | undefined): string {
  const numericRating = Number(rating);
  return Number.isFinite(numericRating) && numericRating > 0 ? numericRating.toFixed(1) : 'New';
}

export function withCacheBuster(url: string | null | undefined, timestamp = Date.now()): string | null {
  if (!url) return null;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${timestamp}`;
}
