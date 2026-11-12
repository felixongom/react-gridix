import { createElement, useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useDebouncedCall } from "./hooks";
import { Checkbox } from "../Checkbox/Checkbox";
import { defaultOperator, isFilterActive, OPERATOR_LABELS, resolveOperators } from "./filters";
import { Calendar } from "./Calendar";
import { parseISODate } from "./dates";
import { Popup } from "./Popup";
import type {
  ColumnDef,
  DateRangeFilter,
  FilterOption,
  FilterType,
  FilterValue,
  NumberRangeFilter,
  TextFilter,
  TextFilterOperator,
} from "./types";
import { cx } from "./utils";

export interface ColumnFilterProps<T> {
  column: ColumnDef<T>;
  /** Name used in accessible labels. */
  label: string;
  /** Which controls the popup shows. */
  kind: FilterType;
  /** The column's current filter value (undefined when there is none). */
  value: FilterValue | undefined;
  /** Pass undefined to remove the filter. */
  onChange: (value: FilterValue | undefined) => void;
  /** Choices for the `"select"` kind. */
  options: FilterOption[];
  /** Milliseconds to wait after typing before the text / number filter is applied (0 = at once). */
  debounce?: number;
  theme?: string;
  indicatorClassName?: string;
  indicatorStyle?: CSSProperties;
  popupClassName?: string;
  popupStyle?: CSSProperties;
  inputClassName?: string;
  inputStyle?: CSSProperties;
}

/** Reads a number out of a text box. Empty or invalid text means "no bound". */
const parseBound = (text: string): number | undefined => {
  if (text.trim() === "") return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/* ---------------------------- the controls in the popup ---------------------------- */

interface EditorProps {
  label: string;
  inputClassName?: string;
  inputStyle?: CSSProperties;
}

/**
 * Min and max boxes for a `"number"` filter (a range: either box may be left empty).
 * The boxes update at once; the filter itself is applied `debounce` ms after the last keystroke.
 */
function NumberRangeEditor({
  value,
  onChange,
  label,
  debounce,
  inputClassName,
  inputStyle,
}: EditorProps & { value: FilterValue | undefined; onChange: (v: FilterValue | undefined) => void; debounce: number }) {
  const range: NumberRangeFilter = isObject(value) ? (value as NumberRangeFilter) : {};

  // Keep the text the user typed ("1." or "-" are not numbers yet), and only report valid numbers
  const [lo, setLo] = useState(range.min === undefined ? "" : String(range.min));
  const [hi, setHi] = useState(range.max === undefined ? "" : String(range.max));

  // The last range this editor reported, to tell our own changes from changes made outside
  const reported = useRef<NumberRangeFilter>(range);

  const apply = useDebouncedCall((nextLo: string, nextHi: string) => {
    const min = parseBound(nextLo);
    const max = parseBound(nextHi);
    reported.current = { min, max };
    onChange(min === undefined && max === undefined ? undefined : { min, max });
  }, debounce);

  // When the filter is changed from outside (Clear button, controlled filters), reset the text
  // and forget any typing that was still waiting for its delay
  useEffect(() => {
    if (range.min === reported.current.min && range.max === reported.current.max) return;
    reported.current = range;
    apply.cancel();
    setLo(range.min === undefined ? "" : String(range.min));
    setHi(range.max === undefined ? "" : String(range.max));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.min, range.max]);

  return (
    <div className="rg-grid__filter-fields">
      <label className="rg-grid__filter-field">
        <span>Min</span>
        <input
          autoFocus
          type="number"
          className={cx("rg-grid__filter-input", inputClassName)}
          style={inputStyle}
          value={lo}
          aria-label={`Minimum ${label}`}
          onChange={(e) => {
            setLo(e.target.value);
            apply.call(e.target.value, hi);
          }}
          onKeyDown={(e) => e.key === "Enter" && apply.flush()}
        />
      </label>
      <label className="rg-grid__filter-field">
        <span>Max</span>
        <input
          type="number"
          className={cx("rg-grid__filter-input", inputClassName)}
          style={inputStyle}
          value={hi}
          aria-label={`Maximum ${label}`}
          onChange={(e) => {
            setHi(e.target.value);
            apply.call(lo, e.target.value);
          }}
          onKeyDown={(e) => e.key === "Enter" && apply.flush()}
        />
      </label>
    </div>
  );
}

/**
 * One text box for the "text" and "exact" filters. Typing shows at once; the filter is applied
 * `debounce` ms after the last keystroke, or immediately when Enter is pressed.
 */
function TextEditor({
  value,
  onChange,
  onEnter,
  label,
  kind,
  placeholder,
  debounce,
  inputClassName,
  inputStyle,
}: EditorProps & {
  value: string;
  onChange: (v: FilterValue | undefined) => void;
  onEnter: () => void;
  kind: FilterType;
  placeholder?: string;
  debounce: number;
}) {
  const [draft, setDraft] = useState(value);
  const reported = useRef(value); // the last text this editor reported

  const apply = useDebouncedCall((text: string) => {
    reported.current = text;
    onChange(text || undefined);
  }, debounce);

  // Changed from outside (Clear button, controlled filters): show it, and drop waiting typing
  useEffect(() => {
    if (value === reported.current) return;
    reported.current = value;
    apply.cancel();
    setDraft(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      autoFocus
      type="text"
      className={cx("rg-grid__filter-input", inputClassName)}
      style={inputStyle}
      value={draft}
      placeholder={placeholder ?? (kind === "exact" ? `Exactly…` : `Filter ${label}…`)}
      aria-label={`Filter text for ${label}`}
      onChange={(e) => {
        setDraft(e.target.value);
        apply.call(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          // preventDefault: otherwise the Enter "keypress" lands on the indicator button we focus
          // below and counts as a click on it, which would open the popup again
          e.preventDefault();
          apply.flush(); // apply right now, then close the popup
          onEnter();
        }
      }}
    />
  );
}

/**
 * From and To boxes plus a calendar for a `"date"` filter.
 *
 * Dates can be typed ("2026-03-01") or picked: the first click on the calendar sets From, the second
 * sets To (swapped if it is earlier), and a third click starts a new range. Either end may stay empty.
 */
function DateRangeEditor({
  value,
  onChange,
  label,
  inputClassName,
  inputStyle,
  min,
  max,
  locale,
}: EditorProps & { value: FilterValue | undefined; onChange: (v: FilterValue | undefined) => void; min?: string; max?: string; locale?: string }) {
  const range: DateRangeFilter = isObject(value) ? (value as DateRangeFilter) : {};
  const report = (from: string | undefined, to: string | undefined) =>
    onChange(!from && !to ? undefined : { from: from || undefined, to: to || undefined });

  // What is typed in the two boxes. Only complete, real dates are reported to the grid.
  const [fromText, setFromText] = useState(range.from ?? "");
  const [toText, setToText] = useState(range.to ?? "");

  // Keep the boxes in step when the range is changed from outside (calendar clicks, Clear, controlled filters)
  useEffect(() => {
    if ((parseISODate(fromText) ? fromText : "") !== (range.from ?? "")) setFromText(range.from ?? "");
    if ((parseISODate(toText) ? toText : "") !== (range.to ?? "")) setToText(range.to ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  const typed = (which: "from" | "to", text: string) => {
    (which === "from" ? setFromText : setToText)(text);
    // An empty box clears that end, a complete real date sets it, anything else is still being typed
    if (text !== "" && !parseISODate(text)) return;
    const next = text || undefined;
    which === "from" ? report(next, range.to) : report(range.from, next);
  };

  const pick = (iso: string) => {
    if (!iso) return;
    if (!range.from || range.to) report(iso, undefined); // start a new range
    else if (iso < range.from) report(iso, range.from); // clicked before From: swap
    else report(range.from, iso);
  };

  const box = (which: "from" | "to", text: string, autoFocus: boolean) => (
    <label className="rg-grid__filter-field">
      <span>{which === "from" ? "From" : "To"}</span>
      <input
        autoFocus={autoFocus}
        type="text"
        inputMode="numeric"
        placeholder="YYYY-MM-DD"
        className={cx("rg-grid__filter-input", text !== "" && !parseISODate(text) && "rg-grid__filter-input--invalid", inputClassName)}
        style={inputStyle}
        value={text}
        aria-label={`${label} ${which}`}
        aria-invalid={(text !== "" && !parseISODate(text)) || undefined}
        onChange={(e) => typed(which, e.target.value.trim())}
      />
    </label>
  );

  return (
    <div className="rg-grid__filter-fields rg-grid__filter-fields--stack">
      <div className="rg-grid__filter-date-row">
        {box("from", fromText, true)}
        {box("to", toText, false)}
      </div>
      <Calendar range={range} min={min} max={max} locale={locale} onPick={pick} hideFooter />
    </div>
  );
}

/** A list of checkboxes for a `"select"` filter. */
function SelectEditor({
  value,
  onChange,
  options,
}: {
  value: FilterValue | undefined;
  onChange: (v: FilterValue | undefined) => void;
  options: FilterOption[];
}) {
  const selected = Array.isArray(value) ? value : [];
  const toggle = (optionValue: string, on: boolean) => {
    const next = on ? [...selected, optionValue] : selected.filter((v) => v !== optionValue);
    onChange(next.length ? next : undefined);
  };
  return (
    <div className="rg-grid__filter-fields rg-grid__filter-options" role="group">
      {options.length === 0 && <span className="rg-grid__filter-empty">No values</span>}
      {options.map((o) => (
        <Checkbox
          key={o.value}
          checked={selected.includes(o.value)}
          onChange={(on) => toggle(o.value, on)}
          label={o.label ?? o.value}
        />
      ))}
    </div>
  );
}

/* ---------------------------- the comparison drop-down ---------------------------- */

/**
 * The drop-down at the top of a text filter popup: "Contains", "Equals", "Starts with" ...
 * It is a small listbox built by hand (instead of a native <select>) so it looks the same everywhere
 * and follows the grid's theme. Click or use the keyboard: Up / Down move, Enter or Space pick, Esc closes the list.
 */
function OperatorSelect({
  value,
  options,
  onChange,
  label,
}: {
  value: TextFilterOperator;
  options: TextFilterOperator[];
  onChange: (op: TextFilterOperator) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  // The option the keyboard is on while the list is open
  const [active, setActive] = useState(0);
  const listId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);

  const show = () => {
    setActive(Math.max(0, options.indexOf(value)));
    setOpen(true);
  };
  const choose = (op: TextFilterOperator) => {
    onChange(op);
    setOpen(false);
    btnRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        show();
      }
      return; // Enter / Space click the button, which opens the list
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => Math.min(options.length - 1, a + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault(); // do not also click the button, which would reopen the list
        choose(options[active]);
        break;
      case "Escape":
        // Close only the list. stopPropagation keeps the popup itself open.
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <div className="rg-op">
      <button
        ref={btnRef}
        type="button"
        className="rg-op__btn"
        role="combobox"
        aria-label={`Comparison for ${label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      >
        <span className="rg-op__value">{OPERATOR_LABELS[value]}</span>
        <svg className="rg-op__chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" />
        </svg>
      </button>
      {open && (
        // mousedown must not move focus away from the button, or onBlur would close the list before the click lands
        <ul id={listId} role="listbox" className="rg-op__list" aria-label={`Comparisons for ${label}`} onMouseDown={(e) => e.preventDefault()}>
          {options.map((op, i) => (
            <li
              key={op}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={op === value}
              data-op={op}
              className={cx("rg-op__option", op === value && "rg-op__option--selected", i === active && "rg-op__option--active")}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(op)}
            >
              {OPERATOR_LABELS[op]}
              {op === value && (
                <svg className="rg-op__check" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2.5 6.5 5 9l4.5-5.5" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------------------- the indicator and its popup ---------------------------- */

/**
 * The filter indicator in a column header (a dot, or your own component) and the popup that opens
 * next to it when it is clicked. The popup shows the controls for the column's filter kind.
 */
export function ColumnFilter<T>({
  column,
  label,
  kind,
  value,
  onChange,
  options,
  debounce = 300,
  theme,
  indicatorClassName,
  indicatorStyle,
  popupClassName,
  popupStyle,
  inputClassName,
  inputStyle,
}: ColumnFilterProps<T>) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const active = isFilterActive(value);
  const close = useCallback(() => setOpen(false), []);

  // Text boxes: the default control, and what a custom `filterRenderer` receives.
  // With a comparison drop-down the value is { operator, value }; without it, the plain string.
  const asText = isObject(value) ? (value as unknown as TextFilter) : null;
  const text = typeof value === "string" ? value : typeof asText?.value === "string" ? asText.value : "";

  // The drop-down is opt-in (`filterOperators` on the column) and belongs to the built-in text box only
  const operators = (kind === "text" || kind === "exact") && !column.filterRenderer ? resolveOperators(column) : null;
  // What the user picked while no text is typed yet (the filter itself holds the operator once there is text)
  const [pickedOp, setPickedOp] = useState<TextFilterOperator>(() => defaultOperator(column, kind));
  const operator: TextFilterOperator = asText && typeof asText.operator === "string" ? asText.operator : pickedOp;

  /** Turns the text the text box reports into the value stored in the grid's filters. */
  const reportText = (v: FilterValue | undefined) => {
    if (v === undefined) return onChange(undefined);
    onChange(operators ? { operator, value: String(v) } : v);
  };
  const pickOperator = (op: TextFilterOperator) => {
    setPickedOp(op);
    if (text.trim() !== "") onChange({ operator: op, value: text }); // re-filter at once with the new comparison
  };

  const renderControls = () => {
    // A custom component replaces every built-in control
    if (column.filterRenderer) {
      return createElement(column.filterRenderer, { column, value: text, onChange: (v: string) => onChange(v || undefined) });
    }
    switch (kind) {
      case "number":
        return <NumberRangeEditor value={value} onChange={onChange} label={label} debounce={debounce} inputClassName={inputClassName} inputStyle={inputStyle} />;
      case "date":
        return <DateRangeEditor value={value} onChange={onChange} label={label} min={column.dateMin} max={column.dateMax} locale={column.dateLocale} inputClassName={inputClassName} inputStyle={inputStyle} />;
      case "select":
        return <SelectEditor value={value} onChange={onChange} options={options} />;
      default:
        // "text" and "exact" share one text box. Enter applies it and closes the popup.
        return (
          <div className="rg-grid__filter-stack">
            {operators && <OperatorSelect value={operator} options={operators} onChange={pickOperator} label={label} />}
            <TextEditor
              value={text}
              onChange={reportText}
              onEnter={() => {
                setOpen(false);
                buttonRef.current?.focus();
              }}
              label={label}
              kind={kind}
              placeholder={column.filterPlaceholder}
              debounce={debounce}
              inputClassName={inputClassName}
              inputStyle={inputStyle}
            />
          </div>
        );
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={cx(
          "rg-grid__filter-btn",
          active && "rg-grid__filter-btn--active",
          open && "rg-grid__filter-btn--open",
          indicatorClassName
        )}
        style={indicatorStyle}
        aria-label={`Filter ${label}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-active={active || undefined}
        onClick={(e) => {
          e.stopPropagation(); // do not also sort the column
          setOpen((o) => !o);
        }}
        // Space and Enter on this button must not bubble up and sort the column either
        onKeyDown={(e) => e.stopPropagation()}
      >
        {column.filterIndicator ? (
          createElement(column.filterIndicator, { column, active, open })
        ) : (
          <span className="rg-grid__filter-dot" aria-hidden="true" />
        )}
      </button>

      <Popup
        anchorRef={buttonRef}
        open={open}
        onClose={close}
        label={`Filter ${label}`}
        theme={theme}
        className={popupClassName}
        style={popupStyle}
      >
        {renderControls()}
        {active && (
          <button type="button" className="rg-grid__filter-clear" onClick={() => onChange(undefined)}>
            Clear
          </button>
        )}
      </Popup>
    </>
  );
}
