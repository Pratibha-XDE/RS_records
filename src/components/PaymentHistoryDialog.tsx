import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Payment, WorkRecord } from "@/types";
import { paymentService } from "@/services/paymentService";
import { formatDate, formatINR } from "@/utils/format";
import { bigDialog } from "./shared";

export function PaymentHistoryDialog({
  open,
  onOpenChange,
  record,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: WorkRecord | null;
}) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && record) {
      setLoading(true);
      setError(null);
      paymentService
        .listForWorkRecord(record.id)
        .then((data) => setPayments(data))
        .catch((err) => setError(err instanceof Error ? err.message : "Failed to load payment history."))
        .finally(() => setLoading(false));
    }
  }, [open, record]);

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={bigDialog}>
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl">Payment History</DialogTitle>
          <DialogDescription className="break-words text-lg font-semibold text-foreground">
            {record.employeeName ?? "Employee"} · {formatDate(record.workDate)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 rounded-lg border-2 border-primary/20 bg-accent p-3 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Total Earnings</p>
            <p className="font-bold text-foreground">{formatINR(record.calculatedEarnings)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Paid</p>
            <p className="font-bold text-success">{formatINR(record.totalPaid ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Remaining Balance</p>
            <p className="font-bold text-warning">{formatINR(record.balanceDue ?? 0)}</p>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {!loading && !error && payments.length === 0 && (
          <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">
            No payments logged for this work record.
          </p>
        )}

        {!loading && payments.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Disbursement Records ({payments.length})</h3>
            <ul className="space-y-2">
              {payments.map((p) => (
                <li key={p.id} className="rounded-lg border-2 border-border bg-card p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">{formatINR(p.amount)}</span>
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {p.paymentMethod ?? "Cash"}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Disbursed: {formatDate(p.paymentDate)}</span>
                    {p.notes && <span className="italic">{p.notes}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Button type="button" variant="outline" size="xl" className="w-full" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
}
