import { describe, expect, it } from "vitest";
import { calculateEarnings, describeCalculation } from "@/utils/wageCalculator";

describe("calculateEarnings", () => {
  it("hourly: 7h 30m at ₹100/hour = ₹750", () => {
    expect(calculateEarnings({ wageType: "hourly", rate: 100, hours: 7, minutes: 30 })).toBe(750);
  });

  it("hourly: whole hours 8h at ₹100/hour = ₹800", () => {
    expect(calculateEarnings({ wageType: "hourly", rate: 100, hours: 8, minutes: 0 })).toBe(800);
  });

  it("hourly: 5h 15m at ₹80/hour = ₹420", () => {
    expect(calculateEarnings({ wageType: "hourly", rate: 80, hours: 5, minutes: 15 })).toBe(420);
  });

  it("daily wage is manually entered regular earnings and not treated as hourly", () => {
    expect(calculateEarnings({ wageType: "daily", rate: 600, hours: 8, minutes: 0 })).toBe(600);
    expect(calculateEarnings({ wageType: "daily", rate: 600, hours: 4, minutes: 0, baseAmount: 750 })).toBe(750);
  });

  it("monthly wage regular earnings must be manually entered and never divided by 30 or calculated from hours", () => {
    // When rate is entered directly as manual regular earnings for the record:
    expect(calculateEarnings({ wageType: "monthly", rate: 1500, hours: 8, minutes: 0 })).toBe(1500);
    // When explicit baseAmount is provided:
    expect(calculateEarnings({ wageType: "monthly", rate: 30000, hours: 8, minutes: 0, baseAmount: 1200 })).toBe(1200);
    // Must NOT divide by 30:
    expect(calculateEarnings({ wageType: "monthly", rate: 30000, hours: 8, minutes: 0 })).not.toBe(1000);
  });

  it("hourly: 7h 30m at ₹150/hour with ₹100 extra pay = ₹1,225 total (₹1,125 regular)", () => {
    const regular = calculateEarnings({ wageType: "hourly", rate: 150, hours: 7, minutes: 30 });
    expect(regular).toBe(1125);
    const extraPay = 100;
    const total = regular + extraPay;
    expect(total).toBe(1225);
  });

  it("daily employee regular earnings are manually entered and extra pay remains separate", () => {
    const regular = calculateEarnings({ wageType: "daily", rate: 700, hours: 0, minutes: 0 });
    expect(regular).toBe(700);
    const extraPay = 150;
    expect(regular + extraPay).toBe(850);
  });

  it("monthly employee regular earnings are manually entered and extra pay remains separate", () => {
    const regular = calculateEarnings({ wageType: "monthly", rate: 1600, hours: 0, minutes: 0 });
    expect(regular).toBe(1600);
    const extraPay = 200;
    expect(regular + extraPay).toBe(1800);
    // Agreedy monthly salary (e.g. 36000) must never be divided by 30 (not 1200)
    expect(regular).not.toBe(36000 / 30);
  });

  it("describes calculation accurately for all three wage types", () => {
    expect(describeCalculation("hourly")).toBe("Hours worked × hourly rate");
    expect(describeCalculation("daily")).toBe("Manually entered regular earnings");
    expect(describeCalculation("monthly")).toBe("Manually entered regular earnings");
  });
});

