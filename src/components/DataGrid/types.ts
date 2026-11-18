import type { ComponentType, CSSProperties, MutableRefObject, ReactNode } from "react";
import type { CheckboxSlot, CheckboxVariant } from "../Checkbox/Checkbox";
import type { FieldPath } from "./paths";

/* -------------------------------------------------------------------------- */
/* Small shared types                                                         */
/* -------------------------------------------------------------------------- */

export type SortDirection = "asc" | "desc";

/** One sorted column. The grid keeps a list of these (more than one only with `multiSort`). */
export interface SortModel {
  field: string;
  direction: SortDirection;
}

export type MoveDirection = "down" | "up" | "left" | "right" | "none";

export type PaginationPosition = "bottom" | "top" | "both";

/**
 * Built-in themes. A theme only applies when you pass its name to `<DataGrid theme="..." />`.
 * Any other string works too if you define `[data-rg-theme="name"]` CSS variables yourself.
 */
export type GridTheme =
  | "ocean"
  | "midnight"
  | "sunset"
  | "forest"
  | "lavender"
  | "coffee"
  | "graphite"
  | "aurora";

/* -------------------------------------------------------------------------- */
/* Filters                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Which kind of filter a column gets in its popup.
 * - `"text"`   : "contains" match on the displayed text (default for text columns)
 * - `"exact"`  : the displayed text must equal what was typed (ignoring case)
 * - `"number"` : a min / max range (default for `type: "number"` columns)
 * - `"date"`   : a from / to range (default for `type: "date"` columns)
 * - `"select"` : pick one or more values from a list (default for `type: "boolean"` columns)
 */
export type FilterType = "text" | "exact" | "number" | "date" | "select";

/** Value of a `"number"` filter. Either bound may be missing. */
export interface NumberRangeFilter {
  min?: number;
  max?: number;
}

/** Value of a `"date"` filter: ISO days (`"2026-11-05"`), both ends included. */
export interface DateRangeFilter {
  from?: string;
  to?: string;
}

/**
 * How a text filter compares the typed text with the cell's displayed text (ignoring case):
 * - `"contains"` / `"notContains"`         : the text appears anywhere in the cell (or does not)
 * - `"equals"` / `"notEquals"`             : the whole cell is the text (or is not)
 * - `"startsWith"` / `"notStartsWith"`     : the cell begins with the text (or does not)
 * - `"endsWith"` / `"notEndsWith"`         : the cell ends with the text (or does not)
 */
export type TextFilterOperator =
  | "contains"
  | "notContains"
  | "equals"
  | "notEquals"
  | "startsWith"
  | "notStartsWith"
  | "endsWith"
  | "notEndsWith";

/**
 * Value of a text filter whose column has `filterOperators` switched on: the chosen comparison plus the
 * typed text. (Without `filterOperators` a text filter is just the string.)
 */
export interface TextFilter {
  operator: TextFilterOperator;
  value: string;
}

/** What a column's filter currently holds. The shape depends on the column's `FilterType`. */
export type FilterValue = string | TextFilter | NumberRangeFilter | DateRangeFilter | string[];

/** An entry in a `"select"` filter's list. A plain string is shorthand for `{ value }`. */
export interface FilterOption {
  value: string;
  /** Text shown in the list. Defaults to `value`. */
  label?: string;
}

/* -------------------------------------------------------------------------- */
/* Params and props for custom column components                              */
/* -------------------------------------------------------------------------- */

export interface CellEditableParams<T = Record<string, any>> {
  /** The raw value stored in the row (read from nested objects for `"a.b"` fields). */
  value: unknown;
  /** The value as text, after `valueFormatter`. */
  formattedValue: string;
  row: T;
  rowIndex: number;
  field: string;
  column: ColumnDef<T>;
}

export interface CellParams<T = Record<string, any>> extends CellEditableParams<T> {
  /** Whether this cell may be changed (the column's `editable` setting, or the grid's). */
  editable: boolean;
  /**
   * Saves a new value for this cell straight away, without opening the editor. It runs `validate`
   * and fires `onCellEdit` / `onRowsChange` like any edit. Returns false if the value was rejected
   * or the cell is not editable.
   */
  updateValue: (value: unknown) => boolean;
}

/** Props received by a column's `cellEditor` component. */
export interface CellEditorProps<T = Record<string, any>> {
  /** The current draft value (starts as the cell's raw value). */
  value: unknown;
  row: T;
  rowIndex: number;
  field: string;
  column: ColumnDef<T>;
  /** Update the draft value without saving it. */
  onChange: (value: unknown) => void;
  /**
   * Save and close the editor. Pass the value to save, or call with no value to save the
   * current draft. `move` also starts editing the neighbouring cell ("down" and so on).
   */
  onCommit: (value?: unknown, move?: MoveDirection) => void;
  /** Close the editor without saving. */
  onCancel: () => void;
}

/** Props received by a column's `headerRenderer` component. */
export interface HeaderRendererProps<T = Record<string, any>> {
  column: ColumnDef<T>;
  /** Direction this column is sorted in, or null when it is not sorted. */
  sortDirection: SortDirection | null;
}

/**
 * Props received by a column's `filterRenderer` component (shown inside the filter popup).
 * A column with a `filterRenderer` always filters with a text "contains" match.
 */
export interface FilterRendererProps<T = Record<string, any>> {
  column: ColumnDef<T>;
  value: string;
  onChange: (value: string) => void;
}

/** Props received by a column's `filterIndicator` component. */
export interface FilterIndicatorProps<T = Record<string, any>> {
  column: ColumnDef<T>;
  /** True while a filter is set for this column. */
  active: boolean;
  /** True while the filter popup is open. */
  open: boolean;
}

/** Props received by a `sortIndicator` component: the little arrow next to a sortable header's name. */
export interface SortIndicatorProps<T = Record<string, any>> {
  column: ColumnDef<T>;
  /** Direction this column is sorted in, or null when it is not sorted. */
  direction: SortDirection | null;
  /** Position of this column in a multi-column sort (1, 2, ...), or undefined when only one column is sorted. */
  priority?: number;
}

/** Why the grid has no rows to show. */
export type EmptyReason = "no-data" | "no-results";

/** Props received by the `emptyComponent`, drawn in place of the "No rows to show" message. */
export interface EmptyStateProps<T = Record<string, any>> {
  /**
   * `"no-data"`: the grid was given no rows at all.
   * `"no-results"`: there are rows, but the search or the filters hide all of them.
   */
  reason: EmptyReason;
  /** The global search text (empty when none). */
  search: string;
  /** The filters that are active right now, by field. */
  filters: Record<string, FilterValue>;
  /** The columns that are visible. */
  columns: ColumnDef<T>[];
  /** Clears the search box and every filter, which brings the rows back. */
  clearAll: () => void;
}

/** Props received by the `skeletonRow` component, which draws one placeholder row while loading. */
export interface SkeletonRowProps<T = Record<string, any>> {
  /** Position of this placeholder row (0, 1, 2 ...). */
  rowIndex: number;
  /** The columns that are currently visible. */
  columns: ColumnDef<T>[];
}

/** Props received by a column's `skeleton` component, which draws the placeholder of ONE cell while loading. */
export interface SkeletonCellProps<T = Record<string, any>> {
  /** Position of this placeholder row (0, 1, 2 ...). */
  rowIndex: number;
  /** The column this placeholder belongs to. */
  column: ColumnDef<T>;
}

/** Options for the checkbox drawn in a `type: "boolean"` column. */
export interface ColumnCheckboxOptions {
  /** Overrides the grid's `checkboxVariant` for this column. */
  variant?: CheckboxVariant;
  /** A custom character (or any node) drawn inside the box when checked, for example `"✕"` or `"★"`. */
  indicator?: ReactNode;
  className?: string;
  style?: CSSProperties;
  classNames?: Partial<Record<CheckboxSlot, string>>;
  styles?: Partial<Record<CheckboxSlot, CSSProperties>>;
}

/* -------------------------------------------------------------------------- */
/* Column definition                                                          */
/* -------------------------------------------------------------------------- */

/** What can be given as a `sortIndicator`: a built-in name or your own component. */
export type SortIndicatorSetting<T = Record<string, any>> = "default" | "arrow" | ComponentType<SortIndicatorProps<T>>;

/** The field of a `type: "sequence"` column. It holds no data, so it can be any name that starts with `#`. */
export type SequenceField = `#${string}`;

export interface ColumnDef<T = Record<string, any>> {
  /**
   * Key of the row object this column reads and writes. Use dot notation for nested objects:
   * `"contact.phone"`. Edits to a nested field copy the objects on the way and never change your data in place.
   */
  field: (FieldPath<T> & string) | SequenceField;
  /**
   * Text shown in the header. Defaults to the field name, except for `type: "boolean"` columns,
   * which default to an empty string.
   */
  headerName?: string;
  /**
   * - `"number"`  : sorts numerically, edits parse as numbers, filters with a min / max range.
   * - `"boolean"` : shows a checkbox that toggles with one click (see `checkbox`).
   * - `"date"`    : shows a formatted date, edits with a date picker, sorts by day, filters with a from / to range.
   *   Values can be ISO strings (`"2026-11-05"`), `Date` objects or timestamps. A date is saved in the same
   *   kind the cell already had (a `Date` stays a `Date`, a string stays an ISO string).
   */
  type?: "text" | "number" | "boolean" | "date" | "sequence";
  /**
   * Only for `type: "sequence"`: the number of the first row. Default 1.
   * A sequence column shows row numbers that are counted again after every search, filter or sort, and it
   * needs no data. Give it any `field` that starts with `#`, for example `{ field: "#", type: "sequence" }`.
   */
  sequenceStart?: number;
  /** Only for `type: "sequence"`: start again at `sequenceStart` on every page. Default false (the count continues: 11, 12, ...). */
  sequenceRestartEachPage?: boolean;
  /** Column width: a number (pixels) or any CSS length such as "20%" or "12rem". Columns without one share the remaining space. */
  width?: number | string;
  /**
   * The placeholder drawn in this column's cells while the grid is loading. It replaces the default bar
   * and the grid's `skeletonRow` for this column. Columns without one keep the default bar.
   * (If any column has a `skeleton`, the grid's whole-row `skeletonRow` is not used.)
   */
  skeleton?: ComponentType<SkeletonCellProps<T>>;
  /**
   * What happens to text that does not fit the column (header and cells):
   * "wrap" breaks it onto new lines (even in the middle of a word), "ellipsis" cuts it and shows "...",
   * "clip" just cuts it. Default: "wrap" for a column that has a `width` ("clip" when the width is under 40), otherwise the grid's normal behaviour.
   */
  overflow?: "wrap" | "ellipsis" | "clip";
  minWidth?: number | string;
  /** Largest width in pixels (also limits dragging the column wider). */
  maxWidth?: number;
  align?: "left" | "center" | "right";

  /** Click the header to sort by this column. Default false: sorting is opt-in, column by column. */
  sortable?: boolean;

  /** Let the user drag the right edge of the header to change the column's width. Default false. */
  resizable?: boolean;
  /** Keep this column stuck to the left or right edge while the grid scrolls sideways. Pinned columns move to that edge. */
  pinned?: "left" | "right";
  /** Start with this column hidden. Needs `columnMenu` on the grid if users should be able to show it again. */
  hidden?: boolean;
  /** Set to false to keep this column out of the column menu (it can then never be hidden by the user). */
  hideable?: boolean;

  /** Show a filter indicator in this column's header. Default false. Clicking it opens the filter popup. */
  filterable?: boolean;
  /** Which filter this column gets. Defaults from `type`, see {@link FilterType}. */
  filterType?: FilterType;
  /** Choices for a `"select"` filter. When missing they are taken from the values in the loaded rows. */
  filterOptions?: (string | FilterOption)[];
  /** Placeholder of the default filter text box. */
  filterPlaceholder?: string;
  /**
   * Milliseconds to wait after the user stops typing in this column's filter before the filter is
   * applied (and, in server-side mode, before `onQueryChange` is called). Applies to the text, exact
   * and number boxes. Checkboxes (select) and date pickers apply at once.
   * Overrides the grid's `filterDebounce`. Use 0 to apply on every keystroke.
   */
  filterDebounce?: number;
  /**
   * Adds a drop-down at the top of this column's filter popup for choosing how the text is compared:
   * contains, does not contain, equals, not equal, starts with, does not start with, ends with, does not
   * end with. Default false: the column then simply filters with "contains" and shows no drop-down.
   * Pass `true` for all eight, or a list to offer only some, for example `["contains", "equals", "startsWith"]`.
   * Applies to text columns (`filterType` `"text"` or `"exact"`); it has no effect on number, date or select filters.
   */
  filterOperators?: boolean | TextFilterOperator[];
  /** The comparison that is selected first when `filterOperators` is on. Default `"contains"` (`"equals"` for `filterType: "exact"`). */
  filterOperator?: TextFilterOperator;
  /** A React component drawn instead of the default dot. Receives `{ column, active, open }`. */
  filterIndicator?: ComponentType<FilterIndicatorProps<T>>;
  /** Classes for this column's filter indicator button (Tailwind works). */
  filterIndicatorClassName?: string;
  /** Inline styles for this column's filter indicator button. */
  filterIndicatorStyle?: CSSProperties;
  /** Classes for this column's filter popup. */
  filterPopupClassName?: string;
  /** Inline styles for this column's filter popup. */
  filterPopupStyle?: CSSProperties;
  /** A React component that replaces the filter controls inside the popup (text matching only). */
  filterRenderer?: ComponentType<FilterRendererProps<T>>;

  /**
   * `true` / `false`, or a function that decides per cell. Overrides the grid-level `editable`.
   * Example: `editable: ({ row }) => row.status !== "locked"`.
   */
  editable?: boolean | ((params: CellEditableParams<T>) => boolean);
  /** Text used for display, global search and filtering. */
  valueFormatter?: (value: any, row: T) => string;
  /** Turns the typed text into the stored value. */
  valueParser?: (text: string, row: T) => unknown;
  /** Return false to reject an edit. The editor stays open and is marked invalid. */
  validate?: (value: unknown, row: T) => boolean;
  /** Custom sort. Return a negative, zero or positive number. */
  comparator?: (a: any, b: any, rowA: T, rowB: T) => number;

  /** `type: "date"`: how the date is shown, as `Intl.DateTimeFormat` options. Default `{ year: "numeric", month: "short", day: "numeric" }`. */
  dateFormat?: Intl.DateTimeFormatOptions;
  /** `type: "date"`: locale for the displayed date, for example `"en-GB"`. Default is the browser's. */
  dateLocale?: string;
  /** `type: "date"`: earliest day the date picker accepts, as `"YYYY-MM-DD"`. */
  dateMin?: string;
  /** `type: "date"`: latest day the date picker accepts, as `"YYYY-MM-DD"`. */
  dateMax?: string;

  /** What goes into the CSV export for this column. Defaults to the displayed text (dates as `YYYY-MM-DD`). */
  exportValue?: (value: any, row: T) => string | number | boolean | null | undefined;

  /** A React component that renders the cell content. Define it outside render so it keeps its identity. */
  cellRenderer?: ComponentType<CellParams<T>>;
  /** A React component used instead of the default editor when editing this column. */
  cellEditor?: ComponentType<CellEditorProps<T>>;
  /** A React component that renders the header label (the filter indicator and sort arrow are still added). */
  headerRenderer?: ComponentType<HeaderRendererProps<T>>;
  /** The sort indicator of this column. Overrides the grid's `sortIndicator`. See {@link DataGridProps.sortIndicator}. */
  sortIndicator?: SortIndicatorSetting<T>;

  /** Classes for the whole column: its header cell and every body cell. Tailwind works. */
  className?: string;
  /** Inline styles for the whole column: its header cell and every body cell. */
  style?: CSSProperties;
  headerClassName?: string;
  headerStyle?: CSSProperties;
  cellClassName?: string | ((params: CellParams<T>) => string);
  cellStyle?: CSSProperties | ((params: CellParams<T>) => CSSProperties);

  /** Look of the checkbox in a `type: "boolean"` column. */
  checkbox?: ColumnCheckboxOptions;
  /**
   * For `type: "boolean"` columns: draws a checkbox in the header, with the header name as its
   * label (no label when the name is empty). Clicking it checks every row that matches the current
   * search and filters (all pages), or unchecks them all when they are already checked. It shows a
   * mixed state when only some are checked. Ignored when the column has a `headerRenderer`.
   */
  headerCheckbox?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Events, selection, queries and the imperative API                          */
/* -------------------------------------------------------------------------- */

export interface CellEditEvent<T> {
  rowId: string | number;
  rowIndex: number;
  /** The column's field, for example `"contact.phone"`. */
  field: string;
  oldValue: unknown;
  newValue: unknown;
  /** The updated row. */
  row: T;
}

/** The selected rows. `rows` only holds rows that are loaded in the grid right now (matters with `serverSide`). */
export interface RowSelection<T> {
  ids: (string | number)[];
  rows: T[];
}

/**
 * Everything the grid wants from your server in `serverSide` mode. It is sent to `onQueryChange`
 * on mount and whenever the sort, search, a filter, the page or the page size changes.
 */
export interface GridQuery {
  /** Sorted columns, in priority order. Only sortable columns are included. */
  sort: SortModel[];
  /** Active filters by field. A filter that is empty is left out. Values depend on each column's `filterType`. */
  filters: Record<string, FilterValue>;
  /** The global search text (trimmed). */
  search: string;
  /** Zero-based page index. */
  page: number;
  pageSize: number;
}

/** The file formats the grid can export. */
export type ExportFormat = "csv" | "xlsx" | "json" | "pdf";

/**
 * The PDF libraries, handed to the grid by your app (see `PdfExportOptions.libraries`). The grid does not
 * import them itself, so apps that never export a PDF need not install them.
 */
export interface PdfLibraries {
  /** The `jsPDF` class from `jspdf`. */
  jsPDF: any;
  /** The `autoTable` function from `jspdf-autotable` (its default export). */
  autoTable: any;
  /** The `html2canvas` function. Only needed when the header or footer is a React element. */
  html2canvas?: any;
}

/** A CSS colour: `"#4f46e5"`, `"#fff"`, `"rgb(79, 70, 229)"`, `"rgba(0,0,0,.5)"` or a name like `"tomato"`. */
export type PdfColor = string;

/** Padding inside table cells, in points: one number, or one per side. */
export type PdfPadding = number | { top?: number; right?: number; bottom?: number; left?: number };

/** Looks of one column in the PDF, by the column's `field` (see `PdfStyle.columns`). */
export interface PdfColumnStyle {
  /** Column width in points, or `"auto"` (default), or `"wrap"` (as narrow as the longest word allows). */
  width?: number | "auto" | "wrap";
  align?: "left" | "center" | "right";
  textColor?: PdfColor;
  backgroundColor?: PdfColor;
  fontStyle?: "normal" | "bold" | "italic" | "bolditalic";
  fontSize?: number;
}

/** Colours and font for one PDF row or cell (returned by `pdf.rowStyle` / `pdf.cellStyle`). Every field is optional. */
export interface PdfRowStyle {
  /** Background colour, for example `"#fee2e2"`. */
  backgroundColor?: PdfColor;
  /** Text colour, for example `"#991b1b"`. */
  textColor?: PdfColor;
  fontStyle?: "normal" | "bold" | "italic" | "bolditalic";
  fontSize?: number;
}

/** What `pdf.cellStyle` is told about one body cell. */
export interface PdfCellInfo {
  /** The whole data row (the object you gave the grid). */
  row: any;
  /** The raw value of this cell (not formatted). */
  value: unknown;
  /** The `field` of the cell's column. */
  field: string;
  /** Position of the row in the exported list (0, 1, 2 ...). */
  rowIndex: number;
}

/** How the PDF's table and page look. Every field is optional. */
export interface PdfStyle {
  /** Header row background. Default `"#4f46e5"`. */
  headColor?: PdfColor;
  /** Header row text colour. Default white. */
  headTextColor?: PdfColor;
  /** Header row text size in points. Default: the table's `fontSize`. */
  headFontSize?: number;
  /** Header row font style. Default `"bold"`. */
  headFontStyle?: "normal" | "bold" | "italic" | "bolditalic";
  /** Background of body rows (when no `stripeColors`). Default: none (white page). */
  bodyColor?: PdfColor;
  /** Text colour of body rows. */
  bodyTextColor?: PdfColor;
  /** The two colours rows alternate between, starting with the first: `["#ffffff", "#f1f5f9"]`. */
  stripeColors?: [PdfColor, PdfColor];
  /** Colour of the lines between cells. */
  borderColor?: PdfColor;
  /** Thickness of those lines in points (0.5 is thin). Default: the table theme's. */
  borderWidth?: number;
  /** Space inside each cell, in points. Default 4. */
  cellPadding?: PdfPadding;
  /** Smallest height of a row in points. */
  minRowHeight?: number;
  /** Table text size in points. Default 9 (the `fontSize` option does the same). */
  fontSize?: number;
  /** Font registered with jsPDF (the `fontName` option does the same). */
  fontName?: string;
  /** Colour behind everything on every page, for example `"#0f172a"`. Default: white paper. Text colours adapt when it is dark. */
  pageBackground?: PdfColor;
  /** Colour of the header, footer and page-number text. Default grey, or light on a dark `pageBackground`. */
  textColor?: PdfColor;
  /** Colour of the `title`. Default near black, or light on a dark `pageBackground`. */
  titleColor?: PdfColor;
  /** Size of the `title` in points. Default 14. */
  titleSize?: number;
  /** Margins of the page (the `margin` option does the same). */
  margin?: PdfExportOptions["margin"];
  /** Per column, by the column's `field`: width, alignment, colours, font. */
  columns?: Record<string, PdfColumnStyle>;
}

/** What `header` / `footer` functions are told (called again for every page). */
export interface PdfPageContext {
  /** This page (1, 2, 3 ...). */
  page: number;
  /** How many pages the PDF has. While the header height is measured this is a placeholder (99). */
  pages: number;
  /** Today's date as text. */
  date: string;
  /** The rows being exported (the data objects). */
  rows: any[];
}

/** What a `title` function is told. */
export interface PdfTitleContext {
  date: string;
  rows: any[];
}

/** Props of a `body.component`: one is drawn for each exported row. */
export interface PdfBodyItemProps<T = any> {
  row: T;
  /** Position of the row in the exported list (0, 1, 2 ...). */
  index: number;
  /** How many rows are exported. */
  count: number;
}

/** A custom PDF body: one block per exported row, laid out page by page. */
export interface PdfBodyOptions {
  /** How to draw one row: a template string (`"{name} ({email})"`) or a function returning text or a React element. */
  render?: string | ((row: any, index: number) => ReactNode);
  /** Or a React component that receives `{ row, index, count }`. It is drawn to a picture, so it needs `html2canvas`. */
  component?: ComponentType<PdfBodyItemProps>;
  /** The most blocks on one page (a second limit next to `columns` x `rows`; the smaller wins). When it is reached the next block goes on a new page. */
  perPage?: number;
  /** Blocks side by side (like cards in a grid). Default 1. */
  columns?: number;
  /**
   * Lines of blocks on one page. Default 1, so with the default `columns: 1` each page holds one block.
   * `columns: 2, rows: 2` puts 4 blocks on each page (2 across, 2 down). `"auto"` puts as many lines on a
   * page as fit. When both `rows` and `perPage` are given, the smaller number of blocks wins.
   */
  rows?: number | "auto";
  /** Space between blocks, in points. Default 8. */
  gap?: number;
}

/** Options of a PDF export (the `pdf` field of {@link ExportOptions}). */
export interface PdfExportOptions {
  /**
   * Where the PDF libraries come from. Required for PDF export. Give the libraries, or a function that loads
   * them (best: it runs only when someone exports a PDF):
   *
   *     libraries: async () => ({
   *       jsPDF: (await import("jspdf")).jsPDF,
   *       autoTable: (await import("jspdf-autotable")).default,
   *       html2canvas: (await import("html2canvas")).default, // only for a header / footer element
   *     })
   */
  libraries?: PdfLibraries | (() => PdfLibraries | Promise<PdfLibraries>);
  /**
   * A heading printed above the table on the first page: a string, or a React element (drawn to a picture
   * like `header` and `footer`, so it needs `html2canvas` in `libraries`).
   */
  title?: ReactNode | ((ctx: PdfTitleContext) => ReactNode);
  /**
   * Printed at the top of every page. A string (tokens `{page}`, `{pages}` and `{date}` are replaced), or a
   * React element such as `<div style={{display:"flex"}}><img src={logo} height={32}/> Sales report</div>`.
   * An element is drawn to an image first (with html2canvas), so styled boxes, colours and images work.
   */
  header?: ReactNode | ((ctx: PdfPageContext) => ReactNode);
  /** Printed at the bottom of every page. Same rules as `header`. */
  footer?: ReactNode | ((ctx: PdfPageContext) => ReactNode);
  /**
   * What goes between the header and the footer. Leave it out for the usual table. Otherwise give:
   *  - a string: a template per row, `{field}` is replaced by that column's text (`"{name} - {email}"`), `{index}` by the row number
   *  - a function `(row, index) => string | element`: one block per row
   *  - an object `{ render | component, perPage, columns, gap }` for page layout (see {@link PdfBodyOptions})
   * Only the rows being exported are used (visible or selected rows). When a page is full, the next block moves to a new page.
   */
  body?: string | ((row: any, index: number) => ReactNode) | PdfBodyOptions;
  /** Where the header goes horizontally. Default `"left"`. */
  headerAlign?: "left" | "center" | "right";
  /** Where the footer goes horizontally. Default `"center"`. */
  footerAlign?: "left" | "center" | "right";
  /** `"auto"` (default) picks landscape when the table has more than 6 columns. */
  orientation?: "portrait" | "landscape" | "auto";
  /** Paper size. Default `"a4"`. */
  pageSize?: "a3" | "a4" | "a5" | "letter" | "legal";
  /**
   * Space around the page in points (1 pt = 1/72 inch). A number for all four sides, or
   * `{ top, right, bottom, left }` (a missing side uses 36). Default 36.
   */
  margin?: number | { top?: number; right?: number; bottom?: number; left?: number };
  /** Font size of the table text in points. Default 9. */
  fontSize?: number;
  /** Look of the table: `"striped"` (default), `"grid"` or `"plain"`. */
  tableTheme?: "striped" | "grid" | "plain";
  /** Background colour of the table's header row, as a hex string. Default `"#4f46e5"`. Same as `style.headColor`. */
  headColor?: string;
  /** Text colour of the table's header row. Default `"#ffffff"`. Same as `style.headTextColor`. */
  headTextColor?: string;
  /**
   * Copy the look of the grid on screen into the PDF: header colours, the two row stripe colours, text
   * colour, row borders, text size and the grid's background. It reads the real elements, so it follows your
   * theme, Tailwind classes and CSS. Default false (the PDF then uses its own look). Anything you set
   * yourself in `style` or the options above wins over the copied value.
   */
  matchGridStyle?: boolean;
  /** Colours, borders, padding and more for the table and the page. See {@link PdfStyle}. */
  style?: PdfStyle;
  /**
   * Extra options for jspdf-autotable, merged in last so they override everything above. For anything this
   * list does not cover: `{ rowPageBreak: "avoid", didParseCell: (data) => { ... } }`.
   */
  autoTableOptions?: Record<string, any>;
  /** Print "Page 1 of 3" in the bottom right corner. Default true. */
  pageNumbers?: boolean;
  /** Tallest a header or footer image may be, in points. Default 90. */
  maxImageHeight?: number;
  /**
   * Name of a font you registered with jsPDF (`doc.addFileToVFS` / `doc.addFont`) in `beforeRender`.
   * jsPDF's built-in fonts only cover Western European letters, so register one for other alphabets.
   */
  fontName?: string;
  /**
   * Colours for whole rows, chosen from the row's data (any column). Return nothing for rows that keep the
   * normal look. Give a function (decides per row) or a plain object (the same look for every body row). It beats `stripeColors` and `bodyColor` on the rows it colours.
   *
   *     rowStyle: (row) => (row.status === "overdue" ? { backgroundColor: "#fee2e2", textColor: "#991b1b" } : undefined)
   */
  rowStyle?: PdfRowStyle | ((row: any, rowIndex: number) => PdfRowStyle | null | undefined | void);
  /** Like `rowStyle` but for one cell, so it can also use that cell's own value. It beats `rowStyle` for that cell. */
  cellStyle?: PdfRowStyle | ((info: PdfCellInfo) => PdfRowStyle | null | undefined | void);
  /** Called with the jsPDF document before anything is drawn, so you can register fonts or set document properties. */
  beforeRender?: (doc: any) => void | Promise<void>;
}

export interface ExportOptions {
  /** File name without the extension. Default `"export"`. */
  filename?: string;
  /**
   * Which rows to export.
   * - `"filtered"` (default): every row matching the search and filters, across all pages
   * - `"visible"` : the rows you can see now, which is the current page (every matching row when there is no pagination)
   * - `"page"`    : same as `"visible"`
   * - `"selected"`: only the selected rows (needs `rowSelection`)
   * With `serverSide`, "filtered" means the rows currently loaded.
   */
  scope?: "filtered" | "visible" | "page" | "selected";
  /** Also export columns the user has hidden. Default false. */
  includeHidden?: boolean;
  /** CSV only: add an apostrophe in front of text that starts with `= + - @`, so spreadsheets do not run it as a formula. Default true. */
  sanitize?: boolean;
  /**
   * Which formats the toolbar export button offers. One format (the default, `["csv"]`) gives a plain
   * "Export CSV" button; several give an "Export" menu with a format list and, when more than one choice
   * makes sense, a "Visible rows / Selected rows / All matching rows" chooser.
   */
  formats?: ExportFormat[];
  /** Excel only: name of the worksheet. Default `"Sheet1"`. */
  sheetName?: string;
  /** JSON only: use the column `"field"` (default) or its `"header"` text as the key of each value. */
  jsonKeys?: "field" | "header";
  /** JSON only: spaces of indentation. Default 2; use 0 for one compact line. */
  jsonIndent?: number;
  /** PDF only: header, footer, paper and table settings. */
  pdf?: PdfExportOptions;
}

/** Methods you can call from outside by passing a ref as `apiRef`. */
export interface DataGridApi<T = Record<string, any>> {
  /** Loads the data again: runs `loadRows` (client-side loading) or sends the query again (`serverSide`). */
  reload: () => Promise<void>;
  /** Builds the CSV text without downloading it. */
  getCsv: (options?: ExportOptions) => string;
  /** Downloads a CSV file (opens the browser's save dialog). */
  exportCsv: (options?: ExportOptions) => void;
  /** Builds the JSON text (an array of objects) without downloading it. */
  getJson: (options?: ExportOptions) => string;
  /** Downloads a `.json` file. */
  exportJson: (options?: ExportOptions) => void;
  /** Builds an Excel (`.xlsx`) file in memory. */
  getXlsx: (options?: ExportOptions) => Promise<Blob>;
  /** Downloads an `.xlsx` file. */
  exportXlsx: (options?: ExportOptions) => Promise<void>;
  /** Builds a PDF in memory. Needs `jspdf` and `jspdf-autotable` (and `html2canvas` for header/footer elements). */
  getPdf: (options?: ExportOptions) => Promise<Blob>;
  /** Downloads a `.pdf` file. */
  exportPdf: (options?: ExportOptions) => Promise<void>;
  /** Exports in the given format: the same as calling the method above for it. */
  exportAs: (format: ExportFormat, options?: ExportOptions) => Promise<void>;
  getSelectedRows: () => T[];
  getSelectedRowIds: () => (string | number)[];
  /** Selects every selectable row that matches the search and filters. */
  selectAll: () => void;
  clearSelection: () => void;
  /** Runs the last query again (`serverSide` only). Use it after your data changed on the server. */
  refresh: () => void;
}

/**
 * Entrance / exit animations a row can use. Every name has an "in" version (a row appears) and an
 * "out" version (a row leaves).
 * `"fade"`, `"slide-up"`, `"slide-down"`, `"slide-left"`, `"slide-right"`, `"zoom"`, `"flip-x"`, `"flip-y"`,
 * `"rotate"`, `"skew"`, `"blur"`, `"bounce"` and `"none"`.
 */
export type RowAnimationName =
  | "fade"
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "zoom"
  | "flip-x"
  | "flip-y"
  | "rotate"
  | "skew"
  | "blur"
  | "bounce"
  | "none";

/* -------------------------------------------------------------------------- */
/* Grid props                                                                 */
/* -------------------------------------------------------------------------- */

export type GridSlot =
  | "root"
  | "toolbar"
  | "search"
  | "scroll"
  | "table"
  | "thead"
  | "headerRow"
  | "headerCell"
  | "filterIndicator"
  | "filterPopup"
  | "filterInput"
  | "tbody"
  | "row"
  | "cell"
  | "editor"
  | "empty"
  | "footer"
  | "rowCount"
  | "pageInfo"
  | "pageSize"
  | "pagination"
  | "pageButton"
  | "checkbox"
  | "checkboxControl"
  | "checkboxIndicator"
  | "toolButton"
  | "exportMenu"
  | "sortIndicator"
  | "skeleton";

export interface DataGridProps<T = Record<string, any>> {
  columns: ColumnDef<T>[];
  /**
   * The rows. Leave it `undefined` (or pass `null`) while your data is still on its way: the grid then shows the
   * loading skeleton. An empty array `[]` means "loaded, and there is nothing", which shows the empty message.
   */
  rows?: T[] | null;
  /**
   * Let the grid load the rows itself (client-side loading). It runs on mount, shows the skeleton while the
   * promise is pending, the rows when it resolves, the empty message when it resolves with `[]` and an error
   * with a Retry button when it rejects. Use `apiRef.current.reload()` to run it again, or change `loadRowsKey`.
   */
  loadRows?: () => Promise<T[]>;
  /**
   * When this changes, `loadRows` runs again. It can be one value, an array or a plain object holding several
   * (`[category, status]` or `{ category, status }`); they are compared by content, so an inline one is fine.
   */
  loadRowsKey?: unknown;

  /** Stable id for each row. Defaults to the row's index in `rows`. Row selection needs ids that do not change. */
  getRowId?: (row: T, index: number) => string | number;

  /* ---- editing ---- */

  /** Allow editing cells (double-click, Enter/F2, or just start typing). Default false. */
  editable?: boolean;
  /**
   * After Enter saves a cell, start editing the cell below (Shift+Enter: the cell above).
   * Tab and Shift+Tab move across the row. Default true.
   */
  enterMovesDown?: boolean;
  /** Fires after a cell edit is committed. */
  onCellEdit?: (event: CellEditEvent<T>) => void;
  /** Fires with the full updated array after a cell edit. Handy for `setRows`. */
  onRowsChange?: (rows: T[]) => void;

  /* ---- row selection (off by default) ---- */

  /**
   * Adds a checkbox column for selecting rows. `true` or `"multiple"` allows many rows (with a
   * select-all header and Shift+click ranges), `"single"` allows one. Default false.
   */
  rowSelection?: boolean | "single" | "multiple";
  /** Controlled selection: the ids of the selected rows. Pair it with `onSelectionChange`. */
  selectedRowIds?: (string | number)[];
  /** Initial selection when you do not control it. */
  defaultSelectedRowIds?: (string | number)[];
  /** Fires whenever the selection changes. */
  onSelectionChange?: (selection: RowSelection<T>) => void;
  /** Return false for rows that must not be selected (their checkbox is disabled). */
  isRowSelectable?: (row: T) => boolean;

  /* ---- sorting (each column opts in with `sortable: true`) ---- */

  /** Controlled sort. Pair it with `onSortChange`. */
  sort?: SortModel[];
  /** Initial sort when you do not control it. */
  defaultSort?: SortModel | SortModel[] | null;
  /** Fires with the new sort list (empty when no column is sorted). */
  onSortChange?: (sort: SortModel[]) => void;
  /** Hold Shift while clicking headers to sort by several columns. Default false. */
  multiSort?: boolean;

  /* ---- search (the box only shows when `searchable` is true) ---- */

  /** Show the global search box. Default false. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Controlled search text. Pair it with `onSearchChange`. */
  search?: string;
  onSearchChange?: (search: string) => void;

  /* ---- filters (columns opt in with `filterable: true`) ---- */

  /** Controlled filters, by field. Pair it with `onFiltersChange`. */
  filters?: Record<string, FilterValue>;
  onFiltersChange?: (filters: Record<string, FilterValue>) => void;

  /* ---- pagination (the bar and the page information only show when `pagination` is true) ---- */

  /** Split rows into pages and show the row count and page controls. Default false. */
  pagination?: boolean;
  /** Where the row count and page controls go: "bottom" (default), "top" or "both". */
  /**
   * Set to `false` to remove the toolbar row completely (search box, Columns button, Export button,
   * selected count and your `toolbar` content), even if those features are switched on. The features
   * still work: drive them yourself with `search`, `apiRef.exportCsv()` and so on. Default `true`
   * (the toolbar is drawn only when one of those features is used).
   */
  showToolbar?: boolean;
  /**
   * Set to `false` to remove the footer completely (row count, page-size menu and page buttons), even
   * when `pagination` is on. Rows are still split into pages, so control the page yourself with
   * `page` / `onPageChange`. Default `true` (the footer is drawn when `pagination` is on).
   */
  showFooter?: boolean;
  paginationPosition?: PaginationPosition;
  /** Initial rows per page. */
  pageSize?: number;
  pageSizeOptions?: number[];
  /** Controlled page (zero-based). Pair it with `onPageChange`. */
  page?: number;
  onPageChange?: (page: number) => void;
  /** Fires when the user picks another page size. */
  onPageSizeChange?: (pageSize: number) => void;

  /* ---- server-side mode ---- */

  /**
   * Let your server sort, filter, search and page. The grid then shows `rows` as they are (the
   * current page) and calls `onQueryChange` whenever the query changes. Default false.
   */
  serverSide?: boolean;
  /** Total number of rows on the server, for the page count. Needed with `serverSide` and `pagination`. */
  rowCount?: number;
  /**
   * Called on mount and whenever the query changes (`serverSide` only). If it returns a promise,
   * the grid shows the loading state until the promise settles and shows an error with a Retry
   * button if it rejects. Update your `rows` (and `rowCount`) before the promise resolves.
   */
  onQueryChange?: (query: GridQuery) => void | Promise<unknown>;
  /** Wait this long (ms) after the last keystroke in the search box before querying. Default 250. */
  queryDebounce?: number;
  /**
   * Default for every column's filter: milliseconds to wait after the last keystroke before a typed
   * filter is applied. A column can override it with its own `filterDebounce`. Default 300.
   */
  filterDebounce?: number;

  /* ---- loading, skeleton and errors ---- */

  /**
   * Force the loading state on or off. When you leave it out, the loading state follows the promise
   * returned by `onQueryChange`.
   */
  loading?: boolean;
  /** How many placeholder rows to draw while loading. Default: the page size (at most 20), or 5 without pagination. */
  loadingRows?: number;
  /** A component that draws one placeholder row's content. Without it each cell gets a shimmering bar. */
  skeletonRow?: ComponentType<SkeletonRowProps<T>>;
  /** Shown (with a Retry button) when the promise from `onQueryChange` rejects. */
  errorMessage?: ReactNode;

  /* ---- columns: visibility, keyboard ---- */

  /** Show a "Columns" button that lets users show and hide columns. Default false. */
  columnMenu?: boolean;
  /** Fires with the fields that are hidden now. */
  onColumnVisibilityChange?: (hiddenFields: string[]) => void;
  /** Arrow keys, Home/End and Page Up/Down move between cells. Default false. */
  keyboardNavigation?: boolean;

  /* ---- big data ---- */

  /**
   * Render only the rows that are on screen, so tens of thousands of rows stay smooth. Needs a fixed
   * `rowHeight`, and the grid scrolls inside `maxHeight` (400 when you set none). Default false.
   */
  virtualize?: boolean;
  /** Row height in pixels when `virtualize` is on. Rows must fit it. Default 40. */
  rowHeight?: number;
  /** Extra rows rendered above and below the visible ones when `virtualize` is on. Default 6. */
  overscan?: number;

  /* ---- export and imperative API ---- */

  /**
   * Show an export button in the toolbar. `true` gives "Export CSV". Pass an object to set the file name,
   * scope and so on, and `formats: ["csv", "xlsx", "json", "pdf"]` to offer more formats in an "Export" menu. Default false.
   */
  exportable?: boolean | ExportOptions;
  /** Called when an export fails (for example `jspdf` is not installed). Without it the error is logged to the console. */
  onExportError?: (error: Error, format: ExportFormat) => void;
  /** Pass a ref to call methods such as `exportCsv()` or `getSelectedRows()` from outside. */
  apiRef?: MutableRefObject<DataGridApi<T> | null>;

  /* ---- look ---- */

  onRowClick?: (row: T, rowIndex: number) => void;
  /** Extra content on the right side of the toolbar. */
  toolbar?: ReactNode;
  emptyMessage?: ReactNode;
  /**
   * A component drawn instead of the `emptyMessage` text when there are no rows to show. It receives
   * `{ reason, search, filters, columns, clearAll }`, so it can say "nothing matches" and offer a button
   * that clears the filters. Define it outside render so it keeps its identity.
   */
  emptyComponent?: ComponentType<EmptyStateProps<T>>;
  /**
   * The arrow shown in sortable headers. `"default"` (the little ▲ ▼ ↕ text arrows), `"arrow"` (a smooth
   * arrow that turns around when the sort changes), or your own component, which receives
   * `{ column, direction, priority }`. A column can override it with its own `sortIndicator`.
   */
  sortIndicator?: SortIndicatorSetting<T>;
  /**
   * Turn the default ▲ and your own indicator smoothly (half a turn) when the sort direction changes.
   * Default true. Does not affect `sortIndicator="arrow"`, which already turns itself. Set false if your
   * own component animates by itself, so it is not turned twice.
   */
  sortIndicatorRotate?: boolean;
  /** Alternate row shading. Default false. */
  striped?: boolean;
  /** Two colours for the alternating rows, for example `["#ffffff", "#f1f5f9"]`. Implies `striped`. */
  stripeColors?: [string, string];
  /** Checkbox style for `type: "boolean"` columns and the selection column: "button", "tick" or "native" (default). */
  checkboxVariant?: CheckboxVariant;
  /**
   * Rows animate when they come and go. Default true. Respects "reduce motion".
   * Rows are matched by `getRowId`: a row that stays on screen is left alone while new rows animate in
   * and are added to the list, and a row that goes away animates out where it was.
   */
  animateRows?: boolean;
  /**
   * Which animation rows use: one name for both directions (`"zoom"`), or `{ enter, exit }` to mix
   * (`{ enter: "slide-right", exit: "fade" }`). See {@link RowAnimationName}. Default `"slide-up"`.
   */
  rowAnimation?: RowAnimationName | { enter?: RowAnimationName; exit?: RowAnimationName };
  /** Length of the enter animation in milliseconds (exit takes 80% of it). Default 380. */
  rowAnimationDuration?: number;
  /** Delay between rows that appear together, in milliseconds. Use 0 to start all at once. Default 28. */
  rowAnimationStagger?: number;
  /**
   * Your own CSS class (or function) for the animation of a row that leaves, like `rowAnimationClassName`
   * is for rows that arrive. The class should set `animation` and keep the final state (`forwards`).
   */
  rowExitAnimationClassName?: string | ((row: T, rowIndex: number) => string);
  /**
   * Your own CSS class (or a function returning one) for the entrance animation of every row. It
   * replaces the built-in slide-up. The class should set `animation`. Each row also has the CSS
   * variable `--rg-i` (its position, 0 to 24) so you can stagger rows:
   * `.fade-in { animation: fade 0.4s both; animation-delay: calc(var(--rg-i) * 40ms); }`.
   * Does nothing when `animateRows` is false or `virtualize` is on.
   */
  rowAnimationClassName?: string | ((row: T, rowIndex: number) => string);
  /**
   * Name of a theme. Nothing changes unless you pass one: "ocean", "midnight", "sunset", "forest",
   * "lavender", "coffee", "graphite" or "aurora", or the name of your own `[data-rg-theme="..."]` CSS.
   */
  theme?: GridTheme | (string & {});
  /** Makes the body scroll with a sticky header, e.g. 400 or "60vh". */
  maxHeight?: number | string;
  /**
   * Keep the toolbar at the top of the browser window while the PAGE scrolls past a tall grid.
   * Optional (default false). Not needed with `maxHeight` (the toolbar already stays put there).
   */
  stickyToolbar?: boolean;
  /** Keep the column headers at the top of the browser window while the PAGE scrolls (under the toolbar when it is sticky too). Default false. */
  stickyHeader?: boolean;
  /**
   * Space kept free above the sticky parts, for a fixed bar of your own, e.g. 64 or "4rem". Default 0.
   * Page-scroll sticky mode lets the table grow to its full height, so a table wider than the page
   * overflows instead of getting its own horizontal scroll bar; give columns widths that fit.
   */
  stickyOffset?: number | string;
  /**
   * The scroll bars inside the grid. "thin" (default) is a slim bar, "auto" the browser's normal one,
   * "hidden" shows none (scrolling still works) and "custom" adds no scroll bar style at all so
   * your own CSS (`::-webkit-scrollbar`, ...) on `classNames.scroll` applies. The colours of "thin"
   * come from `--rg-scrollbar-thumb` and `--rg-scrollbar-track`.
   */
  scrollbar?: "thin" | "auto" | "hidden" | "custom";

  /** Tailwind or any CSS classes for the root element. */
  className?: string;
  /** Inline styles for the root element. */
  style?: CSSProperties;
  /** Classes per part of the grid. */
  classNames?: Partial<Record<GridSlot, string>>;
  /** Inline styles per part of the grid. */
  styles?: Partial<Record<GridSlot, CSSProperties>>;
  rowClassName?: string | ((row: T, rowIndex: number) => string);
  rowStyle?: CSSProperties | ((row: T, rowIndex: number) => CSSProperties);
}
