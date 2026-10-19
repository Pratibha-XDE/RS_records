export type WageType = "hourly" | "daily" | "monthly";
export type PaymentStatus = "paid" | "not_paid";

export interface Employee {
  id: string;
  name: string;
  workProfile?: string | undefined;
  phone?: string | undefined;
  age?: number | undefined;
  wageAmount: number;
  wageType: WageType;
  wageSource: "global" | "individual";
  isActive: boolean;
  createdAt: string;
}

export interface WageSettings {
  id: string;
  amount: number;
  type: WageType;
  scope: "global" | "employee";
  employeeId?: string | undefined;
  effectiveFrom: string;
  createdAt: string;
}

export interface WorkRecord {
  id: string;
  employeeId: string;
  workDate: string; // YYYY-MM-DD
  hoursWorked: number;
  minutesWorked: number;
  wageType: WageType;
  wageRateUsed: number;
  calculatedEarnings: number;
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}

/** Frontend-only correction log; final audit trail will live server-side. */
export interface WorkRecordAudit {
  id: string;
  recordId: string;
  previous: WorkRecord;
  changedAt: string;
}
