import type { BackendEmployee, BackendEmployeeWageRate, BackendGlobalWageSetting, WageType } from "@/types";
import { mapBackendEmployeeToEmployee, mapBackendGlobalWageToGlobalWage } from "@/types";
import { apiClient } from "./api";
import { getState, setState } from "./store";
import { todayISO } from "@/utils/format";

function getYesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Wage changes NEVER touch saved work records — each record stores its own snapshot rate. */
export const wageService = {
  /** Return synchronous in-memory global wage */
  getGlobal(): { amount: number; type: WageType } {
    return getState().globalWage;
  },

  /** Fetch current active global wage setting from backend */
  async fetchGlobal(): Promise<{ amount: number; type: WageType }> {
    try {
      const dto = await apiClient.get<BackendGlobalWageSetting>("/api/wages/global/");
      const setting = mapBackendGlobalWageToGlobalWage(dto);
      setState((s) => ({
        ...s,
        globalWage: { amount: setting.wageAmount, type: setting.wageBasis },
      }));
      return { amount: setting.wageAmount, type: setting.wageBasis };
    } catch (err: unknown) {
      // 404 indicates no global wage setting configured yet; return default
      if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 404) {
        return getState().globalWage;
      }
      throw err;
    }
  },

  /** Create or update global default wage */
  async applyGlobal(amount: number, type: WageType): Promise<void> {
    const payload = {
      wage_amount: amount.toFixed(2),
      wage_basis: type,
      effective_from: todayISO(),
    };

    await apiClient.post<BackendGlobalWageSetting>("/api/wages/global/", payload);

    setState((s) => ({
      ...s,
      globalWage: { amount, type },
    }));

    // Refresh employee list so employees relying on global default reflect updated rate
    try {
      const res = await apiClient.get<BackendEmployee[] | { results: BackendEmployee[] }>("/api/employees/");
      const dtos = Array.isArray(res) ? res : (res?.results ?? []);
      const employees = dtos.map(mapBackendEmployeeToEmployee);
      setState((s) => ({
        ...s,
        employees,
      }));
    } catch {
      // Non-fatal if employee refresh fails
    }
  },

  /** Apply individual wage rate override to a specific employee */
  async applyToEmployee(employeeId: string, amount: number, type: WageType): Promise<void> {
    const res = await apiClient.get<BackendEmployeeWageRate[] | { results: BackendEmployeeWageRate[] }>(
      `/api/employees/${employeeId}/wage-rates/`,
    );
    const currentRates = Array.isArray(res) ? res : (res?.results ?? []);
    const activeRate = currentRates.find((r) => !r.effective_to);

    if (activeRate) {
      if (activeRate.effective_from === todayISO()) {
        await apiClient.patch(`/api/wage-rates/${activeRate.id}/`, {
          wage_amount: amount.toFixed(2),
          wage_basis: type,
        });
      } else {
        await apiClient.patch(`/api/wage-rates/${activeRate.id}/`, {
          effective_to: getYesterdayISO(),
        });
        await apiClient.post(`/api/employees/${employeeId}/wage-rates/`, {
          wage_amount: amount.toFixed(2),
          wage_basis: type,
          effective_from: todayISO(),
        });
      }
    } else {
      await apiClient.post(`/api/employees/${employeeId}/wage-rates/`, {
        wage_amount: amount.toFixed(2),
        wage_basis: type,
        effective_from: todayISO(),
      });
    }

    // Re-fetch employee with resolved wage snapshot
    const refreshedDto = await apiClient.get<BackendEmployee>(`/api/employees/${employeeId}/`);
    const emp = mapBackendEmployeeToEmployee(refreshedDto);

    setState((s) => ({
      ...s,
      employees: s.employees.map((e) => (e.id === employeeId ? emp : e)),
    }));
  },
};

