import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { employeeService } from "@/services/employeeService";
import { paymentService } from "@/services/paymentService";
import { workRecordService } from "@/services/workRecordService";
import { resetState, getState, setState } from "@/services/store";
import { setAuthToken, clearAuthToken } from "@/services/api";
import type {
  BackendDailyWorkRecord,
  BackendEmployee,
  BackendEmployeeBalanceSummary,
  BackendPayment,
} from "@/types";

describe("Pending Payments and Inactive Employees Integration", () => {
  beforeEach(() => {
    localStorage.clear();
    resetState();
    vi.restoreAllMocks();
    setAuthToken("test-admin-token");
  });

  afterEach(() => {
    localStorage.clear();
    resetState();
    clearAuthToken();
    vi.restoreAllMocks();
  });

  // 1. Active employee with outstanding dues
  it("includes active employee with outstanding dues in pending payments", async () => {
    const activeEmpDto: BackendEmployee = {
      id: 1,
      name: "Ramesh Pawar",
      phone_number: "9876543210",
      age: 32,
      is_active: true,
      applicable_wage_rate: "800.00",
      applicable_wage_basis: "daily",
      created_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:00Z",
    };

    const activeBalanceSummary: BackendEmployeeBalanceSummary = {
      employee_id: 1,
      employee_name: "Ramesh Pawar",
      is_active: true,
      total_earnings: "2400.00",
      total_paid: "1000.00",
      outstanding_balance: "1400.00",
      work_record_count: 3,
      unpaid_record_count: 1,
      partially_paid_record_count: 1,
      paid_record_count: 1,
    };

    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("/api/employees/")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => [activeEmpDto],
        };
      }
      if (url.endsWith("/api/employees/1/balance_summary/")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => activeBalanceSummary,
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const pending = await employeeService.fetchPendingPayments();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.employeeName).toBe("Ramesh Pawar");
    expect(pending[0]?.isActive).toBe(true);
    expect(pending[0]?.totalEarnings).toBe(2400);
    expect(pending[0]?.totalPaid).toBe(1000);
    expect(pending[0]?.outstandingBalance).toBe(1400);
  });

  // 2. Inactive employee with outstanding dues
  it("includes inactive employee with outstanding dues in pending payments without hiding them", async () => {
    const inactiveEmpDto: BackendEmployee = {
      id: 2,
      name: "Sunil Shinde",
      phone_number: "9811223344",
      age: 40,
      is_active: false,
      applicable_wage_rate: "1000.00",
      applicable_wage_basis: "daily",
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-10-15T00:00:00Z",
    };

    const inactiveBalanceSummary: BackendEmployeeBalanceSummary = {
      employee_id: 2,
      employee_name: "Sunil Shinde",
      is_active: false,
      total_earnings: "3000.00",
      total_paid: "1000.00",
      outstanding_balance: "2000.00",
      work_record_count: 3,
      unpaid_record_count: 2,
      partially_paid_record_count: 0,
      paid_record_count: 1,
    };

    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("/api/employees/")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => [inactiveEmpDto],
        };
      }
      if (url.endsWith("/api/employees/2/balance_summary/")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => inactiveBalanceSummary,
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const pending = await employeeService.fetchPendingPayments();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.employeeName).toBe("Sunil Shinde");
    expect(pending[0]?.isActive).toBe(false);
    expect(pending[0]?.totalEarnings).toBe(3000);
    expect(pending[0]?.totalPaid).toBe(1000);
    expect(pending[0]?.outstandingBalance).toBe(2000);
  });

  // 3. Inactive employee with zero outstanding balance
  it("excludes inactive employee with zero balance from pending payments while keeping accessible", async () => {
    const settledInactiveEmp: BackendEmployee = {
      id: 3,
      name: "Meena Sharma",
      phone_number: "9899001122",
      age: 30,
      is_active: false,
      applicable_wage_rate: "600.00",
      applicable_wage_basis: "daily",
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-10-10T00:00:00Z",
    };

    const zeroBalanceSummary: BackendEmployeeBalanceSummary = {
      employee_id: 3,
      employee_name: "Meena Sharma",
      is_active: false,
      total_earnings: "1800.00",
      total_paid: "1800.00",
      outstanding_balance: "0.00",
      work_record_count: 3,
      unpaid_record_count: 0,
      partially_paid_record_count: 0,
      paid_record_count: 3,
    };

    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("/api/employees/")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => [settledInactiveEmp],
        };
      }
      if (url.endsWith("/api/employees/3/balance_summary/")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => zeroBalanceSummary,
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    // Verify employee is accessible under all employees
    const allEmployees = await employeeService.fetchAll();
    expect(allEmployees).toHaveLength(1);
    expect(allEmployees[0]?.name).toBe("Meena Sharma");
    expect(allEmployees[0]?.isActive).toBe(false);

    // Verify fetchAllBalances accurately reflects 0 outstanding balance
    const balances = await employeeService.fetchAllBalances();
    expect(balances["3"]?.outstandingBalance).toBe(0);

    // Verify employee is NOT in pending payments (since balance is 0)
    const pending = await employeeService.fetchPendingPayments();
    expect(pending).toHaveLength(0);
  });

  // 4. Partial payment by an inactive employee
  it("allows recording a partial payment for an inactive employee and updates balances", async () => {
    const inactiveEmpDto: BackendEmployee = {
      id: 2,
      name: "Sunil Shinde",
      phone_number: null,
      age: 40,
      is_active: false,
      applicable_wage_rate: "1000.00",
      applicable_wage_basis: "daily",
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-10-15T00:00:00Z",
    };

    const mockPaymentDto: BackendPayment = {
      id: 201,
      work_record: 88,
      employee_name: "Sunil Shinde",
      work_date: "2026-10-10",
      amount: "400.00",
      payment_date: "2026-10-21",
      payment_method: "Cash",
      notes: "Partial payment to inactive worker",
      created_at: "2026-10-21T12:00:00Z",
    };

    const mockUpdatedRecordDto: BackendDailyWorkRecord = {
      id: 88,
      employee: 2,
      employee_name: "Sunil Shinde",
      work_date: "2026-10-10",
      hours_worked: 8,
      minutes_worked: 0,
      wage_rate: "1000.00",
      wage_basis: "daily",
      base_amount: "1000.00",
      overtime_minutes: 0,
      overtime_amount: "0.00",
      extra_pay: "0.00",
      total_earnings: "1000.00",
      total_paid: "400.00",
      balance_due: "600.00",
      payment_status: "partially_paid",
      notes: null,
      created_at: "2026-10-10T18:00:00Z",
      updated_at: "2026-10-21T12:00:00Z",
    };

    const updatedBalanceSummary: BackendEmployeeBalanceSummary = {
      employee_id: 2,
      employee_name: "Sunil Shinde",
      is_active: false,
      total_earnings: "1000.00",
      total_paid: "400.00",
      outstanding_balance: "600.00",
      work_record_count: 1,
      unpaid_record_count: 0,
      partially_paid_record_count: 1,
      paid_record_count: 0,
    };

    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/payments/") && init?.method === "POST") {
        return {
          ok: true,
          status: 201,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => mockPaymentDto,
        };
      }
      if (url.endsWith("/api/work-records/88/")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => mockUpdatedRecordDto,
        };
      }
      if (url.endsWith("/api/employees/")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => [inactiveEmpDto],
        };
      }
      if (url.endsWith("/api/employees/2/balance_summary/")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => updatedBalanceSummary,
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const payment = await paymentService.create({
      workRecordId: 88,
      amount: 400,
      paymentDate: "2026-10-21",
      paymentMethod: "Cash",
      notes: "Partial payment to inactive worker",
    });

    expect(payment.id).toBe("201");
    expect(payment.amount).toBe(400);

    // Verify record in store was updated with partial payment status
    const rec = getState().records.find((r) => r.id === "88");
    expect(rec?.paymentStatus).toBe("partially_paid");
    expect(rec?.totalPaid).toBe(400);
    expect(rec?.balanceDue).toBe(600);

    // Verify still in pending payments with remaining balance of 600
    const pending = await employeeService.fetchPendingPayments();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.outstandingBalance).toBe(600);
  });

  // 5. Full settlement removing the employee from Pending Payments
  it("removes employee from pending payments when fully settled while remaining accessible under inactive", async () => {
    const inactiveEmpDto: BackendEmployee = {
      id: 2,
      name: "Sunil Shinde",
      phone_number: null,
      age: 40,
      is_active: false,
      applicable_wage_rate: "1000.00",
      applicable_wage_basis: "daily",
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-10-15T00:00:00Z",
    };

    const mockPaymentDto: BackendPayment = {
      id: 202,
      work_record: 88,
      employee_name: "Sunil Shinde",
      work_date: "2026-10-10",
      amount: "600.00",
      payment_date: "2026-10-21",
      payment_method: "Bank Transfer",
      notes: "Settling final balance",
      created_at: "2026-10-21T13:00:00Z",
    };

    const mockSettledRecordDto: BackendDailyWorkRecord = {
      id: 88,
      employee: 2,
      employee_name: "Sunil Shinde",
      work_date: "2026-10-10",
      hours_worked: 8,
      minutes_worked: 0,
      wage_rate: "1000.00",
      wage_basis: "daily",
      base_amount: "1000.00",
      overtime_minutes: 0,
      overtime_amount: "0.00",
      extra_pay: "0.00",
      total_earnings: "1000.00",
      total_paid: "1000.00",
      balance_due: "0.00",
      payment_status: "paid",
      notes: null,
      created_at: "2026-10-10T18:00:00Z",
      updated_at: "2026-10-21T13:00:00Z",
    };

    const settledBalanceSummary: BackendEmployeeBalanceSummary = {
      employee_id: 2,
      employee_name: "Sunil Shinde",
      is_active: false,
      total_earnings: "1000.00",
      total_paid: "1000.00",
      outstanding_balance: "0.00",
      work_record_count: 1,
      unpaid_record_count: 0,
      partially_paid_record_count: 0,
      paid_record_count: 1,
    };

    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/payments/") && init?.method === "POST") {
        return {
          ok: true,
          status: 201,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => mockPaymentDto,
        };
      }
      if (url.endsWith("/api/work-records/88/")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => mockSettledRecordDto,
        };
      }
      if (url.endsWith("/api/employees/")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => [inactiveEmpDto],
        };
      }
      if (url.endsWith("/api/employees/2/balance_summary/")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => settledBalanceSummary,
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await paymentService.create({
      workRecordId: 88,
      amount: 600,
      paymentDate: "2026-10-21",
      paymentMethod: "Bank Transfer",
      notes: "Settling final balance",
    });

    // Record is marked as paid
    const rec = getState().records.find((r) => r.id === "88");
    expect(rec?.paymentStatus).toBe("paid");
    expect(rec?.balanceDue).toBe(0);

    // Employee must be REMOVED from pending payments
    const pending = await employeeService.fetchPendingPayments();
    expect(pending).toHaveLength(0);

    // Inactive employee remains accessible in employee list
    const all = await employeeService.fetchAll();
    expect(all).toHaveLength(1);
    expect(all[0]?.name).toBe("Sunil Shinde");
    expect(all[0]?.isActive).toBe(false);

    // Balance is 0
    const balances = await employeeService.fetchAllBalances();
    expect(balances["2"]?.outstandingBalance).toBe(0);
  });

  // 6. Prevention of new work records for inactive employees
  it("prevents creating new work records for inactive employees without reactivation", async () => {
    // Inactive employee in state
    setState((s) => ({
      ...s,
      employees: [
        {
          id: "2",
          name: "Sunil Shinde",
          wageAmount: 1000,
          wageType: "daily",
          wageSource: "individual",
          isActive: false,
          createdAt: "2026-09-01T00:00:00Z",
        },
      ],
    }));

    await expect(
      workRecordService.create({
        employeeId: "2",
        workDate: "2026-10-21",
        hoursWorked: 8,
        minutesWorked: 0,
        wageType: "daily",
        wageRateUsed: 1000,
        paymentStatus: "not_paid",
      }),
    ).rejects.toThrow("Employee 'Sunil Shinde' is inactive. Cannot create new work records.");
  });
});
