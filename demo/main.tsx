import { StrictMode, useEffect, useState, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import "./demo.css";
import { BasicDemo } from "./examples/BasicDemo";
import { CheckboxDemo } from "./examples/CheckboxDemo";
import { CustomComponentsDemo } from "./examples/CustomComponentsDemo";
import { EditingDemo } from "./examples/EditingDemo";
import { NestedDemo } from "./examples/NestedDemo";
import { PaginationDemo } from "./examples/PaginationDemo";
import { StylingDemo } from "./examples/StylingDemo";
import { SelectionDemo } from "./examples/SelectionDemo";
import { ServerDemo } from "./examples/ServerDemo";
import { ColumnsDemo } from "./examples/ColumnsDemo";
import { LargeDemo } from "./examples/LargeDemo";
import { DatesDemo } from "./examples/DatesDemo";
import { ThemesDemo } from "./examples/ThemesDemo";
import { FeaturesDemo } from "./examples/FeaturesDemo";

interface DemoEntry {
  id: string;
  label: string;
  title: string;
  blurb: string;
  Component: ComponentType;
}

const demos: DemoEntry[] = [
  {
    id: "basic",
    label: "Basic",
    title: "Sorting, search and filters",
    blurb:
      "Click a header to sort (ascending, descending, off). The box above the grid searches every column. Name, Department and Status have a filter dot: click it to open that column's filter.",
    Component: BasicDemo,
  },
  {
    id: "editing",
    label: "Editing",
    title: "Editing cells",
    blurb: "Edit values in place, with Excel-style Enter-moves-down, validation and locked cells.",
    Component: EditingDemo,
  },
  {
    id: "custom",
    label: "Custom components",
    title: "Custom components per column",
    blurb: "Plug your own React components into any column: cells, editors, headers and filters.",
    Component: CustomComponentsDemo,
  },
  {
    id: "checkboxes",
    label: "Checkboxes",
    title: "Checkboxes",
    blurb: "Boolean columns with one-click checkboxes in three styles, all restylable from outside, plus a standalone Checkbox.",
    Component: CheckboxDemo,
  },
  {
    id: "styling",
    label: "Styling",
    title: "Tailwind and inline styles",
    blurb: "Pass className and style to the grid, to any part of it, and to columns, rows and cells.",
    Component: StylingDemo,
  },
  {
    id: "pagination",
    label: "Pagination",
    title: "Pagination",
    blurb: "Put the page info and controls at the top, the bottom or both. Turn pagination off to scroll instead.",
    Component: PaginationDemo,
  },
  {
    id: "nested",
    label: "Nested fields",
    title: "Nested objects with dot notation",
    blurb: "A column's field can reach into nested objects, like contact.phone. Sorting, search, filters and editing all work, and your original data is never mutated.",
    Component: NestedDemo,
  },
  {
    id: "selection",
    label: "Row selection",
    title: "Row selection",
    blurb: "Turn on rowSelection for a checkbox column with select-all, Shift+click ranges, single or multiple mode, and controlled ids.",
    Component: SelectionDemo,
  },
  {
    id: "server",
    label: "Server-side",
    title: "Server-side data and loading skeleton",
    blurb: "Your API sorts, filters, searches and pages. The grid sends a query, shows a skeleton while the promise is pending, and handles errors.",
    Component: ServerDemo,
  },
  {
    id: "columns",
    label: "Columns",
    title: "Resize, pin, hide, keyboard and export",
    blurb: "Opt-in column features: drag to resize, pin to an edge, show and hide, arrow-key navigation, multi-column sort and CSV export.",
    Component: ColumnsDemo,
  },
  {
    id: "large",
    label: "Large data",
    title: "20,000 rows with virtualization",
    blurb: "virtualize renders only the visible rows, so a huge array scrolls smoothly.",
    Component: LargeDemo,
  },
  {
    id: "dates",
    label: "Dates and filters",
    title: "Date columns and typed filters",
    blurb: "type: \"date\" gives a date picker editor, and each column gets the filter that fits it: range, date range, exact match or a list.",
    Component: DatesDemo,
  },
  {
    id: "themes",
    label: "Themes",
    title: "Themes",
    blurb: "Eight built-in themes: ocean, midnight, sunset, forest, lavender, coffee, graphite and aurora. Without a theme name the grid keeps its plain default look.",
    Component: ThemesDemo,
  },
  {
    id: "features",
    label: "Animations and export",
    title: "Row animations, exports, sort arrow, filter operators and empty state",
    blurb: "Rows animate in and out without disturbing the rows that stay. Export visible or selected rows to CSV, Excel, JSON or PDF. Text filters can offer contains / equals / starts with and more.",
    Component: FeaturesDemo,
  },
];

function useHash() {
  const read = () => window.location.hash.slice(1) || demos[0].id;
  const [hash, setHash] = useState(read);
  useEffect(() => {
    const onChange = () => setHash(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

function App() {
  const hash = useHash();
  const demo = demos.find((d) => d.id === hash) ?? demos[0];
  const Demo = demo.Component;

  return (
    <div className="demo-shell">
      <nav className="demo-nav">
        <h2>react-gridix</h2>
        {demos.map((d) => (
          <a key={d.id} href={`#${d.id}`} aria-current={d.id === demo.id ? "page" : undefined}>
            {d.label}
          </a>
        ))}
      </nav>
      <main className="demo-main">
        <h1>{demo.title}</h1>
        <p className="demo-blurb">{demo.blurb}</p>
        <Demo key={demo.id} />
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
