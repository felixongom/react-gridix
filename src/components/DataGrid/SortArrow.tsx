import { useRef, type CSSProperties } from "react";
import type { SortDirection } from "./types";
import { cx } from "./utils";

export interface SortArrowProps {
  /** Direction the column is sorted in, or null when it is not sorted. */
  direction: SortDirection | null;
  /** Size of the arrow in pixels. Default 14. */
  size?: number;
  /** Position of the column in a multi-column sort. Shown as a small number next to the arrow. */
  priority?: number;
  className?: string;
  style?: CSSProperties;
}

/** Where the arrow points for each direction, in degrees (0 = up). */
const ANGLE: Record<"none" | SortDirection, number> = { none: 0, asc: 0, desc: 180 };

/**
 * An arrow that turns around smoothly when the sort changes.
 *
 * Ascending points up, descending points down, and "not sorted" is a dim up arrow. The arrow always
 * keeps turning the same way (up -> down -> back up) instead of spinning backwards, so the movement
 * reads as one continuous half-turn per click. Use it in a column with `sortIndicator="arrow"`, or put
 * it inside your own `sortIndicator` component:
 *
 *     const MyIndicator = ({ direction }) => <SortArrow direction={direction} size={16} />;
 *
 * The turn is a CSS transition (`--rg-sort-turn`, default 0.28s) and is switched off for people who
 * prefer reduced motion.
 */
export function SortArrow({ direction, size = 14, priority, className, style }: SortArrowProps) {
  // Total rotation so far. We only ever add to it, so the arrow keeps turning forward.
  const turn = useRef(0);
  const wanted = ANGLE[direction ?? "none"];
  // How far we still have to go (0 to 359 degrees) to point the wanted way
  const delta = (((wanted - turn.current) % 360) + 360) % 360;
  turn.current += delta;

  return (
    <span className={cx("rg-sort-arrow", direction && "rg-sort-arrow--active", className)} style={style} data-direction={direction ?? "none"}>
      <svg
        className="rg-sort-arrow__icon"
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        style={{ transform: `rotate(${turn.current}deg)` }}
      >
        <path d="M8 13V3" />
        <path d="M3.5 7.5 8 3l4.5 4.5" />
      </svg>
      {direction && priority !== undefined && <sup className="rg-sort-arrow__order">{priority}</sup>}
    </span>
  );
}
