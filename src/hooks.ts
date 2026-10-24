import { useCallback, useState } from "react";
import { readStored, writeStored } from "./storage";

/** localStorage 에 보관되는 상태. 사용자가 바꿀 때만 저장한다 */
export function useStoredState<T>(key: string, initial: T | (() => T)) {
  const [value, setValue] = useState<T>(() => readStored(key, typeof initial === "function" ? (initial as () => T)() : initial));
  const update = useCallback(
    (next: T | ((prev: T) => T)) =>
      setValue((prev) => {
        const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        writeStored(key, v);
        return v;
      }),
    [key],
  );
  return [value, update] as const;
}
