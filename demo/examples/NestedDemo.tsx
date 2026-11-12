import { useState } from "react";
import { DataGrid, type CellEditEvent, type ColumnDef } from "../../src";

interface Person {
  id: number;
  name: string;
  contact: { email: string; phone: string };
  address: { city: string; country: string };
  prefs: { newsletter: boolean };
}

const cities: [string, string][] = [
  ["Kampala", "Uganda"],
  ["Nairobi", "Kenya"],
  ["Kigali", "Rwanda"],
  ["Dar es Salaam", "Tanzania"],
];
const names = ["Amina Okello", "Brian Mugisha", "Carol Nankya", "David Kato", "Esther Achieng", "Felix Opio", "Grace Namuli", "Henry Ssemakula"];

const original: Person[] = names.map((name, i) => ({
  id: i + 1,
  name,
  contact: { email: `${name.split(" ")[0].toLowerCase()}@example.com`, phone: `+256 700 ${String(100 + i * 37).padStart(3, "0")} ${String(200 + i * 11)}` },
  address: { city: cities[i % 4][0], country: cities[i % 4][1] },
  prefs: { newsletter: i % 3 === 0 },
}));

// "contact.phone" reaches into row.contact.phone. The field names are type-checked against Person.
const columns: ColumnDef<Person>[] = [
  { field: "id", sortable: true, headerName: "ID", type: "number", width: 60, editable: false },
  { field: "name", sortable: true, headerName: "Name", filterable: true },
  { field: "contact.email", sortable: true, headerName: "Email", filterable: true },
  { field: "contact.phone", sortable: true, headerName: "Phone" },
  { field: "address.city", sortable: true, headerName: "City", filterable: true },
  { field: "address.country", sortable: true, headerName: "Country" },
  { field: "prefs.newsletter", sortable: true, headerName: "Newsletter", type: "boolean", align: "center", width: 140, headerCheckbox: true },
];

export function NestedDemo() {
  const [rows, setRows] = useState(original);
  const [last, setLast] = useState("none yet");

  return (
    <>
      <ul className="demo-tips">
        <li>Double-click a phone number or city and type a new value. The nested object is copied, not changed in place.</li>
        <li>Search, sorting and the filter dots work on nested values too.</li>
      </ul>
      <DataGrid
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        editable
        onRowsChange={setRows}
        onCellEdit={(e: CellEditEvent<Person>) => setLast(`${e.field}: ${String(e.oldValue)} → ${String(e.newValue)}`)}
        searchable
        pagination
        pageSize={8}
      />
      <p className="demo-note">Last edit: {last}</p>
      <p className="demo-note">
        Row 1 phone in the original array (never changed): <code>{original[0].contact.phone}</code> · in the grid state:{" "}
        <code>{rows[0].contact.phone}</code>
      </p>
    </>
  );
}
