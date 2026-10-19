import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, User, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Employee, WageType } from "@/types";
import { employeeService } from "@/services/employeeService";
import { wageService } from "@/services/wageService";
import { formatWage } from "@/utils/format";
import { Field, RupeeInput, WageTypePicker, bigDialog, bigInput } from "./shared";

type Target = "all" | "one" | null;

export function ManageWageDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<WageType>("hourly");
  const [target, setTarget] = useState<Target>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Employee | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const g = wageService.getGlobal();
    setAmount(String(g.amount));
    setType(g.type);
    setTarget(null);
    setQuery("");
    setSelected(null);
    setError("");
    setConfirming(false);
  }, [open]);

  const results = employeeService.search(query);

  function review() {
    if (amount === "" || isNaN(Number(amount)) || Number(amount) < 0) return setError("Please enter a valid wage amount (0 or more).");
    if (!target) return setError("Please choose who gets this wage.");
    if (target === "one" && !selected) return setError("Please select an employee.");
    setError("");
    setConfirming(true);
  }

  async function confirm() {
    setSaving(true);
    if (target === "all") {
      await wageService.applyGlobal(Number(amount), type);
      toast.success("Common wage updated.");
    } else if (selected) {
      await wageService.applyToEmployee(selected.id, Number(amount), type);
      toast.success(`${selected.name}'s wage updated.`);
    }
    setSaving(false);
    onOpenChange(false);
  }

  const wageText = formatWage(Number(amount) || 0, type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={bigDialog}>
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl">Manage Wage Rates</DialogTitle>
          <DialogDescription>Past work records will not change.</DialogDescription>
        </DialogHeader>

        {confirming ? (
          <div className="space-y-5">
            <p className="rounded-lg border-2 border-primary/30 bg-accent p-4 text-lg font-medium">
              {target === "all"
                ? `Apply ${wageText} as the default wage for employees using the global rate?`
                : `Update ${selected?.name}'s wage to ${wageText}?`}
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button variant="outline" size="xl" className="w-full sm:flex-1" onClick={() => setConfirming(false)}>Cancel</Button>
              <Button size="xl" className="w-full sm:flex-1" onClick={confirm} disabled={saving}>
                {saving && <Loader2 className="animate-spin" />} Confirm
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <Field label="Wage Amount" htmlFor="mw-amt">
              <RupeeInput id="mw-amt" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Wage Type">
              <WageTypePicker value={type} onChange={setType} />
            </Field>

            <div className="space-y-3">
              <p className="text-base font-medium">Who should get this wage?</p>
              {([
                ["all", Users, "Apply to All", "Set this wage as the default for all employees."],
                ["one", User, "Set Wage for a Particular Employee", "Choose one employee and set an individual wage."],
              ] as const).map(([v, Icon, title, desc]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTarget(v)}
                  aria-pressed={target === v}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg border-2 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    target === v ? "border-primary bg-accent" : "border-border",
                  )}
                >
                  <Icon className="mt-0.5 size-6 shrink-0 text-primary" />
                  <span>
                    <span className="block text-base font-semibold">{title}</span>
                    <span className="block text-sm text-muted-foreground">{desc}</span>
                  </span>
                </button>
              ))}
            </div>

            {target === "one" && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                  <input className={cn(bigInput, "pl-10")} placeholder="Search employee by name..." value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
                <div className="max-h-56 space-y-2 overflow-y-auto">
                  {results.length === 0 && <p className="p-2 text-muted-foreground">No employees found.</p>}
                  {results.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setSelected(e)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left",
                        selected?.id === e.id ? "border-2 border-primary bg-accent" : "border-border",
                      )}
                    >
                      <span className="min-w-0 break-words font-medium">{e.name}</span>
                      <span className="shrink-0 text-sm text-muted-foreground">Now: {formatWage(e.wageAmount, e.wageType)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button variant="outline" size="xl" className="w-full sm:flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button size="xl" className="w-full sm:flex-1" onClick={review}>Continue</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
