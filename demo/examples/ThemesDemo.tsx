import { useState } from "react";
import { DataGrid, type ColumnDef, type GridTheme } from "../../src";
import { makeEmployees, money, type Employee } from "../data";

interface Row extends Employee {
  remote: boolean;
}

const rows: Row[] = makeEmployees(30).map((e) => ({ ...e, remote: e.id % 3 === 0 }));

const columns: ColumnDef<Row>[] = [
  { field: "name", sortable: true, headerName: "Name", filterable: true },
  { field: "department", sortable: true, headerName: "Department", filterable: true },
  { field: "salary", sortable: true, headerName: "Salary", type: "number", align: "right", valueFormatter: (v) => money.format(v) },
  { field: "status", sortable: true, headerName: "Status", filterable: true },
  { field: "remote", sortable: true, headerName: "Remote", type: "boolean", align: "center", width: 120, headerCheckbox: true },
];

const options: { value: GridTheme | undefined; label: string }[] = [
  { value: undefined, label: "None (default)" },
  { value: "ocean", label: "Ocean" },
  { value: "midnight", label: "Midnight" },
  { value: "sunset", label: "Sunset" },
  { value: "forest", label: "Forest" },
  { value: "lavender", label: "Lavender" },
  { value: "coffee", label: "Coffee" },
  { value: "graphite", label: "Graphite" },
  { value: "aurora", label: "Aurora" },
];

export function ThemesDemo() {
  const [theme, setTheme] = useState<GridTheme | undefined>("ocean");
  return (
    <>
      <div className="demo-switcher" role="group" aria-label="Theme">
        {options.map((o) => (
          <button key={o.label} type="button" aria-pressed={theme === o.value} onClick={() => setTheme(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
      <DataGrid
        key={theme ?? "none"}
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        theme={theme}
        editable
        striped
        checkboxVariant="tick"
        searchable
        pagination
        pageSize={8}
        pageSizeOptions={[8, 16]}
      />
      <p className="demo-note">
        <code>{theme ? `<DataGrid theme="${theme}" />` : "<DataGrid />"}</code>. Open a filter dot: the popup follows the theme too.
      </p>
    </>
  );
}
