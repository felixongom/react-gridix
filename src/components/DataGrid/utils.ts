import type { ColumnDef } from "./types";

/** Joins class names, skipping anything falsy. */
export const cx = (...parts: (string | false | undefined | null)[]) => parts.filter(Boolean).join(" ");

/**
 * The text shown in a column's header. Boolean columns default to an empty string
 * (so a checkbox column is just the checkbox), every other column to its field name.
 */
export const headerLabel = <T,>(c: ColumnDef<T>) => c.headerName ?? (c.type === "boolean" ? "" : c.type === "sequence" ? "#" : c.field);

/** A name for screen readers: the visible header text, or the field when the header is empty. */
export const nameOf = <T,>(c: ColumnDef<T>) => headerLabel(c) || c.field;
