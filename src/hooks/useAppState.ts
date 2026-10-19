import { useEffect, useState, useSyncExternalStore } from "react";
import { getState, subscribe } from "@/services/store";

/** Re-renders when the store changes. `ready` is false during SSR / first paint. */
export function useAppState() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const state = useSyncExternalStore(subscribe, getState, getState);
  return { state, ready };
}
