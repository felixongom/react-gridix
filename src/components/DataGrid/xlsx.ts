/*
  A small Excel (.xlsx) writer with no dependencies.

  An .xlsx file is a zip archive of XML files. We write the handful of files Excel needs (workbook,
  styles, one worksheet) and zip them ourselves, deflate-compressed when the browser can do it
  (CompressionStream) and stored uncompressed otherwise. The result opens in Excel, LibreOffice,
  Google Sheets and Numbers. It has a bold coloured header row that stays in place while you scroll,
  an auto-filter, sensible column widths, real numbers, real booleans and real dates.
*/

/** What a spreadsheet column holds, so each cell is written with the right type. */
export type XlsxKind = "text" | "number" | "date" | "boolean";

export interface XlsxColumn {
  header: string;
  kind: XlsxKind;
  /** Text alignment of the cells. */
  align?: "left" | "center" | "right";
}

/** A cell value. Dates are ISO days ("2026-11-05") in a `kind: "date"` column. */
export type XlsxValue = string | number | boolean | null | undefined;

export interface XlsxOptions {
  /** Worksheet name. Excel allows 31 characters and none of `[ ] : * ? / \`. Default "Sheet1". */
  sheetName?: string;
}

/* ------------------------------------------------------------------------------------------ */
/* Zip                                                                                        */
/* ------------------------------------------------------------------------------------------ */

const encoder = new TextEncoder();

// CRC-32 lookup table (the checksum every zip entry carries)
let crcTable: Uint32Array | null = null;
function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Compresses with the browser's built-in deflate. Returns null when it is not available (we then store the file as is). */
async function deflateRaw(data: Uint8Array): Promise<Uint8Array | null> {
  const CS = (globalThis as any).CompressionStream;
  if (typeof CS === "undefined") return null;
  try {
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CS("deflate-raw"));
    return new Uint8Array(await new Response(stream as any).arrayBuffer());
  } catch {
    return null;
  }
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/** Builds a zip archive in memory. */
export async function zip(entries: ZipEntry[]): Promise<Uint8Array> {
  const now = new Date();
  // DOS date and time, the format zip stores
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const packed = await deflateRaw(entry.data);
    // Keep the compressed copy only when it is really smaller
    const useDeflate = packed !== null && packed.length < entry.data.length;
    const body = useDeflate ? (packed as Uint8Array) : entry.data;
    const method = useDeflate ? 8 : 0;

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // local file header signature
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // flags: names are UTF-8
    lv.setUint16(8, method, true);
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, body.length, true); // compressed size
    lv.setUint32(22, entry.data.length, true); // uncompressed size
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true); // no extra field
    local.set(name, 30);

    const dir = new Uint8Array(46 + name.length);
    const dv = new DataView(dir.buffer);
    dv.setUint32(0, 0x02014b50, true); // central directory header signature
    dv.setUint16(4, 20, true); // version made by
    dv.setUint16(6, 20, true); // version needed
    dv.setUint16(8, 0x0800, true);
    dv.setUint16(10, method, true);
    dv.setUint16(12, dosTime, true);
    dv.setUint16(14, dosDate, true);
    dv.setUint32(16, crc, true);
    dv.setUint32(20, body.length, true);
    dv.setUint32(24, entry.data.length, true);
    dv.setUint16(28, name.length, true);
    dv.setUint32(42, offset, true); // where this entry's local header starts
    dir.set(name, 46);

    chunks.push(local, body);
    central.push(dir);
    offset += local.length + body.length;
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); // end of central directory signature
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const all = [...chunks, ...central, end];
  const out = new Uint8Array(all.reduce((n, c) => n + c.length, 0));
  let pos = 0;
  for (const c of all) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

/* ------------------------------------------------------------------------------------------ */
/* Worksheet XML                                                                              */
/* ------------------------------------------------------------------------------------------ */

/** Escapes text for XML and drops the control characters XML cannot hold. */
function esc(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Column letters: 0 -> A, 25 -> Z, 26 -> AA. */
function colName(index: number): string {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    name = String.fromCharCode(65 + r) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

/** Excel's date number: days since 1899-12-30. Returns null for text that is not a "YYYY-MM-DD" day. */
export function excelDate(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  // 2026-02-29 would quietly become 1 March: only real calendar days become dates
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return Math.round((date.getTime() - Date.UTC(1899, 11, 30)) / 86400000);
}

/** A worksheet name Excel accepts. */
function safeSheetName(name: string | undefined): string {
  const cleaned = (name ?? "").replace(/[\[\]:*?/\\]/g, " ").trim().slice(0, 31);
  return cleaned || "Sheet1";
}

// Cell style numbers, matching the <cellXfs> in styles.xml below
const STYLE_HEADER = 1;
const STYLE_DATE = 2;
const STYLE_RIGHT = 3;
const STYLE_CENTER = 4;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF4F46E5"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/** One cell as XML, or "" for an empty cell. */
function cellXml(ref: string, value: XlsxValue, col: XlsxColumn): string {
  if (value === null || value === undefined || value === "") return "";
  const alignStyle = col.align === "right" ? STYLE_RIGHT : col.align === "center" ? STYLE_CENTER : 0;

  if (typeof value === "boolean") return `<c r="${ref}" t="b"${alignStyle ? ` s="${alignStyle}"` : ""}><v>${value ? 1 : 0}</v></c>`;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return `<c r="${ref}"${alignStyle ? ` s="${alignStyle}"` : ""}><v>${value}</v></c>`;
  }

  // Text. In a date column a "YYYY-MM-DD" text becomes a real date; in a number column numeric text becomes a number.
  if (col.kind === "date") {
    const serial = excelDate(value);
    if (serial !== null) return `<c r="${ref}" s="${STYLE_DATE}"><v>${serial}</v></c>`;
  }
  if (col.kind === "number" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return `<c r="${ref}"${alignStyle ? ` s="${alignStyle}"` : ""}><v>${Number(value)}</v></c>`;
  }
  // Excel cells hold at most 32,767 characters. xml:space keeps leading and trailing spaces.
  const text = esc(value.slice(0, 32767));
  return `<c r="${ref}" t="inlineStr"${alignStyle ? ` s="${alignStyle}"` : ""}><is><t xml:space="preserve">${text}</t></is></c>`;
}

/** The text length of a value, to size the column. */
const lengthOf = (v: XlsxValue): number => (v === null || v === undefined ? 0 : typeof v === "boolean" ? 5 : String(v).length);

function sheetXml(columns: XlsxColumn[], rows: XlsxValue[][]): string {
  const lastCol = colName(Math.max(0, columns.length - 1));
  const lastRow = rows.length + 1;

  // Column widths from the longest text in the first 500 rows (between 8 and 60 characters)
  const widths = columns.map((c, i) => {
    let longest = lengthOf(c.header) + 3; // room for the filter button
    for (let r = 0; r < Math.min(rows.length, 500); r++) longest = Math.max(longest, c.kind === "date" ? 11 : lengthOf(rows[r][i]));
    return Math.min(60, Math.max(8, longest + 2));
  });

  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  out.push('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">');
  out.push(`<dimension ref="A1:${lastCol}${lastRow}"/>`);
  out.push('<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/></sheetView></sheetViews>');
  out.push('<sheetFormatPr defaultRowHeight="15"/>');
  out.push("<cols>" + widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("") + "</cols>");
  out.push("<sheetData>");
  out.push(
    '<row r="1" ht="22" customHeight="1">' +
      columns.map((c, i) => `<c r="${colName(i)}1" s="${STYLE_HEADER}" t="inlineStr"><is><t xml:space="preserve">${esc(c.header)}</t></is></c>`).join("") +
      "</row>"
  );
  rows.forEach((row, r) => {
    const n = r + 2;
    const cells = columns.map((c, i) => cellXml(`${colName(i)}${n}`, row[i], c)).join("");
    out.push(`<row r="${n}">${cells}</row>`);
  });
  out.push("</sheetData>");
  out.push(`<autoFilter ref="A1:${lastCol}${lastRow}"/>`);
  out.push("</worksheet>");
  return out.join("");
}

/**
 * Builds an .xlsx file.
 * @example const blob = await buildXlsx([{ header: "Name", kind: "text" }, { header: "Age", kind: "number" }], [["Amina", 31]]);
 */
export async function buildXlsx(columns: XlsxColumn[], rows: XlsxValue[][], options: XlsxOptions = {}): Promise<Blob> {
  const sheetName = safeSheetName(options.sheetName);
  const quoted = `'${sheetName.replace(/'/g, "''")}'`;
  const lastCol = colName(Math.max(0, columns.length - 1));

  const files: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(sheetName)}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">${esc(quoted)}!$A$1:$${lastCol}$${rows.length + 1}</definedName></definedNames></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": STYLES_XML,
    "xl/worksheets/sheet1.xml": sheetXml(columns, rows),
  };

  const bytes = await zip(Object.entries(files).map(([name, text]) => ({ name, data: encoder.encode(text) })));
  return new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
