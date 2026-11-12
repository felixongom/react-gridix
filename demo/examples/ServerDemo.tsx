import { useCallback, useRef, useState } from "react";
import { DataGrid, type ColumnDef, type FilterValue, type GridQuery, type SkeletonRowProps } from "../../src";
import { makeEmployees, money, type Employee } from "../data";

// Pretend this is your database. In a real app the work below happens on the server.
const DATABASE = makeEmployees(237);

/** Applies a grid query the way a back end would: search, filters, multi-column sort, then one page. */
function runQuery(q: GridQuery): { rows: Employee[]; total: number } {
  const needle = q.search.toLowerCase();
  let list = DATABASE.filter((e) => !needle || [e.name, e.email, e.department, e.status].some((v) => v.toLowerCase().includes(needle)));

  for (const [field, value] of Object.entries(q.filters) as [keyof Employee, FilterValue][]) {
    list = list.filter((e) => {
      const v = e[field];
      if (Array.isArray(value)) return value.includes(String(v)); // select filter
      if (typeof value === "string") return String(v).toLowerCase().includes(value.toLowerCase()); // text filter
      const r = value as { min?: number; max?: number }; // number range
      return (r.min === undefined || Number(v) >= r.min) && (r.max === undefined || Number(v) <= r.max);
    });
  }

  list = [...list].sort((a, b) => {
    for (const s of q.sort) {
      const x = a[s.field as keyof Employee];
      const y = b[s.field as keyof Employee];
      const r = typeof x === "number" ? x - (y as number) : String(x).localeCompare(String(y));
      if (r !== 0) return s.direction === "asc" ? r : -r;
    }
    return 0;
  });

  const start = q.page * q.pageSize;
  return { rows: list.slice(start, start + q.pageSize), total: list.length };
}

/** A custom placeholder for one row, used instead of the default grey bars. */
function CardSkeleton({ rowIndex }: SkeletonRowProps<Employee>) {
  return (
    <div className="demo-skeleton-card" data-testid="custom-skeleton">
      <span className="demo-skeleton-avatar" />
      <span className="demo-skeleton-lines">
        <span style={{ width: `${40 + ((rowIndex * 17) % 30)}%` }} />
        <span style={{ width: "25%" }} />
      </span>
    </div>
  );
}

const columns: ColumnDef<Employee>[] = [
  { field: "id", headerName: "ID", type: "number", width: 70, sortable: true },
  { field: "name", headerName: "Name", sortable: true, filterable: true, filterDebounce: 600 }, // this column waits 600 ms after typing (the grid default is 300)
  { field: "department", headerName: "Department", sortable: true, filterable: true, filterOptions: ["Engineering", "Design", "Sales", "Support"] },
  { field: "salary", headerName: "Salary", type: "number", align: "right", sortable: true, filterable: true, valueFormatter: (v) => money.format(v) },
  { field: "status", headerName: "Status", sortable: true },
];

export function ServerDemo() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [lastQuery, setLastQuery] = useState<GridQuery | null>(null);
  const [calls, setCalls] = useState(0);
  const [fail, setFail] = useState(false);
  const [custom, setCustom] = useState(false);
  const failRef = useRef(fail);
  failRef.current = fail;
  const latest = useRef(0);

  // The grid calls this on mount and whenever the sort, search, a filter or the page changes.
  // Returning a promise is what turns on the loading skeleton: it stays until the promise settles.
  const onQueryChange = useCallback((q: GridQuery) => {
    setLastQuery(q);
    setCalls((c) => c + 1);
    const id = ++latest.current;
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        if (failRef.current) return reject(new Error("Simulated server error"));
        if (id !== latest.current) return resolve(); // a newer query was sent: ignore this stale answer
        const result = runQuery(q);
        setRows(result.rows);
        setTotal(result.total);
        resolve();
      }, 700);
    });
  }, []);

  return (
    <>
      <ul className="demo-tips">
        <li>Sorting, search, filters and paging all happen in <code>runQuery()</code> (standing in for your API), 700 ms after you ask.</li>
        <li>While the promise returned by <code>onQueryChange</code> is pending, the grid shows a loading skeleton.</li>
        <li>Shift+click headers to sort by several columns (<code>multiSort</code>). Search waits 250 ms after you stop typing.</li>
        <li>Turn on the error switch and change the page: the grid shows an error with a Retry button.</li>
      </ul>
      <div className="demo-controls">
        <label>
          <input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} /> Custom skeleton row
        </label>
        <label>
          <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} /> Simulate a server error
        </label>
      </div>
      <DataGrid
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        serverSide
        rowCount={total}
        onQueryChange={onQueryChange}
        skeletonRow={custom ? CardSkeleton : undefined}
        multiSort
        searchable
        pagination
        pageSize={6}
        pageSizeOptions={[6, 12, 24]}
        loadingRows={6}
      />
      <p className="demo-note">Server calls so far: {calls}</p>
      <pre className="demo-json">{JSON.stringify(lastQuery, null, 2)}</pre>
    </>
  );
}
