import type { ReactNode } from "react";
import { contrastText, parseColor, type RGB } from "./color";
import type { PdfExportOptions, PdfLibraries, PdfPadding, PdfStyle } from "./types";

/*
  PDF export.

  The heavy lifting is done by small, popular libraries that YOUR APP hands to the grid through
  `exportable.pdf.libraries` (usually a function that imports them on demand), so apps that never export a
  PDF do not install, bundle or even resolve them:
    - jspdf            creates the PDF document
    - jspdf-autotable  lays the table out over as many pages as it needs
    - html2canvas      turns a header / footer given as a React element into a picture
  Install them with: npm install jspdf jspdf-autotable html2canvas
*/

/** What the PDF is made of. Everything is already text by now. */
export interface PdfTable {
  headers: string[];
  rows: string[][];
  /** Alignment of each column (numbers are usually right-aligned). */
  aligns: ("left" | "center" | "right" | undefined)[];
  /** The `field` of each column, so `style.columns` can address them. */
  fields: string[];
}

/** A header or footer, ready to draw. */
type Block =
  | { kind: "text"; text: string }
  | { kind: "image"; dataUrl: string; width: number; height: number };

const PX_TO_PT = 72 / 96; // CSS pixels are 1/96 inch, PDF points 1/72 inch
const INSTALL_HINT =
  "Install them with: npm install jspdf jspdf-autotable (and html2canvas for header / footer elements), then pass them in exportable.pdf.libraries.";

/** Loads a library on demand and turns a failed import into a message that says what to install. */
async function load<M>(name: string, importer: () => Promise<M>): Promise<M> {
  try {
    return await importer();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`PDF export needs the package "${name}", which could not be loaded (${reason}). ${INSTALL_HINT}`);
  }
}

/** Replaces {page}, {pages} and {date} in a header / footer string. */
function fillTokens(text: string, page: number, pages: number): string {
  return text.replace(/\{page\}/g, String(page)).replace(/\{pages\}/g, String(pages)).replace(/\{date\}/g, new Date().toLocaleDateString());
}

/** Waits until every <img> inside `host` has loaded (or failed, or 5 seconds passed) so the picture is not taken too early. */
async function imagesReady(host: HTMLElement): Promise<void> {
  const waits = Array.from(host.querySelectorAll("img")).map(
    (img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          })
  );
  await Promise.race([Promise.all(waits), new Promise((resolve) => setTimeout(resolve, 5000))]);
}

/**
 * Draws a React element off-screen and returns it as a PNG picture, `widthPt` points wide when laid out.
 * The element is rendered into a temporary container that is removed again, so nothing is left in the page.
 */
async function renderNode(node: ReactNode, widthPt: number, libs: PdfLibraries, bg: string, fg: string): Promise<{ dataUrl: string; width: number; height: number }> {
  const html2canvas: any = libs.html2canvas;
  if (typeof html2canvas !== "function") {
    throw new Error(`A PDF header / footer element needs html2canvas. Add it to exportable.pdf.libraries. ${INSTALL_HINT}`);
  }
  const [client, dom] = await Promise.all([
    load("react-dom/client", () => import("react-dom/client")),
    load("react-dom", () => import("react-dom")),
  ]);

  const SCALE = 2; // render at twice the size so the picture stays sharp in the PDF
  const host = document.createElement("div");
  // Off-screen but still laid out and painted, which html2canvas needs
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${Math.round(widthPt / PX_TO_PT)}px;background:${bg};color:${fg};font-family:system-ui,sans-serif;font-size:14px;`;
  document.body.appendChild(host);
  const root = client.createRoot(host);
  try {
    dom.flushSync(() => root.render(node as any));
    await imagesReady(host);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    const canvas: HTMLCanvasElement = await html2canvas(host, { scale: SCALE, backgroundColor: bg, useCORS: true, logging: false });
    return { dataUrl: canvas.toDataURL("image/png"), width: (canvas.width / SCALE) * PX_TO_PT, height: (canvas.height / SCALE) * PX_TO_PT };
  } finally {
    root.unmount();
    host.remove();
  }
}

/** A string (or number) becomes a text block, an element becomes a picture, empty values become nothing. */
async function toBlock(node: ReactNode, widthPt: number, maxHeight: number, libs: PdfLibraries, bg: string, fg: string): Promise<Block | null> {
  if (node === null || node === undefined || node === false || node === true || node === "") return null;
  if (typeof node === "string" || typeof node === "number") return { kind: "text", text: String(node) };
  const picture = await renderNode(node, widthPt, libs, bg, fg);
  // Shrink (never enlarge) so it fits the page width and the maximum height, keeping its proportions
  const k = Math.min(1, widthPt / picture.width, maxHeight / picture.height);
  return { kind: "image", dataUrl: picture.dataUrl, width: picture.width * k, height: picture.height * k };
}

const rgbCss = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`;
const FONT_STYLES = ["normal", "bold", "italic", "bolditalic"];

/** One number for all sides, or per side, as the four numbers autotable wants. */
function sides(value: PdfPadding | undefined, fallback: number): { top: number; right: number; bottom: number; left: number } {
  if (typeof value === "number") return { top: value, right: value, bottom: value, left: value };
  return { top: value?.top ?? fallback, right: value?.right ?? fallback, bottom: value?.bottom ?? fallback, left: value?.left ?? fallback };
}

/** Removes the keys that are undefined, so they never overwrite a value from a weaker source. */
function defined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/**
 * Builds a PDF with the table, plus an optional header and footer on every page.
 *
 * Style sources, weakest to strongest: built-in defaults, the grid's own look (`gridStyle`, only when
 * `matchGridStyle` is on), the flat options (`headColor`, `fontSize`, `margin` ...), then `options.style`.
 * @returns the PDF as a Blob, ready to download.
 */
export async function buildPdf(table: PdfTable, options: PdfExportOptions = {}, gridStyle: PdfStyle = {}): Promise<Blob> {
  // The libraries come from the app: as an object, or from a function that imports them on demand
  let libs: PdfLibraries | undefined;
  try {
    libs = typeof options.libraries === "function" ? await options.libraries() : options.libraries;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`PDF export could not load jspdf / jspdf-autotable (${reason}). ${INSTALL_HINT}`);
  }
  if (!libs) throw new Error(`PDF export needs the jspdf and jspdf-autotable libraries. ${INSTALL_HINT}`);
  const JsPDF: any = libs.jsPDF;
  const autoTable: any = libs.autoTable;
  if (typeof JsPDF !== "function" || typeof autoTable !== "function") {
    throw new Error(`exportable.pdf.libraries must contain jsPDF (a class) and autoTable (a function). ${INSTALL_HINT}`);
  }

  const {
    title,
    header,
    footer,
    headerAlign = "left",
    footerAlign = "center",
    orientation = "auto",
    pageSize = "a4",
    tableTheme = "striped",
    pageNumbers = true,
    maxImageHeight = 90,
    beforeRender,
    autoTableOptions,
  } = options;

  // ---- the look: defaults < the grid (if asked) < flat options < style ----
  const st: PdfStyle = {
    ...gridStyle,
    ...defined({
      headColor: options.headColor,
      headTextColor: options.headTextColor,
      fontSize: options.fontSize,
      fontName: options.fontName,
      margin: options.margin,
    }),
    ...defined(options.style ?? {}),
  };
  const m = sides(st.margin, 36);
  const fontName = st.fontName ?? "helvetica";
  const fontSize = st.fontSize ?? 9;
  const pageBg = parseColor(st.pageBackground);
  // On a dark page the default text colours turn light, so nothing is unreadable
  const baseText: RGB = pageBg ? contrastText(pageBg) : [75, 85, 99];
  const textColor = parseColor(st.textColor) ?? baseText;
  const titleColor = parseColor(st.titleColor) ?? (pageBg ? contrastText(pageBg) : [17, 24, 39]);
  const headFill = parseColor(st.headColor) ?? [79, 70, 229];
  const headText = parseColor(st.headTextColor) ?? [255, 255, 255];
  const bodyText = parseColor(st.bodyTextColor);
  const stripeA = parseColor(st.stripeColors?.[0]);
  const stripeB = parseColor(st.stripeColors?.[1]);
  const bodyFill = parseColor(st.bodyColor) ?? stripeA ?? pageBg ?? undefined;
  const lineColor = parseColor(st.borderColor);

  const doc = new JsPDF({
    orientation: orientation === "auto" ? (table.headers.length > 6 ? "landscape" : "portrait") : orientation,
    unit: "pt",
    format: pageSize,
  });
  if (beforeRender) await beforeRender(doc);

  const pageW: number = doc.internal.pageSize.getWidth();
  const pageH: number = doc.internal.pageSize.getHeight();
  const contentW = pageW - m.left - m.right;
  const TEXT_SIZE = 10;
  const LINE = 12;

  /** Paints the page background (once per page), under everything drawn later. */
  const painted = new Set<number>();
  const paintPage = (page: number) => {
    if (!pageBg || painted.has(page)) return;
    painted.add(page);
    doc.setFillColor(...pageBg);
    doc.rect(0, 0, pageW, pageH, "F");
  };
  paintPage(1);

  // ---- header and footer: measure them first, so the table leaves room for them on every page ----
  const elementBg = pageBg ? rgbCss(pageBg) : "#ffffff";
  const elementFg = rgbCss(textColor);
  const headerBlock = await toBlock(header, contentW, maxImageHeight, libs, elementBg, elementFg);
  const footerBlock = await toBlock(footer, contentW, maxImageHeight, libs, elementBg, elementFg);

  doc.setFont(fontName, "normal");
  doc.setFontSize(TEXT_SIZE);
  /** Height of a block in points. Text is measured with the longest likely page numbers filled in. */
  const heightOf = (b: Block | null): number => {
    if (!b) return 0;
    if (b.kind === "image") return b.height;
    return (doc.splitTextToSize(fillTokens(b.text, 99, 99), contentW) as string[]).length * LINE;
  };
  const headerH = heightOf(headerBlock);
  const footerH = heightOf(footerBlock);

  const HEADER_TOP = Math.min(18, m.top); // distance of the header from the top edge
  const PAGE_NO_Y = pageH - 14; // baseline of "Page x of y"
  const footerBottom = pageH - (pageNumbers ? 26 : 18); // bottom edge of the footer
  const topMargin = headerBlock ? Math.max(m.top, HEADER_TOP + headerH + 12) : m.top;
  const bottomMargin = Math.max(m.bottom, footerBlock ? pageH - footerBottom + footerH + 10 : pageNumbers ? 34 : 0);

  // ---- the title and the table ----
  let startY = topMargin;
  if (title && typeof title !== "string" && typeof title !== "number" && typeof title !== "boolean") {
    // A React element: drawn to a picture, shrunk to fit the page width, at the left edge
    const picture = await toBlock(title, contentW, maxImageHeight, libs, elementBg, elementFg);
    if (picture && picture.kind === "image") {
      doc.addImage(picture.dataUrl, "PNG", m.left, startY, picture.width, picture.height);
      startY += picture.height + 12;
    }
  } else if (title) {
    doc.setFont(fontName, "bold");
    doc.setFontSize(st.titleSize ?? 14);
    doc.setTextColor(...titleColor);
    doc.text(String(title), m.left, startY + (st.titleSize ?? 14));
    startY += (st.titleSize ?? 14) + 12;
  }

  // Per column: alignment from the column, then whatever `style.columns` says for that field
  const columnStyles: Record<number, Record<string, unknown>> = {};
  table.fields.forEach((field, i) => {
    const cs = st.columns?.[field];
    const style: Record<string, unknown> = {};
    const align = cs?.align ?? table.aligns[i];
    if (align) style.halign = align;
    if (cs?.width !== undefined) style.cellWidth = cs.width;
    const color = parseColor(cs?.textColor);
    if (color) style.textColor = color;
    const fill = parseColor(cs?.backgroundColor);
    if (fill) style.fillColor = fill;
    if (cs?.fontStyle && FONT_STYLES.includes(cs.fontStyle)) style.fontStyle = cs.fontStyle;
    if (cs?.fontSize) style.fontSize = cs.fontSize;
    if (Object.keys(style).length > 0) columnStyles[i] = style;
  });

  const styles: Record<string, unknown> = {
    font: fontName,
    fontSize,
    cellPadding: sides(st.cellPadding, 4),
    overflow: "linebreak",
    valign: "middle",
  };
  if (bodyText) styles.textColor = bodyText;
  else if (pageBg) styles.textColor = contrastText(pageBg); // dark page, light text
  if (lineColor) styles.lineColor = lineColor;
  if (st.borderWidth !== undefined) styles.lineWidth = st.borderWidth;
  else if (lineColor) styles.lineWidth = 0.5; // a border colour without a width would draw nothing in "striped"
  if (st.minRowHeight) styles.minCellHeight = st.minRowHeight;

  const tableOptions: Record<string, unknown> = {
    head: [table.headers],
    body: table.rows,
    startY,
    margin: { top: topMargin, right: m.right, bottom: bottomMargin, left: m.left },
    theme: tableTheme,
    showHead: "everyPage",
    styles,
    headStyles: {
      fillColor: headFill,
      textColor: headText,
      fontStyle: st.headFontStyle && FONT_STYLES.includes(st.headFontStyle) ? st.headFontStyle : "bold",
      ...(st.headFontSize ? { fontSize: st.headFontSize } : null),
    },
    columnStyles,
    // A new page starts blank: paint its background before the table draws on it
    willDrawPage: () => {
      const info = typeof doc.getCurrentPageInfo === "function" ? doc.getCurrentPageInfo() : doc.internal.getCurrentPageInfo?.();
      if (info?.pageNumber) paintPage(info.pageNumber);
    },
  };
  // Rows: with two stripe colours they alternate; with one body colour every row gets it
  if (bodyFill) tableOptions.bodyStyles = { fillColor: bodyFill };
  if (stripeA && stripeB) {
    tableOptions.bodyStyles = { fillColor: stripeA };
    tableOptions.alternateRowStyles = { fillColor: stripeB };
  } else if (stripeA || bodyFill) {
    // One colour only: no alternate shading
    tableOptions.alternateRowStyles = { fillColor: bodyFill };
  }

  // Anything in `autoTableOptions` has the last word (its own nested styles replace ours key by key)
  const merged: Record<string, unknown> = { ...tableOptions, ...autoTableOptions };
  for (const key of ["styles", "headStyles", "bodyStyles", "alternateRowStyles", "margin"]) {
    const mine = tableOptions[key];
    const theirs = autoTableOptions?.[key];
    if (mine && theirs && typeof theirs === "object") merged[key] = { ...(mine as object), ...theirs };
  }
  autoTable(doc, merged);

  // ---- draw header, footer and page numbers on every page (now that the page count is known) ----
  const pages: number = typeof doc.getNumberOfPages === "function" ? doc.getNumberOfPages() : doc.internal.getNumberOfPages();
  const xFor = (align: "left" | "center" | "right", width: number) =>
    align === "center" ? (pageW - width) / 2 : align === "right" ? pageW - m.right - width : m.left;

  const drawBlock = (b: Block | null, top: number, align: "left" | "center" | "right", page: number) => {
    if (!b) return;
    if (b.kind === "image") {
      doc.addImage(b.dataUrl, "PNG", xFor(align, b.width), top, b.width, b.height);
      return;
    }
    doc.setFont(fontName, "normal");
    doc.setFontSize(TEXT_SIZE);
    doc.setTextColor(...textColor);
    const lines = doc.splitTextToSize(fillTokens(b.text, page, pages), contentW) as string[];
    const x = align === "center" ? pageW / 2 : align === "right" ? pageW - m.right : m.left;
    // The first baseline sits one font size below the top of the block
    doc.text(lines, x, top + TEXT_SIZE, { align });
  };

  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    drawBlock(headerBlock, HEADER_TOP, headerAlign, page);
    drawBlock(footerBlock, footerBottom - footerH, footerAlign, page);
    if (pageNumbers) {
      doc.setFont(fontName, "normal");
      doc.setFontSize(8);
      doc.setTextColor(...textColor);
      doc.text(`Page ${page} of ${pages}`, pageW - m.right, PAGE_NO_Y, { align: "right" });
    }
  }

  return doc.output("blob") as Blob;
}
