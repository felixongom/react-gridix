import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { parseISODate, toISODate } from "./dates";
import { cx } from "./utils";

export interface CalendarProps {
  /** The selected day, "YYYY-MM-DD" (or empty). */
  value?: string | null;
  /** Highlights a span of days (used by the From / To filter). Either end may be missing. */
  range?: { from?: string; to?: string };
  /** Earliest and latest day that can be picked, "YYYY-MM-DD". Other days are dimmed and disabled. */
  min?: string;
  max?: string;
  /** Called with "YYYY-MM-DD" when a day is picked, or "" when Clear is pressed. */
  onPick: (iso: string) => void;
  /** Locale for month and weekday names. Defaults to the browser's. */
  locale?: string;
  /** First day of the week: 0 = Sunday (default), 1 = Monday. */
  weekStart?: 0 | 1;
  /** Hide the Today / Clear buttons. */
  hideFooter?: boolean;
  /**
   * Keep keyboard focus where it is when the calendar is clicked. The cell editor needs this so
   * its text box does not lose focus (which would save the edit before the click is handled).
   */
  keepFocus?: boolean;
  className?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** The day to show first: the selected one, else the start of the range, else today (clamped into min / max). */
function initialMonth(value?: string | null, range?: CalendarProps["range"], min?: string, max?: string): Date {
  const pick = [value, range?.from, range?.to].map((v) => (v ? parseISODate(v) : null)).find(Boolean);
  if (pick) return new Date(pick.getFullYear(), pick.getMonth(), 1);
  const today = new Date();
  let iso = toISODate(today)!;
  if (min && iso < min) iso = min;
  if (max && iso > max) iso = max;
  const d = parseISODate(iso) ?? today;
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * A month calendar for picking a day. It draws no popup of its own: put it in a popup (the cell
 * editor does) or inline (the date filter does).
 *
 * Mouse: click a day, use the arrows to change month (double arrows change year).
 * Keyboard (focus on a day): arrows move a day / week, Page Up / Page Down change month,
 * Home / End go to the start / end of the week, Enter or Space picks the day.
 */
export function Calendar({ value, range, min, max, onPick, locale, weekStart = 0, hideFooter, keepFocus, className }: CalendarProps) {
  // The month on screen (always the 1st of that month)
  const [view, setView] = useState(() => initialMonth(value, range, min, max));
  // The day that holds the keyboard focus inside the grid ("roving tabindex")
  const [focusIso, setFocusIso] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // When the selected day (or an end of the range) changes, jump to the month of whichever changed.
  // Picking a day in the month you are looking at does not move the view.
  const shown = useRef({ value, from: range?.from, to: range?.to });
  useEffect(() => {
    const prev = shown.current;
    shown.current = { value, from: range?.from, to: range?.to };
    const changed = value !== prev.value ? value : range?.from !== prev.from ? range?.from : range?.to !== prev.to ? range?.to : undefined;
    const d = changed ? parseISODate(changed) : null;
    if (d) setView((v) => (v.getFullYear() === d.getFullYear() && v.getMonth() === d.getMonth() ? v : new Date(d.getFullYear(), d.getMonth(), 1)));
  }, [value, range?.from, range?.to]);

  const todayIso = toISODate(new Date())!;
  const year = view.getFullYear();
  const month = view.getMonth();

  // Weekday names, starting from `weekStart`
  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
    // 2023-01-01 was a Sunday
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2023, 0, 1 + ((i + weekStart) % 7))));
  }, [locale, weekStart]);

  const title = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(view);

  // The 6 weeks that fill the grid: days of the previous month, this month, then the next
  const cells = useMemo(() => {
    const lead = (new Date(year, month, 1).getDay() - weekStart + 7) % 7;
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(year, month, 1 - lead + i);
      return { iso: isoOf(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), outside: d.getMonth() !== month };
    });
  }, [year, month, weekStart]);

  const disabled = (iso: string) => (!!min && iso < min) || (!!max && iso > max);
  const shiftMonth = (by: number) => setView(new Date(year, month + by, 1));

  /** Moves the keyboard focus to another day (changing month if needed) */
  const focusDay = (iso: string) => {
    const d = parseISODate(iso);
    if (!d) return;
    if (d.getFullYear() !== year || d.getMonth() !== month) setView(new Date(d.getFullYear(), d.getMonth(), 1));
    setFocusIso(iso);
    // Wait for the (possibly new) month to render, then focus the button
    requestAnimationFrame(() => gridRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${iso}"]`)?.focus());
  };

  const onDayKeyDown = (e: KeyboardEvent<HTMLButtonElement>, iso: string) => {
    const d = parseISODate(iso)!;
    const go = (days: number) => {
      e.preventDefault();
      focusDay(isoOf(d.getFullYear(), d.getMonth(), d.getDate() + days));
    };
    switch (e.key) {
      case "ArrowLeft": return go(-1);
      case "ArrowRight": return go(1);
      case "ArrowUp": return go(-7);
      case "ArrowDown": return go(7);
      case "Home": return go(-((d.getDay() - weekStart + 7) % 7));
      case "End": return go(6 - ((d.getDay() - weekStart + 7) % 7));
      case "PageUp":
      case "PageDown": {
        e.preventDefault();
        const by = e.key === "PageUp" ? -1 : 1;
        // Same day number in the other month, but never spilling into the month after it
        const last = new Date(d.getFullYear(), d.getMonth() + by + 1, 0).getDate();
        focusDay(isoOf(d.getFullYear(), d.getMonth() + by, Math.min(d.getDate(), last)));
        return;
      }
    }
  };

  // Which day is the single tab stop: the focused one, else the selected one, else today, else the 1st
  const inView = (iso: string | null | undefined) => !!iso && cells.some((c) => c.iso === iso && !c.outside);
  const tabIso = [focusIso, value, todayIso].find((iso) => inView(iso) && !disabled(iso!)) ?? cells.find((c) => !c.outside && !disabled(c.iso))?.iso;

  const from = range?.from;
  const to = range?.to;

  return (
    <div
      className={cx("rg-cal", className)}
      onMouseDown={keepFocus ? (e) => e.preventDefault() : undefined}
      role="group"
      aria-label={`Calendar, ${title}`}
    >
      <div className="rg-cal__head">
        <button type="button" className="rg-cal__nav" aria-label="Previous year" onClick={() => shiftMonth(-12)}>«</button>
        <button type="button" className="rg-cal__nav" aria-label="Previous month" onClick={() => shiftMonth(-1)}>‹</button>
        <span className="rg-cal__title" aria-live="polite">{title}</span>
        <button type="button" className="rg-cal__nav" aria-label="Next month" onClick={() => shiftMonth(1)}>›</button>
        <button type="button" className="rg-cal__nav" aria-label="Next year" onClick={() => shiftMonth(12)}>»</button>
      </div>

      <div className="rg-cal__grid" ref={gridRef}>
        {weekdays.map((w) => (
          <span key={w} className="rg-cal__dow" aria-hidden="true">{w.slice(0, 2)}</span>
        ))}
        {cells.map(({ iso, day, outside }) => {
          const selected = iso === value;
          const isFrom = iso === from;
          const isTo = iso === to;
          // Strictly between the two ends (when only one end is set, no span is drawn)
          const between = !!from && !!to && iso > from && iso < to;
          return (
            <button
              key={iso}
              type="button"
              data-iso={iso}
              tabIndex={iso === tabIso ? 0 : -1}
              disabled={disabled(iso)}
              aria-pressed={selected || isFrom || isTo}
              aria-label={new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(parseISODate(iso)!)}
              className={cx(
                "rg-cal__day",
                outside && "rg-cal__day--outside",
                iso === todayIso && "rg-cal__day--today",
                (selected || isFrom || isTo) && "rg-cal__day--selected",
                between && "rg-cal__day--in-range",
                from && to && isFrom && from !== to && "rg-cal__day--range-start",
                from && to && isTo && from !== to && "rg-cal__day--range-end"
              )}
              onClick={() => onPick(iso)}
              onKeyDown={(e) => onDayKeyDown(e, iso)}
              onFocus={() => setFocusIso(iso)}
            >
              {day}
            </button>
          );
        })}
      </div>

      {!hideFooter && (
        <div className="rg-cal__foot">
          <button
            type="button"
            className="rg-cal__link"
            disabled={disabled(todayIso)}
            onClick={() => {
              setView(initialMonth(todayIso));
              onPick(todayIso);
            }}
          >
            Today
          </button>
          <button type="button" className="rg-cal__link" onClick={() => onPick("")}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
