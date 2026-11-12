import { useCallback, useRef, useState, type CSSProperties } from "react";
import { Popup } from "./Popup";
import type { ExportFormat } from "./types";
import { cx } from "./utils";

/** Which rows an export covers (the grid's `ExportOptions.scope`, in the shorter names the menu uses). */
export type MenuScope = "visible" | "filtered" | "selected";

export interface ExportScopeChoice {
  value: MenuScope;
  label: string;
  /** How many rows that choice would export. */
  count: number;
}

export interface ExportMenuProps {
  formats: ExportFormat[];
  /** The row choices to offer. When there is only one, the chooser is not drawn. */
  scopes: ExportScopeChoice[];
  scope: MenuScope;
  onScopeChange: (scope: MenuScope) => void;
  /** Called when a format is clicked. May return a promise (PDF takes a moment); the menu shows "Preparing…" until it settles. */
  onExport: (format: ExportFormat, scope: MenuScope) => void | Promise<unknown>;
  theme?: string;
  className?: string;
  style?: CSSProperties;
  /** Class for the popup panel. */
  popupClassName?: string;
}

const FORMAT_LABEL: Record<ExportFormat, string> = {
  csv: "CSV",
  xlsx: "Excel",
  json: "JSON",
  pdf: "PDF",
};
const FORMAT_EXT: Record<ExportFormat, string> = { csv: ".csv", xlsx: ".xlsx", json: ".json", pdf: ".pdf" };

/** Label of the plain single-format button ("Export CSV"). */
export const exportButtonLabel = (format: ExportFormat) => `Export ${FORMAT_LABEL[format]}`;

/**
 * The "Export" button of the toolbar when several formats are offered. It opens a small panel with
 * "Rows to export" (visible / selected / all matching) and one button per file format.
 */
export function ExportMenu({ formats, scopes, scope, onScopeChange, onExport, theme, className, style, popupClassName }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  const run = async (format: ExportFormat) => {
    setBusy(format);
    try {
      await onExport(format, scope);
    } finally {
      setBusy(null);
      setOpen(false);
      buttonRef.current?.focus();
    }
  };

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
        Export
        <svg className="rg-export__chevron" width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" />
        </svg>
      </button>

      <Popup anchorRef={buttonRef} open={open} onClose={close} label="Export" theme={theme} className={cx("rg-export-popup", popupClassName)}>
        <div className="rg-export">
          {scopes.length > 1 && (
            <div className="rg-export__group" role="radiogroup" aria-label="Rows to export">
              <div className="rg-export__title">Rows to export</div>
              {scopes.map((s) => {
                const disabled = s.count === 0;
                return (
                  <label key={s.value} className={cx("rg-export__scope", disabled && "rg-export__scope--disabled", s.value === scope && "rg-export__scope--on")}>
                    <input
                      type="radio"
                      name="rg-export-scope"
                      value={s.value}
                      checked={s.value === scope}
                      disabled={disabled}
                      onChange={() => onScopeChange(s.value)}
                    />
                    <span className="rg-export__scope-label">{s.label}</span>
                    <span className="rg-export__count">{s.count}</span>
                  </label>
                );
              })}
            </div>
          )}
          <div className="rg-export__group">
            <div className="rg-export__title">Download as</div>
            {formats.map((f) => (
              <button
                key={f}
                type="button"
                className="rg-export__format"
                data-format={f}
                disabled={busy !== null}
                onClick={() => run(f)}
              >
                <span>{FORMAT_LABEL[f]}</span>
                <span className="rg-export__ext">{busy === f ? "Preparing…" : FORMAT_EXT[f]}</span>
              </button>
            ))}
          </div>
        </div>
      </Popup>
    </>
  );
}
