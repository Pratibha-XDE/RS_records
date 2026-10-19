import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ClipboardPen, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/AppHeader";
import { WorkEntryDialog } from "@/components/WorkEntryDialog";
import { Field, StatusBadge, bigInput } from "@/components/shared";
import { useAppState } from "@/hooks/useAppState";
import { authService } from "@/services/authService";
import type { WorkRecord } from "@/types";
import { formatDate, formatINR, formatWage } from "@/utils/format";

export const Route = createFileRoute("/employees/$id")({
  head: () => ({
    meta: [
      { title: "Work History — Daily Wage Calculator" },
      { name: "description", content: "Daily work history, earnings and pending payments for an employee." },
      { property: "og:title", content: "Work History — Daily Wage Calculator" },
      { property: "og:description", content: "Daily work history, earnings and pending payments for an employee." },
    ],
  }),
  component: LogsPage,
});

function LogsPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { state, ready } = useAppState();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [dialog, setDialog] = useState<{ open: boolean; record?: WorkRecord | undefined }>({ open: false });

  useEffect(() => {
    if (!authService.isLoggedIn()) navigate({ to: "/" });
  }, [navigate]);

  // Reset filter when switching employees
  useEffect(() => {
    setFrom(""); setTo(""); setApplied({ from: "", to: "" });
  }, [id]);

  const employee = state.employees.find((e) => e.id === id) ?? null;
  const records = state.records
    .filter((r) => r.employeeId === id)
    .filter((r) => (!applied.from || r.workDate >= applied.from) && (!applied.to || r.workDate <= applied.to))
    .sort((a, b) => b.workDate.localeCompare(a.workDate));
  const total = records.reduce((s, r) => s + r.calculatedEarnings, 0);
  const pending = records.filter((r) => r.paymentStatus === "not_paid").reduce((s, r) => s + r.calculatedEarnings, 0);

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-5">
        <Button variant="outline" size="xl" asChild>
          <Link to="/dashboard"><ArrowLeft /> Back</Link>
        </Button>

        {ready && !employee && <p className="text-muted-foreground">Employee not found.</p>}

        {ready && employee && (
          <>
            <section>
              <h1 className="break-words text-2xl font-bold">Work History — {employee.name}</h1>
              <p className="text-muted-foreground">
                Assigned wage: <span className="font-semibold text-foreground">{formatWage(employee.wageAmount, employee.wageType)}</span>
                {!employee.isActive && " · Inactive"}
              </p>
            </section>

            <div className="grid grid-cols-3 gap-2">
              {[["Days Recorded", String(records.length)], ["Total Earnings", formatINR(total)], ["Pending Amount", formatINR(pending)]].map(([l, v]) => (
                <div key={l} className="rounded-xl border-2 border-border p-3">
                  <p className="text-xs text-muted-foreground sm:text-sm">{l}</p>
                  <p className="break-words text-lg font-bold sm:text-xl">{v}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3 rounded-xl border-2 border-border p-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start Date" htmlFor="f-from"><input id="f-from" type="date" className={bigInput} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
                <Field label="End Date" htmlFor="f-to"><input id="f-to" type="date" className={bigInput} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button size="xl" onClick={() => setApplied({ from, to })}>Apply Filter</Button>
                <Button size="xl" variant="outline" onClick={() => { setFrom(""); setTo(""); setApplied({ from: "", to: "" }); }}>Show All</Button>
              </div>
            </div>

            {employee.isActive && (
              <Button size="xl" className="w-full" onClick={() => setDialog({ open: true })}><ClipboardPen /> Record Work</Button>
            )}

            {records.length === 0 ? (
              <p className="rounded-xl border-2 border-dashed border-border p-8 text-center text-muted-foreground">No work records yet.</p>
            ) : (
              <ul className="space-y-3">
                {records.map((r) => (
                  <li key={r.id} className="rounded-xl border-2 border-border p-4 shadow-card">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-lg font-bold">{formatDate(r.workDate)}</h2>
                      <StatusBadge status={r.paymentStatus} />
                    </div>
                    <dl className="mt-2 space-y-1 text-base">
                      <div><dt className="inline text-muted-foreground">Working time: </dt><dd className="inline">{r.hoursWorked} hours {r.minutesWorked} minutes</dd></div>
                      <div><dt className="inline text-muted-foreground">Wage rate: </dt><dd className="inline">{formatWage(r.wageRateUsed, r.wageType)}</dd></div>
                      <div><dt className="inline text-muted-foreground">Daily earnings: </dt><dd className="inline text-lg font-bold">{formatINR(r.calculatedEarnings)}</dd></div>
                    </dl>
                    {state.audits.some((a) => a.recordId === r.id) && (
                      <p className="mt-1 text-xs text-muted-foreground">Corrected {state.audits.filter((a) => a.recordId === r.id).length}× · last updated {new Date(r.updatedAt).toLocaleString("en-IN")}</p>
                    )}
                    <Button variant="outline" size="xl" className="mt-3 w-full" onClick={() => setDialog({ open: true, record: r })}><Pencil /> Edit Record</Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
      <WorkEntryDialog open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} employee={employee} record={dialog.record} />
    </div>
  );
}
