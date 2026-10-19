import type { AppState } from "./store";
import type { Employee, WorkRecord } from "@/types";
import { calculateEarnings } from "@/utils/wageCalculator";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function seedState(): AppState {
  const now = new Date().toISOString();
  const employees: Employee[] = [
    { id: "emp-1", name: "Rahul Patil", workProfile: "Machine Operator", phone: "9876543210", age: 34, wageAmount: 100, wageType: "hourly", wageSource: "global", isActive: true, createdAt: now },
    { id: "emp-2", name: "Amit Shinde", workProfile: "Helper", wageAmount: 600, wageType: "daily", wageSource: "individual", isActive: true, createdAt: now },
    { id: "emp-3", name: "Sagar Jadhav", workProfile: "Supervisor", phone: "9822001122", age: 45, wageAmount: 25000, wageType: "monthly", wageSource: "individual", isActive: true, createdAt: now },
    { id: "emp-4", name: "Sneha Kulkarni", workProfile: "Assistant", wageAmount: 80, wageType: "hourly", wageSource: "individual", isActive: true, createdAt: now },
    { id: "emp-5", name: "Priya Deshmukh", workProfile: "Worker", wageAmount: 700, wageType: "daily", wageSource: "individual", isActive: true, createdAt: now },
    { id: "emp-6", name: "Venkatesh Ramachandran Subramaniam", workProfile: "Packing", wageAmount: 100, wageType: "hourly", wageSource: "global", isActive: true, createdAt: now },
  ];

  const mk = (id: string, e: Employee, ago: number, h: number, m: number, paid: boolean): WorkRecord => ({
    id,
    employeeId: e.id,
    workDate: daysAgo(ago),
    hoursWorked: h,
    minutesWorked: m,
    wageType: e.wageType,
    wageRateUsed: e.wageAmount,
    calculatedEarnings: calculateEarnings({ wageType: e.wageType, rate: e.wageAmount, hours: h, minutes: m }),
    paymentStatus: paid ? "paid" : "not_paid",
    createdAt: now,
    updatedAt: now,
  });

  const [r, a, s, sn] = employees as [Employee, Employee, Employee, Employee];
  return {
    employees,
    records: [
      mk("rec-1", r, 1, 7, 30, false),
      mk("rec-2", r, 2, 8, 0, true),
      mk("rec-3", r, 3, 6, 45, true),
      mk("rec-4", a, 1, 8, 0, false),
      mk("rec-5", a, 2, 8, 0, true),
      mk("rec-6", s, 1, 9, 0, true),
      mk("rec-7", sn, 1, 5, 15, false),
    ],
    wageSettings: [
      { id: "ws-1", amount: 100, type: "hourly", scope: "global", effectiveFrom: daysAgo(30), createdAt: now },
    ],
    globalWage: { amount: 100, type: "hourly" },
    audits: [],
  };
}
