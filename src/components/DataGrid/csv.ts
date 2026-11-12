/** A value that can go into a CSV cell. */
export type CsvCell = string | number | boolean | null | undefined;

// Spreadsheets run a cell as a formula when it starts with one of these characters.
const FORMULA_START = /^[=+\-@\t\r]/;

/** Escapes one cell: formula guard first, then quotes around anything with a comma, quote or line break. */
function encodeCell(value: CsvCell, delimiter: string, sanitize: boolean): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Only text can be a formula. Numbers such as -5 are fine, so leave anything that is a number alone.
  if (sanitize && typeof value === "string" && FORMULA_START.test(text) && !Number.isFinite(Number(text))) {
    text = `'${text}`;
  }
  const needsQuotes = text.includes(delimiter) || /["\r\n]/.test(text);
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Builds CSV text (RFC 4180: comma separated, CRLF line breaks, quotes doubled).
 * @example toCsv(["Name", "Age"], [["Amina", 31], ["Brian, Jr.", 27]])
 */
export function toCsv(
  headers: string[],
  rows: CsvCell[][],
  options: { delimiter?: string; sanitize?: boolean } = {}
): string {
  const { delimiter = ",", sanitize = true } = options;
  const line = (cells: CsvCell[]) => cells.map((c) => encodeCell(c, delimiter, sanitize)).join(delimiter);
  return [line(headers), ...rows.map(line)].join("\r\n");
}

/** Saves any Blob as a file through a temporary download link. Does nothing outside a browser. */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Release the blob a little later, after the browser started the download
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Saves CSV text as a file. */
export function downloadCsv(csv: string, filename: string): void {
  // The byte order mark makes Excel read the file as UTF-8 (so accents and symbols survive)
  downloadBlob(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }), filename);
}
