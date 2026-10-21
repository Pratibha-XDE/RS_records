/**
 * Reactive application store for in-memory cache of backend entities.
 * Operational data is populated through real Django REST Framework API requests.
 */
import type { Employee, WageSettings, WorkRecord, WorkRecordAudit, WageType } from "@/types";

export interface AppState {
  employees: Employee[];
  records: WorkRecord[];
  wageSettings: WageSettings[];
  globalWage: { amount: number; type: WageType };
  audits: WorkRecordAudit[];
}

export function createInitialState(): AppState {
  return {
    employees: [],
    records: [],
    wageSettings: [],
    globalWage: { amount: 0, type: "daily" },
    audits: [],
  };
}

let state: AppState = createInitialState();
const listeners = new Set<() => void>();

export function getState(): AppState {
  return state;
}

export function setState(updater: (s: AppState) => AppState) {
  state = updater(state);
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function resetState(): void {
  state = createInitialState();
  listeners.forEach((l) => l());
}

