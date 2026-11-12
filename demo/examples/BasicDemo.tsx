import { useState } from "react";
import { DataGrid, type ColumnDef, type SortModel } from "../../src";
import { makeEmployees, money, type Employee } from "../data";

const rows = makeEmployees(60);

const columns: ColumnDef<Employee>[] = [
  { field: "id", sortable: true, headerName: "ID", type: "number", width: 70 },
  { field: "name", sortable: true, headerName: "Name", filterable: true },
  { field: "department", sortable: true, headerName: "Department", filterable: true },
  { field: "salary", sortable: true, headerName: "Salary", type: "number", align: "right", valueFormatter: (v) => money.format(v) },
  { field: "joined", sortable: true, headerName: "Joined" },
  { field: "status", sortable: true, headerName: "Status", filterable: true },
];

const initialSort: SortModel = { field: "salary", direction: "desc" };

export function BasicDemo() {
  const [sort, setSort] = useState<SortModel[]>([initialSort]);

  return (
    <>
      <DataGrid
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        defaultSort={initialSort}
        onSortChange={setSort}
        searchable
        pagination
        pageSize={8}
        pageSizeOptions={[8, 16, 32]}
      />
      <p className="demo-note">Current sort: {sort.length ? sort.map((s) => `${s.field} (${s.direction})`).join(", ") : "none"}</p>
    </>
  );
}
