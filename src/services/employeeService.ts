import type { Employee, WageType } from "@/types";
import { delay, getState, setState } from "./store";
import { uid } from "@/utils/format";

export interface EmployeeInput {
  name: string;
  workProfile?: string | undefined;
  phone?: string | undefined;
  age?: number | undefined;
  wageAmount?: number | undefined; // empty => global
  wageType?: WageType | undefined;
}

export const employeeService = {
  listActive(): Employee[] {
    return getState().employees.filter((e) => e.isActive);
  },
  get(id: string) {
    return getState().employees.find((e) => e.id === id);
  },
  search(q: string) {
    const t = q.trim().toLowerCase();
    return this.listActive().filter((e) => e.name.toLowerCase().includes(t));
  },
  async create(input: EmployeeInput) {
    await delay();
    const g = getState().globalWage;
    const individual = input.wageAmount !== undefined;
    const emp: Employee = {
      id: uid(),
      name: input.name.trim(),
      workProfile: input.workProfile?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      age: input.age,
      wageAmount: individual ? input.wageAmount! : g.amount,
      wageType: individual ? (input.wageType ?? g.type) : g.type,
      wageSource: individual ? "individual" : "global",
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    setState((s) => ({ ...s, employees: [emp, ...s.employees] }));
    return emp;
  },
  async update(id: string, input: EmployeeInput) {
    await delay();
    const g = getState().globalWage;
    setState((s) => ({
      ...s,
      employees: s.employees.map((e) => {
        if (e.id !== id) return e;
        const individual = input.wageAmount !== undefined;
        return {
          ...e,
          name: input.name.trim(),
          workProfile: input.workProfile?.trim() || undefined,
          phone: input.phone?.trim() || undefined,
          age: input.age,
          wageAmount: individual ? input.wageAmount! : g.amount,
          wageType: individual ? (input.wageType ?? e.wageType) : g.type,
          wageSource: individual ? "individual" : "global",
        };
      }),
    }));
  },
  /** Soft delete: keeps historical work records intact. */
  async deactivate(id: string) {
    await delay();
    setState((s) => ({
      ...s,
      employees: s.employees.map((e) => (e.id === id ? { ...e, isActive: false } : e)),
    }));
  },
};
