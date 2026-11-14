# react-gridix

A React `DataGrid` and the `Checkbox` it uses. Row selection, server-side mode, typed per-column filters, date columns with a date picker, in-cell editing, resize / pin / hide, keyboard navigation, export to CSV / Excel / JSON / PDF, in and out row animations, filter comparisons, virtualization, loading skeletons and 8 themes. TypeScript, plain CSS.

```tsx
import { DataGrid, type ColumnDef } from "react-gridix";
import "react-gridix/style.css";
```

**Everything is opt-in.** A bare grid is a plain read-only table. You switch each feature on:

```tsx
interface Task { id: number; title: string; due: string; budget: number; status: string }

const columns: ColumnDef<Task>[] = [
  { field: "id", headerName: "ID", type: "number", width: 70, pinned: "left" },
  { field: "title", headerName: "Task", sortable: true, filterable: true, resizable: true },
  { field: "due", headerName: "Due", type: "date", sortable: true, filterable: true },   // date picker + From/To filter
  { field: "budget", headerName: "Budget", type: "number", sortable: true, filterable: true }, // Min/Max filter
  { field: "status", headerName: "Status", sortable: true, filterable: true, filterType: "select" }, // checkbox list
];

<DataGrid
  columns={columns}
  rows={rows}
  getRowId={(r) => r.id}
  editable
  onRowsChange={setRows}
  searchable          // search box
  pagination          // row count and page controls
  rowSelection        // checkbox column
  multiSort           // Shift+click for more sort columns
  columnMenu          // show / hide columns
  keyboardNavigation  // arrow keys
  exportable={{ filename: "tasks" }}   // Export CSV button
  theme="aurora"
/>
```

## What you switch on, and where

| Feature | Switch | Default |
| --- | --- | --- |
| Sorting | `sortable: true` **per column** | off |
| Multi-column sort | `multiSort` | off |
| Search box | `searchable` | off |
| Page info and controls | `pagination` | off |
| Column filter | `filterable: true` per column | off |
| Row selection | `rowSelection` (`true`, `"multiple"`, `"single"`) | off |
| Server-side mode | `serverSide` + `onQueryChange` | off |
| Resize / pin | `resizable: true` / `pinned: "left" \| "right"` per column | off |
| Show / hide columns | `columnMenu` | off |
| Arrow-key navigation | `keyboardNavigation` | off |
| Export (CSV, Excel, JSON, PDF) | `exportable` (`formats`) | off |
| Virtualization | `virtualize` | off |
| Theme | `theme` | none |

There is deliberately no column reordering.

## Row selection

```tsx
const [ids, setIds] = useState<(string | number)[]>([]);

<DataGrid
  rowSelection                                   // or "single"
  getRowId={(r) => r.id}
  selectedRowIds={ids}                           // controlled (or defaultSelectedRowIds)
  onSelectionChange={(s) => setIds(s.ids)}       // s = { ids, rows }
  isRowSelectable={(r) => r.status !== "archived"}
  ...
/>
```

Select-all works across all pages, Shift+click selects a range, and the selection survives paging and sorting.

## Server-side mode

```tsx
const load = useCallback(async (q: GridQuery) => {
  // q = { sort, filters, search, page, pageSize }
  const res = await fetch("/api/people?" + new URLSearchParams({ page: String(q.page), pageSize: String(q.pageSize), search: q.search }));
  if (!res.ok) throw new Error("failed");        // shows an error row with Retry
  const body = await res.json();
  setRows(body.rows);
  setTotal(body.total);
}, []);

<DataGrid serverSide columns={columns} rows={rows} rowCount={total} pagination searchable onQueryChange={load} />
```

`onQueryChange` runs on mount and whenever the sort, search (debounced), a filter or the page changes. **Return a promise and the grid shows a loading skeleton until it settles.**

### Loading skeleton, and a custom one per row

```tsx
function RowSkeleton({ rowIndex }: SkeletonRowProps<Person>) {
  return <div className="my-skeleton" style={{ width: `${50 + (rowIndex * 13) % 40}%` }} />;
}

<DataGrid serverSide onQueryChange={load} skeletonRow={RowSkeleton} loadingRows={6} ... />
```

Or force it yourself: `loading={isFetching}`.

## Controlled state

Search, filters, sort, page and selection are each controlled when you pass the value and its callback:

```tsx
<DataGrid
  search={search} onSearchChange={setSearch}
  filters={filters} onFiltersChange={setFilters}
  sort={sort} onSortChange={setSort}
  page={page} onPageChange={setPage}
  ...
/>
```

## Typed filters

Typed filters (text, exact, number) wait for the user to stop typing before they apply: 300 ms by default (`filterDebounce` on the grid), or a different wait per column. Enter applies at once.

```tsx
<DataGrid filterDebounce={500} columns={[{ field: "email", filterable: true, filterDebounce: 800 }]} ... />
```

| `filterType` | Popup | Value |
| --- | --- | --- |
| `"text"` (default for text) | text box, contains | `"sales"` |
| `"exact"` | text box, equals | `"active"` |
| `"number"` (default for numbers) | Min / Max | `{ min, max }` |
| `"date"` (default for dates) | From / To pickers | `{ from, to }` |
| `"select"` (default for booleans) | checkbox list from the data or `filterOptions` | `["open", "done"]` |

## Date columns

`type: "date"` formats the value (`dateLocale`, `dateFormat`), edits it with a built-in calendar (type the date or click a day; `dateMin` / `dateMax` limit it; the filter has a From / To range calendar), sorts by day and filters by range. Rows can hold `"2026-11-05"`, a `Date`, or a timestamp, and edits keep that shape.

```tsx
{ field: "due", type: "date", editable: true, sortable: true, dateLocale: "en-GB", dateFormat: { dateStyle: "long" } }
```

## Row numbers

```tsx
{ field: "#", type: "sequence", headerName: "No.", width: 64 }   // 1, 2, 3 ... starts again at 1 after a search or filter
```

Numbers follow the filtered, sorted list and continue across pages (`sequenceRestartEachPage` restarts them on each page, `sequenceStart` changes the first number).

## Row animations (in and out)

Rows are matched by `getRowId`: rows that stay are left alone, a new row adds itself with an "in" animation, and a removed row animates "out" where it was.

```tsx
<DataGrid getRowId={(r) => r.id} rowAnimation="zoom" ... />
<DataGrid rowAnimation={{ enter: "slide-left", exit: "fade" }} rowAnimationDuration={500} rowAnimationStagger={40} ... />
```

12 built-in styles, each with an in and an out: `fade`, `slide-up` (default), `slide-down`, `slide-left`, `slide-right`, `zoom`, `flip-x`, `flip-y`, `rotate`, `skew`, `blur`, `bounce` (and `none`). `animateRows={false}` turns them off.

Your own CSS classes work too, one for arriving rows and one for leaving rows:

```tsx
<DataGrid rowAnimationClassName="row-fade-left" rowExitAnimationClassName="row-fade-right" ... />
```

```css
@keyframes fade-left { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: none; } }
@keyframes fade-right { to { opacity: 0; transform: translateX(24px); } }
.row-fade-left  { animation: fade-left 0.45s ease-out both; animation-delay: calc(var(--rg-i, 0) * 45ms); }
.row-fade-right { animation: fade-right 0.3s ease-in forwards; }
```

Every row has `--rg-i` for staggering. Pass a function `(row, index) => className` to choose per row.

## Filter comparisons

Text columns can offer a drop-down in the filter popup (contains, does not contain, equals, not equal, starts with, does not start with, ends with, does not end with). It is opt-in per column:

```tsx
{ field: "name", filterable: true, filterOperators: true }                                     // all eight
{ field: "email", filterable: true, filterOperators: ["contains", "startsWith"], filterOperator: "startsWith" }
{ field: "city", filterable: true }                                                            // no drop-down, always "contains"
```

With it on, the filter value is `{ operator, value }`; without it, a plain string.

## Sort indicator

```tsx
<DataGrid sortIndicator="arrow" ... />          // smooth arrow that rotates when the sort changes
<DataGrid sortIndicator={MyIndicator} ... />    // your component: ({ column, direction, priority }) => ...
```

The default stays the small ▲ ▼ ↕ text arrow. `SortArrow` is exported for use inside your own indicator.

## Custom empty state

```tsx
function NothingHere({ reason, clearAll }: EmptyStateProps<User>) {
  return reason === "no-results" ? <button onClick={clearAll}>Clear filters</button> : <p>No users yet</p>;
}
<DataGrid emptyComponent={NothingHere} ... />      // instead of emptyMessage
```

## Resize, pin, hide, keyboard

```tsx
const columns = [
  { field: "id", width: 70, pinned: "left" },
  { field: "name", width: 160, pinned: "left", resizable: true },
  { field: "email", width: 280, resizable: true, minWidth: 120 },
  { field: "notes", hidden: true },                // starts hidden, shown from the Columns menu
  { field: "status", width: 120, pinned: "right", hideable: false },
];
<DataGrid columnMenu keyboardNavigation columns={columns} rows={rows} />
```

Arrow keys, Home / End (Ctrl for first / last cell), Page Up / Down move between cells. Enter or F2 edits.

## Export: CSV, Excel, JSON, PDF

```tsx
<DataGrid rowSelection pagination getRowId={(r) => r.id}
  exportable={{
    filename: "employees",
    formats: ["csv", "xlsx", "json", "pdf"],      // several formats -> an "Export" menu
    pdf: {
      title: "Employee list",
      header: <div style={{ display: "flex", gap: 12 }}><img src={logo} height={32} /> <b>Acme Corp</b></div>,   // string or element
      footer: "Confidential, page {page} of {pages}",
    },
  }} ... />
```

The menu lets the user choose **Visible rows**, **All matching rows** or **Selected rows**, then a format. CSV, Excel (`.xlsx`, real numbers and dates) and JSON need no extra package. PDF needs `npm install jspdf jspdf-autotable` (plus `html2canvas` for a header or footer element) and you pass them in, so the package never imports them itself:

```tsx
pdf: { libraries: async () => ({ jsPDF: (await import("jspdf")).jsPDF, autoTable: (await import("jspdf-autotable")).default, html2canvas: (await import("html2canvas")).default }) }
```

From code:

```tsx
const api = useRef<DataGridApi<Task> | null>(null);

<DataGrid apiRef={api} rowSelection ... />

api.current?.exportXlsx({ scope: "selected", filename: "picked" });   // scope: "filtered" | "visible" | "selected"
api.current?.exportJson({ scope: "visible" });
await api.current?.exportPdf({ pdf: { title: "Tasks" } });
const blob = await api.current!.getXlsx();                              // build without downloading
api.current?.getSelectedRows();
api.current?.selectAll();
api.current?.refresh();                                                // re-run the server query
```

PDF styling is opt-in: `pdf: { matchGridStyle: true }` copies the grid's on-screen colours, stripes and borders, and `pdf.style` sets your own (`headColor`, `stripeColors`, `pageBackground`, `borderColor`, `cellPadding`, per-column looks) with `margin` as a number or per side:

```tsx
pdf: { libraries, margin: { top: 60, left: 30, right: 30 }, style: { pageBackground: "#0f172a", stripeColors: ["#1e293b", "#334155"], headColor: "#f59e0b" } }
```

Use `exportValue` on a column to control what is written to the file. Handle failures with `onExportError`.

## Virtualization

```tsx
<DataGrid virtualize rowHeight={40} maxHeight={480} rows={twentyThousandRows} ... />
```

Only the visible rows are rendered. Rows must have a fixed height.

## Themes

`theme` is one of `"ocean"`, `"midnight"`, `"sunset"`, `"forest"`, `"lavender"`, `"coffee"`, `"graphite"`, `"aurora"`, or your own `[data-rg-theme="name"]` block of CSS variables. Nothing changes unless you pass it.

```css
[data-rg-theme="brand"] { --rg-header-bg: #7c3aed; --rg-header-text: #fff; --rg-selected-bg: #ede9fe; }
```

## Editing, nested fields, custom components, checkboxes

- Double-click, Enter / F2, or just type. Enter saves and moves down, Tab moves across, Esc cancels. Dot paths such as `"contact.phone"` work everywhere and never mutate your data.
- `cellRenderer`, `cellEditor`, `headerRenderer`, `filterRenderer`, `filterIndicator` take your own components (define them at module level).
- `type: "boolean"` columns show a `Checkbox` (`variant: "button" | "tick" | "native"`, custom `indicator`, `headerCheckbox` for select-all). The standalone `<Checkbox />` is exported too.

## Styling

Remove the bars with `showToolbar={false}` and `showFooter={false}` (the features keep working). Add classes to parts with `classNames={{ cell: "border border-teal-400 py-2" }}`: that puts those classes on every body cell.

The built-in CSS has zero specificity, so Tailwind classes or any of your own win without `!important`. Use `className` / `style` on the root, `classNames` / `styles` for parts, per-column `className` / `style`, and CSS variables (`--rg-header-bg`, `--rg-row-hover`, `--rg-selected-bg`, `--rg-primary`, ...).

## Upgrading

The package is `react-gridix` and CSS variables, classes and the theme attribute use the `rg-` prefix (they used `rk-`). Sorting is now chosen per column (`sortable: true`), and `searchable` / `pagination` default to `false`. See the migration table in [DOCUMENTATION.md](./DOCUMENTATION.md#10-migrating-from-the-earlier-version).

See [DOCUMENTATION.md](./DOCUMENTATION.md) for the full guide with many more examples.

## Demos

`npm run dev` opens a playground with 13 pages: Basic, Editing, Custom components, Checkboxes, Styling, Pagination, Nested fields, Row selection, Server-side, Columns, Large data, Dates and filters, and Themes (source in `demo/examples/`).

## Scripts

- `npm run dev` – demo playground
- `npm run build` – build `dist/` (ES + CJS + types + CSS)
- `npm run typecheck` – TypeScript check
