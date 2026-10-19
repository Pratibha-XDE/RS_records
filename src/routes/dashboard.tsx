import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClipboardPen, History, MoreVertical, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription } from "@/components/ui/alert-dialog";
import { AppHeader } from "@/components/AppHeader";
import { EmployeeFormDialog } from "@/components/EmployeeFormDialog";
import { WorkEntryDialog } from "@/components/WorkEntryDialog";
import { ManageWageDialog } from "@/components/ManageWageDialog";
import { bigInput } from "@/components/shared";
import { useAppState } from "@/hooks/useAppState";
import { authService } from "@/services/authService";
import { employeeService } from "@/services/employeeService";
import type { Employee } from "@/types";
import { formatLongToday, formatWage } from "@/utils/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Employees — Daily Wage Calculator" },
      { name: "description", content: "Search employees, record today's work and manage wage rates." },
      { property: "og:title", content: "Employees — Daily Wage Calculator" },
      { property: "og:description", content: "Search employees, record today's work and manage wage rates." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const { state, ready } = useAppState();
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [wageOpen, setWageOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | undefined>();
  const [workFor, setWorkFor] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState<Employee | null>(null);

  useEffect(() => {
    if (!authService.isLoggedIn()) navigate({ to: "/" });
  }, [navigate]);

  const t = q.trim().toLowerCase();
  const employees = state.employees.filter((e) => e.isActive && e.name.toLowerCase().includes(t));

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-5">
        <section>
          <h1 className="text-2xl font-bold">Employees</h1>
          <p className="text-muted-foreground">Manage employees, working hours, and daily wages.</p>
          <p className="mt-1 text-sm font-medium text-primary">{ready ? formatLongToday() : "\u00a0"}</p>
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button size="xl" onClick={() => { setEditing(undefined); setAddOpen(true); }}><Plus /> Add Employee</Button>
          <Button size="xl" variant="outline" className="border-2 border-primary/40 text-primary" onClick={() => setWageOpen(true)}><Plus /> Add Wage</Button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <input aria-label="Search employee" className={cn(bigInput, "h-14 pl-11 text-lg")} placeholder="Search employee by name..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {ready && employees.length === 0 && (
          <p className="rounded-xl border-2 border-dashed border-border p-8 text-center text-muted-foreground">No employees found.</p>
        )}

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ready && employees.map((e) => (
            <li key={e.id} className="flex flex-col rounded-xl border-2 border-border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <button type="button" onClick={() => setWorkFor(e)} className="min-w-0 text-left">
                  <h2 className="break-words text-lg font-bold leading-snug">{e.name}</h2>
                  {e.workProfile && <p className="text-sm text-muted-foreground">Work profile: {e.workProfile}</p>}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`More options for ${e.name}`} className="-mr-2 -mt-1 size-10 shrink-0"><MoreVertical className="size-5" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="py-2.5 text-base" onSelect={() => { setEditing(e); setAddOpen(true); }}><Pencil /> Edit</DropdownMenuItem>
                    <DropdownMenuItem className="py-2.5 text-base text-destructive" onSelect={() => setDeleting(e)}><Trash2 /> Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <p className="mt-2 text-base">
                Assigned wage: <span className="font-semibold">{formatWage(e.wageAmount, e.wageType)}</span>
                <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {e.wageSource === "global" ? "Common" : "Individual"}
                </span>
              </p>
              <div className="mt-4 grid gap-2">
                <Button size="xl" onClick={() => setWorkFor(e)}><ClipboardPen /> Enter Today's Work</Button>
                <Button size="xl" variant="outline" asChild>
                  <Link to="/employees/$id" params={{ id: e.id }}><History /> View Logs</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </main>

      <EmployeeFormDialog open={addOpen} onOpenChange={setAddOpen} employee={editing} />
      <ManageWageDialog open={wageOpen} onOpenChange={setWageOpen} />
      <WorkEntryDialog open={!!workFor} onOpenChange={(o) => !o && setWorkFor(null)} employee={workFor} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="w-[calc(100vw-1.5rem)] max-w-md rounded-xl">
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle>Are you sure you want to delete this employee?</AlertDialogTitle>
            <AlertDialogDescription>{deleting?.name} will be hidden from the list. Past work records are kept.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-12 text-base">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="h-12 bg-destructive text-base text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleting) return;
                await employeeService.deactivate(deleting.id);
                toast.success("Employee deleted.");
                setDeleting(null);
              }}
            >
              Delete Employee
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
