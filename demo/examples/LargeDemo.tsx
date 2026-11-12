import { useMemo } from "react";
import { DataGrid, type ColumnDef } from "../../src";
import { makeEmployees, money, type Employee } from "../data";

const columns: ColumnDef<Employee>[] = [
  { field: "id", headerName: "ID", type: "number", width: 90, sortable: true },
  { field: "name", headerName: "Name", sortable: true, filterable: true },
  { field: "department", headerName: "Department", sortable: true, filterable: true },
  { field: "salary", headerName: "Salary", type: "number", align: "right", sortable: true, filterable: true, valueFormatter: (v) => money.format(v) },
  { field: "joined", headerName: "Joined", type: "date", sortable: true, filterable: true },
];

export function LargeDemo() {
  // 20,000 rows, created once. The grid only renders the ones on screen.
  const rows = useMemo(() => makeEmployees(20000), []);

  return (
    <>
      <ul className="demo-tips">
        <li><code>virtualize</code> renders only the visible rows (about 15 of 20,000), so scrolling stays smooth.</li>
        <li>Sorting, searching and filtering still work on every row. Shift+click headers for a second sort column.</li>
        <li>Rows have a fixed <code>rowHeight</code> (40 px here) and the grid scrolls inside <code>maxHeight</code>.</li>
        <li>Click a cell and use the arrow keys, or Ctrl+End to jump to the last row.</li>
      </ul>
      <DataGrid
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        virtualize
        rowHeight={40}
        maxHeight={420}
        multiSort
        keyboardNavigation
        searchable
        exportable={{ filename: "big-export" }}
        striped
        theme="ocean"
      />
    </>
  );
}
