import { describe, expect, it } from "vitest";
import { calculateEarnings } from "@/utils/wageCalculator";

describe("calculateEarnings", () => {
  it("hourly: 7h 30m at ₹100/hour = ₹750", () => {
    expect(calculateEarnings({ wageType: "hourly", rate: 100, hours: 7, minutes: 30 })).toBe(750);
  });
  it("hourly: 5h 15m at ₹80/hour = ₹420", () => {
    expect(calculateEarnings({ wageType: "hourly", rate: 80, hours: 5, minutes: 15 })).toBe(420);
  });
  it("daily wage is not treated as hourly", () => {
    expect(calculateEarnings({ wageType: "daily", rate: 600, hours: 8, minutes: 0 })).toBe(600);
  });
});
