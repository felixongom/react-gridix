import { useRef, useState } from "react";
import { DataGrid, type ColumnDef, type DataGridApi, type RowSelection } from "../../src";
import { makeEmployees, money, type Employee } from "../data";

// Row selection is off by default. `rowSelection` adds a checkbox column on the left.
const columns: ColumnDef<Employee>[] = [
  { field: "name", headerName: "Name", sortable: true, filterable: true },
  { field: "department", headerName: "Department", sortable: true, filterable: true },
  { field: "salary", headerName: "Salary", type: "number", align: "right", sortable: true, valueFormatter: (v) => money.format(v) },
  { field: "status", headerName: "Status", filterable: true },
];

export function SelectionDemo() {
  const [rows, setRows] = useState(() => makeEmployees(40));
  const [mode, setMode] = useState<"multiple" | "single">("multiple");

  // Controlled selection: we own the list of ids, the grid reports changes
  const [ids, setIds] = useState<(string | number)[]>([2, 4]);
  const [selection, setSelection] = useState<RowSelection<Employee>>({ ids: [2, 4], rows: [] });

  // apiRef gives access to methods such as selectAll() from outside the grid
  const api = useRef<DataGridApi<Employee> | null>(null);

  const deleteSelected = () => {
    const drop = new Set(ids);
    setRows((r) => r.filter((row) => !drop.has(row.id)));
    setIds([]);
  };

  return (
    <>
      <ul className="demo-tips">
        <li>Click a checkbox to select a row. Hold Shift while clicking to select everything between two rows.</li>
        <li>The header checkbox selects every row that matches the search and filters, on all pages.</li>
        <li>Inactive employees have <code>isRowSelectable</code> returning false, so their checkbox is disabled.</li>
        <li>The selection lives in this page's state (<code>selectedRowIds</code>), so the buttons below can change it too.</li>
      </ul>
      <div className="demo-controls">
        <label>
          <input type="radio" name="mode" checked={mode === "multiple"} onChange={() => setMode("multiple")} /> Multiple
        </label>
        <label>
          <input type="radio" name="mode" checked={mode === "single"} onChange={() => setMode("single")} /> Single
        </label>
        <button onClick={() => api.current?.selectAll()}>Select all (API)</button>
        <button onClick={() => setIds([])}>Clear</button>
        <button onClick={deleteSelected} disabled={ids.length === 0}>
          Delete {ids.length} selected
        </button>
      </div>
      <DataGrid
        key={mode}
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        rowSelection={mode}
        selectedRowIds={ids}
        isRowSelectable={(r) => r.status !== "inactive"}
        onSelectionChange={(s) => {
          setIds(s.ids);
          setSelection(s);
        }}
        apiRef={api}
        searchable
        pagination
        pageSize={8}
        pageSizeOptions={[8, 16]}
        checkboxVariant="tick"
      />
      <p className="demo-note">
        Selected ids: <code>{JSON.stringify(ids)}</code> · rows reported by the last change event: {selection.rows.length}
      </p>
    </>
  );
}
