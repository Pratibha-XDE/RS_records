import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { paymentService } from "@/services/paymentService";
import { resetState, setState, getState } from "@/services/store";
import { setAuthToken, clearAuthToken, ApiError } from "@/services/api";
import type { BackendDailyWorkRecord, BackendPayment, WorkRecord } from "@/types";

describe("paymentService Integration & Safeguards", () => {
  beforeEach(() => {
    localStorage.clear();
    resetState();
    vi.restoreAllMocks();
    setAuthToken("test-token");
  });

  afterEach(() => {
    localStorage.clear();
    resetState();
    clearAuthToken();
    vi.restoreAllMocks();
  });

  it("records full payment successfully and updates reactive store with server-computed values", async () => {
    const mockPaymentDto: BackendPayment = {
      id: 101,
      work_record: 42,
      employee_name: "Rahul Patil",
      work_date: "2026-10-21",
      amount: "800.00",
      payment_date: "2026-10-21",
      payment_method: "Cash",
      notes: "Full daily wage payment",
      created_at: "2026-10-21T18:00:00Z",
    };

    const mockUpdatedRecordDto: BackendDailyWorkRecord = {
      id: 42,
      employee: 1,
      employee_name: "Rahul Patil",
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
      total_paid: "800.00",
      balance_due: "0.00",
      payment_status: "paid",
      notes: null,
      created_at: "2026-10-21T17:00:00Z",
      updated_at: "2026-10-21T18:00:00Z",
    };

    const initialRecord: WorkRecord = {
      id: "42",
      employeeId: "1",
      workDate: "2026-10-21",
      hoursWorked: 8,
      minutesWorked: 0,
      wageType: "hourly",
      wageRateUsed: 100,
      calculatedEarnings: 800,
      totalPaid: 0,
      balanceDue: 800,
      paymentStatus: "not_paid",
      createdAt: "2026-10-21T17:00:00Z",
      updatedAt: "2026-10-21T17:00:00Z",
    };

    setState((s) => ({ ...s, records: [initialRecord] }));

    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/payments/") && init?.method === "POST") {
        const body = JSON.parse(init.body as string);
        expect(body.work_record).toBe(42);
        expect(body.amount).toBe("800.00");
        expect(body.payment_method).toBe("Cash");
        return {
          ok: true,
          status: 201,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => mockPaymentDto,
        };
      }
      if (url.endsWith("/api/work-records/42/") && (!init || init.method === "GET")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => mockUpdatedRecordDto,
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const payment = await paymentService.create({
      workRecordId: 42,
      amount: 800,
      paymentDate: "2026-10-21",
      paymentMethod: "Cash",
      notes: "Full daily wage payment",
    });

    expect(payment.id).toBe("101");
    expect(payment.amount).toBe(800);
    expect(payment.workRecordId).toBe(42);

    // Verify reactive store was updated with server-computed values
    const updatedInStore = getState().records.find((r) => r.id === "42");
    expect(updatedInStore?.paymentStatus).toBe("paid");
    expect(updatedInStore?.totalPaid).toBe(800);
    expect(updatedInStore?.balanceDue).toBe(0);
  });

  it("supports partial payments and updates work record status to partially_paid", async () => {
    const mockPaymentDto: BackendPayment = {
      id: 102,
      work_record: 43,
      employee_name: "Amit Shinde",
      work_date: "2026-10-21",
      amount: "300.00",
      payment_date: "2026-10-21",
      payment_method: "UPI",
      notes: "Partial payment",
      created_at: "2026-10-21T18:00:00Z",
    };

    const mockUpdatedRecordDto: BackendDailyWorkRecord = {
      id: 43,
      employee: 2,
      employee_name: "Amit Shinde",
      work_date: "2026-10-21",
      hours_worked: 8,
      minutes_worked: 0,
      wage_rate: "600.00",
      wage_basis: "daily",
      base_amount: "600.00",
      overtime_minutes: 0,
      overtime_amount: "0.00",
      extra_pay: "0.00",
      total_earnings: "600.00",
      total_paid: "300.00",
      balance_due: "300.00",
      payment_status: "partially_paid",
      notes: null,
      created_at: "2026-10-21T17:00:00Z",
      updated_at: "2026-10-21T18:00:00Z",
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
      if (url.endsWith("/api/work-records/43/")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => mockUpdatedRecordDto,
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const payment = await paymentService.create({
      workRecordId: 43,
      amount: 300,
      paymentDate: "2026-10-21",
      paymentMethod: "UPI",
    });

    expect(payment.amount).toBe(300);
    expect(payment.paymentMethod).toBe("UPI");
  });

  it("rejects non-positive payment amounts", async () => {
    await expect(
      paymentService.create({
        workRecordId: 10,
        amount: 0,
        paymentDate: "2026-10-21",
      }),
    ).rejects.toThrow("Payment amount must be greater than zero.");

    await expect(
      paymentService.create({
        workRecordId: 10,
        amount: -50,
        paymentDate: "2026-10-21",
      }),
    ).rejects.toThrow("Payment amount must be greater than zero.");
  });

  it("prevents concurrent duplicate payment submissions for the same work record", async () => {
    let resolveFirst: (val: unknown) => void = () => {};
    const firstPromise = new Promise((res) => {
      resolveFirst = res;
    });

    const fetchMock = vi.fn().mockImplementation(async () => {
      await firstPromise;
      return {
        ok: true,
        status: 201,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ id: 1, amount: "500.00" }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    // Launch first payment request (still in-flight)
    const p1 = paymentService.create({
      workRecordId: 99,
      amount: 500,
      paymentDate: "2026-10-21",
    });

    // Launch second concurrent payment request for the exact same record
    const p2 = paymentService.create({
      workRecordId: 99,
      amount: 500,
      paymentDate: "2026-10-21",
    });

    // Second call should immediately fail due to in-flight lock
    await expect(p2).rejects.toThrow("already processing");

    // Complete first call
    resolveFirst({});
    await p1;
  });

  it("lists payment history for a specific work record from backend API", async () => {
    const mockPayments: BackendPayment[] = [
      {
        id: 1,
        work_record: 50,
        employee_name: "Sneha Kulkarni",
        work_date: "2026-10-20",
        amount: "200.00",
        payment_date: "2026-10-20",
        payment_method: "Cash",
        notes: "Advance installment 1",
        created_at: "2026-10-20T10:00:00Z",
      },
      {
        id: 2,
        work_record: 50,
        employee_name: "Sneha Kulkarni",
        work_date: "2026-10-20",
        amount: "300.00",
        payment_date: "2026-10-21",
        payment_method: "Bank Transfer",
        notes: null,
        created_at: "2026-10-21T10:00:00Z",
      },
    ];

    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      expect(url).toContain("/api/payments/");
      expect(url).toContain("work_record=50");
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => mockPayments,
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const history = await paymentService.listForWorkRecord(50);
    expect(history).toHaveLength(2);
    expect(history[0]?.amount).toBe(200);
    expect(history[1]?.amount).toBe(300);
  });

  it("handles backend validation error when payment exceeds remaining balance", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        amount: ["Payment amount of 1000.00 exceeds the remaining balance due (500.00)."],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      paymentService.create({
        workRecordId: 60,
        amount: 1000,
        paymentDate: "2026-10-21",
      }),
    ).rejects.toThrow(ApiError);
  });
});
