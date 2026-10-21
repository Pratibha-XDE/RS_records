import type { WageType } from "@/types";

/**
 * Wage calculation rules:
 * - Hourly: whole hours × applicable hourly rate (pro-rated by minutes if entered)
 * - Daily: manually entered regular earnings for the workday (not prorated by hours)
 * - Monthly: manually entered regular earnings for the work record (never divided by 30 or calculated from hours)
 */
export const WAGE_RULES = {
  dailyMode: "manual_entry" as const,
  monthlyMode: "manual_entry" as const,
};

const toPaise = (rupees: number) => Math.round(rupees * 100);

export function calculateEarnings(input: {
  wageType: WageType;
  rate: number;
  hours: number;
  minutes: number;
  baseAmount?: number;
}): number {
  if (input.baseAmount !== undefined) {
    return Math.round(input.baseAmount * 100) / 100;
  }

  const ratePaise = toPaise(input.rate || 0);
  switch (input.wageType) {
    case "hourly": {
      const totalMinutes = (input.hours || 0) * 60 + (input.minutes || 0);
      return Math.round((ratePaise * totalMinutes) / 60) / 100;
    }
    case "daily":
      return ratePaise / 100;
    case "monthly":
      return ratePaise / 100;
  }
}

export function describeCalculation(wageType: WageType): string {
  if (wageType === "hourly") return "Hours worked × hourly rate";
  if (wageType === "daily") return "Manually entered regular earnings";
  return "Manually entered regular earnings";
}
