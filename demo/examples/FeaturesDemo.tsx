import { useRef, useState } from "react";
import {
  DataGrid,
  type ColumnDef,
  type DataGridApi,
  type EmptyStateProps,
  type RowAnimationName,
  type SortIndicatorProps,
} from "../../src";
import { departments, makeEmployees, money, type Employee } from "../data";

const animations: RowAnimationName[] = [
  "fade", "slide-up", "slide-down", "slide-left", "slide-right", "zoom", "flip-x", "flip-y", "rotate", "skew", "blur", "bounce", "none",
];

// A tiny logo as an SVG data URL, so the PDF header example needs no image file
const LOGO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" rx="24" fill="#4f46e5"/><path d="M30 80 60 30l30 50z" fill="#fff"/></svg>'
  );

/** A custom sort indicator: a text label that reads "A→Z" / "Z→A" and turns with the direction. */
function LabelIndicator({ direction }: SortIndicatorProps<Employee>) {
  return (
    <span data-testid="label-indicator" style={{ fontSize: 11, fontWeight: 700, opacity: direction ? 1 : 0.4 }}>
      {direction === "asc" ? "A→Z" : direction === "desc" ? "Z→A" : "A·Z"}
    </span>
  );
}

/** The custom "no rows" component: says why, and offers a way out when filters caused it. */
function NothingHere({ reason, clearAll, search }: EmptyStateProps<Employee>) {
  return (
    <div data-testid="empty-custom" style={{ display: "grid", gap: 8, justifyItems: "center" }}>
      <div style={{ fontSize: 32 }}>{reason === "no-results" ? "🔍" : "📭"}</div>
      <strong>{reason === "no-results" ? "Nothing matches" : "No employees yet"}</strong>
      <span style={{ opacity: 0.7 }}>{reason === "no-results" ? `Try other filters${search ? ` than "${search}"` : ""}.` : "Add someone to get started."}</span>
      {reason === "no-results" && (
        <button type="button" onClick={clearAll}>
          Clear search and filters
        </button>
      )}
    </div>
  );
}

const columns: ColumnDef<Employee>[] = [
  { field: "#", type: "sequence", headerName: "No.", width: 64, align: "center" },
  { field: "id", headerName: "ID", type: "number", sortable: true, width: 70 },
  // The comparison drop-down is opt-in per column: here all eight comparisons
  { field: "name", headerName: "Name", sortable: true, filterable: true, filterOperators: true },
  // ... or just a few, with another one selected first
  { field: "email", headerName: "Email", filterable: true, filterOperators: ["contains", "startsWith", "endsWith", "equals"], filterOperator: "startsWith" },
  // No filterOperators: a plain box that always means "contains"
  { field: "department", headerName: "Department", sortable: true, filterable: true },
  { field: "salary", headerName: "Salary", type: "number", sortable: true, filterable: true, align: "right", valueFormatter: (v) => money.format(v) },
  { field: "joined", headerName: "Joined", type: "date", sortable: true },
];

let nextId = 1000;

export function FeaturesDemo() {
  const [rows, setRows] = useState<Employee[]>(() => makeEmployees(8));
  const [enter, setEnter] = useState<RowAnimationName>("slide-up");
  const [exit, setExit] = useState<RowAnimationName>("fade");
  const [indicator, setIndicator] = useState<"default" | "arrow" | "label">("arrow");
  const [pdfStyle, setPdfStyle] = useState<"default" | "grid" | "custom">("default");
  const [theme, setTheme] = useState("");
  const [pdfHeader, setPdfHeader] = useState<"string" | "component" | "none">("component");
  const [selected, setSelected] = useState<(string | number)[]>([]);
  const api = useRef<DataGridApi<Employee> | null>(null);
  const [pdfMessage, setPdfMessage] = useState("");

  const add = (where: "start" | "end") => {
    const [e] = makeEmployees(1);
    const row: Employee = { ...e, id: ++nextId, name: `New Person ${nextId}`, email: `new${nextId}@example.com`, department: departments[nextId % 4] };
    setRows((r) => (where === "start" ? [row, ...r] : [...r, row]));
  };

  return (
    <>
      <div className="demo-controls">
        <label>
          In
          <select aria-label="Enter animation" value={enter} onChange={(e) => setEnter(e.target.value as RowAnimationName)}>
            {animations.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
        <label>
          Out
          <select aria-label="Exit animation" value={exit} onChange={(e) => setExit(e.target.value as RowAnimationName)}>
            {animations.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => add("start")}>Add row on top</button>
        <button type="button" onClick={() => add("end")}>Add row at the end</button>
        <button type="button" onClick={() => setRows((r) => r.slice(1))}>Remove first row</button>
        <button type="button" onClick={() => setRows((r) => r.filter((x) => !selected.includes(x.id)))}>Remove selected</button>
        <button type="button" onClick={() => setRows([])}>Remove all</button>
        <button type="button" onClick={() => setRows(makeEmployees(8))}>Reset</button>
      </div>
      <div className="demo-controls">
        <label>
          Sort arrow
          <select aria-label="Sort indicator" value={indicator} onChange={(e) => setIndicator(e.target.value as typeof indicator)}>
            <option value="default">default (▲ ▼)</option>
            <option value="arrow">arrow (rotates)</option>
            <option value="label">custom component</option>
          </select>
        </label>
        <label>
          PDF header / footer
          <select aria-label="PDF header" value={pdfHeader} onChange={(e) => setPdfHeader(e.target.value as typeof pdfHeader)}>
            <option value="component">component with a logo</option>
            <option value="string">plain text</option>
            <option value="none">none</option>
          </select>
        </label>
        <label>
          PDF style
          <select aria-label="PDF style" value={pdfStyle} onChange={(e) => setPdfStyle(e.target.value as typeof pdfStyle)}>
            <option value="default">built-in look</option>
            <option value="grid">copy the grid's look</option>
            <option value="custom">custom (dark page, stripes, margins)</option>
          </select>
        </label>
        <label>
          Grid theme
          <select aria-label="Grid theme" value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value="">none</option>
            <option>ocean</option>
            <option>midnight</option>
          </select>
        </label>
        {pdfMessage && <span role="status" style={{ color: "#b91c1c" }}>{pdfMessage}</span>}
      </div>

      <DataGrid
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        searchable
        rowSelection
        selectedRowIds={selected}
        onSelectionChange={(s) => setSelected(s.ids)}
        pagination
        pageSize={10}
        apiRef={api}
        striped
        theme={theme || undefined}
        rowAnimation={{ enter, exit }}
        sortIndicator={indicator === "label" ? LabelIndicator : indicator}
        emptyComponent={NothingHere}
        onExportError={(error, format) => setPdfMessage(`${format.toUpperCase()} export failed: ${error.message}`)}
        exportable={{
          filename: "employees",
          formats: ["csv", "xlsx", "json", "pdf"],
          sheetName: "Employees",
          pdf: {
            // Loaded only when a PDF is exported (needs: npm install jspdf jspdf-autotable html2canvas)
            libraries: async () => (await import("../pdfLibraries")).pdfLibraries,
            // A string, or an element (drawn to a picture, needs html2canvas)
            title: pdfHeader === "component" ? <h2 style={{ margin: 0, color: "#4f46e5", fontFamily: "Georgia, serif" }}>Employee <em>list</em></h2> : "Employee list",
            // Copy the look of the grid on screen (theme colours, stripes, borders) into the PDF
            matchGridStyle: pdfStyle === "grid",
            // ... or set the look yourself. Values in `style` always win over the copied ones.
            ...(pdfStyle === "custom"
              ? {
                  margin: { top: 60, right: 30, bottom: 50, left: 30 },
                  tableTheme: "grid" as const,
                  style: {
                    pageBackground: "#0f172a",
                    headColor: "#f59e0b",
                    headTextColor: "#111827",
                    stripeColors: ["#1e293b", "#334155"] as [string, string],
                    bodyTextColor: "#e2e8f0",
                    borderColor: "#475569",
                    borderWidth: 0.4,
                    cellPadding: { top: 6, bottom: 6, left: 8, right: 8 },
                    fontSize: 10,
                    columns: { salary: { fontStyle: "bold" as const, textColor: "#fbbf24" }, name: { width: 120 } },
                  },
                }
              : null),
            header:
              pdfHeader === "component" ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0", borderBottom: "3px solid #4f46e5" }}>
                  <img src={LOGO} alt="" width={36} height={36} style={{ borderRadius: 8 }} />
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#312e81" }}>Acme Corporation</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>People &amp; Culture report</div>
                  </div>
                </div>
              ) : pdfHeader === "string" ? (
                "Acme Corporation — People report ({date})"
              ) : undefined,
            footer: pdfHeader === "none" ? undefined : pdfHeader === "component" ? <div style={{ textAlign: "center", fontSize: 11, color: "#6b7280" }}>Confidential — do not share</div> : "Confidential · page {page} of {pages}",
          },
        }}
      />
    </>
  );
}

