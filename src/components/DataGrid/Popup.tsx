import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useIsoLayoutEffect } from "./hooks";
import { cx } from "./utils";

export interface PopupProps {
  /** The button the popup belongs to. The popup opens right below it. */
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  /** Called when the user clicks outside or presses Escape. */
  onClose: () => void;
  /** Accessible name of the dialog. */
  label: string;
  /** Theme name. It is copied onto the popup so theme variables apply outside the grid. */
  theme?: string;
  className?: string;
  style?: CSSProperties;
  /** Pressing the mouse inside the popup does not take focus from the element that has it (used by the date editor). */
  keepFocus?: boolean;
  children: ReactNode;
}

/**
 * A small floating panel drawn in `document.body` (so a scrolling grid can never clip it) and
 * positioned under its anchor button. Used by the filter popups and the column menu.
 */
export function Popup({ anchorRef, open, onClose, label, theme, className, style, keepFocus, children }: PopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  // Place the popup under the anchor and keep it inside the window
  const reposition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = popupRef.current?.offsetWidth ?? 260;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    setPos({ top: rect.bottom + 6, left });
  }, [anchorRef]);

  // Measure once the popup exists (its real width is only known after it rendered)
  useIsoLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;

    // A mouse press outside the popup and its anchor closes it
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popupRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    // Escape closes it and gives focus back to the button
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        anchorRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true); // true: also fires for scrolling inside the grid
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, onClose, reposition, anchorRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={popupRef}
      role="dialog"
      onMouseDown={keepFocus ? (e) => e.preventDefault() : undefined}
      aria-label={label}
      data-rg-theme={theme || undefined}
      className={cx("rg-grid-popup", className)}
      style={{ position: "fixed", top: pos.top, left: pos.left, ...style }}
    >
      {children}
    </div>,
    document.body
  );
}
