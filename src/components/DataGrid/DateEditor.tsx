import { useRef, type CSSProperties, type FocusEvent, type KeyboardEvent } from "react";
import { Calendar } from "./Calendar";
import { parseISODate, toISODate } from "./dates";
import { Popup } from "./Popup";

export interface DateEditorProps {
  /** The text in the box: "YYYY-MM-DD" or whatever the user has typed so far. */
  value: string;
  onChange: (text: string) => void;
  /** Called when a day is picked in the calendar ("" for Clear). The grid saves the edit. */
  onPick: (iso: string) => void;
  onBlur: (e: FocusEvent<HTMLInputElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  min?: string;
  max?: string;
  locale?: string;
  invalid?: boolean;
  label: string;
  theme?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * The editor of a `type: "date"` cell: a text box (type "2026-11-05" if you like) with a calendar
 * that drops down under it. The calendar follows what is typed, clicking a day saves it at once, and
 * Enter / Tab / Esc work like in every other editor because the text box keeps the focus.
 */
export function DateEditor({ value, onChange, onPick, onBlur, onKeyDown, min, max, locale, invalid, label, theme, className, style }: DateEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Arrow keys move the selected day while the text box keeps the focus:
   *   Up / Down          one week back / forward
   *   Ctrl or Alt + Left / Right   one day back / forward
   *   Page Up / Page Down          one month back / forward
   * (plain Left / Right still move the text cursor). Anything else goes to the grid's normal editor keys.
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const modified = e.ctrlKey || e.altKey || e.metaKey;
    // How far to move: always both numbers, so TypeScript knows each one is defined
    const step: { days: number; months: number } | null =
      e.key === "ArrowUp" ? { days: -7, months: 0 } :
      e.key === "ArrowDown" ? { days: 7, months: 0 } :
      modified && e.key === "ArrowLeft" ? { days: -1, months: 0 } :
      modified && e.key === "ArrowRight" ? { days: 1, months: 0 } :
      e.key === "PageUp" ? { days: 0, months: -1 } :
      e.key === "PageDown" ? { days: 0, months: 1 } : null;
    if (!step || e.shiftKey) return onKeyDown(e);

    e.preventDefault(); // do not also move the cell or the text cursor
    const from = parseISODate(value) ?? new Date();
    // Months: same day number in the other month, but never spilling into the month after it
    const lastDay = new Date(from.getFullYear(), from.getMonth() + step.months + 1, 0).getDate();
    const next = new Date(from.getFullYear(), from.getMonth() + step.months, Math.min(from.getDate(), lastDay) + step.days);
    let iso = toISODate(next)!;
    if (min && iso < min) iso = min; // stay inside dateMin / dateMax
    if (max && iso > max) iso = max;
    onChange(iso);
  };

  return (
    <>
      <input
        ref={inputRef}
        autoFocus
        type="text"
        inputMode="numeric"
        placeholder="YYYY-MM-DD"
        autoComplete="off"
        className={className}
        style={style}
        value={value}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-haspopup="dialog"
        aria-expanded
        onChange={(e) => onChange(e.target.value.trim())}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
      />
      {/* The popup never takes focus (keepFocus), so the text box stays the active element */}
      <Popup anchorRef={inputRef} open onClose={() => undefined} label={label} theme={theme} className="rg-date-popup" keepFocus>
        <Calendar value={value} min={min} max={max} locale={locale} onPick={onPick} keepFocus />
      </Popup>
    </>
  );
}
