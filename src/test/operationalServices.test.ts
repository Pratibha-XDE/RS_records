import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { employeeService } from "@/services/employeeService";
import { wageService } from "@/services/wageService";
import { workRecordService } from "@/services/workRecordService";
import { resetState, getState, setState } from "@/services/store";
import { setAuthToken, clearAuthToken, ApiError } from "@/services/api";
import type {
  BackendDailyWorkRecord,
  BackendEmployee,
  BackendEmployeeWageRate,
  BackendGlobalWageSetting,
  BackendPayment,
} from "@/types";

describe("Phase 1 Operational Services Integration", () => {
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

  // ==========================================
  // Employee Service Tests
  // ==========================================
  describe("employeeService", () => {
    it("fetchAll fetches active employees from /api/employees/ and updates store", async () => {
      const mockBackendEmployees: BackendEmployee[] = [
        {
          id: 1,
          name: "Ramesh Pawar",
          phone_number: "9876543210",
          age: 35,
          is_active: true,
          applicable_wage_rate: "500.00",
          applicable_wage_basis: "daily",
          created_at: "2026-10-01T00:00:00Z",
          updated_at: "2026-10-01T00:00:00Z",
        },
        {
          id: 2,
          name: "Sunil Shinde",
          phone_number: null,
          age: null,
          is_active: false,
          applicable_wage_rate: "100.00",
          applicable_wage_basis: "hourly",
          created_at: "2026-10-02T00:00:00Z",
          updated_at: "2026-10-02T00:00:00Z",
        },
      ];

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => mockBackendEmployees,
      });
      vi.stubGlobal("fetch", fetchMock);

      const employees = await employeeService.fetchAll();
      expect(employees).toHaveLength(2);
      expect(employees[0]?.name).toBe("Ramesh Pawar");
      expect(employees[0]?.wageType).toBe("daily");
      expect(employees[0]?.wageAmount).toBe(500);

      // Verify reactive store was updated
      const active = employeeService.listActive();
      expect(active).toHaveLength(1);
      expect(active[0]?.name).toBe("Ramesh Pawar");
    });

    it("create posts to /api/employees/ and configures wage rate override when provided", async () => {
      const createdEmpDto: BackendEmployee = {
        id: 10,
        name: "Anita Verma",
        phone_number: "9822110022",
        age: 28,
        is_active: true,
        applicable_wage_rate: null,
        applicable_wage_basis: null,
        created_at: "2026-10-21T00:00:00Z",
        updated_at: "2026-10-21T00:00:00Z",
      };

      const refreshedEmpDto: BackendEmployee = {
        ...createdEmpDto,
        applicable_wage_rate: "650.00",
        applicable_wage_basis: "daily",
      };

      const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.endsWith("/api/employees/") && init?.method === "POST") {
          return {
            ok: true,
            status: 201,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => createdEmpDto,
          };
        }
        if (url.includes("/wage-rates/") && init?.method === "POST") {
          return {
            ok: true,
            status: 201,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => ({ id: 5, wage_amount: "650.00", wage_basis: "daily" }),
          };
        }
        if (url.endsWith("/api/employees/10/") && (!init || init.method === "GET")) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => refreshedEmpDto,
          };
        }
        throw new Error(`Unexpected fetch call: ${url}`);
      });
      vi.stubGlobal("fetch", fetchMock);

      const emp = await employeeService.create({
        name: "Anita Verma",
        phone: "9822110022",
        age: 28,
        wageAmount: 650,
        wageType: "daily",
      });

      expect(emp.id).toBe("10");
      expect(emp.name).toBe("Anita Verma");
      expect(emp.wageAmount).toBe(650);
      expect(emp.wageType).toBe("daily");

      // Verify store contains the new employee
      expect(getState().employees.some((e) => e.id === "10")).toBe(true);
    });

    it("deactivate sends POST /api/employees/{id}/deactivate/ and updates store", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ id: 10, is_active: false }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await employeeService.deactivate("10");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/employees/10/deactivate/"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("does not insert fallback mock data when API request fails", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ detail: "Database connection failure." }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(employeeService.fetchAll()).rejects.toThrow(ApiError);
      // Store must remain completely empty, no mock fallbacks
      expect(getState().employees).toHaveLength(0);
    });
  });

  // ==========================================
  // Wage Service Tests
  // ==========================================
  describe("wageService", () => {
    it("fetchGlobal retrieves current global wage and updates store", async () => {
      const globalDto: BackendGlobalWageSetting = {
        id: 1,
        wage_amount: "500.00",
        wage_basis: "daily",
        effective_from: "2026-01-01",
        effective_to: null,
        created_at: "2026-01-01T00:00:00Z",
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => globalDto,
      });
      vi.stubGlobal("fetch", fetchMock);

      const wage = await wageService.fetchGlobal();
      expect(wage.amount).toBe(500);
      expect(wage.type).toBe("daily");
      expect(wageService.getGlobal()).toEqual({ amount: 500, type: "daily" });
    });

    it("applyGlobal sends POST /api/wages/global/ with accurate payload", async () => {
      const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.endsWith("/api/wages/global/") && init?.method === "POST") {
          return {
            ok: true,
            status: 201,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => ({
              id: 2,
              wage_amount: "30000.00",
              wage_basis: "monthly",
              effective_from: "2026-10-21",
              effective_to: null,
            }),
          };
        }
        if (url.endsWith("/api/employees/")) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => [],
          };
        }
        throw new Error(`Unexpected call: ${url}`);
      });
      vi.stubGlobal("fetch", fetchMock);

      await wageService.applyGlobal(30000, "monthly");
      expect(wageService.getGlobal()).toEqual({ amount: 30000, type: "monthly" });
    });

    it("applyToEmployee closes previous open-ended rate and posts new rate override", async () => {
      const existingRates: BackendEmployeeWageRate[] = [
        {
          id: 5,
          employee: 12,
          employee_name: "Pooja Sharma",
          wage_amount: "500.00",
          wage_basis: "daily",
          effective_from: "2026-01-01",
          effective_to: null, // open-ended
          created_at: "2026-01-01T00:00:00Z",
        },
      ];

      const refreshedEmpDto: BackendEmployee = {
        id: 12,
        name: "Pooja Sharma",
        phone_number: null,
        age: 30,
        is_active: true,
        applicable_wage_rate: "700.00",
        applicable_wage_basis: "daily",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-10-21T00:00:00Z",
      };

      const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes("/api/employees/12/wage-rates/") && (!init || init.method === "GET")) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => existingRates,
          };
        }
        if (url.endsWith("/api/wage-rates/5/") && init?.method === "PATCH") {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => ({ id: 5, effective_to: "2026-10-20" }),
          };
        }
        if (url.includes("/api/employees/12/wage-rates/") && init?.method === "POST") {
          return {
            ok: true,
            status: 201,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => ({ id: 6, wage_amount: "700.00", wage_basis: "daily" }),
          };
        }
        if (url.endsWith("/api/employees/12/") && (!init || init.method === "GET")) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => refreshedEmpDto,
          };
        }
        throw new Error(`Unexpected url: ${url}`);
      });
      vi.stubGlobal("fetch", fetchMock);

      await wageService.applyToEmployee("12", 700, "daily");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/wage-rates/5/"),
        expect.objectContaining({ method: "PATCH" }),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/employees/12/wage-rates/"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  // ==========================================
  // Work Record Service Tests
  // ==========================================
  describe("workRecordService", () => {
    it("create posts hourly work record with whole hours and minutes_worked = 0", async () => {
      const recordDto: BackendDailyWorkRecord = {
        id: 50,
        employee: 1,
        employee_name: "Ramesh Pawar",
        work_date: "2026-10-21",
        hours_worked: 8,
        minutes_worked: 0,
        wage_rate: "100.00",
        wage_basis: "hourly",
        base_amount: "800.00",
        overtime_minutes: 0,
        overtime_amount: "0.00",
        extra_pay: "0.00",
        total_earnings: "800.00",
        total_paid: "0.00",
        balance_due: "800.00",
        payment_status: "not_paid",
        notes: null,
        created_at: "2026-10-21T18:00:00Z",
        updated_at: "2026-10-21T18:00:00Z",
      };

      const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.endsWith("/api/work-records/") && init?.method === "POST") {
          const body = JSON.parse(init.body as string);
          expect(body.hours_worked).toBe(8);
          expect(body.minutes_worked).toBe(0);
          return {
            ok: true,
            status: 201,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => recordDto,
          };
        }
        throw new Error(`Unexpected url: ${url}`);
      });
      vi.stubGlobal("fetch", fetchMock);

      const record = await workRecordService.create({
        employeeId: "1",
        workDate: "2026-10-21",
        hoursWorked: 8,
        minutesWorked: 0,
        wageType: "hourly",
        wageRateUsed: 100,
        paymentStatus: "not_paid",
      });

      expect(record.id).toBe("50");
      expect(record.hoursWorked).toBe(8);
      expect(record.calculatedEarnings).toBe(800);
      expect(record.paymentStatus).toBe("not_paid");
    });

    it("create sends manual regular earnings as base_amount for monthly wages and never divides by 30", async () => {
      const recordDto: BackendDailyWorkRecord = {
        id: 51,
        employee: 3,
        employee_name: "Sagar Jadhav",
        work_date: "2026-10-21",
        hours_worked: 8,
        minutes_worked: 0,
        wage_rate: "30000.00",
        wage_basis: "monthly",
        base_amount: "1500.00",
        overtime_minutes: 0,
        overtime_amount: "0.00",
        extra_pay: "200.00",
        total_earnings: "1700.00",
        total_paid: "0.00",
        balance_due: "1700.00",
        payment_status: "not_paid",
        notes: null,
        created_at: "2026-10-21T18:00:00Z",
        updated_at: "2026-10-21T18:00:00Z",
      };

      const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.endsWith("/api/work-records/") && init?.method === "POST") {
          const body = JSON.parse(init.body as string);
          // Must send manually entered base_amount and extra_pay
          expect(body.base_amount).toBe("1500.00");
          expect(body.extra_pay).toBe("200.00");
          return {
            ok: true,
            status: 201,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => recordDto,
          };
        }
        throw new Error(`Unexpected url: ${url}`);
      });
      vi.stubGlobal("fetch", fetchMock);

      const record = await workRecordService.create({
        employeeId: "3",
        workDate: "2026-10-21",
        hoursWorked: 8,
        minutesWorked: 0,
        wageType: "monthly",
        wageRateUsed: 30000,
        baseAmount: 1500,
        extraPay: 200,
        paymentStatus: "not_paid",
      });

      expect(record.baseAmount).toBe(1500);
      expect(record.extraPay).toBe(200);
      expect(record.calculatedEarnings).toBe(1700);
    });

    it("throws DUPLICATE error when backend rejects duplicate employee and date", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          detail: "A work record already exists for employee 'Ramesh Pawar' on 2026-10-21.",
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        workRecordService.create({
          employeeId: "1",
          workDate: "2026-10-21",
          hoursWorked: 8,
          minutesWorked: 0,
          wageType: "daily",
          wageRateUsed: 500,
          paymentStatus: "not_paid",
        }),
      ).rejects.toThrow("DUPLICATE");
    });

    it("creates work record and immediately disburses payment when status is paid", async () => {
      const recordDto: BackendDailyWorkRecord = {
        id: 70,
        employee: 1,
        employee_name: "Ramesh Pawar",
        work_date: "2026-10-21",
        hours_worked: 8,
        minutes_worked: 0,
        wage_rate: "500.00",
        wage_basis: "daily",
        base_amount: "500.00",
        overtime_minutes: 0,
        overtime_amount: "0.00",
        extra_pay: "0.00",
        total_earnings: "500.00",
        total_paid: "0.00",
        balance_due: "500.00",
        payment_status: "not_paid",
        notes: null,
        created_at: "2026-10-21T18:00:00Z",
        updated_at: "2026-10-21T18:00:00Z",
      };

      const paidRecordDto: BackendDailyWorkRecord = {
        ...recordDto,
        total_paid: "500.00",
        balance_due: "0.00",
        payment_status: "paid",
      };

      const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.endsWith("/api/work-records/") && init?.method === "POST") {
          return {
            ok: true,
            status: 201,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => recordDto,
          };
        }
        if (url.endsWith("/api/payments/") && init?.method === "POST") {
          const body = JSON.parse(init.body as string);
          expect(body.work_record).toBe(70);
          expect(body.amount).toBe("500.00");
          return {
            ok: true,
            status: 201,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => ({ id: 101, amount: "500.00" }),
          };
        }
        if (url.endsWith("/api/work-records/70/") && (!init || init.method === "GET")) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => paidRecordDto,
          };
        }
        throw new Error(`Unexpected url: ${url}`);
      });
      vi.stubGlobal("fetch", fetchMock);

      const record = await workRecordService.create({
        employeeId: "1",
        workDate: "2026-10-21",
        hoursWorked: 8,
        minutesWorked: 0,
        wageType: "daily",
        wageRateUsed: 500,
        paymentStatus: "paid",
      });

      expect(record.paymentStatus).toBe("paid");
      expect(record.totalPaid).toBe(500);
      expect(record.balanceDue).toBe(0);
    });

    it("update does not automatically disburse duplicate payments when editing an already paid record", async () => {
      // Existing record in store marked paid with balance 0
      const existingRecord = {
        id: "75",
        employeeId: "1",
        workDate: "2026-10-21",
        hoursWorked: 8,
        minutesWorked: 0,
        wageType: "daily" as const,
        wageRateUsed: 500,
        calculatedEarnings: 500,
        totalPaid: 500,
        balanceDue: 0,
        paymentStatus: "paid" as const,
        createdAt: "2026-10-21T00:00:00Z",
        updatedAt: "2026-10-21T00:00:00Z",
      };
      setState((s) => ({ ...s, records: [existingRecord] }));

      const patchedRecordDto: BackendDailyWorkRecord = {
        id: 75,
        employee: 1,
        employee_name: "Ramesh Pawar",
        work_date: "2026-10-21",
        hours_worked: 9,
        minutes_worked: 0,
        wage_rate: "500.00",
        wage_basis: "daily",
        base_amount: "500.00",
        overtime_minutes: 0,
        overtime_amount: "0.00",
        extra_pay: "0.00",
        total_earnings: "500.00",
        total_paid: "500.00",
        balance_due: "0.00",
        payment_status: "paid",
        notes: "Updated hours",
        created_at: "2026-10-21T00:00:00Z",
        updated_at: "2026-10-21T01:00:00Z",
      };

      const paymentCallMock = vi.fn();
      const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.endsWith("/api/work-records/75/") && init?.method === "PATCH") {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => patchedRecordDto,
          };
        }
        if (url.includes("/api/payments/")) {
          paymentCallMock();
          return {
            ok: true,
            status: 201,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => ({ id: 99 }),
          };
        }
        throw new Error(`Unexpected url: ${url}`);
      });
      vi.stubGlobal("fetch", fetchMock);

      await workRecordService.update("75", {
        employeeId: "1",
        workDate: "2026-10-21",
        hoursWorked: 9,
        minutesWorked: 0,
        wageType: "daily",
        wageRateUsed: 500,
        paymentStatus: "paid",
      });

      // Crucial safeguard check: no duplicate payment disbursement was triggered
      expect(paymentCallMock).not.toHaveBeenCalled();
    });
  });

  describe("employeeService Financial Summaries", () => {
    it("getBalanceSummary fetches employee balance summary from /api/employees/{id}/balance_summary/", async () => {
      const summaryDto = {
        employee_id: 5,
        employee_name: "Rahul Patil",
        is_active: true,
        total_earnings: "3000.00",
        total_paid: "1400.00",
        outstanding_balance: "1600.00",
        work_record_count: 3,
        unpaid_record_count: 1,
        partially_paid_record_count: 1,
        paid_record_count: 1,
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => summaryDto,
      });
      vi.stubGlobal("fetch", fetchMock);

      const summary = await employeeService.getBalanceSummary("5");
      expect(summary.employeeId).toBe(5);
      expect(summary.totalEarnings).toBe(3000);
      expect(summary.totalPaid).toBe(1400);
      expect(summary.outstandingBalance).toBe(1600);
      expect(summary.workRecordCount).toBe(3);
    });

    it("getFinancialSummary fetches aggregate organization summary from /api/employees/financial_summary/", async () => {
      const orgSummaryDto = {
        total_employees: 10,
        active_employees: 8,
        inactive_employees: 2,
        total_earnings: "50000.00",
        total_paid: "35000.00",
        outstanding_balance: "15000.00",
        work_record_count: 50,
        unpaid_record_count: 10,
        partially_paid_record_count: 5,
        paid_record_count: 35,
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => orgSummaryDto,
      });
      vi.stubGlobal("fetch", fetchMock);

      const summary = await employeeService.getFinancialSummary();
      expect(summary.totalEmployees).toBe(10);
      expect(summary.activeEmployees).toBe(8);
      expect(summary.totalEarnings).toBe(50000);
      expect(summary.totalPaid).toBe(35000);
      expect(summary.outstandingBalance).toBe(15000);
    });
  });
});

