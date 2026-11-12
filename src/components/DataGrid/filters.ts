import type { ColumnDef, DateRangeFilter, FilterOption, FilterType, FilterValue, NumberRangeFilter, TextFilter, TextFilterOperator } from "./types";
import { toISODate } from "./dates";

/*
  Typed column filters. The value a filter holds depends on its kind:
    "text" / "exact" -> a string                       "sales"
                        (or { operator, value } when the column has `filterOperators`)
    "number"         -> a range                        { min: 10, max: 50 }
    "date"           -> a range of "YYYY-MM-DD" days   { from: "2026-01-01", to: "2026-03-31" }
    "select"         -> the chosen values              ["active", "pending"]
*/

/** Which kind of filter a column gets: its `filterType`, else a sensible default for its `type`. */
export function resolveFilterKind<T>(c: ColumnDef<T>): FilterType {
  if (c.filterType) return c.filterType;
  if (c.type === "number") return "number";
  if (c.type === "date") return "date";
  if (c.type === "boolean") return "select";
  return "text";
}

/** Every text comparison, in the order the drop-down lists them. */
export const ALL_TEXT_OPERATORS: TextFilterOperator[] = [
  "contains",
  "notContains",
  "equals",
  "notEquals",
  "startsWith",
  "notStartsWith",
  "endsWith",
  "notEndsWith",
];

/** The words shown for each comparison. */
export const OPERATOR_LABELS: Record<TextFilterOperator, string> = {
  contains: "Contains",
  notContains: "Does not contain",
  equals: "Equals",
  notEquals: "Not equal",
  startsWith: "Starts with",
  notStartsWith: "Does not start with",
  endsWith: "Ends with",
  notEndsWith: "Does not end with",
};

/**
 * The comparisons a column's drop-down offers, or null when the column has none (the default).
 * `filterOperators: true` offers all eight; a list offers just those (in the standard order).
 */
export function resolveOperators<T>(c: ColumnDef<T>): TextFilterOperator[] | null {
  const setting = c.filterOperators;
  if (!setting) return null;
  if (setting === true) return ALL_TEXT_OPERATORS;
  const list = ALL_TEXT_OPERATORS.filter((op) => setting.includes(op));
  return list.length > 0 ? list : null;
}

/** The comparison used when the user has not picked one: the column's `filterOperator`, else equals (exact filters) or contains. */
export function defaultOperator<T>(c: ColumnDef<T>, kind: FilterType): TextFilterOperator {
  const offered = resolveOperators(c);
  const wanted = c.filterOperator ?? (kind === "exact" ? "equals" : "contains");
  // Never start on a comparison that is not in the list
  return offered && !offered.includes(wanted) ? offered[0] : wanted;
}

/** Compares a cell's text with what was typed (both ignoring case) the way `operator` says. */
export function compareText(operator: TextFilterOperator, cell: string, typed: string): boolean {
  const a = cell.toLowerCase();
  const b = typed.trim().toLowerCase();
  switch (operator) {
    case "contains": return a.includes(b);
    case "notContains": return !a.includes(b);
    case "equals": return a === b;
    case "notEquals": return a !== b;
    case "startsWith": return a.startsWith(b);
    case "notStartsWith": return !a.startsWith(b);
    case "endsWith": return a.endsWith(b);
    case "notEndsWith": return !a.endsWith(b);
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** True when the filter would actually hide rows. The check looks at the value's shape, so it needs no kind. */
export function isFilterActive(value: FilterValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  if (isObject(value)) {
    const v = value as Record<string, unknown>;
    // { operator, value }: only counts once some text was typed
    if (typeof v.operator === "string") return typeof v.value === "string" && v.value.trim() !== "";
    return typeof v.min === "number" || typeof v.max === "number" || !!v.from || !!v.to;
  }
  return false;
}

/**
 * Does one row pass the filter?
 * @param display the cell's displayed text (after valueFormatter)
 * @param raw the raw value stored in the row
 */
export function matchesFilter<T>(kind: FilterType, value: FilterValue, display: string, raw: unknown): boolean {
  switch (kind) {
    case "text":
    case "exact": {
      // A plain string uses the filter's own comparison; an object carries the one the user picked
      if (isObject(value)) {
        const f = value as unknown as TextFilter;
        return compareText(f.operator, display, String(f.value ?? ""));
      }
      return compareText(kind === "exact" ? "equals" : "contains", display, String(value));
    }
    case "number": {
      const { min, max } = value as NumberRangeFilter;
      const n = typeof raw === "number" ? raw : raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
      if (Number.isNaN(n)) return false; // a row without a number never matches a number range
      return (typeof min !== "number" || n >= min) && (typeof max !== "number" || n <= max);
    }
    case "date": {
      const { from, to } = value as DateRangeFilter;
      const iso = toISODate(raw);
      if (!iso) return false;
      // "YYYY-MM-DD" strings sort correctly as plain text, so comparing strings is enough.
      return (!from || iso >= from) && (!to || iso <= to);
    }
    case "select":
      return (value as string[]).includes(String(raw ?? ""));
  }
}

/**
 * The choices of a "select" filter: the column's `filterOptions` if it has some, otherwise every
 * distinct non-empty value found in the rows (labelled with its displayed text, sorted by label).
 * Boolean columns always get Yes / No.
 */
export function buildOptions<T>(c: ColumnDef<T>, rows: T[], read: (row: T) => unknown, show: (row: T) => string): FilterOption[] {
  if (c.filterOptions) return c.filterOptions.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  if (c.type === "boolean") {
    return [
      { value: "true", label: "Yes" },
      { value: "false", label: "No" },
    ];
  }
  const seen = new Map<string, string>();
  for (const row of rows) {
    const raw = read(row);
    if (raw === null || raw === undefined || raw === "") continue;
    const key = String(raw);
    if (!seen.has(key)) seen.set(key, show(row));
  }
  return [...seen]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}
