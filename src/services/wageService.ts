import type { WageType } from "@/types";
import { delay, getState, setState } from "./store";
import { todayISO, uid } from "@/utils/format";

/** Wage changes NEVER touch saved work records — each record stores its own rate. */
export const wageService = {
  getGlobal() {
    return getState().globalWage;
  },
  async applyGlobal(amount: number, type: WageType) {
    await delay();
    const now = new Date().toISOString();
    setState((s) => ({
      ...s,
      globalWage: { amount, type },
      wageSettings: [
        ...s.wageSettings,
        { id: uid(), amount, type, scope: "global", effectiveFrom: todayISO(), createdAt: now },
      ],
      employees: s.employees.map((e) =>
        e.wageSource === "global" ? { ...e, wageAmount: amount, wageType: type } : e,
      ),
    }));
  },
  async applyToEmployee(employeeId: string, amount: number, type: WageType) {
    await delay();
    const now = new Date().toISOString();
    setState((s) => ({
      ...s,
      wageSettings: [
        ...s.wageSettings,
        { id: uid(), amount, type, scope: "employee", employeeId, effectiveFrom: todayISO(), createdAt: now },
      ],
      employees: s.employees.map((e) =>
        e.id === employeeId ? { ...e, wageAmount: amount, wageType: type, wageSource: "individual" } : e,
      ),
    }));
  },
};
