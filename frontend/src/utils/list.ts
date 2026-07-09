/**
 * Normalizes a raw API response into an array.
 *
 * Different endpoints on the production API return list data in slightly
 * different shapes: sometimes a bare array, sometimes wrapped under a key such
 * as `data`, `results`, or a resource-specific key (`transactions`,
 * `bookings`, `reviews`, `providers`, ...). This helper returns the array
 * whether it's already an array or nested under one of the provided keys,
 * falling back to an empty array so callers can always safely `.map()` over
 * the result.
 *
 * @param raw  The raw response body.
 * @param keys Ordered list of keys to look under when `raw` isn't itself an
 *             array. The first truthy match wins (matching the previous
 *             `raw?.data || raw?.xxx || []` behavior each service used).
 */
export function toList(raw: any, keys: string[] = ['data', 'results']): any[] {
  if (Array.isArray(raw)) return raw;
  for (const key of keys) {
    const value = raw?.[key];
    if (value) return value;
  }
  return [];
}
