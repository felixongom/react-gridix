import { useState } from "react";
import {
  DataGrid,
  type CellEditorProps,
  type CellParams,
  type ColumnDef,
  type FilterIndicatorProps,
  type FilterRendererProps,
  type HeaderRendererProps,
} from "../../src";
import { departments, makeEmployees, money, statuses, type Employee } from "../data";

// Custom components are plain React components. Define them at module level (not inline in
// render) so React keeps their identity between renders.

/* ---------- cell renderers ---------- */

function NameCell({ row }: CellParams<Employee>) {
  const initials = row.name
    .split(" ")
    .map((p) => p[0])
    .join("");
  return (
    <div className="demo-person">
      <span className="demo-avatar" style={{ background: `hsl(${(row.id * 47) % 360} 60% 42%)` }}>
        {initials}
      </span>
      <span>
        <strong>{row.name}</strong>
        <br />
        <small>{row.email}</small>
      </span>
    </div>
  );
}

function StatusCell({ value }: CellParams<Employee>) {
  return <span className={`demo-badge demo-badge--${value}`}>{String(value)}</span>;
}

function RatingCell({ value }: CellParams<Employee>) {
  const n = Math.max(0, Math.min(5, Number(value) || 0));
  return (
    <span className="demo-stars-text" aria-label={`${n} out of 5`}>
      {"★".repeat(n)}
      {"☆".repeat(5 - n)}
    </span>
  );
}

function ProgressCell({ value }: CellParams<Employee>) {
  const n = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <>
      <span className="demo-bar" role="progressbar" aria-valuenow={n} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${n}%` }} />
      </span>
      <small>{n}%</small>
    </>
  );
}

/* ---------- cell editors ---------- */

function makeSelectEditor(options: readonly string[]) {
  return function SelectEditor({ value, onCommit }: CellEditorProps<Employee>) {
    return (
      <select autoFocus className="demo-select" value={String(value)} onChange={(e) => onCommit(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  };
}

const DepartmentEditor = makeSelectEditor(departments);
const StatusEditor = makeSelectEditor(statuses);

function RatingEditor({ value, onChange, onCommit }: CellEditorProps<Employee>) {
  const n = Number(value) || 0;
  return (
    <div
      className="demo-stars"
      tabIndex={0}
      ref={(el) => el?.focus()}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") onChange(Math.min(5, n + 1));
        else if (e.key === "ArrowLeft") onChange(Math.max(0, n - 1));
        else if (e.key === "Enter") {
          e.preventDefault();
          onCommit(undefined, "down"); // save the draft and edit the cell below
        }
      }}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          tabIndex={-1}
          aria-label={`${i} star${i > 1 ? "s" : ""}`}
          onMouseDown={(e) => e.preventDefault()} // keep focus on the editor
          onClick={() => onCommit(i)}
        >
          {i <= n ? "★" : "☆"}
        </button>
      ))}
    </div>
  );
}

function ProgressEditor({ value, onChange, onCommit }: CellEditorProps<Employee>) {
  const n = Number(value) || 0;
  return (
    <div className="demo-slider">
      <input
        autoFocus
        type="range"
        min={0}
        max={100}
        value={n}
        onChange={(e) => onChange(Number(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit(undefined, "down");
          }
        }}
      />
      <span>{n}%</span>
    </div>
  );
}

/* ---------- header and filter renderers ---------- */

function SalaryHeader({ column }: HeaderRendererProps<Employee>) {
  return (
    <span>
      {column.headerName} <small className="demo-muted">USD</small>
    </span>
  );
}

function DepartmentFilter({ value, onChange }: FilterRendererProps<Employee>) {
  return (
    <select
      className="rg-grid__filter-input"
      aria-label="Filter department"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">All</option>
      {departments.map((d) => (
        <option key={d} value={d}>
          {d}
        </option>
      ))}
    </select>
  );
}

/** A custom filter indicator: a funnel that turns solid when the filter is active. */
function FunnelIndicator({ active }: FilterIndicatorProps<Employee>) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M1.5 2h13l-5 6v5l-3 1.5V8z" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

const columns: ColumnDef<Employee>[] = [
  { field: "name", sortable: true, headerName: "Employee", width: 260, cellRenderer: NameCell },
  {
    field: "department",
    sortable: true,
    headerName: "Department",
    cellEditor: DepartmentEditor,
    filterable: true,
    filterIndicator: FunnelIndicator,
    filterRenderer: DepartmentFilter,
  },
  {
    field: "salary",
    sortable: true,
    headerName: "Salary",
    type: "number",
    align: "right",
    headerRenderer: SalaryHeader,
    valueFormatter: (v) => (v === null || v === undefined ? "" : money.format(v)),
  },
  { field: "rating", sortable: true, headerName: "Rating", type: "number", width: 130, cellRenderer: RatingCell, cellEditor: RatingEditor },
  { field: "progress", sortable: true, headerName: "Progress", type: "number", width: 200, cellRenderer: ProgressCell, cellEditor: ProgressEditor },
  {
    field: "status",
    sortable: true,
    headerName: "Status",
    cellRenderer: StatusCell,
    cellEditor: StatusEditor,
    filterable: true,
    // Each column styles its own indicator: a dot here, coloured amber
    filterIndicatorStyle: { color: "#f59e0b" },
    filterPopupStyle: { borderColor: "#f59e0b" },
  },
];

export function CustomComponentsDemo() {
  const [rows, setRows] = useState(() => makeEmployees(24));
  return (
    <>
      <ul className="demo-tips">
        <li><strong>cellRenderer</strong>: avatar, badge, stars and progress bar. Search and sort still use the underlying value.</li>
        <li><strong>cellEditor</strong>: double-click Department, Rating, Progress or Status to get a select, star picker or slider.</li>
        <li><strong>headerRenderer</strong> (Salary) and <strong>filterIndicator</strong> (a funnel on Department, an amber dot on Status) and <strong>filterRenderer</strong> (a dropdown inside the Department popup). Click an indicator to open its popup.</li>
      </ul>
      <DataGrid columns={columns} rows={rows} getRowId={(r) => r.id} editable onRowsChange={setRows} searchable pagination pageSize={6} pageSizeOptions={[6, 12, 24]} />
    </>
  );
}
