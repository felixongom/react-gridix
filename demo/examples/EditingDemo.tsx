import { useState } from "react";
import { DataGrid, type CellEditEvent, type ColumnDef } from "../../src";
import { makeEmployees, money, type Employee } from "../data";

const columns: ColumnDef<Employee>[] = [
  // editable: false locks the whole column
  { field: "id", headerName: "ID", type: "number", width: 70, editable: false },
  { field: "name", headerName: "Name", validate: (v) => String(v).trim().length > 0 },
  { field: "email", headerName: "Email", validate: (v) => /^\S+@\S+\.\S+$/.test(String(v)) },
  {
    field: "salary",
    headerName: "Salary",
    type: "number",
    align: "right",
    valueFormatter: (v) => (v === null || v === undefined ? "" : money.format(v)),
    validate: (v) => v === null || Number(v) >= 0,
  },
  // editable can also be a function, so it is decided per cell
  { field: "status", headerName: "Status", editable: ({ row }) => row.department !== "Support" },
];

export function EditingDemo() {
  const [rows, setRows] = useState(() => makeEmployees(30));
  const [enterMovesDown, setEnterMovesDown] = useState(true);
  const [log, setLog] = useState<string[]>([]);

  const onCellEdit = (e: CellEditEvent<Employee>) =>
    setLog((l) => [`#${e.row.id} ${e.field}: ${JSON.stringify(e.oldValue)} → ${JSON.stringify(e.newValue)}`, ...l].slice(0, 5));

  return (
    <>
      <ul className="demo-tips">
        <li>Double-click a cell, or select it and press Enter or F2. Or just start typing to replace the value.</li>
        <li>Enter saves and starts editing the cell below. Shift+Enter goes up. Tab moves across. Esc cancels.</li>
        <li>Salary only takes numbers and Email needs an @. A bad value leaves the editor open, marked in red.</li>
        <li>The ID column is locked, and Status is locked for the Support department.</li>
      </ul>
      <div className="demo-controls">
        <label>
          <input type="checkbox" checked={enterMovesDown} onChange={(e) => setEnterMovesDown(e.target.checked)} />
          Enter moves down
        </label>
      </div>
      <DataGrid
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        editable
        enterMovesDown={enterMovesDown}
        onRowsChange={setRows}
        onCellEdit={onCellEdit}
        searchable
        pagination
        pageSize={10}
      />
      <h2 className="demo-heading">Last edits (from onCellEdit)</h2>
      <ul className="demo-log">
        {log.length === 0 && <li>No edits yet</li>}
        {log.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </>
  );
}
