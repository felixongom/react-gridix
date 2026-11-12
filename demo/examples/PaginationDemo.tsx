import { useState } from "react";
import { DataGrid, type ColumnDef, type PaginationPosition } from "../../src";

// A second, smaller data set for the controlled-state example at the bottom
const smallRows = () => makeEmployees(50);
import { makeEmployees, money, type Employee } from "../data";

const rows = makeEmployees(200);

const columns: ColumnDef<Employee>[] = [
  // Row numbers: counted again after every search, filter or sort. Needs no data, so its field starts with "#".
  { field: "#", type: "sequence", headerName: "No.", width: 64, align: "center" },
  { field: "id", sortable: true, headerName: "ID", type: "number", width: 70 },
  { field: "name", sortable: true, headerName: "Name" },
  { field: "department", sortable: true, headerName: "Department" },
  { field: "salary", sortable: true, headerName: "Salary", type: "number", align: "right", valueFormatter: (v) => money.format(v) },
];

const positions: { value: PaginationPosition; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "both", label: "Both" },
];

export function PaginationDemo() {
  const [position, setPosition] = useState<PaginationPosition>("top");
  const [pagination, setPagination] = useState(true);
  const [animate, setAnimate] = useState(true);
  // Both bars can be removed completely, even though searchable and pagination are on
  const [toolbar, setToolbar] = useState(true);
  const [footer, setFooter] = useState(true);
  // "default" = the built-in slide-up; the others are classes from demo.css (your own CSS class works the same way)
  const [animation, setAnimation] = useState<"default" | "demo-row-fade" | "demo-row-zoom">("default");
  const [ctlPage, setCtlPage] = useState(0);
  const [ctlSearch, setCtlSearch] = useState("");
  const [ctlRows] = useState(smallRows);

  return (
    <>
      <div className="demo-controls">
        <span>Page info position:</span>
        {positions.map((p) => (
          <label key={p.value}>
            <input
              type="radio"
              name="position"
              checked={position === p.value}
              disabled={!pagination}
              onChange={() => setPosition(p.value)}
            />
            {p.label}
          </label>
        ))}
        <label>
          <input type="checkbox" checked={pagination} onChange={(e) => setPagination(e.target.checked)} />
          Pagination
        </label>
        <label>
          <input type="checkbox" checked={toolbar} onChange={(e) => setToolbar(e.target.checked)} />
          Show toolbar
        </label>
        <label>
          <input type="checkbox" checked={footer} onChange={(e) => setFooter(e.target.checked)} />
          Show footer
        </label>
        <label>
          <input type="checkbox" checked={animate} onChange={(e) => setAnimate(e.target.checked)} />
          Animate rows
        </label>
        <label>
          Animation:{" "}
          <select aria-label="Row animation" value={animation} onChange={(e) => setAnimation(e.target.value as typeof animation)}>
            <option value="default">Slide up (built in)</option>
            <option value="demo-row-fade">Fade from left (custom class)</option>
            <option value="demo-row-zoom">Zoom in (custom class)</option>
          </select>
        </label>
      </div>
      <DataGrid
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        searchable
        pagination={pagination}
        paginationPosition={position}
        pageSize={10}
        pageSizeOptions={[5, 10, 20, 50]}
        maxHeight={pagination ? undefined : 360}
        striped
        animateRows={animate}
        showToolbar={toolbar}
        showFooter={footer}
        rowAnimationClassName={animation === "default" ? undefined : animation}
      />
      <p className="demo-note">
        With pagination off, all 200 rows scroll inside the grid (maxHeight 360) with a sticky header, and only the row count shows.
      </p>

      <h2 className="demo-heading">Controlled state</h2>
      <p className="demo-note">
        This grid's page and search text live in this page's state, so outside controls can change them. The grid reports changes through
        <code> onPageChange</code> and <code>onSearchChange</code>.
      </p>
      <div className="demo-controls">
        <button onClick={() => setCtlPage(2)}>Go to page 3</button>
        <input aria-label="Outside search" placeholder="Outside search" value={ctlSearch} onChange={(e) => setCtlSearch(e.target.value)} />
        <span data-testid="ctl-state">page={ctlPage} search="{ctlSearch}"</span>
      </div>
      <DataGrid
        columns={columns}
        rows={ctlRows}
        getRowId={(r) => r.id}
        pagination
        pageSize={5}
        page={ctlPage}
        onPageChange={setCtlPage}
        search={ctlSearch}
        onSearchChange={setCtlSearch}
        searchable
      />
    </>
  );
}
