import { useCallback, useRef, useState, type CSSProperties } from "react";
import { Checkbox } from "../Checkbox/Checkbox";
import { Popup } from "./Popup";
import type { ColumnDef } from "./types";
import { cx, nameOf } from "./utils";

export interface ColumnMenuProps<T> {
  /** Every column of the grid (visible or not). */
  columns: ColumnDef<T>[];
  /** Fields that are hidden right now. */
  hidden: Set<string>;
  /** Called with the field and whether it should now be hidden. */
  onToggle: (field: string, hide: boolean) => void;
  theme?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * The "Columns" button in the toolbar. It opens a popup with one checkbox per column so users can
 * show and hide columns. A column with `hideable: false` is not listed, and the last visible
 * column cannot be hidden (a grid with no columns would be useless).
 */
export function ColumnMenu<T>({ columns, hidden, onToggle, theme, className, style }: ColumnMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  const visibleCount = columns.filter((c) => !hidden.has(c.field)).length;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={cx("rg-grid__tool-btn", className)}
        style={style}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Columns
      </button>
      <Popup anchorRef={buttonRef} open={open} onClose={close} label="Show or hide columns" theme={theme}>
        <div className="rg-grid__filter-fields rg-grid__filter-options" role="group" aria-label="Columns">
          {columns
            .filter((c) => c.hideable !== false)
            .map((c) => {
              const isVisible = !hidden.has(c.field);
              return (
                <Checkbox
                  key={c.field}
                  checked={isVisible}
                  // The last visible column stays on
                  disabled={isVisible && visibleCount <= 1}
                  onChange={(show) => onToggle(c.field, !show)}
                  label={nameOf(c)}
                />
              );
            })}
        </div>
      </Popup>
    </>
  );
}
