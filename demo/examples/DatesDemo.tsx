import { useState } from "react";
import { DataGrid, type ColumnDef } from "../../src";

interface Task {
  id: number;
  title: string;
  due: string; // ISO text: "2026-11-05"
  created: Date; // a real Date object
  budget: number;
  status: "open" | "blocked" | "done";
}

const titles = ["Write specs", "Design review", "Ship beta", "Fix login", "Update docs", "Plan sprint", "Audit access", "Refactor grid"];
const statuses: Task["status"][] = ["open", "blocked", "done"];

const initial: Task[] = Array.from({ length: 32 }, (_, i) => ({
  id: i + 1,
  title: `${titles[i % titles.length]} ${Math.floor(i / titles.length) + 1}`,
  due: new Date(Date.UTC(2026, (i * 3) % 12, 1 + ((i * 5) % 27))).toISOString().slice(0, 10),
  created: new Date(2026, 0, 1 + i * 6),
  budget: 500 + ((i * 937) % 9000),
  status: statuses[(i * 7) % 3],
}));

const columns: ColumnDef<Task>[] = [
  // filterType "exact": the filter text must equal the title
  { field: "title", headerName: "Task", sortable: true, filterable: true, filterType: "exact", filterPlaceholder: "Exact title" },
  // type "date": formatted display, a date picker editor, sorts by day, filters with a from/to range.
  // dateMin / dateMax limit what the picker accepts (try 2025 or 2028: it is rejected).
  { field: "due", headerName: "Due", type: "date", sortable: true, filterable: true, dateMin: "2026-01-01", dateMax: "2027-12-31", width: 150 },
  // the value is a Date object, so edits are saved as Date objects. Custom locale and format.
  { field: "created", headerName: "Created", type: "date", sortable: true, filterable: true, dateLocale: "en-GB", dateFormat: { dateStyle: "long" }, width: 170 },
  // type "number": a min / max range filter
  { field: "budget", headerName: "Budget", type: "number", align: "right", sortable: true, filterable: true, valueFormatter: (v) => `$${Number(v).toLocaleString()}` },
  // select filter built from the values in the data (open / blocked / done)
  { field: "status", headerName: "Status", sortable: true, filterable: true, filterType: "select" },
];

export function DatesDemo() {
  const [rows, setRows] = useState(initial);
  const [last, setLast] = useState("none yet");

  return (
    <>
      <ul className="demo-tips">
        <li>Double-click a Due or Created cell (or select it and press Enter) to open the date picker.</li>
        <li>Due holds ISO strings and Created holds <code>Date</code> objects. Each is saved back as the same kind.</li>
        <li>Open the filter dots: Task is an exact match, Due and Created have from/to dates, Budget has min/max, Status has a checkbox list.</li>
      </ul>
      <DataGrid
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        editable
        onRowsChange={setRows}
        onCellEdit={(e) => setLast(`#${e.row.id} ${e.field}: ${String(e.oldValue)} → ${String(e.newValue)} (${e.newValue instanceof Date ? "Date" : typeof e.newValue})`)}
        searchable
        pagination
        pageSize={8}
        theme="lavender"
      />
      <p className="demo-note">Last edit: {last}</p>
    </>
  );
}
