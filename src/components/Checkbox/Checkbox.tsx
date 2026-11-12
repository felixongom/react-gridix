import type { CSSProperties, ReactNode } from "react";
import "./checkbox.css";

/**
 * - `"button"`: a `<button>` box with a `<span>` inside that is shown when checked.
 * - `"tick"`: a `<button>` box that fills in and shows a tick when checked.
 * - `"native"`: the browser's own `<input type="checkbox">`.
 */
export type CheckboxVariant = "button" | "tick" | "native";

export type CheckboxSlot = "root" | "control" | "indicator" | "label";

export interface CheckboxProps {
  checked: boolean;
  /** Called once per click (or Space key press) with the new value. */
  onChange: (checked: boolean) => void;
  /**
   * Shows the mixed ("some are selected") state, with a dash instead of a tick. Use it together
   * with `checked={false}`. Clicking a mixed checkbox calls `onChange(true)`.
   */
  indeterminate?: boolean;
  /** Default `"native"`. */
  variant?: CheckboxVariant;
  disabled?: boolean;
  /** Text next to the box. Clicking it toggles the checkbox. */
  label?: ReactNode;
  /** Accessible name when there is no visible `label`. */
  "aria-label"?: string;
  id?: string;
  /** Only used by the `"native"` variant. */
  name?: string;
  /** Replaces what is drawn inside the `"button"` and `"tick"` variants (for example `"★"` or your own icon). */
  indicator?: ReactNode;
  /** Classes for the root element (same as `classNames.root`). */
  className?: string;
  /** Inline styles for the root element (same as `styles.root`). */
  style?: CSSProperties;
  /** Classes per part. */
  classNames?: Partial<Record<CheckboxSlot, string>>;
  /** Inline styles per part. */
  styles?: Partial<Record<CheckboxSlot, CSSProperties>>;
}

const cx = (...parts: (string | false | undefined | null)[]) => parts.filter(Boolean).join(" ");

function TickIcon() {
  return (
    <svg viewBox="0 0 16 16" width="100%" height="100%" aria-hidden="true" focusable="false">
      <path
        d="M3.5 8.5l3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DashIcon() {
  return (
    <svg viewBox="0 0 16 16" width="100%" height="100%" aria-hidden="true" focusable="false">
      <path d="M4 8h8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function Checkbox({
  checked,
  onChange,
  indeterminate = false,
  variant = "native",
  disabled = false,
  label,
  "aria-label": ariaLabel,
  id,
  name,
  indicator,
  className,
  style,
  classNames = {},
  styles = {},
}: CheckboxProps) {
  const state = indeterminate ? "indeterminate" : checked ? "checked" : "unchecked";

  return (
    <label
      className={cx(
        "rg-checkbox",
        `rg-checkbox--${variant}`,
        state === "checked" && "rg-checkbox--checked",
        indeterminate && "rg-checkbox--indeterminate",
        disabled && "rg-checkbox--disabled",
        classNames.root,
        className
      )}
      style={{ ...styles.root, ...style }}
      data-state={state}
    >
      {variant === "native" ? (
        <input
          type="checkbox"
          id={id}
          name={name}
          ref={(el) => {
            if (el) el.indeterminate = indeterminate;
          }}
          className={cx("rg-checkbox__control", classNames.control)}
          style={styles.control}
          checked={checked}
          disabled={disabled}
          aria-label={ariaLabel}
          data-state={state}
          onChange={(e) => onChange(e.target.checked)}
        />
      ) : (
        <button
          type="button"
          role="checkbox"
          id={id}
          className={cx("rg-checkbox__control", classNames.control)}
          style={styles.control}
          aria-checked={indeterminate ? "mixed" : checked}
          aria-label={ariaLabel}
          disabled={disabled}
          data-state={state}
          onClick={() => onChange(!checked)}
        >
          <span
            className={cx(
              "rg-checkbox__indicator",
              indicator !== undefined && !indeterminate && "rg-checkbox__indicator--custom",
              classNames.indicator
            )}
            style={styles.indicator}
            data-state={state}
            aria-hidden="true"
          >
            {indeterminate
              ? variant === "tick"
                ? <DashIcon />
                : null
              : indicator !== undefined
                ? indicator
                : variant === "tick"
                  ? <TickIcon />
                  : null}
          </span>
        </button>
      )}
      {label !== undefined && label !== null && label !== false && label !== "" && (
        <span className={cx("rg-checkbox__label", classNames.label)} style={styles.label}>
          {label}
        </span>
      )}
    </label>
  );
}
