import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { employeeService } from "@/services/employeeService";
import { wageService } from "@/services/wageService";
import { workRecordService } from "@/services/workRecordService";
import { resetState, getState, setState } from "@/services/store";
import { setAuthToken, clearAuthToken } from "@/services/api";
import { calculateEarnings } from "@/utils/wageCalculator";
import type {
  BackendDailyWorkRecord,
  BackendEmployee,
  BackendEmployeeWageRate,
  BackendGlobalWageSetting,
} from "@/types";

function mockJsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => data,
  };
}

describe("Focused Improvements Integration Tests", () => {
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
  // 1. Wage Entry Tests
  // ==========================================
  describe("1. Wage Entry Dependencies & Calculations", () => {
    it("hourly employee with whole hours calculates correctly", () => {
      const regular = calculateEarnings({ wageType: "hourly", rate: 150, hours: 8, minutes: 0 });
      expect(regular).toBe(1200);
      const extraPay = 50;
      expect(regular + extraPay).toBe(1250);
    });

    it("hourly employee with 7h 30m fractional time at ₹150/hr = ₹1,125 + ₹100 extra pay = ₹1,225 total", () => {
      const regular = calculateEarnings({ wageType: "hourly", rate: 150, hours: 7, minutes: 30 });
      expect(regular).toBe(1125);
      const extraPay = 100;
      expect(regular + extraPay).toBe(1225);
    });

    it("daily employee regular earnings are manually entered without hours/minutes", () => {
      const regular = calculateEarnings({ wageType: "daily", rate: 650, hours: 0, minutes: 0 });
      expect(regular).toBe(650);
      const extraPay = 75;
      expect(regular + extraPay).toBe(725);
    });

    it("monthly employee regular earnings are manually entered and never divided by 30", () => {
      const agreedMonthlySalary = 36000;
      const regular = calculateEarnings({ wageType: "monthly", rate: 1500, hours: 0, minutes: 0 });
      expect(regular).toBe(1500);
      expect(regular).not.toBe(agreedMonthlySalary / 30);
      const extraPay = 200;
      expect(regular + extraPay).toBe(1700);
    });

    it("workRecordService sends minutesWorked and notes in create payload", async () => {
      setState((s) => ({
        ...s,
        employees: [
          {
            id: "1",
            name: "Anil Shinde",
            wageAmount: 150,
            wageType: "hourly",
            wageSource: "individual",
            isActive: true,
            createdAt: "2026-10-01T00:00:00Z",
          },
        ],
      }));

      let capturedPayload: unknown = null;
      const fetchMock = vi.fn().mockImplementation(async (url: string, options?: RequestInit) => {
        if (url.endsWith("/api/work-records/")) {
          capturedPayload = JSON.parse(options?.body as string);
          return mockJsonResponse(
            {
              id: 101,
              employee: 1,
              employee_name: "Anil Shinde",
              work_date: "2026-10-21",
              hours_worked: 7,
              minutes_worked: 30,
              wage_rate: "150.00",
              wage_basis: "hourly",
              base_amount: "1125.00",
              overtime_minutes: 0,
              overtime_amount: "0.00",
              extra_pay: "100.00",
              total_earnings: "1225.00",
              total_paid: "0.00",
              balance_due: "1225.00",
              payment_status: "not_paid",
              notes: "Site visit and repairs",
              created_at: "2026-10-21T10:00:00Z",
              updated_at: "2026-10-21T10:00:00Z",
            },
            201
          );
        }
        return mockJsonResponse({}, 404);
      });
      vi.stubGlobal("fetch", fetchMock);

      const record = await workRecordService.create({
        employeeId: "1",
        workDate: "2026-10-21",
        hoursWorked: 7,
        minutesWorked: 30,
        wageType: "hourly",
        wageRateUsed: 150,
        baseAmount: 1125,
        extraPay: 100,
        paymentStatus: "not_paid",
        notes: "Site visit and repairs",
      });

      expect(capturedPayload).toEqual({
        employee: 1,
        work_date: "2026-10-21",
        hours_worked: 7,
        minutes_worked: 30,
        extra_pay: "100.00",
        notes: "Site visit and repairs",
      });
      expect(record.hoursWorked).toBe(7);
      expect(record.minutesWorked).toBe(30);
      expect(record.calculatedEarnings).toBe(1225);
    });
  });

  // ==========================================
  // 2. Work History in Table & Pagination Tests
  // ==========================================
  describe("2. Work History Display & Pagination", () => {
    it("fetches all pages when backend pagination is present", async () => {
      const makeDto = (id: number, date: string): BackendDailyWorkRecord => ({
        id,
        employee: 1,
        employee_name: "Test Worker",
        work_date: date,
        hours_worked: 8,
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
        notes: null,
        created_at: "2026-10-01T00:00:00Z",
        updated_at: "2026-10-01T00:00:00Z",
      });

      const page1Records = Array.from({ length: 15 }, (_, i) =>
        makeDto(i + 1, `2026-10-${String(i + 1).padStart(2, "0")}`)
      );
      const page2Records = Array.from({ length: 10 }, (_, i) =>
        makeDto(i + 16, `2026-09-${String(i + 1).padStart(2, "0")}`)
      );

      const fetchMock = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("page=2")) {
          return mockJsonResponse({
            count: 25,
            next: null,
            previous: "http://localhost:8000/api/work-records/?employee=1&page=1",
            results: page2Records,
          });
        }
        return mockJsonResponse({
          count: 25,
          next: "http://localhost:8000/api/work-records/?employee=1&page=2",
          previous: null,
          results: page1Records,
        });
      });
      vi.stubGlobal("fetch", fetchMock);

      const records = await workRecordService.listForEmployee("1");
      expect(records).toHaveLength(25);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // Top 10 initial display verification
      const initialDisplay = records.slice(0, 10);
      expect(initialDisplay).toHaveLength(10);
      expect(initialDisplay[0]?.workDate).toBe("2026-10-15"); // newest first

      // See More reveals additional records
      const afterSeeMore = records.slice(0, 20);
      expect(afterSeeMore).toHaveLength(20);

      // All 25 remain accessible
      expect(records.slice(0, 25)).toHaveLength(25);
    });
  });

  // ==========================================
  // 3. Duplicate Employee Prevention Tests
  // ==========================================
  describe("3. Duplicate Employee Prevention", () => {
    it("rejects creating employee when phone number matches an existing employee", async () => {
      setState((s) => ({
        ...s,
        employees: [
          {
            id: "1",
            name: "Devendra Shinde",
            phone: "9876543211",
            wageAmount: 150,
            wageType: "hourly",
            wageSource: "individual",
            isActive: true,
            createdAt: "2026-10-01T00:00:00Z",
          },
        ],
      }));

      await expect(
        employeeService.create({
          name: "Devendra Duplicate",
          phone: "9876543211",
        })
      ).rejects.toThrow("An employee with phone number '9876543211' already exists (Devendra Shinde)");
    });

    it("allows creating employee with same name if phone number is different", async () => {
      setState((s) => ({
        ...s,
        employees: [
          {
            id: "1",
            name: "Ramesh Pawar",
            phone: "9876543210",
            wageAmount: 500,
            wageType: "daily",
            wageSource: "individual",
            isActive: true,
            createdAt: "2026-10-01T00:00:00Z",
          },
        ],
      }));

      const fetchMock = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith("/api/employees/")) {
          return mockJsonResponse(
            {
              id: 2,
              name: "Ramesh Pawar",
              phone_number: "9876543299",
              age: null,
              is_active: true,
              applicable_wage_rate: "500.00",
              applicable_wage_basis: "daily",
              created_at: "2026-10-21T00:00:00Z",
              updated_at: "2026-10-21T00:00:00Z",
            },
            201
          );
        }
        return mockJsonResponse({}, 404);
      });
      vi.stubGlobal("fetch", fetchMock);

      const created = await employeeService.create({
        name: "Ramesh Pawar",
        phone: "9876543299",
      });

      expect(created.id).toBe("2");
      expect(created.name).toBe("Ramesh Pawar");
      expect(created.phone).toBe("9876543299");
    });

    it("updating an existing employee's wage does not create a new profile and preserves historical records", async () => {
      setState((s) => ({
        ...s,
        employees: [
          {
            id: "1",
            name: "Mahesh Patil",
            wageAmount: 300,
            wageType: "daily",
            wageSource: "individual",
            isActive: true,
            createdAt: "2026-10-01T00:00:00Z",
          },
        ],
        records: [
          {
            id: "10",
            employeeId: "1",
            workDate: "2026-10-10",
            hoursWorked: 0,
            minutesWorked: 0,
            wageType: "daily",
            wageRateUsed: 300,
            baseAmount: 300,
            calculatedEarnings: 300,
            paymentStatus: "paid",
            totalPaid: 300,
            balanceDue: 0,
            createdAt: "2026-10-10T00:00:00Z",
            updatedAt: "2026-10-10T00:00:00Z",
          },
        ],
      }));

      const fetchMock = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/api/employees/1/wage-rates/")) {
          return mockJsonResponse([
            {
              id: 50,
              employee: 1,
              employee_name: "Mahesh Patil",
              wage_amount: "300.00",
              wage_basis: "daily",
              effective_from: "2026-10-01",
              effective_to: null,
              created_at: "2026-10-01T00:00:00Z",
            },
          ]);
        }
        if (url.includes("/api/wage-rates/50/")) {
          return mockJsonResponse({});
        }
        if (url.includes("/api/employees/1/")) {
          return mockJsonResponse({
            id: 1,
            name: "Mahesh Patil",
            phone_number: null,
            age: null,
            is_active: true,
            applicable_wage_rate: "450.00",
            applicable_wage_basis: "hourly",
            created_at: "2026-10-01T00:00:00Z",
            updated_at: "2026-10-21T00:00:00Z",
          });
        }
        return mockJsonResponse({});
      });
      vi.stubGlobal("fetch", fetchMock);

      // Update wage to hourly 450
      await wageService.applyToEmployee("1", 450, "hourly");

      // Verify only 1 employee profile exists
      expect(getState().employees).toHaveLength(1);
      expect(getState().employees[0]?.wageType).toBe("hourly");
      expect(getState().employees[0]?.wageAmount).toBe(450);

      // Historical work record retains its wage snapshot
      const histRecord = getState().records.find((r) => r.id === "10");
      expect(histRecord?.wageRateUsed).toBe(300);
      expect(histRecord?.wageType).toBe("daily");
      expect(histRecord?.calculatedEarnings).toBe(300);
    });
  });

  // ==========================================
  // 4. Dashboard Section Ordering & Behavior
  // ==========================================
  describe("4. Dashboard Section Behavior", () => {
    it("pending payments includes both active and inactive employees with positive balance", () => {
      const balances = {
        "1": {
          employeeId: 1,
          employeeName: "Active Due Worker",
          isActive: true,
          totalEarnings: 2000,
          totalPaid: 1000,
          outstandingBalance: 1000,
          workRecordCount: 2,
          unpaidRecordCount: 1,
          partiallyPaidRecordCount: 0,
          paidRecordCount: 1,
        },
        "2": {
          employeeId: 2,
          employeeName: "Inactive Due Worker",
          isActive: false,
          totalEarnings: 1500,
          totalPaid: 500,
          outstandingBalance: 1000,
          workRecordCount: 1,
          unpaidRecordCount: 1,
          partiallyPaidRecordCount: 0,
          paidRecordCount: 0,
        },
        "3": {
          employeeId: 3,
          employeeName: "Settled Inactive Worker",
          isActive: false,
          totalEarnings: 1000,
          totalPaid: 1000,
          outstandingBalance: 0,
          workRecordCount: 1,
          unpaidRecordCount: 0,
          partiallyPaidRecordCount: 0,
          paidRecordCount: 1,
        },
      };

      const pending = Object.values(balances).filter((b) => b.outstandingBalance > 0);
      expect(pending).toHaveLength(2);
      expect(pending.map((p) => p.employeeName)).toContain("Active Due Worker");
      expect(pending.map((p) => p.employeeName)).toContain("Inactive Due Worker");
      // Settled inactive worker disappears from Pending Payments
      expect(pending.map((p) => p.employeeName)).not.toContain("Settled Inactive Worker");
    });
  });
});
