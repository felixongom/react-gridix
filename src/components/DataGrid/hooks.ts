import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** `useLayoutEffect` in the browser, `useEffect` on the server (avoids the SSR warning). */
export const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * State that can be "controlled" from outside.
 *
 * - If `controlled` is not undefined, that value is used and the grid only REPORTS changes
 *   through `onChange` (the parent must store the new value and pass it back).
 * - Otherwise the grid keeps the value itself, starting at `initial`, and still calls `onChange`.
 */
export function useControlled<V>(controlled: V | undefined, initial: V, onChange?: (value: V) => void) {
  const [inner, setInner] = useState<V>(initial);
  const isControlled = controlled !== undefined;
  const value = isControlled ? (controlled as V) : inner;

  const set = useCallback(
    (next: V) => {
      if (!isControlled) setInner(next);
      onChange?.(next);
    },
    [isControlled, onChange]
  );

  return [value, set] as const;
}

/**
 * Calls `fn` only after `delay` ms have passed without another call (a "debounce").
 *
 * - `call(...args)` schedules the call. Calling again before the delay restarts the wait, so only
 *   the LAST arguments are used. With a delay of 0 (or less) it calls straight away.
 * - `flush()` runs a waiting call right now (used for Enter, and when the popup closes).
 * - `cancel()` throws a waiting call away (used when the value was changed from outside).
 * - A call that is still waiting when the component unmounts is flushed, so no input is lost.
 * `fn` may change on every render: the newest one is always the one that runs.
 */
export function useDebouncedCall<A extends unknown[]>(fn: (...args: A) => void, delay: number) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<A | null>(null);

  const cancel = useCallback(() => {
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = undefined;
    pending.current = null;
  }, []);

  const flush = useCallback(() => {
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = undefined;
    const args = pending.current;
    pending.current = null;
    if (args) fnRef.current(...args);
  }, []);

  const call = useCallback(
    (...args: A) => {
      if (delay <= 0) {
        cancel();
        fnRef.current(...args);
        return;
      }
      pending.current = args;
      if (timer.current !== undefined) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [delay, cancel, flush]
  );

  // Do not lose what the user typed if the popup closes (unmounts) during the wait
  useEffect(() => flush, [flush]);

  return { call, flush, cancel };
}
