import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { WorkRecord } from "@/types";
import { paymentService } from "@/services/paymentService";
import { formatDate, formatINR, todayISO } from "@/utils/format";
import { Field, RupeeInput, bigDialog, bigInput } from "./shared";

const PAYMENT_METHODS = ["Cash", "UPI", "Bank Transfer", "Cheque"] as const;

export function RecordPaymentDialog({
  open,
  onOpenChange,
  record,
  records,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: WorkRecord | null;
  records?: WorkRecord[];
  onSuccess?: () => void;
}) {
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<string>("Cash");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Partial<Record<"amount" | "date", string>>>({});
  const [saving, setSaving] = useState(false);

  const activeRecord =
    (records && records.find((r) => r.id === selectedRecordId)) ??
    record ??
    (records && records[0]) ??
    null;

  const balanceDue = activeRecord
    ? activeRecord.balanceDue !== undefined
      ? activeRecord.balanceDue
      : activeRecord.calculatedEarnings - (activeRecord.totalPaid ?? 0)
    : 0;

  useEffect(() => {
    if (open) {
      const initialRecord =
        record ??
        (records && selectedRecordId ? records.find((r) => r.id === selectedRecordId) : null) ??
        (records && records[0]) ??
        null;

      if (initialRecord) {
        setSelectedRecordId(initialRecord.id);
        const currentBalance =
          initialRecord.balanceDue !== undefined
            ? initialRecord.balanceDue
            : initialRecord.calculatedEarnings - (initialRecord.totalPaid ?? 0);
        setAmount(currentBalance > 0 ? String(currentBalance) : "");
      } else {
        setAmount("");
      }
      setDate(todayISO());
      setMethod("Cash");
      setNotes("");
      setErrors({});
      setSaving(false);
    }
  }, [open, record, records]);

  if (!activeRecord) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeRecord) return;

    const errs: Partial<Record<"amount" | "date", string>> = {};
    const numAmount = Number(amount);

    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      errs.amount = "Payment amount must be greater than zero.";
    } else if (numAmount > balanceDue + 0.001) {
      errs.amount = `Payment cannot exceed remaining balance due (${formatINR(balanceDue)}).`;
    }

    if (!date) {
      errs.date = "Please specify a payment date.";
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      await paymentService.create({
        workRecordId: activeRecord.id,
        amount: numAmount,
        paymentDate: date,
        paymentMethod: method,
        notes: notes.trim() || undefined,
      });
      toast.success(`Payment of ${formatINR(numAmount)} recorded.`);
      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={bigDialog}>
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl">Record Payment</DialogTitle>
          <DialogDescription className="break-words text-lg font-semibold text-foreground">
            {activeRecord.employeeName ?? "Employee"} · {formatDate(activeRecord.workDate)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 rounded-lg border-2 border-primary/20 bg-accent p-3 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Total Earnings</p>
            <p className="font-bold text-foreground">{formatINR(activeRecord.calculatedEarnings)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Already Paid</p>
            <p className="font-bold text-success">{formatINR(activeRecord.totalPaid ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Balance Due</p>
            <p className="font-bold text-warning">{formatINR(balanceDue)}</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4" noValidate>
          {records && records.length > 1 && (
            <Field label="Work Date to Settle" htmlFor="pay-record-select">
              <select
                id="pay-record-select"
                className={bigInput}
                value={activeRecord.id}
                onChange={(e) => {
                  const targetId = e.target.value;
                  setSelectedRecordId(targetId);
                  const targetRec = records.find((r) => r.id === targetId);
                  if (targetRec) {
                    const due =
                      targetRec.balanceDue !== undefined
                        ? targetRec.balanceDue
                        : targetRec.calculatedEarnings - (targetRec.totalPaid ?? 0);
                    setAmount(due > 0 ? String(due) : "");
                    setErrors({});
                  }
                }}
              >
                {records.map((r) => {
                  const due =
                    r.balanceDue !== undefined
                      ? r.balanceDue
                      : r.calculatedEarnings - (r.totalPaid ?? 0);
                  return (
                    <option key={r.id} value={r.id}>
                      {formatDate(r.workDate)} — Balance Due: {formatINR(due)}
                    </option>
                  );
                })}
              </select>
            </Field>
          )}

          <Field label="Payment Amount" htmlFor="pay-amt" error={errors.amount}>
            <RupeeInput
              id="pay-amt"
              max={balanceDue}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </Field>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setAmount(String(balanceDue))}
            >
              Pay Full Amount ({formatINR(balanceDue)})
            </Button>
            {balanceDue > 100 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setAmount(String(Math.floor(balanceDue / 2)))}
              >
                Pay Half ({formatINR(Math.floor(balanceDue / 2))})
              </Button>
            )}
          </div>

          <Field label="Payment Date" htmlFor="pay-date" error={errors.date}>
            <input
              id="pay-date"
              type="date"
              max={todayISO()}
              className={bigInput}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>

          <Field label="Payment Method" htmlFor="pay-method">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`h-11 rounded-lg border-2 text-sm font-semibold transition-colors ${
                    method === m
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Notes / Reference (Optional)" htmlFor="pay-notes">
            <input
              id="pay-notes"
              type="text"
              className={bigInput}
              placeholder="e.g. UPI Ref / Cash receipt number"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              size="xl"
              className="w-full sm:flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="xl" className="w-full sm:flex-1" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} Confirm Payment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
