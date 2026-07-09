/**
 * Extracts a user-facing error message from a rejected API call.
 *
 * The axios client (src/services/api.ts) attaches a safe, always-string
 * `friendlyMessage` to every error it rejects with. Screens repeatedly did
 * `err?.friendlyMessage || 'some fallback'` to surface it; this centralizes
 * that so the extraction logic lives in one place.
 *
 * @param err      The caught error (typically an axios error).
 * @param fallback Message to show when no `friendlyMessage` is present.
 */
export function getErrorMessage(err: any, fallback: string): string {
  return err?.friendlyMessage || fallback;
}
