import type {
  BackendDashboardFinancialSummary,
  BackendEmployee,
  BackendEmployeeBalanceSummary,
  BackendEmployeeWageRate,
  DashboardFinancialSummary,
  Employee,
  EmployeeBalanceSummary,
  WageType,
} from "@/types";
import {
  mapBackendBalanceSummaryToEmployeeBalanceSummary,
  mapBackendDashboardSummaryToDashboardSummary,
  mapBackendEmployeeToEmployee,
} from "@/types";
import { apiClient } from "./api";
import { getState, setState } from "./store";
import { todayISO } from "@/utils/format";

export interface EmployeeInput {
  name: string;
  workProfile?: string | undefined;
  phone?: string | undefined;
  age?: number | undefined;
  wageAmount?: number | undefined; // empty => global
  wageType?: WageType | undefined;
}

function getYesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export const employeeService = {
  /** Synchronous accessor for in-memory active employees */
  listActive(): Employee[] {
    return getState().employees.filter((e) => e.isActive);
  },

  /** Synchronous accessor for all in-memory employees (active and inactive) */
  listAllSync(): Employee[] {
    return getState().employees;
  },

  /** Synchronous accessor for an employee in store */
  getSync(id: string): Employee | undefined {
    return getState().employees.find((e) => e.id === id);
  },

  /** Synchronous search against active employees in store */
  search(q: string): Employee[] {
    const t = q.trim().toLowerCase();
    return this.listActive().filter((e) => e.name.toLowerCase().includes(t));
  },

  /** Fetch active or all employees from backend API */
  async fetchAll(isActive?: boolean): Promise<Employee[]> {
    const params: Record<string, string | boolean | undefined> = {};
    if (isActive !== undefined) {
      params["is_active"] = isActive;
    }
    const res = await apiClient.get<BackendEmployee[] | { results: BackendEmployee[] }>(
      "/api/employees/",
      { params },
    );
    const dtos = Array.isArray(res) ? res : (res?.results ?? []);
    const employees = dtos.map(mapBackendEmployeeToEmployee);
    setState((s) => ({
      ...s,
      employees,
    }));
    return employees;
  },

  /** Fetch single employee details from backend API */
  async get(id: string): Promise<Employee> {
    const dto = await apiClient.get<BackendEmployee>(`/api/employees/${id}/`);
    const emp = mapBackendEmployeeToEmployee(dto);
    const existing = getState().employees.find((e) => e.id === id);
    if (existing?.workProfile) {
      emp.workProfile = existing.workProfile;
    }
    setState((s) => ({
      ...s,
      employees: s.employees.some((e) => e.id === id)
        ? s.employees.map((e) => (e.id === id ? emp : e))
        : [...s.employees, emp],
    }));
    return emp;
  },

  /** Register new employee with optional individual wage override */
  async create(input: EmployeeInput): Promise<Employee> {
    const cleanPhone = input.phone?.trim() ? input.phone.trim().replace(/[\s-]/g, "") : null;
    if (cleanPhone) {
      const existing = getState().employees.find(
        (e) => e.phone && e.phone.trim().replace(/[\s-]/g, "") === cleanPhone,
      );
      if (existing) {
        throw new Error(
          `An employee with phone number '${input.phone?.trim()}' already exists (${existing.name}). Please update their existing profile instead of creating a duplicate.`,
        );
      }
    }

    const payload = {
      name: input.name.trim(),
      phone_number: input.phone?.trim() || null,
      age: input.age ?? null,
    };

    const createdDto = await apiClient.post<BackendEmployee>("/api/employees/", payload);
    let finalDto = createdDto;

    // If individual wage amount was provided, configure wage override
    if (input.wageAmount !== undefined && input.wageAmount > 0) {
      const wagePayload = {
        wage_amount: input.wageAmount.toFixed(2),
        wage_basis: input.wageType || "daily",
        effective_from: todayISO(),
      };
      await apiClient.post(`/api/employees/${createdDto.id}/wage-rates/`, wagePayload);
      // Re-fetch employee with resolved wage snapshot
      finalDto = await apiClient.get<BackendEmployee>(`/api/employees/${createdDto.id}/`);
    }

    const emp = mapBackendEmployeeToEmployee(finalDto);
    if (input.workProfile?.trim()) {
      emp.workProfile = input.workProfile.trim();
    }

    setState((s) => ({
      ...s,
      employees: [emp, ...s.employees.filter((e) => e.id !== emp.id)],
    }));

    return emp;
  },

  /** Update existing employee profile and wage override */
  async update(id: string, input: EmployeeInput): Promise<Employee> {
    const payload = {
      name: input.name.trim(),
      phone_number: input.phone?.trim() || null,
      age: input.age ?? null,
    };

    await apiClient.patch<BackendEmployee>(`/api/employees/${id}/`, payload);

    if (input.wageAmount !== undefined && input.wageAmount > 0) {
      const currentRates = await apiClient.get<BackendEmployeeWageRate[]>(
        `/api/employees/${id}/wage-rates/`,
      );
      const activeRate = currentRates.find((r) => !r.effective_to);

      if (activeRate) {
        if (activeRate.effective_from === todayISO()) {
          // Update rate starting today directly
          await apiClient.patch(`/api/wage-rates/${activeRate.id}/`, {
            wage_amount: input.wageAmount.toFixed(2),
            wage_basis: input.wageType || "daily",
          });
        } else {
          // Close previous open-ended rate as of yesterday to avoid overlap
          await apiClient.patch(`/api/wage-rates/${activeRate.id}/`, {
            effective_to: getYesterdayISO(),
          });
          await apiClient.post(`/api/employees/${id}/wage-rates/`, {
            wage_amount: input.wageAmount.toFixed(2),
            wage_basis: input.wageType || "daily",
            effective_from: todayISO(),
          });
        }
      } else {
        await apiClient.post(`/api/employees/${id}/wage-rates/`, {
          wage_amount: input.wageAmount.toFixed(2),
          wage_basis: input.wageType || "daily",
          effective_from: todayISO(),
        });
      }
    }

    const refreshedDto = await apiClient.get<BackendEmployee>(`/api/employees/${id}/`);
    const emp = mapBackendEmployeeToEmployee(refreshedDto);
    if (input.workProfile?.trim()) {
      emp.workProfile = input.workProfile.trim();
    }

    setState((s) => ({
      ...s,
      employees: s.employees.map((e) => (e.id === id ? emp : e)),
    }));

    return emp;
  },

  /** Deactivate employee (soft delete keeping historical work records intact) */
  async deactivate(id: string): Promise<void> {
    await apiClient.post<BackendEmployee>(`/api/employees/${id}/deactivate/`);
    setState((s) => ({
      ...s,
      employees: s.employees.map((e) => (e.id === id ? { ...e, isActive: false } : e)),
    }));
  },

  /** Reactivate an inactive employee */
  async activate(id: string): Promise<void> {
    await apiClient.post<BackendEmployee>(`/api/employees/${id}/activate/`);
    setState((s) => ({
      ...s,
      employees: s.employees.map((e) => (e.id === id ? { ...e, isActive: true } : e)),
    }));
  },

  /** Fetch individual employee financial balance summary */
  async getBalanceSummary(id: string | number): Promise<EmployeeBalanceSummary> {
    const dto = await apiClient.get<BackendEmployeeBalanceSummary>(
      `/api/employees/${id}/balance_summary/`,
    );
    return mapBackendBalanceSummaryToEmployeeBalanceSummary(dto);
  },

  /** Fetch aggregate organization-wide financial summary for dashboard */
  async getFinancialSummary(): Promise<DashboardFinancialSummary> {
    const dto = await apiClient.get<BackendDashboardFinancialSummary>(
      "/api/employees/financial_summary/",
    );
    return mapBackendDashboardSummaryToDashboardSummary(dto);
  },

  /**
   * Fetch balance summaries for all employees (both active and inactive)
   * mapped by employee ID using backend balance summary API as single source of truth.
   */
  async fetchAllBalances(employees?: Employee[]): Promise<Record<string, EmployeeBalanceSummary>> {
    const list = employees ?? (await this.fetchAll());
    const entries = await Promise.all(
      list.map(async (e) => {
        try {
          const summary = await this.getBalanceSummary(e.id);
          return [String(e.id), summary] as const;
        } catch {
          return null;
        }
      }),
    );
    const map: Record<string, EmployeeBalanceSummary> = {};
    for (const entry of entries) {
      if (entry) {
        map[entry[0]] = entry[1];
      }
    }
    return map;
  },

  /**
   * Fetch balance summaries for all employees (both active and inactive)
   * and filter for those with an outstanding balance > 0.
   */
  async fetchPendingPayments(employees?: Employee[]): Promise<EmployeeBalanceSummary[]> {
    const balances = await this.fetchAllBalances(employees);
    return Object.values(balances).filter((s) => s.outstandingBalance > 0);
  },
};


