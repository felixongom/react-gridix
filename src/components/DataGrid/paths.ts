type Primitive = string | number | boolean | bigint | symbol | null | undefined | Date | ((...args: any[]) => any);
type Prev = [never, 0, 1, 2, 3, 4, 5];

/**
 * Every field a column can point at: top-level keys, plus dot paths into nested objects
 * (`"contact.phone"`). Goes up to 5 levels deep. Arrays are treated as plain values.
 */
export type FieldPath<T, D extends number = 5> = [D] extends [never]
  ? never
  : T extends Primitive | readonly unknown[]
    ? never
    : {
        [K in keyof T & string]: NonNullable<T[K]> extends Primitive | readonly unknown[]
          ? K
          : K | `${K}.${FieldPath<NonNullable<T[K]>, Prev[D]>}`;
      }[keyof T & string];

const UNSAFE = new Set(["__proto__", "prototype", "constructor"]);
const has = (o: object, key: string) => Object.prototype.hasOwnProperty.call(o, key);

/** Reads `"contact.phone"` style paths. A key that literally contains dots wins over nesting. */
export function getByPath(obj: unknown, path: string): unknown {
  if (obj === null || typeof obj !== "object") return undefined;
  if (has(obj, path)) return (obj as Record<string, unknown>)[path];
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (cur === null || cur === undefined || typeof cur !== "object" || UNSAFE.has(part)) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function assign(src: any, key: string, value: unknown) {
  if (Array.isArray(src)) {
    const copy = [...src];
    (copy as any)[key] = value;
    return copy;
  }
  return { ...src, [key]: value };
}

/**
 * Returns a copy of `obj` with `"contact.phone"` set to `value`. Objects on the way are copied, never
 * changed in place, and missing levels are created. Unsafe keys (`__proto__` and friends) are refused.
 */
export function setByPath<T>(obj: T, path: string, value: unknown): T {
  const src = (obj ?? {}) as Record<string, unknown>;
  if (has(src, path) || !path.includes(".")) {
    if (UNSAFE.has(path)) return obj;
    return assign(src, path, value) as T;
  }
  const [head, ...rest] = path.split(".");
  if (UNSAFE.has(head)) return obj;
  const child = src[head];
  const base = child !== null && typeof child === "object" ? child : {};
  return assign(src, head, setByPath(base, rest.join("."), value)) as T;
}
