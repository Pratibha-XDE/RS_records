import type { WageType } from "@/types";

/**
 * Business rules for non-hourly wages are NOT finalised yet.
 * Change these in one place once the rules are confirmed.
 */
export const WAGE_RULES = {
  /** Daily wage: one recorded day earns the full daily rate (no partial-day proration). */
  dailyMode: "full_day" as const,
  /** Monthly wage: one recorded day earns monthly rate / this many days. */
  monthlyDaysDivisor: 30,
};

const toPaise = (rupees: number) => Math.round(rupees * 100);

export function calculateEarnings(input: {
  wageType: WageType;
  rate: number;
  hours: number;
  minutes: number;
}): number {
  const ratePaise = toPaise(input.rate || 0);
  switch (input.wageType) {
    case "hourly": {
      const totalMinutes = (input.hours || 0) * 60 + (input.minutes || 0);
      return Math.round((ratePaise * totalMinutes) / 60) / 100;
    }
    case "daily":
      return calculateDaily(ratePaise);
    case "monthly":
      return calculateMonthly(ratePaise);
  }
}

function calculateDaily(ratePaise: number) {
  return ratePaise / 100;
}

function calculateMonthly(ratePaise: number) {
  return Math.round(ratePaise / WAGE_RULES.monthlyDaysDivisor) / 100;
}

export function describeCalculation(wageType: WageType): string {
  if (wageType === "hourly") return "(hours + minutes ÷ 60) × hourly rate";
  if (wageType === "daily") return "Full daily rate for the day";
  return `Monthly rate ÷ ${WAGE_RULES.monthlyDaysDivisor} days`;
}
