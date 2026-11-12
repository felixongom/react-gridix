import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { DateEditor } from "./DateEditor";
import { Checkbox } from "../Checkbox/Checkbox";
import { ColumnFilter } from "./ColumnFilter";
import { ColumnMenu } from "./ColumnMenu";
import { downloadBlob, downloadCsv, toCsv } from "./csv";
import { ExportMenu, exportButtonLabel, type ExportScopeChoice, type MenuScope } from "./ExportMenu";
import { buildPdf } from "./pdf";
import { readGridStyle } from "./gridStyle";
import { SortArrow } from "./SortArrow";
import { buildXlsx, type XlsxColumn, type XlsxValue } from "./xlsx";
import { formatDate, fromISODate, parseISODate, toISODate } from "./dates";
import { buildOptions, isFilterActive, matchesFilter, resolveFilterKind } from "./filters";
import { useControlled, useIsoLayoutEffect } from "./hooks";
import { getByPath, setByPath } from "./paths";
import { cx, headerLabel, nameOf } from "./utils";
import "./datagrid.css";
import "./themes.css";
import type {
  CellEditableParams,
  CellEditEvent,
  CellParams,
  ColumnDef,
  DataGridProps,
  EmptyReason,
  ExportFormat,
  ExportOptions,
  FilterOption,
  FilterValue,
  GridQuery,
  GridSlot,
  MoveDirection,
  RowAnimationName,
  SortModel,
} from "./types";

type AnyRow = Record<string, any>;

/** A row together with its position in the data array and its id. */
interface Entry<T> {
  row: T;
  /** Index in the grid's data array (not the position on screen). */
  index: number;
  id: string | number;
}

/**
 * A row that has just been removed from the list (filtered out, deleted ...). It stays on screen, played
 * with its exit animation, and is then dropped. `afterId` is the row it sat below, so it keeps its place.
 */
interface Ghost<T> {
  id: string | number;
  entry: Entry<T>;
  /** Id of the row (or ghost) just above it; null when it was first. */
  afterId: string | number | null;
  /** Position among the rows that left together (for the stagger). */
  batch: number;
}

/** Something drawn in the table body: a live row, or a leaving one. */
type BodyItem<T> = { kind: "row"; entry: Entry<T>; i: number } | { kind: "ghost"; ghost: Ghost<T> };

/** Puts the leaving rows back between the rows they sat between. Ghosts whose anchor is gone go to the end. */
function interleave<T>(rows: Entry<T>[], ghosts: Ghost<T>[]): BodyItem<T>[] {
  if (ghosts.length === 0) return rows.map((entry, i) => ({ kind: "row", entry, i }));
  const byAnchor = new Map<string | number | null, Ghost<T>[]>();
  for (const g of ghosts) byAnchor.set(g.afterId, [...(byAnchor.get(g.afterId) ?? []), g]);
  const out: BodyItem<T>[] = [];
  const done = new Set<string | number>();
  const emit = (anchor: string | number | null) => {
    for (const g of byAnchor.get(anchor) ?? []) {
      if (done.has(g.id)) continue; // guards against a loop
      done.add(g.id);
      out.push({ kind: "ghost", ghost: g });
      emit(g.id); // rows that left below a leaving row
    }
  };
  emit(null);
  rows.forEach((entry, i) => {
    out.push({ kind: "row", entry, i });
    emit(entry.id);
  });
  ghosts.forEach((g) => !done.has(g.id) && out.push({ kind: "ghost", ghost: g }));
  return out;
}

/** True when the user asked the system for less motion. */
const prefersReducedMotion = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The cell that is being edited. */
interface EditState {
  id: string | number;
  field: string;
  draft: unknown;
  /** Counter value of the edit session, used to ignore late blur events from a closed editor. */
  session: number;
  select: "all" | "end";
  invalid: boolean;
}

/** Width of the selection (checkbox) column. */
const SELECT_W = 38;
/** Width used for a column that has no width yet when the user starts resizing. */
const DEFAULT_COL_W = 150;
/** How many rows Page Up / Page Down jump with keyboard navigation. */
const PAGE_STEP = 10;

const cellKey = (id: string | number, field: string) => `${typeof id}:${id}\u0000${field}`;

/** The text a cell shows: valueFormatter first, then the built-in formats for booleans and dates. */
function displayValue<T extends AnyRow>(col: ColumnDef<T>, row: T): string {
  const value = getByPath(row, col.field);
  if (col.valueFormatter) return col.valueFormatter(value, row);
  if (col.type === "boolean" && typeof value === "boolean") return value ? "Yes" : "No";
  if (col.type === "date") return formatDate(value, col.dateLocale, col.dateFormat);
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toLocaleDateString();
  return String(value);
}

/** Default sort order of two non-empty values. Dates compare by day, numbers by size, the rest as text. */
function defaultCompare(a: unknown, b: unknown, col: ColumnDef<any>): number {
  if (col.type === "date") {
    const x = toISODate(a) ?? "";
    const y = toISODate(b) ?? "";
    return x < y ? -1 : x > y ? 1 : 0;
  }
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

const toSortList = (s: SortModel | SortModel[] | null | undefined): SortModel[] => (!s ? [] : Array.isArray(s) ? s : [s]);

/** True when a date <input> holds text the browser cannot turn into a date yet (half-typed). */
const isBadDateInput = (el: HTMLInputElement) => el.type === "date" && el.validity.badInput;

export function DataGrid<T extends AnyRow = AnyRow>({
  columns,
  rows,
  getRowId,
  editable = false,
  enterMovesDown = true,
  onCellEdit,
  onRowsChange,
  rowSelection = false,
  selectedRowIds,
  defaultSelectedRowIds,
  onSelectionChange,
  isRowSelectable,
  sort: sortProp,
  defaultSort = null,
  onSortChange,
  multiSort = false,
  searchable = false,
  searchPlaceholder = "Search…",
  search: searchProp,
  onSearchChange,
  filters: filtersProp,
  onFiltersChange,
  pagination = false,
  paginationPosition = "bottom",
  showToolbar: allowToolbar = true,
  showFooter = true,
  pageSize: initialPageSize = 10,
  pageSizeOptions = [5, 10, 25, 50],
  page: pageProp,
  onPageChange,
  onPageSizeChange,
  serverSide = false,
  rowCount,
  onQueryChange,
  queryDebounce = 250,
  filterDebounce = 300,
  loading: loadingProp,
  loadingRows,
  skeletonRow,
  errorMessage = "Could not load the data.",
  columnMenu = false,
  onColumnVisibilityChange,
  keyboardNavigation = false,
  virtualize = false,
  rowHeight = 40,
  overscan = 6,
  exportable = false,
  onExportError,
  apiRef,
  onRowClick,
  toolbar,
  emptyMessage = "No rows to show",
  emptyComponent,
  sortIndicator = "default",
  striped = false,
  stripeColors,
  checkboxVariant = "native",
  animateRows = true,
  rowAnimation,
  rowAnimationDuration,
  rowAnimationStagger,
  rowAnimationClassName,
  rowExitAnimationClassName,
  theme,
  maxHeight,
  className,
  style,
  classNames = {},
  styles = {},
  rowClassName,
  rowStyle,
}: DataGridProps<T>) {
  /** className + style for one named part of the grid (the `classNames` / `styles` props). */
  const slot = (name: GridSlot, base: string) => ({
    className: cx(base, classNames[name]),
    style: styles[name],
  });

  // ==========================================================================================
  // State
  // ==========================================================================================

  // The grid keeps its own copy of the rows so that edits show immediately. It copies again
  // whenever the `rows` prop changes identity (new array from your state, new page from the server).
  const [data, setData] = useState<T[]>(rows);
  const dataRef = useRef<T[]>(rows);
  useEffect(() => {
    dataRef.current = rows;
    setData(rows);
  }, [rows]);
  const applyData = (next: T[]) => {
    dataRef.current = next;
    setData(next);
  };

  // Each of these can be controlled from outside (pass the prop) or left to the grid.
  const [search, setSearch] = useControlled(searchProp, "", onSearchChange);
  const [filters, setFilters] = useControlled<Record<string, FilterValue>>(filtersProp, {}, onFiltersChange);
  const [sort, setSort] = useControlled<SortModel[]>(sortProp, toSortList(defaultSort), onSortChange);
  const [page, setPage] = useControlled(pageProp, 0, onPageChange);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const changePageSize = (n: number) => {
    setPageSizeState(n);
    onPageSizeChange?.(n);
  };

  // Columns the user (or `hidden: true`) took out of the view
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(columns.filter((c) => c.hidden).map((c) => c.field)));
  const toggleColumn = (field: string, hide: boolean) => {
    const next = new Set(hidden);
    if (hide) next.add(field);
    else next.delete(field);
    setHidden(next);
    onColumnVisibilityChange?.([...next]);
  };

  // Column widths set by dragging. Empty until the user resizes something.
  const [widths, setWidths] = useState<Record<string, number>>({});
  // Sticky offsets of pinned columns, measured from the real header cells
  const [pinOffsets, setPinOffsets] = useState<Record<string, number>>({});
  const [layoutTick, setLayoutTick] = useState(0);
  const thEls = useRef(new Map<string, HTMLTableCellElement>());

  // Editing
  const [editing, setEditing] = useState<EditState | null>(null);
  const sessionRef = useRef(0); // bumped whenever an edit starts or ends, so late blur events can be ignored
  const draftRef = useRef<unknown>(null);
  const cellEls = useRef(new Map<string, HTMLTableCellElement>());

  // Keyboard navigation: the cell that owns the single tab stop, and a cell we still have to focus
  const [activeCell, setActiveCell] = useState<{ id: string | number; field: string } | null>(null);
  const pendingFocus = useRef<string | null>(null);

  // Virtualization: how far the body is scrolled and how tall the scroll area is
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollInfo, setScrollInfo] = useState({ top: 0, height: 0 });

  // ==========================================================================================
  // Columns: hide, then move pinned ones to the edges
  // ==========================================================================================

  const cols = useMemo(() => {
    // A sequence column (row numbers) is display-only: it cannot be sorted, filtered or edited
    const visibleCols = columns
      .filter((c) => !hidden.has(c.field))
      .map((c) => (c.type === "sequence" ? { ...c, sortable: false, filterable: false, editable: false, filterRenderer: undefined } : c));
    return [
      ...visibleCols.filter((c) => c.pinned === "left"),
      ...visibleCols.filter((c) => c.pinned !== "left" && c.pinned !== "right"),
      ...visibleCols.filter((c) => c.pinned === "right"),
    ];
  }, [columns, hidden]);

  const isSortable = (c: ColumnDef<T>) => c.sortable === true; // sorting is opt-in, column by column
  const selectionMode = rowSelection === "single" ? "single" : rowSelection ? "multiple" : null;
  const colSpan = cols.length + (selectionMode ? 1 : 0);

  // ==========================================================================================
  // Rows: entries -> search/filter/sort -> page
  // ==========================================================================================

  const entries = useMemo<Entry<T>[]>(
    () => data.map((row, index) => ({ row, index, id: getRowId ? getRowId(row, index) : index })),
    [data, getRowId]
  );

  // Rows we have seen, by id. Selection can include rows that are on other pages or no longer loaded.
  const rowCache = useRef(new Map<string | number, T>());
  entries.forEach((e) => rowCache.current.set(e.id, e.row));

  // Only filters of columns that are visible and still `filterable` count
  const activeFilters = useMemo(
    () =>
      Object.entries(filters).filter(([field, v]) => {
        const col = cols.find((c) => c.field === field);
        return !!col && !!col.filterable && isFilterActive(v);
      }),
    [filters, cols]
  );

  // In server mode the search text is debounced so we do not query on every keystroke
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    if (!serverSide) return;
    const timer = setTimeout(() => setDebouncedSearch(search), queryDebounce);
    return () => clearTimeout(timer);
  }, [search, serverSide, queryDebounce]);
  const effectiveSearch = serverSide ? debouncedSearch : search;

  const filterKind = (c: ColumnDef<T>) => (c.filterRenderer ? "text" : resolveFilterKind(c));

  const processed = useMemo(() => {
    // The server already searched, filtered and sorted these rows
    if (serverSide) return entries;

    const q = effectiveSearch.trim().toLowerCase();
    let list = entries.filter(({ row }) => {
      if (q && !cols.some((c) => displayValue(c, row).toLowerCase().includes(q))) return false;
      return activeFilters.every(([field, v]) => {
        const col = cols.find((c) => c.field === field)!;
        return matchesFilter(filterKind(col), v, displayValue(col, row), getByPath(row, field));
      });
    });

    // Sort by every sorted column in turn. A later column only decides rows the earlier ones tie on.
    const specs = sort
      .map((s) => ({ col: cols.find((c) => c.field === s.field), dir: s.direction === "asc" ? 1 : -1 }))
      .filter((s): s is { col: ColumnDef<T>; dir: 1 | -1 } => !!s.col);
    if (specs.length) {
      list = [...list].sort((a, b) => {
        for (const { col, dir } of specs) {
          const va = getByPath(a.row, col.field);
          const vb = getByPath(b.row, col.field);
          const aEmpty = va === null || va === undefined || va === "";
          const bEmpty = vb === null || vb === undefined || vb === "";
          if (aEmpty || bEmpty) {
            if (aEmpty !== bEmpty) return aEmpty ? 1 : -1; // empty values always last, in both directions
            continue;
          }
          const result = col.comparator ? col.comparator(va, vb, a.row, b.row) : defaultCompare(va, vb, col);
          if (result !== 0) return result * dir;
        }
        return 0;
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, cols, effectiveSearch, activeFilters, sort, serverSide]);

  // Back to page 1 whenever what the user is looking at changes (but not on the first render)
  const resetKey = JSON.stringify([effectiveSearch, filters, sort, pageSize]);
  const lastResetKey = useRef(resetKey);
  useEffect(() => {
    if (lastResetKey.current === resetKey) return;
    lastResetKey.current = resetKey;
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const total = serverSide ? rowCount ?? entries.length : processed.length;
  const pageCount = pagination ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const safePage = Math.min(page, pageCount - 1);
  // With a server, `rows` already is the current page
  const visible = pagination && !serverSide ? processed.slice(safePage * pageSize, safePage * pageSize + pageSize) : processed;
  const rangeStart = total === 0 ? 0 : pagination ? safePage * pageSize + 1 : 1;
  const rangeEnd = pagination ? Math.min(total, (safePage + 1) * pageSize) : total;

  // ==========================================================================================
  // Server-side mode: ask the server for rows whenever the query changes
  // ==========================================================================================

  const query = useMemo<GridQuery>(
    () => ({
      sort: sort.filter((s) => {
        const col = columns.find((c) => c.field === s.field);
        return !!col && isSortable(col);
      }),
      filters: Object.fromEntries(activeFilters) as Record<string, FilterValue>,
      search: effectiveSearch.trim(),
      page: safePage,
      pageSize,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sort, columns, activeFilters, effectiveSearch, safePage, pageSize]
  );
  const queryKey = JSON.stringify(query);
  const queryRef = useRef(query);
  queryRef.current = query;
  const onQueryRef = useRef(onQueryChange);
  onQueryRef.current = onQueryChange;

  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const requestId = useRef(0);

  /** Calls `onQueryChange`. When it returns a promise we show the loading state until it settles. */
  const runQuery = useCallback((q: GridQuery) => {
    const id = ++requestId.current; // a newer request makes older answers irrelevant
    const result = onQueryRef.current?.(q);
    if (result && typeof (result as Promise<unknown>).then === "function") {
      setPending(true);
      setFailed(false);
      (result as Promise<unknown>).then(
        () => {
          if (id === requestId.current) setPending(false);
        },
        () => {
          if (id === requestId.current) {
            setPending(false);
            setFailed(true);
          }
        }
      );
    } else {
      setPending(false);
      setFailed(false);
    }
  }, []);

  useEffect(() => {
    if (serverSide) runQuery(queryRef.current);
  }, [serverSide, queryKey, runQuery]);

  // If the total shrinks (rows deleted on the server), do not stay on a page that no longer exists
  useEffect(() => {
    if (serverSide && pagination && page > pageCount - 1) setPage(pageCount - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSide, pagination, page, pageCount]);

  const isLoading = loadingProp ?? pending;

  // ==========================================================================================
  // Selection
  // ==========================================================================================

  const idsToRows = (ids: (string | number)[]) =>
    ids.map((id) => rowCache.current.get(id)).filter((r): r is T => r !== undefined);
  const [selected, setSelected] = useControlled<(string | number)[]>(
    selectedRowIds,
    defaultSelectedRowIds ?? [],
    (ids) => onSelectionChange?.({ ids, rows: idsToRows(ids) })
  );
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const canSelect = (row: T) => (isRowSelectable ? isRowSelectable(row) : true);
  const lastClickedId = useRef<string | number | null>(null);
  const shiftHeld = useRef(false);

  /** Checks or unchecks one row. With Shift held, everything between the previous click and this one follows. */
  const toggleRow = (entry: Entry<T>, on: boolean) => {
    if (!selectionMode || !canSelect(entry.row)) return;
    if (selectionMode === "single") {
      setSelected(on ? [entry.id] : []);
      lastClickedId.current = entry.id;
      return;
    }
    const next = new Set(selected);
    const from = shiftHeld.current && lastClickedId.current !== null ? visible.findIndex((e) => e.id === lastClickedId.current) : -1;
    const to = visible.findIndex((e) => e.id === entry.id);
    if (from >= 0 && to >= 0) {
      for (let i = Math.min(from, to); i <= Math.max(from, to); i++) {
        if (!canSelect(visible[i].row)) continue;
        if (on) next.add(visible[i].id);
        else next.delete(visible[i].id);
      }
    } else if (on) next.add(entry.id);
    else next.delete(entry.id);
    lastClickedId.current = entry.id;
    setSelected([...next]);
  };

  // The select-all box acts on every selectable row matching the search and filters (all pages)
  const selectable = useMemo(() => processed.filter((e) => canSelect(e.row)), [processed, isRowSelectable]); // eslint-disable-line react-hooks/exhaustive-deps
  const selectedInView = selectable.filter((e) => selectedSet.has(e.id)).length;
  const allSelected = selectable.length > 0 && selectedInView === selectable.length;
  const toggleAllRows = (on: boolean) => {
    const next = new Set(selected);
    selectable.forEach((e) => (on ? next.add(e.id) : next.delete(e.id)));
    setSelected([...next]);
  };

  // ==========================================================================================
  // Cell params and permissions
  // ==========================================================================================

  const baseParams = (c: ColumnDef<T>, row: T, index: number): CellEditableParams<T> => ({
    value: getByPath(row, c.field),
    formattedValue: displayValue(c, row),
    row,
    rowIndex: index,
    field: c.field,
    column: c,
  });

  /** May the cell's value be changed at all (typed, picked, or through a checkbox)? */
  const cellEditable = (c: ColumnDef<T>, params: CellEditableParams<T>) => {
    const e = c.editable ?? editable;
    return typeof e === "function" ? e(params) : !!e;
  };

  /** Can the cell be opened in an editor? Checkbox cells change with one click instead. */
  const isTextEditable = (c: ColumnDef<T>, params: CellEditableParams<T>) =>
    cellEditable(c, params) && !(c.type === "boolean" && !c.cellEditor);

  const paramsFor = (c: ColumnDef<T>, entry: Entry<T>): CellParams<T> => {
    const base = baseParams(c, entry.row, entry.index);
    const canEdit = cellEditable(c, base);
    return {
      ...base,
      editable: canEdit,
      updateValue: (value: unknown) => canEdit && commitValue(entry, c, { value }),
    };
  };

  // ==========================================================================================
  // Sorting
  // ==========================================================================================

  /**
   * Click: sort by this column only (ascending, then descending, then off).
   * Shift+click with `multiSort`: add the column to the sort list, or change/remove it there.
   */
  const toggleSort = (c: ColumnDef<T>, additive: boolean) => {
    if (!isSortable(c)) return;
    const current = sort.find((s) => s.field === c.field);
    const nextDir = !current ? "asc" : current.direction === "asc" ? "desc" : null;
    let next: SortModel[];
    if (additive && multiSort) {
      if (!nextDir) next = sort.filter((s) => s.field !== c.field);
      else if (current) next = sort.map((s) => (s.field === c.field ? { ...s, direction: nextDir } : s));
      else next = [...sort, { field: c.field, direction: nextDir }];
    } else {
      next = nextDir ? [{ field: c.field, direction: nextDir }] : [];
    }
    setSort(next);
  };

  // ==========================================================================================
  // Editing
  // ==========================================================================================

  const focusCell = (id: string | number, field: string) => cellEls.current.get(cellKey(id, field))?.focus();

  const stopEditing = () => {
    sessionRef.current += 1;
    setEditing(null);
  };

  /** A sample of what the column holds, used to save a date in the same kind (string, Date, number). */
  const sampleValue = (c: ColumnDef<T>) => {
    for (const r of dataRef.current) {
      const v = getByPath(r, c.field);
      if (v !== null && v !== undefined && v !== "") return v;
    }
    return undefined;
  };

  const startEdit = (
    entry: Entry<T>,
    c: ColumnDef<T>,
    opts: { text?: string; select?: "all" | "end" } = {}
  ): boolean => {
    if (!isTextEditable(c, baseParams(c, entry.row, entry.index))) return false;
    const raw = getByPath(entry.row, c.field);
    let draft: unknown;
    if (c.cellEditor) draft = raw;
    else if (c.type === "date") draft = toISODate(raw) ?? ""; // the date picker works with "YYYY-MM-DD"
    else draft = opts.text ?? (raw === null || raw === undefined ? "" : String(raw));
    draftRef.current = draft;
    sessionRef.current += 1;
    setEditing({
      id: entry.id,
      field: c.field,
      draft,
      session: sessionRef.current,
      select: opts.select ?? "end",
      invalid: false,
    });
    return true;
  };

  /** Writes the value into the data. Returns false when the value was rejected. */
  const commitValue = (entry: Entry<T>, c: ColumnDef<T>, input: { text: string } | { value: unknown }): boolean => {
    const current = dataRef.current[entry.index] ?? entry.row;
    const oldValue = getByPath(current, c.field);
    let newValue: unknown;
    if ("value" in input) {
      newValue = input.value;
    } else if (c.valueParser) {
      newValue = c.valueParser(input.text, current);
    } else if (c.type === "date") {
      // The date picker gives "YYYY-MM-DD" or "". Save the same kind of value the cell held before.
      if (input.text !== "" && !parseISODate(input.text)) return false;
      newValue = fromISODate(input.text, oldValue ?? sampleValue(c));
    } else if (c.type === "number") {
      if (input.text.trim() === "") newValue = null;
      else {
        const n = Number(input.text);
        if (!Number.isFinite(n)) return false;
        newValue = n;
      }
    } else {
      newValue = input.text;
    }

    if (c.type === "date") {
      // Two Date objects are never "the same object", so compare the days they stand for
      if (toISODate(newValue) === toISODate(oldValue)) return true;
      const day = toISODate(newValue);
      if (day && ((c.dateMin && day < c.dateMin) || (c.dateMax && day > c.dateMax))) return false;
    } else if (Object.is(newValue, oldValue)) {
      return true;
    }
    if (c.validate && !c.validate(newValue, current)) return false;

    const nextRow = setByPath(current, c.field, newValue); // copies the row (and nested objects), never mutates
    const next = dataRef.current.map((r, i) => (i === entry.index ? nextRow : r));
    applyData(next);
    onCellEdit?.({ rowId: entry.id, rowIndex: entry.index, field: c.field, oldValue, newValue, row: nextRow });
    onRowsChange?.(next);
    return true;
  };

  /** The next editable cell in a direction. Up and down stay in the column, left and right wrap across rows. */
  const findNextCell = (
    entry: Entry<T>,
    field: string,
    move: Exclude<MoveDirection, "none">
  ): { entry: Entry<T>; col: ColumnDef<T> } | null => {
    const rowPos = visible.findIndex((e) => e.id === entry.id);
    const colPos = cols.findIndex((c) => c.field === field);
    if (rowPos < 0 || colPos < 0) return null;
    const ok = (e: Entry<T>, c: ColumnDef<T>) => isTextEditable(c, baseParams(c, e.row, e.index));

    if (move === "down" || move === "up") {
      const step = move === "down" ? 1 : -1;
      for (let r = rowPos + step; r >= 0 && r < visible.length; r += step) {
        if (ok(visible[r], cols[colPos])) return { entry: visible[r], col: cols[colPos] };
      }
      return null;
    }

    const step = move === "right" ? 1 : -1;
    let r = rowPos;
    let c = colPos + step;
    while (r >= 0 && r < visible.length) {
      while (c >= 0 && c < cols.length) {
        if (ok(visible[r], cols[c])) return { entry: visible[r], col: cols[c] };
        c += step;
      }
      r += step;
      c = step > 0 ? 0 : cols.length - 1;
    }
    return null;
  };

  /** Saves the edit and either moves to the neighbouring cell or closes the editor. */
  const finishEdit = (
    entry: Entry<T>,
    c: ColumnDef<T>,
    input: { text: string } | { value: unknown },
    opts: { move?: MoveDirection; focus?: boolean } = {}
  ): boolean => {
    const { move = "none", focus = true } = opts;
    if (!commitValue(entry, c, input)) {
      setEditing((prev) => (prev ? { ...prev, invalid: true } : prev));
      return false;
    }
    const target = move === "none" ? null : findNextCell(entry, c.field, move);
    if (target) {
      startEdit(target.entry, target.col, { select: "all" });
    } else {
      stopEditing();
      if (focus) focusCell(entry.id, c.field);
    }
    return true;
  };

  const onTextEditorKeyDown = (e: KeyboardEvent<HTMLInputElement>, entry: Entry<T>, c: ColumnDef<T>) => {
    if (e.nativeEvent.isComposing) return;
    const text = e.currentTarget.value;
    // A half-typed date cannot be saved yet: keep the editor open and mark it invalid
    const badDate = isBadDateInput(e.currentTarget);
    if (e.key === "Enter") {
      e.preventDefault();
      if (badDate) return setEditing((prev) => (prev ? { ...prev, invalid: true } : prev));
      const move: MoveDirection = enterMovesDown ? (e.shiftKey ? "up" : "down") : "none";
      finishEdit(entry, c, { text }, { move });
    } else if (e.key === "Escape") {
      e.preventDefault();
      stopEditing();
      focusCell(entry.id, c.field);
    } else if (e.key === "Tab" && !badDate) {
      const move = e.shiftKey ? "left" : "right";
      if (findNextCell(entry, c.field, move)) {
        e.preventDefault();
        finishEdit(entry, c, { text }, { move });
      }
      // No next cell: let Tab move focus normally. The blur handler saves the value.
    }
  };

  // ==========================================================================================
  // Keyboard navigation (opt-in)
  // ==========================================================================================

  /** Moves the single tab stop to a cell and focuses it, scrolling to it first when rows are virtualized. */
  const moveFocus = (rowPos: number, colPos: number) => {
    const target = visible[rowPos];
    const col = cols[colPos];
    if (!target || !col) return;
    setActiveCell({ id: target.id, field: col.field });
    pendingFocus.current = cellKey(target.id, col.field);
    const box = scrollRef.current;
    if (virtualize && box) {
      // The row might not be rendered yet. Scroll so that it is, then the effect below focuses it.
      const headH = box.querySelector("thead")?.clientHeight ?? 0;
      const top = rowPos * rowHeight;
      if (top < box.scrollTop) box.scrollTo({ top, behavior: "auto" });
      else if (top + rowHeight > box.scrollTop + box.clientHeight - headH) {
        box.scrollTo({ top: top + rowHeight - box.clientHeight + headH, behavior: "auto" });
      }
    }
  };

  // Focus the cell we were asked to focus as soon as it exists in the DOM
  useEffect(() => {
    const key = pendingFocus.current;
    if (!key) return;
    const el = cellEls.current.get(key);
    if (el) {
      pendingFocus.current = null;
      el.focus();
    }
  });

  /** Arrow keys, Home, End, Page Up and Page Down. Returns true when the key was a navigation key. */
  const navigate = (e: KeyboardEvent<HTMLTableCellElement>, entry: Entry<T>, c: ColumnDef<T>): boolean => {
    if (!keyboardNavigation) return false;
    let r = visible.findIndex((v) => v.id === entry.id);
    let k = cols.findIndex((x) => x.field === c.field);
    if (r < 0 || k < 0) return false;
    switch (e.key) {
      case "ArrowDown": r += 1; break;
      case "ArrowUp": r -= 1; break;
      case "ArrowRight": k += 1; break;
      case "ArrowLeft": k -= 1; break;
      case "PageDown": r += PAGE_STEP; break;
      case "PageUp": r -= PAGE_STEP; break;
      case "Home":
        k = 0;
        if (e.ctrlKey || e.metaKey) r = 0;
        break;
      case "End":
        k = cols.length - 1;
        if (e.ctrlKey || e.metaKey) r = visible.length - 1;
        break;
      default:
        return false;
    }
    e.preventDefault();
    moveFocus(Math.max(0, Math.min(visible.length - 1, r)), Math.max(0, Math.min(cols.length - 1, k)));
    return true;
  };

  const onCellKeyDown = (e: KeyboardEvent<HTMLTableCellElement>, entry: Entry<T>, c: ColumnDef<T>, params: CellParams<T>) => {
    if (e.target !== e.currentTarget) return; // keys typed inside an editor or checkbox are not ours
    if (navigate(e, entry, c)) return;
    if (!isTextEditable(c, params)) return;
    if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      startEdit(entry, c);
    } else if (!c.cellEditor && c.type !== "date" && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      startEdit(entry, c, { text: e.key }); // typing replaces the value, like a spreadsheet
    }
  };

  // ==========================================================================================
  // Virtualization (opt-in): render only the rows that are on screen
  // ==========================================================================================

  useIsoLayoutEffect(() => {
    if (!virtualize || !scrollRef.current) return;
    const box = scrollRef.current;
    const measure = () => setScrollInfo((s) => (s.height === box.clientHeight ? s : { ...s, height: box.clientHeight }));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [virtualize]);

  const virtualOn = virtualize && !isLoading && visible.length > 0;
  const viewH = scrollInfo.height || (typeof maxHeight === "number" ? maxHeight : 400);
  const first = virtualOn ? Math.max(0, Math.floor(scrollInfo.top / rowHeight) - overscan) : 0;
  const last = virtualOn ? Math.min(visible.length, Math.ceil((scrollInfo.top + viewH) / rowHeight) + overscan) : visible.length;
  const windowRows = virtualOn ? visible.slice(first, last) : visible;

  // Replay the row animation and scroll back to the top whenever the visible rows change
  const viewKey = `${safePage}|${pageSize}|${JSON.stringify(sort)}|${effectiveSearch}|${JSON.stringify(filters)}`;
  const firstView = useRef(true);
  useEffect(() => {
    if (firstView.current) {
      firstView.current = false;
      return;
    }
    const el = scrollRef.current;
    if (el && typeof el.scrollTo === "function" && el.scrollTop > 0) el.scrollTo({ top: 0, behavior: "smooth" });
  }, [viewKey]);

  // ==========================================================================================
  // Row animations: rows that stay are left alone, new rows add themselves, removed rows animate out
  // ==========================================================================================

  // Which animation each direction uses. `rowAnimation="zoom"` sets both; `{ enter, exit }` mixes.
  const enterAnim: RowAnimationName = (typeof rowAnimation === "string" ? rowAnimation : rowAnimation?.enter) ?? "slide-up";
  const exitAnim: RowAnimationName = (typeof rowAnimation === "string" ? rowAnimation : rowAnimation?.exit ?? rowAnimation?.enter) ?? "slide-up";
  const animOn = animateRows && !virtualize;
  // Leaving rows are only kept on screen when there is an exit animation to play
  const exitOn = animOn && (exitAnim !== "none" || !!rowExitAnimationClassName);
  const enterMs = rowAnimationDuration ?? 380;
  const staggerMs = rowAnimationStagger ?? 28;

  // Every row gets its stagger position (--rg-i) once, when it first appears, so later renders never
  // change the delay of an animation that is already running.
  const enterIndex = useRef(new Map<string | number, number>());
  let newRowCount = 0; // reset on every render: counts the rows that are new in this render
  const enterIndexOf = (id: string | number) => {
    let k = enterIndex.current.get(id);
    if (k === undefined) {
      k = newRowCount++;
      enterIndex.current.set(id, k);
    }
    return Math.min(k, 24);
  };

  const [ghosts, setGhosts] = useState<Ghost<T>[]>([]);
  // What was on screen after the previous commit: the rows, the order (rows and leaving rows), and which page it was
  const shown = useRef<{ rows: Entry<T>[]; order: (string | number)[]; pageKey: string }>({ rows: [], order: [], pageKey: "" });
  const ghostTimers = useRef(new Map<string | number, ReturnType<typeof setTimeout>>());
  const pageKey = `${safePage}|${pageSize}|${serverSide}`;

  /** Drops a leaving row once its animation is over. Rows that were anchored to it move up to its anchor. */
  const removeGhost = useCallback((id: string | number) => {
    const timer = ghostTimers.current.get(id);
    if (timer !== undefined) clearTimeout(timer);
    ghostTimers.current.delete(id);
    setGhosts((list) => {
      const gone = list.find((g) => g.id === id);
      if (!gone) return list;
      return list.filter((g) => g.id !== id).map((g) => (g.afterId === id ? { ...g, afterId: gone.afterId } : g));
    });
  }, []);

  // Runs before the browser paints, so a removed row never flashes away: it is swapped for its leaving copy at once
  useIsoLayoutEffect(() => {
    const prev = shown.current;
    const currentIds = new Set(visible.map((e) => e.id));

    // Forget the stagger positions of rows that are gone (they start fresh if they ever come back)
    enterIndex.current.forEach((_, id) => !currentIds.has(id) && enterIndex.current.delete(id));

    // Nothing to keep when animations are off, while loading, after an error, when the page changed (a
    // whole new set of rows replaces the old one), or for people who asked for less motion
    const skip = !exitOn || isLoading || failed || prev.pageKey !== pageKey || prefersReducedMotion();

    let next = ghosts;
    if (skip) {
      next = [];
    } else {
      // A row that came back before its exit finished is just a row again
      next = next.filter((g) => !currentIds.has(g.id));
      // Rows that were on screen and no longer are
      const removed = prev.rows.filter((e) => !currentIds.has(e.id) && !next.some((g) => g.id === e.id));
      if (removed.length > 0) {
        const added = removed.map((entry, batch) => {
          const at = prev.order.indexOf(entry.id);
          return { id: entry.id, entry, afterId: at > 0 ? prev.order[at - 1] : null, batch } as Ghost<T>;
        });
        next = [...next, ...added];
      }
    }
    if (next.length !== ghosts.length || next.some((g, i) => g !== ghosts[i])) setGhosts(next);

    shown.current = { rows: visible, order: interleave(visible, next).map((it) => (it.kind === "row" ? it.entry.id : it.ghost.id)), pageKey };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, ghosts, isLoading, failed, pageKey, exitOn]);

  // Every leaving row is removed when its animation ends. The timer is a safety net for custom classes
  // and for browsers that skip animations (display: none, hidden tabs ...).
  useEffect(() => {
    const custom = !!rowExitAnimationClassName;
    ghosts.forEach((g) => {
      if (ghostTimers.current.has(g.id)) return;
      const wait = custom ? 2500 : enterMs * 0.8 + staggerMs * Math.min(g.batch, 24) + 250;
      ghostTimers.current.set(g.id, setTimeout(() => removeGhost(g.id), wait));
    });
    // Timers of rows that were dropped for another reason
    ghostTimers.current.forEach((timer, id) => {
      if (!ghosts.some((g) => g.id === id)) {
        clearTimeout(timer);
        ghostTimers.current.delete(id);
      }
    });
  }, [ghosts, enterMs, staggerMs, rowExitAnimationClassName, removeGhost]);
  useEffect(
    () => () => {
      ghostTimers.current.forEach((timer) => clearTimeout(timer));
      ghostTimers.current.clear();
    },
    []
  );

  // What to draw: the live rows (or the window of them, when virtualizing) with the leaving rows between them
  const bodyItems = useMemo(() => interleave(windowRows, ghosts), [windowRows, ghosts]);

  // ==========================================================================================
  // Resizing and pinning
  // ==========================================================================================

  const resizing = Object.keys(widths).length > 0;
  const widthOf = (c: ColumnDef<T>) => widths[c.field] ?? (typeof c.width === "number" ? c.width : DEFAULT_COL_W);
  const minWidthOf = (c: ColumnDef<T>) => Math.max(40, typeof c.minWidth === "number" ? c.minWidth : 60);

  /** Drag the right edge of a header cell. Uses pointer capture so the drag survives leaving the handle. */
  const startResize = (e: ReactPointerEvent<HTMLElement>, c: ColumnDef<T>) => {
    e.preventDefault();
    e.stopPropagation();
    // On the first drag, fix every column at the width it has right now, so nothing jumps
    const snapshot: Record<string, number> = { ...widths };
    if (!resizing) cols.forEach((col) => (snapshot[col.field] = thEls.current.get(col.field)?.offsetWidth ?? widthOf(col)));
    const startX = e.clientX;
    const startW = snapshot[c.field] ?? widthOf(c);
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    setWidths(snapshot);

    const clamp = (w: number) => Math.min(c.maxWidth ?? Infinity, Math.max(minWidthOf(c), Math.round(w)));
    const onMove = (ev: PointerEvent) => setWidths((w) => ({ ...w, [c.field]: clamp(startW + ev.clientX - startX) }));
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  };

  // A pinned column sticks at an offset equal to the widths of the pinned columns before it.
  // Measure the real header cells after every render and only update state when something moved.
  useIsoLayoutEffect(() => {
    const next: Record<string, number> = {};
    let left = selectionMode && cols.some((c) => c.pinned === "left") ? SELECT_W : 0;
    for (const c of cols) {
      if (c.pinned !== "left") continue;
      next[c.field] = left;
      left += thEls.current.get(c.field)?.offsetWidth ?? 0;
    }
    let right = 0;
    for (const c of [...cols].reverse()) {
      if (c.pinned !== "right") continue;
      next[c.field] = right;
      right += thEls.current.get(c.field)?.offsetWidth ?? 0;
    }
    const keys = Object.keys(next);
    if (keys.length !== Object.keys(pinOffsets).length || keys.some((k) => next[k] !== pinOffsets[k])) setPinOffsets(next);
  });
  useEffect(() => {
    const onResize = () => setLayoutTick((t) => t + 1); // widths change with the window, so measure again
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  void layoutTick;

  const lastLeft = cols.map((c) => c.pinned).lastIndexOf("left");
  const firstRight = cols.findIndex((c) => c.pinned === "right");
  const hasLeftPinned = lastLeft >= 0;

  /** Classes and inline style that make a column sticky (nothing for unpinned columns). */
  const pinProps = (c: ColumnDef<T>, idx: number) => ({
    className: c.pinned
      ? cx("rg-grid__pinned", `rg-grid__pinned--${c.pinned}`, idx === lastLeft && "rg-grid__pinned--edge", idx === firstRight && "rg-grid__pinned--edge")
      : undefined,
    style: (c.pinned === "left" ? { left: pinOffsets[c.field] ?? 0 } : c.pinned === "right" ? { right: pinOffsets[c.field] ?? 0 } : undefined) as
      | CSSProperties
      | undefined,
  });

  // ==========================================================================================
  // Export and the imperative API
  // ==========================================================================================

  const exportDefaults: ExportOptions = typeof exportable === "object" ? exportable : {};
  /** Formats the toolbar button offers. Just CSV unless `exportable.formats` says more. */
  const exportFormats: ExportFormat[] = useMemo(() => {
    const list = exportDefaults.formats?.length ? exportDefaults.formats : (["csv"] as ExportFormat[]);
    return list.filter((f, i) => list.indexOf(f) === i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportable]);

  /**
   * Collects what an export contains: the rows of the chosen scope and, for each, the value in every column
   * in three forms: `display` (text, for CSV and PDF), `typed` (real numbers / booleans, for Excel) and
   * `records` (objects, for JSON).
   */
  const buildTable = (options: ExportOptions = {}) => {
    const opts: ExportOptions = { ...exportDefaults, ...options, pdf: { ...exportDefaults.pdf, ...options.pdf } };
    const scope = opts.scope ?? "filtered";
    const isPage = scope === "page" || scope === "visible";
    const source = isPage ? visible : scope === "selected" ? entries.filter((e) => selectedSet.has(e.id)) : processed;
    const exportCols = opts.includeHidden ? columns : cols;
    // A page export continues the page's row numbers (11, 12 ...) unless the column restarts on every page
    const pageOffset = isPage && pagination ? safePage * pageSize : 0;

    const headers = exportCols.map((c) => headerLabel(c) || c.field);
    const display: (string | number | boolean | null | undefined)[][] = [];
    const typed: XlsxValue[][] = [];
    const records: Record<string, unknown>[] = [];

    source.forEach(({ row }, n) => {
      const shown: (string | number | boolean | null | undefined)[] = [];
      const values: XlsxValue[] = [];
      const record: Record<string, unknown> = {};
      exportCols.forEach((c, k) => {
        const raw = getByPath(row, c.field);
        let text: string | number | boolean | null | undefined;
        let value: XlsxValue;
        if (c.type === "sequence") {
          // Row numbers: the position in the exported list
          const num = sequenceNumber(c, n, c.sequenceRestartEachPage ? 0 : pageOffset);
          text = num;
          value = num;
        } else if (c.exportValue) {
          text = c.exportValue(raw, row);
          value = text ?? null;
        } else if (c.type === "date") {
          text = toISODate(raw) ?? ""; // spreadsheets read ISO dates reliably
          value = text;
        } else {
          text = displayValue(c, row);
          // Keep real numbers, booleans and plain values where there is no formatter that changes the text
          if (c.type === "number" && typeof raw === "number" && Number.isFinite(raw)) value = raw;
          else if (c.type === "boolean" && typeof raw === "boolean") value = raw;
          else if (c.valueFormatter) value = text;
          else if (raw === null || raw === undefined) value = null;
          else if (typeof raw === "string" || typeof raw === "boolean" || (typeof raw === "number" && Number.isFinite(raw))) value = raw;
          else if (raw instanceof Date) value = Number.isNaN(raw.getTime()) ? null : raw.toISOString();
          else value = text;
        }
        shown.push(text);
        values.push(value);
        const key = opts.jsonKeys === "header" ? headers[k] : c.field;
        record[key] = c.type === "date" && value === "" ? null : value ?? null;
      });
      display.push(shown);
      typed.push(values);
      records.push(record);
    });
    return { opts, cols: exportCols, headers, display, typed, records };
  };

  const fileName = (opts: ExportOptions, extension: string) => `${opts.filename ?? "export"}.${extension}`;

  const buildCsv = (options: ExportOptions = {}) => {
    const t = buildTable(options);
    return toCsv(t.headers, t.display, { sanitize: t.opts.sanitize });
  };
  const runExport = (options: ExportOptions = {}) => {
    const opts = { ...exportDefaults, ...options };
    downloadCsv(buildCsv(options), fileName(opts, "csv"));
  };

  const buildJson = (options: ExportOptions = {}) => {
    const t = buildTable(options);
    return JSON.stringify(t.records, null, t.opts.jsonIndent ?? 2);
  };
  const runExportJson = (options: ExportOptions = {}) => {
    const opts = { ...exportDefaults, ...options };
    downloadBlob(new Blob([buildJson(options)], { type: "application/json;charset=utf-8" }), fileName(opts, "json"));
  };

  const buildXlsxFile = async (options: ExportOptions = {}) => {
    const t = buildTable(options);
    const xcols: XlsxColumn[] = t.cols.map((c) => ({
      header: headerLabel(c) || c.field,
      kind: c.type === "number" || c.type === "sequence" ? "number" : c.type === "date" ? "date" : c.type === "boolean" ? "boolean" : "text",
      align: c.align ?? (c.type === "number" || c.type === "sequence" ? "right" : undefined),
    }));
    return buildXlsx(xcols, t.typed, { sheetName: t.opts.sheetName });
  };
  const runExportXlsx = async (options: ExportOptions = {}) => {
    const opts = { ...exportDefaults, ...options };
    downloadBlob(await buildXlsxFile(options), fileName(opts, "xlsx"));
  };

  const buildPdfFile = async (options: ExportOptions = {}) => {
    const t = buildTable(options);
    // pdf.ts loads jsPDF only now, when someone really exports a PDF
    return buildPdf(
      {
        headers: t.headers,
        rows: t.display.map((r) => r.map((v) => (v === null || v === undefined ? "" : String(v)))),
        aligns: t.cols.map((c) => c.align ?? (c.type === "number" || c.type === "sequence" ? "right" : undefined)),
        fields: t.cols.map((c) => c.field),
      },
      t.opts.pdf,
      // Only when asked: read the grid's colours, stripes and borders from the page
      t.opts.pdf?.matchGridStyle ? readGridStyle(rootRef.current) : undefined
    );
  };
  const runExportPdf = async (options: ExportOptions = {}) => {
    const opts = { ...exportDefaults, ...options };
    downloadBlob(await buildPdfFile(options), fileName(opts, "pdf"));
  };

  /** Exports in any format. Rejects when the export fails (for example a PDF library is missing). */
  const exportAs = async (format: ExportFormat, options: ExportOptions = {}) => {
    if (format === "csv") return runExport(options);
    if (format === "json") return runExportJson(options);
    if (format === "xlsx") return runExportXlsx(options);
    return runExportPdf(options);
  };
  /** The toolbar's version: a failure goes to `onExportError` (or the console) instead of becoming an unhandled rejection. */
  const exportFromToolbar = async (format: ExportFormat, options: ExportOptions = {}) => {
    try {
      await exportAs(format, options);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (onExportError) onExportError(err, format);
      else console.error(`[react-gridix] ${format.toUpperCase()} export failed:`, err);
    }
  };

  // The export menu: which rows, and how many each choice would export
  const [menuScope, setMenuScope] = useState<MenuScope>("visible");
  const selectedCount = entries.filter((e) => selectedSet.has(e.id)).length;
  const scopeChoices: ExportScopeChoice[] = [
    { value: "visible", label: "Visible rows", count: visible.length },
    // Without pagination the visible rows already are every matching row
    ...(pagination ? [{ value: "filtered" as const, label: "All matching rows", count: processed.length }] : []),
    ...(selectionMode ? [{ value: "selected" as const, label: "Selected rows", count: selectedCount }] : []),
  ];
  // A choice that is gone (selection emptied, pagination switched off) falls back to the visible rows
  const activeScope: MenuScope = scopeChoices.some((c) => c.value === menuScope && c.count > 0) ? menuScope : "visible";

  // Expose methods through `apiRef`. Reassigned every render so they always see the latest state.
  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      getCsv: buildCsv,
      exportCsv: runExport,
      getJson: buildJson,
      exportJson: runExportJson,
      getXlsx: buildXlsxFile,
      exportXlsx: runExportXlsx,
      getPdf: buildPdfFile,
      exportPdf: runExportPdf,
      exportAs,
      getSelectedRows: () => idsToRows(selected),
      getSelectedRowIds: () => selected,
      selectAll: () => toggleAllRows(true),
      clearSelection: () => setSelected([]),
      refresh: () => {
        if (serverSide) runQuery(queryRef.current);
      },
    };
  });
  useEffect(
    () => () => {
      if (apiRef) apiRef.current = null;
    },
    [apiRef]
  );

  // ==========================================================================================
  // Rendering helpers
  // ==========================================================================================

  /** Variant, classes and styles of a column's checkboxes: grid-level settings first, then the column's. */
  const checkboxLook = (c: ColumnDef<T>) => {
    const opts = c.checkbox ?? {};
    return {
      variant: opts.variant ?? checkboxVariant,
      indicator: opts.indicator,
      className: opts.className,
      style: opts.style,
      classNames: {
        root: cx(classNames.checkbox, opts.classNames?.root),
        control: cx(classNames.checkboxControl, opts.classNames?.control),
        indicator: cx(classNames.checkboxIndicator, opts.classNames?.indicator),
        label: opts.classNames?.label,
      },
      styles: {
        root: { ...styles.checkbox, ...opts.styles?.root },
        control: { ...styles.checkboxControl, ...opts.styles?.control },
        indicator: { ...styles.checkboxIndicator, ...opts.styles?.indicator },
        label: opts.styles?.label,
      },
    };
  };

  // A click on a checkbox should not also count as a click or double-click on the row or header.
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  /** The checkbox in a `type: "boolean"` column. One click saves the new value. */
  const renderCheckbox = (c: ColumnDef<T>, params: CellParams<T>) => (
    <span className="rg-grid__checkbox-cell" onClick={stop} onDoubleClick={stop}>
      <Checkbox
        {...checkboxLook(c)}
        checked={Boolean(params.value)}
        disabled={!params.editable}
        aria-label={`Toggle ${nameOf(c)}`}
        onChange={(next) => params.updateValue(next)}
      />
    </span>
  );

  /** The rows a header checkbox acts on: rows matching the search and filters (all pages) whose cell is editable. */
  const headerTargets = (c: ColumnDef<T>) => processed.filter((e) => cellEditable(c, baseParams(c, e.row, e.index)));

  /** Sets the column to `value` in every target row, then fires onCellEdit per changed row and onRowsChange once. */
  const setAllInColumn = (c: ColumnDef<T>, value: boolean) => {
    const targets = new Map(headerTargets(c).map((e) => [e.index, e]));
    const changes: CellEditEvent<T>[] = [];
    const next = dataRef.current.map((row, i) => {
      const entry = targets.get(i);
      if (!entry) return row;
      const oldValue = getByPath(row, c.field);
      if (Boolean(oldValue) === value) return row;
      if (c.validate && !c.validate(value, row)) return row;
      const nextRow = setByPath(row, c.field, value);
      changes.push({ rowId: entry.id, rowIndex: i, field: c.field, oldValue, newValue: value, row: nextRow });
      return nextRow;
    });
    if (changes.length === 0) return;
    applyData(next);
    changes.forEach((ev) => onCellEdit?.(ev));
    onRowsChange?.(next);
  };

  /** The select-all checkbox shown in the header of a column with `headerCheckbox`. */
  const renderHeaderCheckbox = (c: ColumnDef<T>) => {
    const targets = headerTargets(c);
    // With no editable rows the box is disabled but still shows the real state of the matching rows.
    const base = targets.length > 0 ? targets : processed;
    const on = base.filter((e) => Boolean(getByPath(e.row, c.field))).length;
    const all = base.length > 0 && on === base.length;
    return (
      <span className="rg-grid__header-checkbox" onClick={stop} onDoubleClick={stop}>
        <Checkbox
          {...checkboxLook(c)}
          checked={all}
          indeterminate={on > 0 && !all}
          disabled={targets.length === 0}
          label={headerLabel(c) || undefined}
          aria-label={`Select all ${nameOf(c)}`}
          onChange={(next) => setAllInColumn(c, next)}
        />
      </span>
    );
  };

  const renderEditor = (entry: Entry<T>, c: ColumnDef<T>, ed: EditState) => {
    if (c.cellEditor) {
      return (
        <div
          className="rg-grid__custom-editor"
          onBlur={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
            if (ed.session !== sessionRef.current) return;
            if (!finishEdit(entry, c, { value: draftRef.current }, { focus: false })) stopEditing();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              stopEditing();
              focusCell(entry.id, c.field);
            }
          }}
        >
          {createElement(c.cellEditor, {
            value: ed.draft,
            row: entry.row,
            rowIndex: entry.index,
            field: c.field,
            column: c,
            onChange: (value: unknown) => {
              draftRef.current = value;
              setEditing((prev) => (prev && prev.session === ed.session ? { ...prev, draft: value, invalid: false } : prev));
            },
            onCommit: (value?: unknown, move: MoveDirection = "none") => {
              if (ed.session !== sessionRef.current) return;
              finishEdit(entry, c, { value: value === undefined ? draftRef.current : value }, { move });
            },
            onCancel: () => {
              stopEditing();
              focusCell(entry.id, c.field);
            },
          })}
        </div>
      );
    }

    // The built-in editor: a text box, or the browser's date picker for `type: "date"`
    const isDate = c.type === "date";

    // Dates: a text box with a calendar that drops down under it (see DateEditor)
    if (isDate) {
      return (
        <DateEditor
          value={ed.draft === null || ed.draft === undefined ? "" : String(ed.draft)}
          label={`Edit ${nameOf(c)}`}
          invalid={ed.invalid}
          min={c.dateMin}
          max={c.dateMax}
          locale={c.dateLocale}
          theme={theme}
          className={cx("rg-grid__editor", ed.invalid && "rg-grid__editor--invalid", classNames.editor)}
          style={{ textAlign: c.align, ...styles.editor }}
          onChange={(text) => setEditing((prev) => (prev ? { ...prev, draft: text, invalid: false } : prev))}
          // Clicking a day saves it right away (an empty string, from Clear, saves "no date")
          onPick={(iso) => {
            if (ed.session !== sessionRef.current) return;
            if (!finishEdit(entry, c, { text: iso }, { focus: true })) return;
          }}
          onBlur={(e) => {
            if (ed.session !== sessionRef.current) return;
            if (!finishEdit(entry, c, { text: e.currentTarget.value }, { focus: false })) stopEditing();
          }}
          onKeyDown={(e) => onTextEditorKeyDown(e, entry, c)}
        />
      );
    }

    return (
      <input
        autoFocus
        type={isDate ? "date" : "text"}
        min={isDate ? c.dateMin : undefined}
        max={isDate ? c.dateMax : undefined}
        className={cx("rg-grid__editor", ed.invalid && "rg-grid__editor--invalid", classNames.editor)}
        style={{ textAlign: c.align, ...styles.editor }}
        value={ed.draft === null || ed.draft === undefined ? "" : String(ed.draft)}
        inputMode={c.type === "number" ? "decimal" : undefined}
        aria-label={`Edit ${nameOf(c)}`}
        aria-invalid={ed.invalid || undefined}
        onChange={(e) => {
          const text = e.target.value;
          setEditing((prev) => (prev ? { ...prev, draft: text, invalid: false } : prev));
        }}
        onFocus={(e) => {
          const el = e.currentTarget;
          if (isDate) return; // date inputs have no text selection to set
          if (ed.select === "all") el.select();
          else el.setSelectionRange(el.value.length, el.value.length);
        }}
        onBlur={(e) => {
          if (ed.session !== sessionRef.current) return;
          // Clicking away from a half-typed date throws the edit away instead of clearing the date
          if (isBadDateInput(e.currentTarget)) return stopEditing();
          if (!finishEdit(entry, c, { text: e.currentTarget.value }, { focus: false })) stopEditing();
        }}
        onKeyDown={(e) => onTextEditorKeyDown(e, entry, c)}
      />
    );
  };

  // Options for "select" filters, built from the rows. Only computed for columns that need them.
  const optionsByField = useMemo(() => {
    const map = new Map<string, FilterOption[]>();
    for (const c of cols) {
      if (c.filterable && !c.filterRenderer && resolveFilterKind(c) === "select") {
        map.set(c.field, buildOptions(c, data, (r) => getByPath(r, c.field), (r) => displayValue(c, r)));
      }
    }
    return map;
  }, [cols, data]);

  // ==========================================================================================
  // Rendering: toolbar, pager, header, rows
  // ==========================================================================================

  // Animation timing from the props becomes CSS variables on the root (the CSS reads them)
  const animationVars = {
    ...(rowAnimationDuration !== undefined ? { "--rg-row-duration": `${rowAnimationDuration}ms`, "--rg-row-exit-duration": `${Math.round(rowAnimationDuration * 0.8)}ms` } : null),
    ...(rowAnimationStagger !== undefined ? { "--rg-row-stagger": `${rowAnimationStagger}ms` } : null),
  } as CSSProperties;

  const isStriped = striped || !!stripeColors;
  const stripeVars = (stripeColors ? { "--rg-stripe-a": stripeColors[0], "--rg-stripe-b": stripeColors[1] } : undefined) as CSSProperties | undefined;

  const showTopPager = showFooter && pagination && (paginationPosition === "top" || paginationPosition === "both");
  const showBottomPager = showFooter && pagination && (paginationPosition === "bottom" || paginationPosition === "both");
  // `showToolbar={false}` removes the whole toolbar row even when searchable, columnMenu, exportable or toolbar are used
  const showToolbar = allowToolbar && (searchable || !!toolbar || columnMenu || !!exportable);

  const renderPager = (position: "top" | "bottom") => (
    <div
      className={cx("rg-grid__footer", position === "top" && "rg-grid__footer--top", classNames.footer)}
      style={styles.footer}
      data-position={position}
    >
      <span {...slot("rowCount", "rg-grid__count")}>
        {total === 0 ? "0 rows" : `${rangeStart}–${rangeEnd} of ${total}`}
        {selectionMode && selected.length > 0 ? ` · ${selected.length} selected` : ""}
      </span>
      <div {...slot("pagination", "rg-grid__pagination")}>
        <label className="rg-grid__page-size-label">
          Rows per page
          <select value={pageSize} onChange={(e) => changePageSize(Number(e.target.value))} {...slot("pageSize", "rg-grid__page-size")}>
            {(pageSizeOptions.includes(pageSize) ? pageSizeOptions : [...pageSizeOptions, pageSize].sort((a, b) => a - b)).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button type="button" aria-label="First page" disabled={safePage === 0} onClick={() => setPage(0)} {...slot("pageButton", "rg-grid__page-btn")}>
          «
        </button>
        <button type="button" aria-label="Previous page" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} {...slot("pageButton", "rg-grid__page-btn")}>
          ‹
        </button>
        <span {...slot("pageInfo", "rg-grid__page-info")}>
          Page {safePage + 1} of {pageCount}
        </span>
        <button type="button" aria-label="Next page" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} {...slot("pageButton", "rg-grid__page-btn")}>
          ›
        </button>
        <button type="button" aria-label="Last page" disabled={safePage >= pageCount - 1} onClick={() => setPage(pageCount - 1)} {...slot("pageButton", "rg-grid__page-btn")}>
          »
        </button>
      </div>
    </div>
  );

  /**
   * The arrow in a sortable header. `"default"` is the text arrow (▲ ▼ ↕), `"arrow"` the smooth rotating SVG
   * arrow, and a component is drawn with `{ column, direction, priority }`. A column's own setting wins.
   */
  const renderSortIndicator = (c: ColumnDef<T>, direction: "asc" | "desc" | null, priority: number | undefined) => {
    const setting = c.sortIndicator ?? sortIndicator;
    const custom = setting !== "default";
    return (
      <span {...slot("sortIndicator", cx("rg-grid__sort", custom && "rg-grid__sort--custom"))} aria-hidden="true" data-direction={direction ?? "none"}>
        {setting === "arrow" ? (
          <SortArrow direction={direction} priority={priority} />
        ) : setting !== "default" ? (
          createElement(setting, { column: c, direction, priority })
        ) : (
          <>
            {direction === "asc" ? "▲" : direction === "desc" ? "▼" : "↕"}
            {/* With several sorted columns, show the priority of each */}
            {priority !== undefined && <sup className="rg-grid__sort-order">{priority}</sup>}
          </>
        )}
      </span>
    );
  };

  /** One placeholder row shown while loading. */
  const renderSkeletonRow = (i: number) => (
    <tr key={`sk${i}`} className="rg-grid__tr rg-grid__skeleton-row" aria-hidden="true" style={virtualize ? { height: rowHeight } : undefined}>
      {skeletonRow ? (
        // A custom component draws the whole row content inside one wide cell
        <td colSpan={colSpan} className="rg-grid__td rg-grid__skeleton-cell">
          {createElement(skeletonRow, { rowIndex: i, columns: cols })}
        </td>
      ) : (
        <>
          {selectionMode && (
            <td className="rg-grid__td">
              <span {...slot("skeleton", "rg-grid__skeleton")} style={{ ...styles.skeleton, width: 18 }} />
            </td>
          )}
          {cols.map((c, j) => (
            <td key={c.field} className="rg-grid__td" style={{ textAlign: c.align }}>
              {/* Vary the bar widths a little so the placeholder does not look like a grid of identical stripes */}
              <span {...slot("skeleton", "rg-grid__skeleton")} style={{ ...styles.skeleton, width: `${55 + ((i * 7 + j * 13) % 35)}%` }} />
            </td>
          ))}
        </>
      )}
    </tr>
  );

  /**
   * The number shown in a `type: "sequence"` column for the row at position `i` of the rows on screen.
   * It counts from `sequenceStart` (default 1) in the filtered, sorted list, so it starts again at 1 after
   * a search or filter. Later pages continue the count unless `sequenceRestartEachPage` is set.
   */
  const sequenceNumber = (c: ColumnDef<T>, i: number, rowsBefore = pagination && !c.sequenceRestartEachPage ? safePage * pageSize : 0) =>
    (c.sequenceStart ?? 1) + rowsBefore + i;

  /**
   * One data row: the selection cell, then a cell per visible column. `i` is the position in `visible`.
   * With `ghost` it is a row that is on its way out: it plays its exit animation and cannot be used.
   */
  const renderRow = (entry: Entry<T>, i: number, ghost?: Ghost<T>) => {
    const { row, id, index } = entry;
    const leaving = !!ghost;
    const extraClass = typeof rowClassName === "function" ? rowClassName(row, index) : rowClassName;
    const extraStyle = typeof rowStyle === "function" ? rowStyle(row, index) : rowStyle;
    const isSelected = selectedSet.has(id);
    const animationClass = typeof rowAnimationClassName === "function" ? rowAnimationClassName(row, index) : rowAnimationClassName;
    const exitClass = typeof rowExitAnimationClassName === "function" ? rowExitAnimationClassName(row, index) : rowExitAnimationClassName;
    // Built-in animations: a base class (timing, delay) plus one class per animation name. A custom class replaces them.
    const enterClasses = animationClass || (enterAnim === "none" ? undefined : cx("rg-grid__row--enter", `rg-row-in--${enterAnim}`));
    const exitClasses = exitClass || cx("rg-grid__row--exit", exitAnim !== "none" && `rg-row-out--${exitAnim}`);
    return (
      <tr
        key={leaving ? `ghost:${id}` : id}
        onClick={onRowClick && !leaving ? () => onRowClick(row, index) : undefined}
        // A leaving row is only a picture: hidden from assistive technology, no clicks (CSS), and its animation end removes it
        aria-hidden={leaving || undefined}
        onAnimationEnd={ghost ? (e) => e.target === e.currentTarget && removeGhost(ghost.id) : undefined}
        aria-selected={selectionMode ? isSelected : undefined}
        className={cx(
          "rg-grid__tr",
          "rg-grid__row",
          isStriped && (i % 2 === 0 ? "rg-grid__row--stripe-a" : "rg-grid__row--stripe-b"),
          // Rows are not animated while virtualizing. New rows play the enter class once, when they are created.
          animOn && !leaving && enterClasses,
          leaving && exitClasses,
          isSelected && "rg-grid__row--selected",
          onRowClick && "rg-grid__row--clickable",
          classNames.row,
          extraClass
        )}
        style={{
          ...(animOn ? ({ "--rg-i": ghost ? Math.min(ghost.batch, 24) : enterIndexOf(id) } as CSSProperties) : null),
          ...(virtualize ? { height: rowHeight } : null),
          ...styles.row,
          ...extraStyle,
        }}
      >
        {selectionMode && (
          <td
            className={cx("rg-grid__td rg-grid__select-cell", hasLeftPinned && "rg-grid__pinned rg-grid__pinned--left")}
            style={{ width: SELECT_W, minWidth: SELECT_W, maxWidth: SELECT_W, ...(hasLeftPinned ? { left: 0 } : null) }}
            onClick={stop}
          >
            {/* Remember whether Shift was down, because Checkbox.onChange does not pass the click event */}
            <span className="rg-grid__checkbox-cell" onClickCapture={(e) => (shiftHeld.current = e.shiftKey)}>
              <Checkbox
                variant={checkboxVariant}
                checked={isSelected}
                disabled={leaving || !canSelect(row)}
                aria-label={selectionMode === "single" ? "Select row" : `Select row ${index + 1}`}
                onChange={(on) => toggleRow(entry, on)}
                classNames={{ root: classNames.checkbox, control: classNames.checkboxControl, indicator: classNames.checkboxIndicator }}
                styles={{ root: styles.checkbox, control: styles.checkboxControl, indicator: styles.checkboxIndicator }}
              />
            </span>
          </td>
        )}
        {cols.map((c, idx) => {
          let params = paramsFor(c, entry);
          if (c.type === "sequence") {
            // The number is the row's position in the current list (after search, filters and sorting)
            const n = sequenceNumber(c, i);
            params = { ...params, value: n, formattedValue: c.valueFormatter ? c.valueFormatter(n, row) : String(n), editable: false };
          }
          const cellClass = typeof c.cellClassName === "function" ? c.cellClassName(params) : c.cellClassName;
          const cellStyle = typeof c.cellStyle === "function" ? c.cellStyle(params) : c.cellStyle;
          const isEditing = editing !== null && editing.id === id && editing.field === c.field;
          const canEdit = isTextEditable(c, params);
          const pin = pinProps(c, idx);
          // With keyboard navigation exactly one cell is in the tab order (the "active" one)
          const isTabStop = activeCell ? activeCell.id === id && activeCell.field === c.field : i === 0 && idx === 0;
          return (
            <td
              key={c.field}
              // A leaving row is not registered, focusable or editable
              ref={
                leaving
                  ? undefined
                  : (el) => {
                      const k = cellKey(id, c.field);
                      if (el) cellEls.current.set(k, el);
                      else cellEls.current.delete(k);
                    }
              }
              tabIndex={leaving ? undefined : keyboardNavigation ? (isTabStop ? 0 : -1) : canEdit ? 0 : undefined}
              onFocus={keyboardNavigation && !leaving ? (e) => e.target === e.currentTarget && setActiveCell({ id, field: c.field }) : undefined}
              onDoubleClick={canEdit && !leaving ? () => startEdit(entry, c) : undefined}
              onKeyDown={leaving ? undefined : (e) => onCellKeyDown(e, entry, c, params)}
              className={cx(
                "rg-grid__td",
                canEdit && "rg-grid__td--editable",
                isEditing && "rg-grid__td--editing",
                pin.className,
                classNames.cell,
                c.className,
                cellClass
              )}
              style={{ textAlign: c.align, ...styles.cell, ...c.style, ...cellStyle, ...pin.style }}
            >
              {isEditing && editing && !leaving
                ? renderEditor(entry, c, editing)
                : c.cellRenderer
                  ? createElement(c.cellRenderer, params)
                  : c.type === "boolean" && !c.cellEditor
                    ? renderCheckbox(c, params)
                    : params.formattedValue}
            </td>
          );
        })}
      </tr>
    );
  };

  // Why the table is empty: nothing was given, or the search / filters hide everything
  const emptyReason: EmptyReason = effectiveSearch.trim() !== "" || activeFilters.length > 0 ? "no-results" : "no-data";

  const skeletonCount = loadingRows ?? (pagination ? Math.min(pageSize, 20) : 5);

  return (
    <div
      ref={rootRef}
      className={cx("rg-grid", virtualize && "rg-grid--virtual", classNames.root, className)}
      style={{ ...stripeVars, ...animationVars, ...styles.root, ...style }}
      data-rg-theme={theme || undefined}
      aria-busy={isLoading || undefined}
    >
      {showToolbar && (
        <div {...slot("toolbar", "rg-grid__toolbar")}>
          <div className="rg-grid__toolbar-left">
            {searchable && (
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label="Search all columns"
                {...slot("search", "rg-grid__search")}
              />
            )}
            {selectionMode && selected.length > 0 && (
              <span className="rg-grid__selected-count" role="status">
                {selected.length} selected
              </span>
            )}
          </div>
          <div className="rg-grid__toolbar-actions">
            {toolbar}
            {columnMenu && (
              <ColumnMenu
                columns={columns}
                hidden={hidden}
                onToggle={toggleColumn}
                theme={theme}
                className={classNames.toolButton}
                style={styles.toolButton}
              />
            )}
            {exportable &&
              (exportFormats.length > 1 ? (
                // Several formats: a menu with "which rows" and one button per format
                <ExportMenu
                  formats={exportFormats}
                  scopes={scopeChoices}
                  scope={activeScope}
                  onScopeChange={setMenuScope}
                  onExport={(format, scope) => exportFromToolbar(format, { scope })}
                  theme={theme}
                  className={cx(classNames.toolButton, classNames.exportMenu)}
                  style={{ ...styles.toolButton, ...styles.exportMenu }}
                />
              ) : (
                // One format: a plain button ("Export CSV"), using the scope from `exportable` (default: all matching rows)
                <button type="button" onClick={() => exportFromToolbar(exportFormats[0])} {...slot("toolButton", "rg-grid__tool-btn")}>
                  {exportButtonLabel(exportFormats[0])}
                </button>
              ))}
          </div>
        </div>
      )}

      {showTopPager && renderPager("top")}

      <div
        ref={scrollRef}
        {...slot("scroll", "rg-grid__scroll")}
        onScroll={virtualize ? (e) => setScrollInfo({ top: e.currentTarget.scrollTop, height: e.currentTarget.clientHeight }) : undefined}
        style={{ ...styles.scroll, ...(maxHeight !== undefined ? { maxHeight } : virtualize ? { maxHeight: 400 } : null) }}
      >
        <table
          {...slot("table", "rg-grid__table")}
          role="grid"
          style={
            resizing
              ? {
                  ...styles.table,
                  tableLayout: "fixed",
                  width: cols.reduce((sum, c) => sum + widthOf(c), selectionMode ? SELECT_W : 0),
                  minWidth: "100%",
                }
              : styles.table
          }
        >
          <thead {...slot("thead", "rg-grid__thead")}>
            <tr {...slot("headerRow", "rg-grid__tr")}>
              {selectionMode && (
                <th
                  scope="col"
                  className={cx("rg-grid__th rg-grid__select-cell", hasLeftPinned && "rg-grid__pinned rg-grid__pinned--left", classNames.headerCell)}
                  style={{ width: SELECT_W, minWidth: SELECT_W, maxWidth: SELECT_W, ...(hasLeftPinned ? { left: 0 } : null), ...styles.headerCell }}
                >
                  {selectionMode === "multiple" && (
                    <span className="rg-grid__checkbox-cell">
                      <Checkbox
                        variant={checkboxVariant}
                        checked={allSelected}
                        indeterminate={selectedInView > 0 && !allSelected}
                        disabled={selectable.length === 0}
                        aria-label="Select all rows"
                        onChange={toggleAllRows}
                        classNames={{ root: classNames.checkbox, control: classNames.checkboxControl, indicator: classNames.checkboxIndicator }}
                        styles={{ root: styles.checkbox, control: styles.checkboxControl, indicator: styles.checkboxIndicator }}
                      />
                    </span>
                  )}
                </th>
              )}
              {cols.map((c, idx) => {
                const sortPos = sort.findIndex((s) => s.field === c.field);
                const sorted = sortPos >= 0 ? sort[sortPos].direction : null;
                const canSort = isSortable(c);
                const kind = filterKind(c);
                const pin = pinProps(c, idx);
                return (
                  <th
                    key={c.field}
                    ref={(el) => {
                      if (el) thEls.current.set(c.field, el);
                      else thEls.current.delete(c.field);
                    }}
                    scope="col"
                    aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : canSort ? "none" : undefined}
                    tabIndex={canSort ? 0 : undefined}
                    onClick={(e) => toggleSort(c, e.shiftKey)}
                    onKeyDown={(e) => {
                      if (canSort && e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        toggleSort(c, e.shiftKey);
                      }
                    }}
                    className={cx("rg-grid__th", canSort && "rg-grid__th--sortable", pin.className, classNames.headerCell, c.className, c.headerClassName)}
                    style={{
                      width: resizing ? widthOf(c) : c.width,
                      minWidth: c.minWidth,
                      textAlign: c.align,
                      ...styles.headerCell,
                      ...c.style,
                      ...c.headerStyle,
                      ...pin.style,
                    }}
                  >
                    <span className="rg-grid__th-content">
                      {c.headerRenderer
                        ? createElement(c.headerRenderer, { column: c, sortDirection: sorted })
                        : c.headerCheckbox && c.type === "boolean"
                          ? renderHeaderCheckbox(c)
                          : headerLabel(c)}
                      {c.filterable && (
                        <ColumnFilter
                          column={c}
                          label={nameOf(c)}
                          kind={kind}
                          value={filters[c.field]}
                          onChange={(value) => {
                            const next = { ...filters };
                            if (value === undefined) delete next[c.field];
                            else next[c.field] = value;
                            setFilters(next);
                          }}
                          options={optionsByField.get(c.field) ?? []}
                          debounce={c.filterDebounce ?? filterDebounce}
                          theme={theme}
                          indicatorClassName={cx(classNames.filterIndicator, c.filterIndicatorClassName)}
                          indicatorStyle={{ ...styles.filterIndicator, ...c.filterIndicatorStyle }}
                          popupClassName={cx(classNames.filterPopup, c.filterPopupClassName)}
                          popupStyle={{ ...styles.filterPopup, ...c.filterPopupStyle }}
                          inputClassName={classNames.filterInput}
                          inputStyle={styles.filterInput}
                        />
                      )}
                      {canSort && renderSortIndicator(c, sorted, sorted && sort.length > 1 ? sortPos + 1 : undefined)}
                    </span>
                    {c.resizable && (
                      <span
                        className="rg-grid__resizer"
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Resize ${nameOf(c)}`}
                        onPointerDown={(e) => startResize(e, c)}
                        onClick={stop}
                        onDoubleClick={stop}
                      />
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody {...slot("tbody", "rg-grid__tbody")}>
            {isLoading ? (
              Array.from({ length: skeletonCount }, (_, i) => renderSkeletonRow(i))
            ) : failed ? (
              <tr>
                <td colSpan={colSpan} {...slot("empty", "rg-grid__empty rg-grid__error")} role="alert">
                  {errorMessage}{" "}
                  <button type="button" className="rg-grid__tool-btn" onClick={() => runQuery(queryRef.current)}>
                    Retry
                  </button>
                </td>
              </tr>
            ) : visible.length === 0 && ghosts.length === 0 ? (
              <tr>
                <td colSpan={colSpan} {...slot("empty", cx("rg-grid__empty", emptyComponent && "rg-grid__empty--custom"))}>
                  {emptyComponent
                    ? createElement(emptyComponent, {
                        reason: emptyReason,
                        search: effectiveSearch.trim(),
                        filters: Object.fromEntries(activeFilters) as Record<string, FilterValue>,
                        columns: cols,
                        clearAll: () => {
                          setSearch("");
                          setFilters({});
                        },
                      })
                    : emptyMessage}
                </td>
              </tr>
            ) : (
              <>
                {/* Virtualization: an empty spacer row stands in for every row above and below the window */}
                {virtualOn && first > 0 && (
                  <tr aria-hidden="true" className="rg-grid__spacer">
                    <td colSpan={colSpan} style={{ height: first * rowHeight }} />
                  </tr>
                )}
                {bodyItems.map((item) => (item.kind === "row" ? renderRow(item.entry, first + item.i) : renderRow(item.ghost.entry, 0, item.ghost)))}
                {virtualOn && last < visible.length && (
                  <tr aria-hidden="true" className="rg-grid__spacer">
                    <td colSpan={colSpan} style={{ height: (visible.length - last) * rowHeight }} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {showBottomPager && renderPager("bottom")}
    </div>
  );
}
