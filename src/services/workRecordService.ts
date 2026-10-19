import type { PaymentStatus, WageType, WorkRecord } from "@/types";
import { delay, getState, setState } from "./store";
import { uid } from "@/utils/format";
import { calculateEarnings } from "@/utils/wageCalculator";

export interface WorkInput {
  employeeId: string;
  workDate: string;
  hoursWorked: number;
  minutesWorked: number;
  wageType: WageType;
  wageRateUsed: number;
  paymentStatus: PaymentStatus;
}

export const workRecordService = {
  listForEmployee(employeeId: string, from?: string, to?: string) {
    return getState()
      .records.filter((r) => r.employeeId === employeeId)
      .filter((r) => (!from || r.workDate >= from) && (!to || r.workDate <= to))
      .sort((a, b) => b.workDate.localeCompare(a.workDate));
  },
  findByDate(employeeId: string, workDate: string) {
    return getState().records.find((r) => r.employeeId === employeeId && r.workDate === workDate);
  },
  async create(input: WorkInput): Promise<WorkRecord> {
    await delay();
    if (this.findByDate(input.employeeId, input.workDate)) throw new Error("DUPLICATE");
    const now = new Date().toISOString();
    const rec: WorkRecord = {
      id: uid(),
      ...input,
      calculatedEarnings: calculateEarnings({
        wageType: input.wageType,
        rate: input.wageRateUsed,
        hours: input.hoursWorked,
        minutes: input.minutesWorked,
      }),
      createdAt: now,
      updatedAt: now,
    };
    setState((s) => ({ ...s, records: [...s.records, rec] }));
    return rec;
  },
  async update(id: string, input: WorkInput) {
    await delay();
    const prev = getState().records.find((r) => r.id === id);
    if (!prev) throw new Error("NOT_FOUND");
    const clash = this.findByDate(input.employeeId, input.workDate);
    if (clash && clash.id !== id) throw new Error("DUPLICATE");
    const now = new Date().toISOString();
    setState((s) => ({
      ...s,
      audits: [...s.audits, { id: uid(), recordId: id, previous: prev, changedAt: now }],
      records: s.records.map((r) =>
        r.id === id
          ? {
              ...r,
              ...input,
              calculatedEarnings: calculateEarnings({
                wageType: input.wageType,
                rate: input.wageRateUsed,
                hours: input.hoursWorked,
                minutes: input.minutesWorked,
              }),
              updatedAt: now,
            }
          : r,
      ),
    }));
  },
  correctionCount(recordId: string) {
    return getState().audits.filter((a) => a.recordId === recordId).length;
  },
};
