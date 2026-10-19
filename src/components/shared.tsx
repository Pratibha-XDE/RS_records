import { Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PaymentStatus, WageType } from "@/types";
import { Label } from "@/components/ui/label";
import { wageTypeLabel } from "@/utils/format";

export function Field({ label, error, htmlFor, children, hint }: { label: string; error?: string; htmlFor?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-base font-medium">{label}</Label>
      {children}
      {hint && !error && <p className="text-sm text-muted-foreground">{hint}</p>}
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}

export function StatusBadge({ status }: { status: PaymentStatus }) {
  const paid = status === "paid";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-semibold",
        paid ? "border-success/30 bg-success-soft text-success" : "border-warning/30 bg-warning-soft text-warning",
      )}
    >
      {paid ? <Check className="size-4" /> : <Clock className="size-4" />}
      {paid ? "Paid" : "Not Paid"}
    </span>
  );
}

export function PaymentToggle({ value, onChange }: { value: PaymentStatus; onChange: (v: PaymentStatus) => void }) {
  const opt = (v: PaymentStatus, label: string) => {
    const active = value === v;
    const paid = v === "paid";
    return (
      <button
        type="button"
        role="radio"
        aria-checked={active}
        onClick={() => onChange(v)}
        className={cn(
          "flex h-12 flex-1 items-center justify-center gap-2 rounded-lg border-2 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active
            ? paid
              ? "border-success bg-success-soft text-success"
              : "border-warning bg-warning-soft text-warning"
            : "border-border bg-background text-muted-foreground",
        )}
      >
        {active && <Check className="size-5" />}
        {label}
      </button>
    );
  };
  return (
    <div role="radiogroup" className="flex gap-3">
      {opt("not_paid", "Not Paid")}
      {opt("paid", "Paid")}
    </div>
  );
}

export function WageTypePicker({ value, onChange }: { value: WageType; onChange: (v: WageType) => void }) {
  return (
    <div role="radiogroup" className="grid grid-cols-3 gap-2">
      {(Object.keys(wageTypeLabel) as WageType[]).map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={value === t}
          onClick={() => onChange(t)}
          className={cn(
            "h-12 rounded-lg border-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === t ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground",
          )}
        >
          {wageTypeLabel[t]}
        </button>
      ))}
    </div>
  );
}

export function RupeeInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base font-semibold text-muted-foreground">₹</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        {...props}
        className={cn(bigInput, "pl-8", props.className)}
      />
    </div>
  );
}

export const bigInput =
  "flex h-12 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-muted disabled:text-muted-foreground";

export const bigDialog =
  "max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto rounded-xl p-5 sm:p-6";
