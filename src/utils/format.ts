import type { WageType } from "@/types";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export const formatINR = (n: number) => inr.format(n || 0);

export const wageTypeLabel: Record<WageType, string> = {
  hourly: "Per Hour",
  daily: "Per Day",
  monthly: "Per Month",
};
const wageSuffix: Record<WageType, string> = { hourly: "hour", daily: "day", monthly: "month" };

export const formatWage = (amount: number, type: WageType) => `${formatINR(amount)}/${wageSuffix[type]}`;

export const todayISO = () => {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
};

export const formatDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export const formatLongToday = () =>
  new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
