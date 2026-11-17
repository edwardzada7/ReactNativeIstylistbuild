export function formatRating(rating: number | string | null | undefined): string {
  const numericRating = Number(rating);
  return Number.isFinite(numericRating) && numericRating > 0 ? numericRating.toFixed(1) : 'New';
}

// One stable cache-buster value per app session. It used to be Date.now() on every
// call, which gave each avatar a brand-new URL every time a component mounted, so
// the image cache never hit and every list scroll re-downloaded every photo. Now
// avatars are fetched once per session and only refetched after bumpAvatarVersion()
// (called when the user uploads a new photo).
let avatarVersion = Date.now();

export function bumpAvatarVersion(): number {
  avatarVersion = Date.now();
  return avatarVersion;
}

export function withCacheBuster(url: string | null | undefined, timestamp: number = avatarVersion): string | null {
  if (!url) return null;
  // Local/inline sources (base64 data URIs, file://, blob:) cannot take a query
  // string - appending one corrupts the base64 payload - and are never cached remotely.
  if (/^(data|file|blob|content|asset):/i.test(url)) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${timestamp}`;
}
