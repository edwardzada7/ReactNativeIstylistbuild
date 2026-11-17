// Shared time/date helpers.
//
// The backend validates every time field as strict 24-hour "HH:MM" and rejects
// anything else with "Time must be in HH:MM format". Postgres `time` columns
// come back as "HH:MM:SS", and people type "9:00" or "900", so every screen that
// reads or writes times must go through these helpers.

/** Converts "9:00", "900", "09:00:00", "9" ... to strict "HH:MM". Returns null if it cannot be a valid time. */
export function normalizeTime(value?: string | number | null): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;

  let hours: number;
  let minutes: number;

  const colon = text.match(/^(\d{1,2})\s*[:.]\s*(\d{1,2})(?:\s*[:.]\s*\d{1,2}(?:\.\d+)?)?$/);
  const compact = text.match(/^(\d{1,2})(\d{2})$/);
  const hourOnly = text.match(/^(\d{1,2})$/);

  if (colon) {
    hours = Number(colon[1]);
    minutes = Number(colon[2]);
  } else if (compact) {
    hours = Number(compact[1]);
    minutes = Number(compact[2]);
  } else if (hourOnly) {
    hours = Number(hourOnly[1]);
    minutes = 0;
  } else {
    return null;
  }

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Like normalizeTime but falls back to a default instead of null (for values loaded from the API). */
export function normalizeTimeOr(value: string | number | null | undefined, fallback: string): string {
  return normalizeTime(value) ?? fallback;
}

/** Minutes since midnight for a "HH:MM" string. */
export function timeToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Validates an opening/closing pair. Returns an error message, or null when valid.
 * `label` is used in the message, e.g. "Friday".
 */
export function validateTimeRange(label: string, start?: string | null, end?: string | null): string | null {
  const s = normalizeTime(start);
  const e = normalizeTime(end);
  if (!s) return `${label}: opening time "${start ?? ''}" is not valid. Use 24-hour HH:MM, e.g. 09:00.`;
  if (!e) return `${label}: closing time "${end ?? ''}" is not valid. Use 24-hour HH:MM, e.g. 18:00.`;
  if (timeToMinutes(e) <= timeToMinutes(s)) return `${label}: closing time must be later than opening time.`;
  return null;
}

/** Local calendar date as YYYY-MM-DD. toISOString() uses UTC and returns the wrong day for users east of UTC after midnight. */
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Normalizes whatever the available-slots endpoints return into a sorted, de-duplicated list of "HH:MM" strings.
 * Accepts plain arrays, { slots | available_slots | times | data }, and entries that are strings or
 * { time | start_time | slot, available | is_available }.
 */
export function normalizeSlots(raw: any): string[] {
  const list: any[] = Array.isArray(raw)
    ? raw
    : raw?.slots || raw?.available_slots || raw?.times || raw?.data || [];
  if (!Array.isArray(list)) return [];

  const seen = new Set<string>();
  list.forEach((entry) => {
    if (entry && typeof entry === 'object') {
      if (entry.available === false || entry.is_available === false || entry.booked === true) return;
      const time = normalizeTime(entry.time ?? entry.start_time ?? entry.slot ?? entry.start);
      if (time) seen.add(time);
    } else {
      const time = normalizeTime(entry);
      if (time) seen.add(time);
    }
  });
  return Array.from(seen).sort();
}

/** Drops slots that have already started when `date` is today. */
export function dropPastSlots(slots: string[], date: Date, now: Date = new Date()): string[] {
  if (toLocalDateString(date) !== toLocalDateString(now)) return slots;
  const current = now.getHours() * 60 + now.getMinutes();
  return slots.filter((slot) => timeToMinutes(slot) > current);
}
