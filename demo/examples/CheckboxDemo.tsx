import { useState, type CSSProperties } from "react";
import { Checkbox, DataGrid, type CellEditEvent, type ColumnDef } from "../../src";

interface Task {
  id: number;
  title: string;
  done: boolean;
  urgent: boolean;
  archived: boolean;
  approved: boolean;
  starred: boolean;
}

const titles = [
  "Write documentation",
  "Fix sorting bug",
  "Review pull request",
  "Design the logo",
  "Update dependencies",
  "Plan the release",
  "Answer support emails",
  "Record a demo video",
  "Clean up the backlog",
  "Add dark mode",
  "Improve accessibility",
  "Publish to npm",
];

const initial: Task[] = titles.map((title, i) => ({
  id: i + 1,
  title,
  done: [1, 3, 4, 7].includes(i + 1),
  urgent: [2, 5].includes(i + 1),
  archived: [8].includes(i + 1),
  approved: [1, 2].includes(i + 1),
  starred: [3, 6, 9].includes(i + 1),
}));

// A CSS variable set through an inline style: it only affects this one checkbox.
const red = { "--rg-checkbox-color": "#dc2626" } as CSSProperties;
const amber = { "--rg-checkbox-color": "#f59e0b" } as CSSProperties;

const columns: ColumnDef<Task>[] = [
  { field: "id", sortable: true, headerName: "ID", type: "number", width: 60, editable: false },
  { field: "title", sortable: true, headerName: "Task", filterable: true },
  // type: "boolean" turns the column into checkboxes. Each column picks its own variant.
  // headerCheckbox: true puts a select-all checkbox in the header, labelled with the column name
  // No headerName: a boolean column's label defaults to an empty string, so the header is just the checkbox
  { field: "done", sortable: true, type: "boolean", align: "center", width: 80, headerCheckbox: true, checkbox: { variant: "button" } },
  {
    field: "urgent",
    sortable: true,
    headerName: "Urgent",
    type: "boolean",
    align: "center",
    width: 120,
    headerCheckbox: true,
    checkbox: { variant: "tick", styles: { root: red, control: { borderRadius: 999 } } },
  },
  { field: "archived", sortable: true, headerName: "Archived", type: "boolean", align: "center", width: 130, headerCheckbox: true, checkbox: { variant: "native" } },
  // editable: false shows the checkbox disabled
  { field: "approved", sortable: true, headerName: "Approved (locked)", type: "boolean", align: "center", width: 200, editable: false, headerCheckbox: true, checkbox: { variant: "tick" } },
  // A custom character inside the box, coloured with a CSS variable
  {
    field: "starred",
    sortable: true,
    headerName: "Starred",
    type: "boolean",
    align: "center",
    width: 120,
    headerCheckbox: true,
    checkbox: { variant: "button", indicator: "★", styles: { root: amber } },
  },
];

// No per-column options here: the grid-level checkboxVariant and classNames style them all.
const miniColumns: ColumnDef<Task>[] = [
  { field: "title", sortable: true, headerName: "Task" },
  { field: "done", sortable: true, headerName: "Done", type: "boolean", align: "center", width: 120, headerCheckbox: true },
  { field: "urgent", sortable: true, headerName: "Urgent", type: "boolean", align: "center", width: 120, headerCheckbox: true },
];

export function CheckboxDemo() {
  const [rows, setRows] = useState(initial);
  const [miniRows, setMiniRows] = useState(() => initial.slice(0, 4));
  const [rowClicks, setRowClicks] = useState(0);
  const [lastEdit, setLastEdit] = useState("none yet");
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  const [c, setC] = useState(false);
  const [d, setD] = useState(false);

  return (
    <>
      <ul className="demo-tips">
        <li>One click toggles a checkbox. Space does too when it has focus.</li>
        <li>Each column has its own variant: a box with a span inside, a tick, and the browser's native checkbox. The default border is 1px with no rounding.</li>
        <li>The Done column has no <code>headerName</code>, so its header is only the checkbox. The Starred column draws a custom character (<code>indicator: "★"</code>).</li>
        <li>The last column is locked with <code>editable: false</code>, so its checkboxes are disabled.</li>
        <li>
          Each header is a checkbox too (<code>headerCheckbox: true</code>). It checks or clears every row matching the current search, and shows a dash when only some are checked.
          Click the sort arrow beside it to sort.
        </li>
        <li>Clicking a checkbox does not trigger <code>onRowClick</code>. Clicking any other cell does.</li>
      </ul>
      <DataGrid
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        editable
        onRowsChange={setRows}
        onCellEdit={(e: CellEditEvent<Task>) => setLastEdit(`#${e.row.id} ${e.field}: ${e.oldValue} → ${e.newValue}`)}
        onRowClick={() => setRowClicks((n) => n + 1)}
        searchable
        pagination
        pageSize={12}
        pageSizeOptions={[6, 12]}
      />
      <p className="demo-note">
        Done: {rows.filter((r) => r.done).length} of {rows.length} · Row clicks: {rowClicks} · Last edit: {lastEdit}
      </p>

      <h2 className="demo-heading">Styled from outside (grid-level variant and class names)</h2>
      <DataGrid
        columns={miniColumns}
        rows={miniRows}
        getRowId={(r) => r.id}
        editable
        onRowsChange={setMiniRows}
        checkboxVariant="tick"
        classNames={{
          checkboxControl: "rounded-full border-emerald-500 aria-checked:bg-emerald-500",
          checkboxIndicator: "text-white",
        }}
      />
      <p className="demo-note">
        This grid sets <code>checkboxVariant="tick"</code> and passes Tailwind classes through <code>classNames.checkboxControl</code>.
      </p>

      <h2 className="demo-heading">Standalone Checkbox</h2>
      <div className="demo-controls">
        <Checkbox variant="button" checked={a} onChange={setA} label="Button + span" />
        <Checkbox variant="tick" checked={b} onChange={setB} label="Tick" />
        <Checkbox variant="native" checked={c} onChange={setC} label="Native" />
        <Checkbox
          variant="tick"
          checked={d}
          onChange={setD}
          label="Custom indicator"
          indicator="★"
          styles={{ root: { "--rg-checkbox-color": "#f59e0b" } as CSSProperties }}
        />
      </div>
    </>
  );
}
