import { describe, expect, it } from "vitest";
import {
  mapBackendBalanceSummaryToEmployeeBalanceSummary,
  mapBackendDashboardSummaryToDashboardSummary,
  mapBackendEmployeeToEmployee,
  mapBackendPaymentToPayment,
  mapBackendWorkRecordToWorkRecord,
  mapDjangoUserToAuthUser,
  mapEmployeeToBackendEmployee,
  mapPaymentToBackendPayment,
  mapWorkRecordToBackendWorkRecord,
  type BackendDailyWorkRecord,
  type BackendDashboardFinancialSummary,
  type BackendEmployee,
  type BackendEmployeeBalanceSummary,
  type BackendPayment,
  type BackendUser,
} from "@/types";

describe("Model mappings between Django backend and Frontend UI", () => {
  it("maps DjangoUser to AuthUser camelCase", () => {
    const backendUser: BackendUser = {
      id: 5,
      username: "manager",
      email: "manager@example.com",
      is_staff: true,
      is_superuser: false,
    };

    const frontendUser = mapDjangoUserToAuthUser(backendUser);
    expect(frontendUser).toEqual({
      id: 5,
      username: "manager",
      email: "manager@example.com",
      isStaff: true,
      isSuperuser: false,
    });
  });

  it("maps BackendEmployee to Frontend Employee", () => {
    const backendEmp: BackendEmployee = {
      id: 10,
      name: "Ramesh Pawar",
      phone_number: "9876543210",
      age: 35,
      is_active: true,
      applicable_wage_rate: "550.00",
      applicable_wage_basis: "daily",
      created_at: "2026-10-01T10:00:00Z",
      updated_at: "2026-10-05T12:00:00Z",
    };

    const emp = mapBackendEmployeeToEmployee(backendEmp);
    expect(emp.id).toBe("10");
    expect(emp.name).toBe("Ramesh Pawar");
    expect(emp.phone).toBe("9876543210");
    expect(emp.age).toBe(35);
    expect(emp.wageAmount).toBe(550);
    expect(emp.wageType).toBe("daily");
    expect(emp.isActive).toBe(true);

    const backDto = mapEmployeeToBackendEmployee(emp);
    expect(backDto.name).toBe("Ramesh Pawar");
    expect(backDto.phone_number).toBe("9876543210");
    expect(backDto.age).toBe(35);
  });

  it("maps BackendEmployeeBalanceSummary to EmployeeBalanceSummary", () => {
    const summaryDto: BackendEmployeeBalanceSummary = {
      employee_id: 12,
      employee_name: "Sunil Joshi",
      is_active: true,
      total_earnings: "12500.50",
      total_paid: "10000.00",
      outstanding_balance: "2500.50",
      work_record_count: 20,
      unpaid_record_count: 3,
      partially_paid_record_count: 1,
      paid_record_count: 16,
    };

    const summary = mapBackendBalanceSummaryToEmployeeBalanceSummary(summaryDto);
    expect(summary.employeeId).toBe(12);
    expect(summary.employeeName).toBe("Sunil Joshi");
    expect(summary.totalEarnings).toBe(12500.5);
    expect(summary.totalPaid).toBe(10000);
    expect(summary.outstandingBalance).toBe(2500.5);
    expect(summary.workRecordCount).toBe(20);
    expect(summary.unpaidRecordCount).toBe(3);
    expect(summary.partiallyPaidRecordCount).toBe(1);
    expect(summary.paidRecordCount).toBe(16);
  });

  it("maps BackendPayment to Payment and reverse", () => {
    const paymentDto: BackendPayment = {
      id: 7,
      work_record: 42,
      employee_name: "Sunil Joshi",
      work_date: "2026-10-15",
      amount: "600.00",
      payment_date: "2026-10-16",
      payment_method: "UPI",
      notes: "Reference #123456",
      created_at: "2026-10-16T09:30:00Z",
    };

    const payment = mapBackendPaymentToPayment(paymentDto);
    expect(payment.id).toBe("7");
    expect(payment.workRecordId).toBe(42);
    expect(payment.amount).toBe(600);
    expect(payment.paymentMethod).toBe("UPI");
    expect(payment.notes).toBe("Reference #123456");

    const backDto = mapPaymentToBackendPayment(payment);
    expect(backDto.work_record).toBe(42);
    expect(backDto.amount).toBe("600.00");
    expect(backDto.payment_method).toBe("UPI");
  });

  it("maps BackendDailyWorkRecord to WorkRecord and reverse", () => {
    const recordDto: BackendDailyWorkRecord = {
      id: 101,
      employee: 5,
      employee_name: "Rahul Patil",
      work_date: "2026-10-18",
      hours_worked: 8,
      minutes_worked: 0,
      wage_rate: "100.00",
      wage_basis: "hourly",
      base_amount: "800.00",
      overtime_minutes: 0,
      overtime_amount: "0.00",
      extra_pay: "50.00",
      total_earnings: "850.00",
      total_paid: "400.00",
      balance_due: "450.00",
      payment_status: "partially_paid",
      notes: "Regular shift + bonus",
      created_at: "2026-10-18T18:00:00Z",
      updated_at: "2026-10-18T18:30:00Z",
    };

    const record = mapBackendWorkRecordToWorkRecord(recordDto);
    expect(record.id).toBe("101");
    expect(record.employeeId).toBe("5");
    expect(record.hoursWorked).toBe(8);
    expect(record.wageType).toBe("hourly");
    expect(record.calculatedEarnings).toBe(850);
    expect(record.totalPaid).toBe(400);
    expect(record.balanceDue).toBe(450);
    expect(record.paymentStatus).toBe("partially_paid");

    const backDto = mapWorkRecordToBackendWorkRecord(record);
    expect(backDto.employee).toBe(5);
    expect(backDto.hours_worked).toBe(8);
    expect(backDto.wage_basis).toBe("hourly");
    expect(backDto.payment_status).toBe("partially_paid");
  });

  it("maps monthly BackendEmployee and BackendDailyWorkRecord accurately", () => {
    const monthlyEmpDto: BackendEmployee = {
      id: 20,
      name: "Sagar Jadhav",
      phone_number: "9822001122",
      age: 45,
      is_active: true,
      applicable_wage_rate: "30000.00",
      applicable_wage_basis: "monthly",
      created_at: "2026-10-01T10:00:00Z",
      updated_at: "2026-10-01T10:00:00Z",
    };

    const emp = mapBackendEmployeeToEmployee(monthlyEmpDto);
    expect(emp.wageType).toBe("monthly");
    expect(emp.wageAmount).toBe(30000);

    const monthlyRecordDto: BackendDailyWorkRecord = {
      id: 202,
      employee: 20,
      employee_name: "Sagar Jadhav",
      work_date: "2026-10-19",
      hours_worked: 8,
      minutes_worked: 0,
      wage_rate: "30000.00",
      wage_basis: "monthly",
      base_amount: "1200.00",
      overtime_minutes: 0,
      overtime_amount: "0.00",
      extra_pay: "200.00",
      total_earnings: "1400.00",
      total_paid: "0.00",
      balance_due: "1400.00",
      payment_status: "not_paid",
      notes: "Monthly staff regular shift + allowance",
      created_at: "2026-10-19T18:00:00Z",
      updated_at: "2026-10-19T18:00:00Z",
    };

    const record = mapBackendWorkRecordToWorkRecord(monthlyRecordDto);
    expect(record.wageType).toBe("monthly");
    expect(record.baseAmount).toBe(1200);
    expect(record.extraPay).toBe(200);
    expect(record.calculatedEarnings).toBe(1400);

    const mappedBack = mapWorkRecordToBackendWorkRecord(record);
    expect(mappedBack.wage_basis).toBe("monthly");
    expect(mappedBack.base_amount).toBe("1200.00");
    expect(mappedBack.extra_pay).toBe("200.00");
    expect(mappedBack.total_earnings).toBe("1400.00");
  });

  it("maps BackendDashboardFinancialSummary to DashboardFinancialSummary accurately", () => {
    const summaryDto = {
      total_employees: 15,
      active_employees: 12,
      inactive_employees: 3,
      total_earnings: "45000.75",
      total_paid: "30000.00",
      outstanding_balance: "15000.75",
      work_record_count: 60,
      unpaid_record_count: 10,
      partially_paid_record_count: 5,
      paid_record_count: 45,
    };

    const summary = mapBackendDashboardSummaryToDashboardSummary(summaryDto);
    expect(summary.totalEmployees).toBe(15);
    expect(summary.activeEmployees).toBe(12);
    expect(summary.inactiveEmployees).toBe(3);
    expect(summary.totalEarnings).toBe(45000.75);
    expect(summary.totalPaid).toBe(30000);
    expect(summary.outstandingBalance).toBe(15000.75);
    expect(summary.workRecordCount).toBe(60);
    expect(summary.unpaidRecordCount).toBe(10);
    expect(summary.partiallyPaidRecordCount).toBe(5);
    expect(summary.paidRecordCount).toBe(45);
  });
});

