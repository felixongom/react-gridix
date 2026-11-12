import { DataGrid, type ColumnDef } from "../../src";
import { makeEmployees, money, type Employee } from "../data";

const rows = makeEmployees(18);
const amberSky: [string, string] = ["#fef3c7", "#e0f2fe"];
const format = (v: number) => money.format(v);

// Tailwind: classes on the grid, on each part of it, and on columns and cells.
// (This page loads Tailwind from its CDN. In your own app use your normal Tailwind setup.)
const tailwindColumns: ColumnDef<Employee>[] = [
  { field: "name", sortable: true, headerName: "Name", filterable: true, cellClassName: "font-medium text-slate-900" },
  // className / style apply to the whole column: its header cell and every body cell
  { field: "department", sortable: true, headerName: "Department", className: "italic text-sky-700", filterIndicatorClassName: "text-sky-300" },
  {
    field: "salary",
    sortable: true,
    headerName: "Salary",
    type: "number",
    align: "right",
    valueFormatter: format,
    cellClassName: ({ value }) => (Number(value) >= 100000 ? "font-semibold text-emerald-600" : "text-slate-600"),
  },
  { field: "status", sortable: true, headerName: "Status", headerClassName: "text-indigo-200" },
];

// Inline styles: the same hooks, with style objects instead of class names.
const inlineColumns: ColumnDef<Employee>[] = [
  { field: "name", sortable: true, headerName: "Name", cellStyle: { fontWeight: 700 } },
  { field: "department", sortable: true, headerName: "Department", style: { fontVariant: "small-caps", letterSpacing: 0.5 } },
  {
    field: "salary",
    sortable: true,
    headerName: "Salary",
    type: "number",
    align: "right",
    valueFormatter: format,
    cellStyle: ({ value }) => (Number(value) >= 100000 ? { color: "#0a7d32", fontWeight: 700 } : {}),
  },
  { field: "status", sortable: true, headerName: "Status" },
];

export function StylingDemo() {
  return (
    <>
      <h2 className="demo-heading">Tailwind classes</h2>
      <DataGrid
        columns={tailwindColumns}
        rows={rows}
        getRowId={(r) => r.id}
        searchable
        pagination
        pageSize={5}
        pageSizeOptions={[5, 10]}
        className="rounded-2xl border-0 shadow-xl ring-1 ring-slate-200"
        classNames={{
          toolbar: "bg-slate-50 px-4 py-3",
          search: "rounded-full border-slate-300 px-4",
          headerCell: "bg-slate-900 text-xs uppercase tracking-wider text-slate-100 hover:bg-slate-800",
          row: "hover:bg-indigo-50",
          footer: "bg-slate-50 text-slate-500",
          pageButton: "rounded-full hover:bg-indigo-100",
        }}
        rowClassName={(row) => (row.status === "inactive" ? "opacity-50" : "")}
      />

      <h2 className="demo-heading">Inline styles</h2>
      <DataGrid
        columns={inlineColumns}
        rows={rows}
        getRowId={(r) => r.id}
        searchable
        pagination
        pageSize={5}
        pageSizeOptions={[5, 10]}
        style={{ border: "2px solid #111", borderRadius: 0, fontFamily: "ui-monospace, monospace" }}
        styles={{
          toolbar: { background: "#ffe66d", borderBottom: "2px solid #111" },
          search: { borderRadius: 0, border: "2px solid #111" },
          headerCell: { background: "#111", color: "#ffe66d", textTransform: "uppercase", letterSpacing: 1 },
          footer: { background: "#ffe66d", color: "#111", borderTop: "2px solid #111" },
          pageButton: { borderRadius: 0, border: "2px solid #111" },
        }}
        rowStyle={(row) => (row.status === "pending" ? { background: "#fff7cc" } : {})}
      />

      <h2 className="demo-heading">Striped rows with two custom colours</h2>
      <DataGrid
        columns={inlineColumns}
        rows={rows}
        getRowId={(r) => r.id}
        pagination
        pageSize={6}
        pageSizeOptions={[6, 12]}
        stripeColors={amberSky}
      />
    </>
  );
}
