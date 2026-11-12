import { parseColor } from "./color";
import type { PdfStyle } from "./types";

/**
 * Reads how the grid looks on screen (colours, stripes, borders, text size) so a PDF can match it.
 * It looks at the real elements, so it follows your theme, Tailwind classes and own CSS.
 * Run only when the app asks for it (`pdf.matchGridStyle`).
 */
export function readGridStyle(root: HTMLElement | null): PdfStyle {
  if (!root || typeof getComputedStyle === "undefined") return {};
  const out: PdfStyle = {};
  const css = (el: Element | null | undefined) => (el ? getComputedStyle(el) : null);

  /** The first opaque background of an element or one of its parents. */
  const backgroundOf = (el: Element | null): string | undefined => {
    for (let node: Element | null = el; node; node = node.parentElement) {
      const bg = css(node)?.backgroundColor;
      if (bg && parseColor(bg)) return bg;
    }
    return undefined;
  };
  const toHex = (c: string | undefined) => {
    const rgb = parseColor(c);
    return rgb ? "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("") : undefined;
  };
  /** CSS pixels to PDF points */
  const pt = (px: string | undefined) => (px ? Math.round(parseFloat(px) * 0.75 * 10) / 10 : undefined);

  // Header row
  const th = root.querySelector("thead th");
  if (th) {
    const s = css(th)!;
    out.headColor = toHex(backgroundOf(th));
    out.headTextColor = toHex(s.color);
    out.headFontStyle = parseInt(s.fontWeight, 10) >= 600 ? "bold" : "normal";
  }

  // Body: the first two real rows give the two stripe colours
  const rows = Array.from(root.querySelectorAll("tbody tr.rg-grid__row:not(.rg-grid__row--exit)")).slice(0, 2);
  const cell = rows[0]?.querySelector("td");
  if (cell) {
    const s = css(cell)!;
    out.bodyTextColor = toHex(s.color);
    const size = pt(s.fontSize);
    if (size && !Number.isNaN(size)) out.fontSize = Math.min(14, Math.max(6, size));
    const a = toHex(backgroundOf(rows[0].querySelector("td")));
    const b = toHex(rows[1] ? backgroundOf(rows[1].querySelector("td")) : undefined);
    out.bodyColor = a;
    if (a && b && a !== b) out.stripeColors = [a, b];
    // A row border, when the grid draws one
    const border = css(cell)!;
    if (parseFloat(border.borderBottomWidth) > 0 && border.borderBottomStyle !== "none") {
      out.borderColor = toHex(border.borderBottomColor);
      out.borderWidth = 0.5;
    }
  }

  // The page takes the grid's own background and text colour (matters for dark themes)
  const page = toHex(backgroundOf(root));
  if (page && page !== "#ffffff") out.pageBackground = page;
  out.textColor = toHex(css(root)!.color);
  out.fontName = undefined; // fonts stay jsPDF's: it cannot use a web font without being given its file

  // Drop what could not be read
  (Object.keys(out) as (keyof PdfStyle)[]).forEach((k) => out[k] === undefined && delete out[k]);
  return out;
}
