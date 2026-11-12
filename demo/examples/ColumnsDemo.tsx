import { useRef, useState } from "react";
import { DataGrid, type ColumnDef, type DataGridApi } from "../../src";
import { makeEmployees, money, type Employee } from "../data";

// A wide grid: more column width than the page has, so it scrolls sideways.
const columns: ColumnDef<Employee>[] = [
  // pinned columns stay in view while the rest scrolls
  { field: "id", headerName: "ID", type: "number", width: 70, pinned: "left", sortable: true, hideable: false },
  { field: "name", headerName: "Name", width: 200, pinned: "left", resizable: true, sortable: true, filterable: true },
  { field: "email", headerName: "Email", width: 280, resizable: true, sortable: true },
  { field: "department", headerName: "Department", width: 170, resizable: true, sortable: true, filterable: true },
  { field: "salary", headerName: "Salary", type: "number", width: 150, align: "right", resizable: true, sortable: true, filterable: true, valueFormatter: (v) => money.format(v) },
  { field: "rating", headerName: "Rating", type: "number", width: 110, resizable: true, sortable: true },
  { field: "progress", headerName: "Progress %", type: "number", width: 140, resizable: true, sortable: true },
  { field: "joined", headerName: "Joined", type: "date", width: 150, resizable: true, sortable: true, filterable: true },
  // exportValue changes what ends up in the CSV for this column
  { field: "status", headerName: "Status", width: 130, pinned: "right", sortable: true, exportValue: (v) => String(v).toUpperCase() },
];

export function ColumnsDemo() {
  const [hiddenNow, setHiddenNow] = useState<string[]>([]);
  const [widthsNote, setWidthsNote] = useState("drag a header edge");
  const api = useRef<DataGridApi<Employee> | null>(null);
  const [csv, setCsv] = useState("");

  return (
    <>
      <ul className="demo-tips">
        <li><strong>Resize:</strong> drag the right edge of Name, Email, Department, Salary, Rating, Progress or Joined.</li>
        <li><strong>Pin:</strong> ID and Name are pinned left, Status is pinned right. Scroll sideways and they stay.</li>
        <li><strong>Hide:</strong> the Columns button shows and hides columns (ID can never be hidden: <code>hideable: false</code>).</li>
        <li><strong>Keyboard:</strong> click a cell, then use the arrow keys, Home, End, Page Up and Page Down. Enter edits.</li>
        <li><strong>Export:</strong> the Export CSV button downloads what you see. There is no reordering of columns by design.</li>
      </ul>
      <DataGrid
        columns={columns}
        rows={makeEmployees(60)}
        getRowId={(r) => r.id}
        editable
        keyboardNavigation
        columnMenu
        onColumnVisibilityChange={setHiddenNow}
        exportable={{ filename: "employees", scope: "filtered" }}
        apiRef={api}
        multiSort
        searchable
        pagination
        pageSize={8}
        pageSizeOptions={[8, 16, 32]}
      />
      <p className="demo-note">Hidden columns: {hiddenNow.length ? hiddenNow.join(", ") : "none"} · {widthsNote}</p>
      <div className="demo-controls">
        <button
          onClick={() => {
            setCsv(api.current?.getCsv({ scope: "page" }) ?? "");
            setWidthsNote("CSV of the current page built with api.getCsv()");
          }}
        >
          Show CSV of this page
        </button>
      </div>
      {csv && <pre className="demo-json">{csv}</pre>}
    </>
  );
}
