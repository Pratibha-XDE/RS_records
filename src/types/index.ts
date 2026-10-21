/**
 * TypeScript model definitions aligning frontend types with Django REST Framework backend serializers.
 */

// ==========================================
// Wage and Payment Status Types
// ==========================================

/**
 * Active wage bases supported across backend business logic, database, and UI.
 * Supports 'hourly', 'daily', and 'monthly'.
 */
export type WageBasis = "hourly" | "daily" | "monthly";
export type ActiveWageBasis = WageBasis;

/**
 * WageType alias representing the supported wage bases.
 */
export type WageType = WageBasis;

/**
 * Payment statuses supported across backend serializers and earnings summaries.
 */
export type PaymentStatus = "not_paid" | "partially_paid" | "paid";

// ==========================================
// Backend DRF Schema Definitions (snake_case)
// ==========================================

export interface BackendUser {
  id: number;
  username: string;
  email: string;
  is_staff: boolean;
  is_superuser: boolean;
}

export interface DjangoLoginResponse {
  token: string;
  user: BackendUser;
}

export interface BackendEmployee {
  id: number;
  name: string;
  phone_number: string | null;
  age: number | null;
  is_active: boolean;
  applicable_wage_rate: string | null;
  applicable_wage_basis: WageBasis | null;
  created_at: string;
  updated_at: string;
}

export interface BackendEmployeeBalanceSummary {
  employee_id: number;
  employee_name: string;
  is_active: boolean;
  total_earnings: string;
  total_paid: string;
  outstanding_balance: string;
  work_record_count: number;
  unpaid_record_count: number;
  partially_paid_record_count: number;
  paid_record_count: number;
}

export interface BackendDashboardFinancialSummary {
  total_employees: number;
  active_employees: number;
  inactive_employees: number;
  total_earnings: string;
  total_paid: string;
  outstanding_balance: string;
  work_record_count: number;
  unpaid_record_count: number;
  partially_paid_record_count: number;
  paid_record_count: number;
}


export interface BackendDailyWorkRecord {
  id: number;
  employee: number;
  employee_name: string;
  work_date: string;
  hours_worked: number;
  minutes_worked: number;
  wage_rate: string;
  wage_basis: WageBasis;
  base_amount: string;
  overtime_minutes: number;
  overtime_amount: string;
  extra_pay: string;
  total_earnings: string;
  total_paid: string;
  balance_due: string;
  payment_status: PaymentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BackendPayment {
  id: number;
  work_record: number;
  employee_name: string;
  work_date: string;
  amount: string;
  payment_date: string;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
}

export interface BackendEmployeeWageRate {
  id: number;
  employee: number;
  employee_name: string;
  wage_amount: string;
  wage_basis: WageBasis;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
}

export interface BackendGlobalWageSetting {
  id: number;
  wage_amount: string;
  wage_basis: WageBasis;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
}

// ==========================================
// Frontend Domain / UI Types (camelCase)
// ==========================================

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  isStaff: boolean;
  isSuperuser: boolean;
}

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
  updatedAt?: string | undefined;
}

export interface EmployeeBalanceSummary {
  employeeId: number;
  employeeName: string;
  isActive: boolean;
  totalEarnings: number;
  totalPaid: number;
  outstandingBalance: number;
  workRecordCount: number;
  unpaidRecordCount: number;
  partiallyPaidRecordCount: number;
  paidRecordCount: number;
}

export interface DashboardFinancialSummary {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  totalEarnings: number;
  totalPaid: number;
  outstandingBalance: number;
  workRecordCount: number;
  unpaidRecordCount: number;
  partiallyPaidRecordCount: number;
  paidRecordCount: number;
}

export interface PaymentInput {
  workRecordId: number | string;
  amount: number;
  paymentDate: string;
  paymentMethod?: string | undefined;
  notes?: string | undefined;
}

export interface Payment {
  id: string;
  workRecordId: number;
  employeeName: string;
  workDate: string;
  amount: number;
  paymentDate: string;
  paymentMethod?: string | undefined;
  notes?: string | undefined;
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
  employeeName?: string | undefined;
  baseAmount?: number | undefined;
  overtimeMinutes?: number | undefined;
  overtimeAmount?: number | undefined;
  extraPay?: number | undefined;
  totalPaid?: number | undefined;
  balanceDue?: number | undefined;
  notes?: string | undefined;
}

export interface EmployeeWageRate {
  id: string;
  employeeId: number;
  employeeName: string;
  wageAmount: number;
  wageBasis: WageBasis;
  effectiveFrom: string;
  effectiveTo?: string | undefined;
  createdAt: string;
}

export interface GlobalWageSetting {
  id: string;
  wageAmount: number;
  wageBasis: WageBasis;
  effectiveFrom: string;
  effectiveTo?: string | undefined;
  createdAt: string;
}

/** Existing UI settings type preserved for mock store compatibility */
export interface WageSettings {
  id: string;
  amount: number;
  type: WageType;
  scope: "global" | "employee";
  employeeId?: string | undefined;
  effectiveFrom: string;
  createdAt: string;
}

/** Frontend-only correction log; final audit trail will live server-side. */
export interface WorkRecordAudit {
  id: string;
  recordId: string;
  previous: WorkRecord;
  changedAt: string;
}

// ==========================================
// Explicit Mapping Functions (Backend <-> Frontend)
// ==========================================

export function mapDjangoUserToAuthUser(dto: BackendUser): AuthUser {
  return {
    id: dto.id,
    username: dto.username,
    email: dto.email,
    isStaff: dto.is_staff,
    isSuperuser: dto.is_superuser,
  };
}

export function mapBackendEmployeeToEmployee(dto: BackendEmployee): Employee {
  const wageAmount = dto.applicable_wage_rate ? parseFloat(dto.applicable_wage_rate) : 0;
  const wageType: WageBasis = dto.applicable_wage_basis ?? "daily";

  return {
    id: String(dto.id),
    name: dto.name,
    phone: dto.phone_number ?? undefined,
    age: dto.age ?? undefined,
    wageAmount: isNaN(wageAmount) ? 0 : wageAmount,
    wageType,
    wageSource: "individual",
    isActive: dto.is_active,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export function mapEmployeeToBackendEmployee(
  employee: Partial<Employee>,
): Partial<BackendEmployee> {
  const result: Partial<BackendEmployee> = {};
  if (employee.id !== undefined && !isNaN(Number(employee.id))) {
    result.id = Number(employee.id);
  }
  if (employee.name !== undefined) {
    result.name = employee.name.trim();
  }
  if (employee.phone !== undefined) {
    result.phone_number = employee.phone.trim() || null;
  }
  if (employee.age !== undefined) {
    result.age = employee.age ?? null;
  }
  if (employee.isActive !== undefined) {
    result.is_active = employee.isActive;
  }
  return result;
}

export function mapBackendBalanceSummaryToEmployeeBalanceSummary(
  dto: BackendEmployeeBalanceSummary,
): EmployeeBalanceSummary {
  return {
    employeeId: dto.employee_id,
    employeeName: dto.employee_name,
    isActive: dto.is_active,
    totalEarnings: parseFloat(dto.total_earnings) || 0,
    totalPaid: parseFloat(dto.total_paid) || 0,
    outstandingBalance: parseFloat(dto.outstanding_balance) || 0,
    workRecordCount: dto.work_record_count,
    unpaidRecordCount: dto.unpaid_record_count,
    partiallyPaidRecordCount: dto.partially_paid_record_count,
    paidRecordCount: dto.paid_record_count,
  };
}

export function mapBackendDashboardSummaryToDashboardSummary(
  dto: BackendDashboardFinancialSummary,
): DashboardFinancialSummary {
  return {
    totalEmployees: dto.total_employees,
    activeEmployees: dto.active_employees,
    inactiveEmployees: dto.inactive_employees,
    totalEarnings: parseFloat(dto.total_earnings) || 0,
    totalPaid: parseFloat(dto.total_paid) || 0,
    outstandingBalance: parseFloat(dto.outstanding_balance) || 0,
    workRecordCount: dto.work_record_count,
    unpaidRecordCount: dto.unpaid_record_count,
    partiallyPaidRecordCount: dto.partially_paid_record_count,
    paidRecordCount: dto.paid_record_count,
  };
}


export function mapBackendPaymentToPayment(dto: BackendPayment): Payment {
  return {
    id: String(dto.id),
    workRecordId: dto.work_record,
    employeeName: dto.employee_name,
    workDate: dto.work_date,
    amount: parseFloat(dto.amount) || 0,
    paymentDate: dto.payment_date,
    paymentMethod: dto.payment_method ?? undefined,
    notes: dto.notes ?? undefined,
    createdAt: dto.created_at,
  };
}

export function mapPaymentToBackendPayment(payment: Partial<Payment>): Partial<BackendPayment> {
  const result: Partial<BackendPayment> = {};
  if (payment.id !== undefined && !isNaN(Number(payment.id))) {
    result.id = Number(payment.id);
  }
  if (payment.workRecordId !== undefined) {
    result.work_record = payment.workRecordId;
  }
  if (payment.amount !== undefined) {
    result.amount = payment.amount.toFixed(2);
  }
  if (payment.paymentDate !== undefined) {
    result.payment_date = payment.paymentDate;
  }
  if (payment.paymentMethod !== undefined) {
    result.payment_method = payment.paymentMethod ?? null;
  }
  if (payment.notes !== undefined) {
    result.notes = payment.notes ?? null;
  }
  return result;
}

export function mapBackendWorkRecordToWorkRecord(dto: BackendDailyWorkRecord): WorkRecord {
  return {
    id: String(dto.id),
    employeeId: String(dto.employee),
    employeeName: dto.employee_name,
    workDate: dto.work_date,
    hoursWorked: dto.hours_worked,
    minutesWorked: dto.minutes_worked,
    wageType: dto.wage_basis,
    wageRateUsed: parseFloat(dto.wage_rate) || 0,
    baseAmount: parseFloat(dto.base_amount) || 0,
    overtimeMinutes: dto.overtime_minutes,
    overtimeAmount: parseFloat(dto.overtime_amount) || 0,
    extraPay: parseFloat(dto.extra_pay) || 0,
    calculatedEarnings: parseFloat(dto.total_earnings) || 0,
    totalPaid: parseFloat(dto.total_paid) || 0,
    balanceDue: parseFloat(dto.balance_due) || 0,
    paymentStatus: dto.payment_status,
    notes: dto.notes ?? undefined,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export function mapWorkRecordToBackendWorkRecord(
  record: Partial<WorkRecord>,
): Partial<BackendDailyWorkRecord> {
  const result: Partial<BackendDailyWorkRecord> = {};
  if (record.id !== undefined && !isNaN(Number(record.id))) {
    result.id = Number(record.id);
  }
  if (record.employeeId !== undefined && !isNaN(Number(record.employeeId))) {
    result.employee = Number(record.employeeId);
  }
  if (record.workDate !== undefined) {
    result.work_date = record.workDate;
  }
  if (record.hoursWorked !== undefined) {
    result.hours_worked = record.hoursWorked;
  }
  if (record.minutesWorked !== undefined) {
    result.minutes_worked = record.minutesWorked;
  }
  if (record.wageType !== undefined) {
    result.wage_basis = record.wageType;
  }
  if (record.wageRateUsed !== undefined) {
    result.wage_rate = record.wageRateUsed.toFixed(2);
  }
  if (record.baseAmount !== undefined) {
    result.base_amount = record.baseAmount.toFixed(2);
  }
  if (record.overtimeMinutes !== undefined) {
    result.overtime_minutes = record.overtimeMinutes;
  }
  if (record.overtimeAmount !== undefined) {
    result.overtime_amount = record.overtimeAmount.toFixed(2);
  }
  if (record.extraPay !== undefined) {
    result.extra_pay = record.extraPay.toFixed(2);
  }
  if (record.calculatedEarnings !== undefined) {
    result.total_earnings = record.calculatedEarnings.toFixed(2);
  }
  if (record.paymentStatus !== undefined) {
    result.payment_status = record.paymentStatus;
  }
  if (record.notes !== undefined) {
    result.notes = record.notes ?? null;
  }
  return result;
}

export function mapBackendWageRateToWageRate(dto: BackendEmployeeWageRate): EmployeeWageRate {
  return {
    id: String(dto.id),
    employeeId: dto.employee,
    employeeName: dto.employee_name,
    wageAmount: parseFloat(dto.wage_amount) || 0,
    wageBasis: dto.wage_basis,
    effectiveFrom: dto.effective_from,
    effectiveTo: dto.effective_to ?? undefined,
    createdAt: dto.created_at,
  };
}

export function mapBackendGlobalWageToGlobalWage(dto: BackendGlobalWageSetting): GlobalWageSetting {
  return {
    id: String(dto.id),
    wageAmount: parseFloat(dto.wage_amount) || 0,
    wageBasis: dto.wage_basis,
    effectiveFrom: dto.effective_from,
    effectiveTo: dto.effective_to ?? undefined,
    createdAt: dto.created_at,
  };
}
