/** A colour as red, green, blue (0 to 255 each). */
export type RGB = [number, number, number];

let probe: CanvasRenderingContext2D | null | undefined;

/**
 * Turns any CSS colour into [r, g, b]: "#4f46e5", "#fff", "rgb(79, 70, 229)", "rgba(...)", "tomato",
 * and also modern forms such as "oklch(...)" or "color-mix(...)" (the browser converts those for us).
 * A colour with transparency is blended over white, because a PDF page is white paper.
 * Returns null for empty, "transparent" or colours that cannot be read.
 */
export function parseColor(input: string | null | undefined): RGB | null {
  const text = (input ?? "").trim();
  if (!text || text === "transparent" || text === "none") return null;

  // Hex: #rgb, #rrggbb (the most common case, no browser needed)
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  // rgb() / rgba() with commas or spaces, optional alpha
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(text);
  if (rgb) return blend([Number(rgb[1]), Number(rgb[2]), Number(rgb[3])], alphaOf(rgb[4]));

  // Anything else: let the browser's canvas convert it to pixels
  if (typeof document === "undefined") return null;
  if (probe === undefined) {
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    probe = ctx;
  }
  if (!probe) return null;
  // An unreadable colour leaves fillStyle unchanged, so try two different starting values and compare
  probe.fillStyle = "#000000";
  probe.fillStyle = text;
  const first = String(probe.fillStyle);
  probe.fillStyle = "#ffffff";
  probe.fillStyle = text;
  if (first !== String(probe.fillStyle)) return null; // the text was not a colour
  probe.clearRect(0, 0, 1, 1);
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
  return a === 0 ? null : blend([r, g, b], a / 255);
}

const alphaOf = (a: string | undefined): number => (a === undefined ? 1 : a.endsWith("%") ? parseFloat(a) / 100 : parseFloat(a));

/** Mixes a colour with white by its opacity. Fully transparent gives null. */
function blend(c: RGB, alpha: number): RGB | null {
  if (!(alpha > 0)) return null;
  const k = Math.min(1, alpha);
  return c.map((v) => Math.round(Math.min(255, v) * k + 255 * (1 - k))) as RGB;
}

/** How light a colour looks, 0 (black) to 1 (white). */
export const luminance = ([r, g, b]: RGB): number => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

/** Black or white text, whichever reads better on this background. */
export const contrastText = (bg: RGB): RGB => (luminance(bg) > 0.55 ? [31, 41, 55] : [243, 244, 246]);
