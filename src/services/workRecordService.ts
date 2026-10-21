import type { BackendDailyWorkRecord, PaymentStatus, WageType, WorkRecord } from "@/types";
import { mapBackendWorkRecordToWorkRecord } from "@/types";
import { apiClient, ApiError } from "./api";
import { getState, setState } from "./store";

export interface WorkInput {
  employeeId: string;
  workDate: string;
  hoursWorked: number;
  minutesWorked: number;
  wageType: WageType;
  wageRateUsed: number;
  paymentStatus: PaymentStatus;
  baseAmount?: number | undefined;
  extraPay?: number | undefined;
  notes?: string | undefined;
}

export const workRecordService = {
  /** Fetch work records for a specific employee from backend API */
  async listForEmployee(employeeId: string, from?: string, to?: string): Promise<WorkRecord[]> {
    const params: Record<string, string | number | undefined> = {
      employee: employeeId,
    };
    if (from) params["start_date"] = from;
    if (to) params["end_date"] = to;

    let dtos: BackendDailyWorkRecord[] = [];
    let nextUrl: string | null = "/api/work-records/";
    let currentParams: Record<string, string | number | undefined> | undefined = params;

    while (nextUrl) {
      type WorkRecordApiResponse = BackendDailyWorkRecord[] | { count?: number; results: BackendDailyWorkRecord[]; next?: string | null };
      const res: WorkRecordApiResponse = await apiClient.get<WorkRecordApiResponse>(
        nextUrl,
        currentParams ? { params: currentParams } : undefined,
      );

      if (Array.isArray(res)) {
        dtos = res;
        break;
      }
      dtos = dtos.concat(res?.results ?? []);
      if (res?.next) {
        try {
          const parsed: URL = new URL(res.next, "http://localhost");
          nextUrl = parsed.pathname + parsed.search;
          currentParams = undefined;
        } catch {
          nextUrl = null;
        }
      } else {
        nextUrl = null;
      }
    }

    const records = dtos
      .map(mapBackendWorkRecordToWorkRecord)
      .sort((a, b) => b.workDate.localeCompare(a.workDate));

    setState((s) => {
      const otherRecords = s.records.filter((r) => r.employeeId !== employeeId);
      return {
        ...s,
        records: [...records, ...otherRecords],
      };
    });

    return records;
  },

  /** Synchronous accessor from in-memory store */
  listForEmployeeSync(employeeId: string, from?: string, to?: string): WorkRecord[] {
    return getState()
      .records.filter((r) => r.employeeId === employeeId)
      .filter((r) => (!from || r.workDate >= from) && (!to || r.workDate <= to))
      .sort((a, b) => b.workDate.localeCompare(a.workDate));
  },

  /** Check if a record already exists for an employee on a work date */
  async findByDate(employeeId: string, workDate: string): Promise<WorkRecord | null> {
    try {
      const res = await apiClient.get<BackendDailyWorkRecord[] | { results: BackendDailyWorkRecord[] }>(
        "/api/work-records/",
        {
          params: { employee: employeeId, work_date: workDate },
        },
      );
      const dtos = Array.isArray(res) ? res : (res?.results ?? []);
      if (dtos && dtos.length > 0 && dtos[0]) {
        return mapBackendWorkRecordToWorkRecord(dtos[0]);
      }
      return null;
    } catch {
      return this.findByDateSync(employeeId, workDate) ?? null;
    }
  },

  /** Synchronous check from in-memory store */
  findByDateSync(employeeId: string, workDate: string): WorkRecord | undefined {
    return getState().records.find(
      (r) => r.employeeId === employeeId && r.workDate === workDate,
    );
  },

  /** Create daily work record in backend and handle initial disbursement if paid */
  async create(input: WorkInput): Promise<WorkRecord> {
    const emp = getState().employees.find((e) => e.id === input.employeeId);
    if (emp && !emp.isActive) {
      throw new Error(`Employee '${emp.name}' is inactive. Cannot create new work records.`);
    }

    const payload: Record<string, unknown> = {
      employee: Number(input.employeeId),
      work_date: input.workDate,
      hours_worked: input.hoursWorked,
      minutes_worked: input.minutesWorked,
    };

    // For daily and monthly wages, regular earnings are manually entered
    if (input.wageType === "daily" || input.wageType === "monthly") {
      const manualBase = input.baseAmount !== undefined ? input.baseAmount : input.wageRateUsed;
      payload["base_amount"] = Number(manualBase).toFixed(2);
    }

    if (input.extraPay !== undefined && input.extraPay > 0) {
      payload["extra_pay"] = Number(input.extraPay).toFixed(2);
    }

    if (input.notes !== undefined) {
      payload["notes"] = input.notes || null;
    }

    let createdDto: BackendDailyWorkRecord;
    try {
      createdDto = await apiClient.post<BackendDailyWorkRecord>("/api/work-records/", payload);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const msg = err.message.toLowerCase();
        const dataStr = JSON.stringify(err.data || "").toLowerCase();
        if (msg.includes("already exists") || dataStr.includes("already exists")) {
          throw new Error("DUPLICATE");
        }
      }
      throw err;
    }

    // If marked as paid, disburse payment immediately
    if (input.paymentStatus === "paid") {
      const totalEarnings = parseFloat(createdDto.total_earnings) || 0;
      if (totalEarnings > 0) {
        try {
          await apiClient.post("/api/payments/", {
            work_record: createdDto.id,
            amount: createdDto.total_earnings,
            payment_date: input.workDate,
            payment_method: "Cash",
            notes: "Disbursed upon entry",
          });

          // Re-fetch record to acquire server-computed payment_status and balance_due
          createdDto = await apiClient.get<BackendDailyWorkRecord>(
            `/api/work-records/${createdDto.id}/`,
          );
        } catch (paymentErr) {
          // If payment was already recorded or duplicate, re-fetch latest state
          createdDto = await apiClient.get<BackendDailyWorkRecord>(
            `/api/work-records/${createdDto.id}/`,
          );
        }
      }
    }

    const rec = mapBackendWorkRecordToWorkRecord(createdDto);
    setState((s) => ({
      ...s,
      records: [rec, ...s.records.filter((r) => r.id !== rec.id)],
    }));

    return rec;
  },

  /** Update an existing daily work record */
  async update(id: string, input: WorkInput): Promise<WorkRecord> {
    const existingRecord = getState().records.find((r) => r.id === id);
    const wasAlreadyPaid = existingRecord?.paymentStatus === "paid";

    const payload: Record<string, unknown> = {
      hours_worked: input.hoursWorked,
      minutes_worked: input.minutesWorked,
    };

    if (input.wageType === "daily" || input.wageType === "monthly") {
      const manualBase = input.baseAmount !== undefined ? input.baseAmount : input.wageRateUsed;
      payload["base_amount"] = Number(manualBase).toFixed(2);
    }

    if (input.extraPay !== undefined) {
      payload["extra_pay"] = Number(input.extraPay).toFixed(2);
    }

    if (input.notes !== undefined) {
      payload["notes"] = input.notes || null;
    }

    let updatedDto: BackendDailyWorkRecord;
    try {
      updatedDto = await apiClient.patch<BackendDailyWorkRecord>(
        `/api/work-records/${id}/`,
        payload,
      );
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const msg = err.message.toLowerCase();
        const dataStr = JSON.stringify(err.data || "").toLowerCase();
        if (msg.includes("already exists") || dataStr.includes("already exists")) {
          throw new Error("DUPLICATE");
        }
      }
      throw err;
    }

    // Only disburse remaining balance if user explicitly transitioned paymentStatus to 'paid' from unpaid/partial,
    // to strictly prevent duplicate payment records caused by editing work hours or notes.
    if (input.paymentStatus === "paid" && !wasAlreadyPaid) {
      const balanceDue = parseFloat(updatedDto.balance_due) || 0;
      if (balanceDue > 0) {
        try {
          await apiClient.post("/api/payments/", {
            work_record: updatedDto.id,
            amount: updatedDto.balance_due,
            payment_date: input.workDate,
            payment_method: "Cash",
            notes: "Disbursed on record update",
          });

          updatedDto = await apiClient.get<BackendDailyWorkRecord>(`/api/work-records/${id}/`);
        } catch {
          // If payment disbursement fails or was already processed, retrieve current state
          updatedDto = await apiClient.get<BackendDailyWorkRecord>(`/api/work-records/${id}/`);
        }
      }
    }


    const rec = mapBackendWorkRecordToWorkRecord(updatedDto);
    setState((s) => ({
      ...s,
      records: s.records.map((r) => (r.id === id ? rec : r)),
    }));

    return rec;
  },

  /** Return number of corrections for this record */
  correctionCount(recordId: string): number {
    return getState().audits.filter((a) => a.recordId === recordId).length;
  },
};

