/**
 * Tiny localStorage-backed store. Services below are the only thing that
 * touch it, so they can later be swapped for Django REST API calls.
 */
import type { Employee, WageSettings, WorkRecord, WorkRecordAudit, WageType } from "@/types";
import { seedState } from "./seed";

export interface AppState {
  employees: Employee[];
  records: WorkRecord[];
  wageSettings: WageSettings[];
  globalWage: { amount: number; type: WageType };
  audits: WorkRecordAudit[];
}

const KEY = "dwc_state_v1";
let state: AppState | null = null;
const listeners = new Set<() => void>();

function load(): AppState {
  if (state) return state;
  if (typeof window === "undefined") return seedState();
  try {
    const raw = window.localStorage.getItem(KEY);
    state = raw ? (JSON.parse(raw) as AppState) : seedState();
  } catch {
    state = seedState();
  }
  return state;
}

export function getState(): AppState {
  return load();
}

export function setState(updater: (s: AppState) => AppState) {
  state = updater(load());
  if (typeof window !== "undefined") window.localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Simulated network latency so loading states are visible. */
export const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));
