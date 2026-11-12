/*
  Helpers for the "date" column type.

  Dates travel through the grid as "YYYY-MM-DD" strings (what <input type="date"> uses). We always
  work in the user's LOCAL time zone, so a date typed as 5 Nov never shifts to 4 Nov because of UTC.
*/

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-11-05" -> a local Date at midnight. Returns null when the text is not a real calendar date. */
export function parseISODate(iso: string): Date | null {
  const m = ISO_DATE.exec(iso);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  // new Date(2026, 1, 31) quietly becomes 3 March, so check that the parts survived.
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null;
}

/**
 * Turns whatever a row holds (Date, "2026-11-05", "2026-11-05T10:30:00Z", a timestamp, "Nov 5, 2026")
 * into "YYYY-MM-DD", or null when it is empty or not a date.
 */
export function toISODate(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  if (typeof value === "number") return Number.isFinite(value) ? toISODate(new Date(value)) : null;
  if (typeof value === "string") {
    const text = value.trim();
    if (text === "") return null;
    // Strings that start with a full ISO date keep that date exactly as written (no time zone shift).
    const head = /^\d{4}-\d{2}-\d{2}/.exec(text)?.[0];
    if (head) return parseISODate(head) ? head : null;
    const parsed = Date.parse(text);
    return Number.isNaN(parsed) ? null : toISODate(new Date(parsed));
  }
  return null;
}

/** Text shown in a date cell. Falls back to the raw text when the value is not a recognisable date. */
export function formatDate(value: unknown, locale?: string, options?: Intl.DateTimeFormatOptions): string {
  const iso = toISODate(value);
  if (!iso) return value === null || value === undefined ? "" : String(value);
  return parseISODate(iso)!.toLocaleDateString(locale, options ?? { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Converts the picker's "YYYY-MM-DD" back into the same kind of value the row already holds:
 * a Date stays a Date, a timestamp stays a number, anything else becomes the ISO string.
 * An empty picker value becomes null.
 */
export function fromISODate(iso: string, like: unknown): unknown {
  if (iso === "") return null;
  if (like instanceof Date) return parseISODate(iso);
  if (typeof like === "number") return parseISODate(iso)?.getTime() ?? null;
  return iso;
}
