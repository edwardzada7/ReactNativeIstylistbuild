// The API sends UTC timestamps without a zone suffix ("2026-11-20T04:30:00"). JS reads
// those as LOCAL time, which made new items look an hour old in Lagos (UTC+1).
export function parseServerDate(iso: string): Date {
  const value = String(iso).trim();
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const looksLikeDateTime = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value);
  return new Date(looksLikeDateTime && !hasZone ? `${value.replace(' ', 'T')}Z` : value);
}

export function formatRelativeTime(iso?: string | null): string {
  if (!iso) return 'Just now';

  const timestamp = parseServerDate(iso);
  if (Number.isNaN(timestamp.getTime())) return 'Just now';

  const diffMs = Date.now() - timestamp.getTime();
  if (diffMs <= 0) return 'Just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds || 1} second${seconds === 1 ? '' : 's'} ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;

  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}
