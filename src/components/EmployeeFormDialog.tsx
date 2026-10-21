import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Employee, WageType } from "@/types";
import { employeeService } from "@/services/employeeService";
import { wageService } from "@/services/wageService";
import { Field, RupeeInput, WageTypePicker, bigDialog, bigInput } from "./shared";
import { formatWage } from "@/utils/format";

import { ApiError } from "@/services/api";

export function EmployeeFormDialog({ open, onOpenChange, employee }: { open: boolean; onOpenChange: (o: boolean) => void; employee?: Employee | undefined }) {
  const [name, setName] = useState("");
  const [profile, setProfile] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [wage, setWage] = useState("");
  const [wageType, setWageType] = useState<WageType>("hourly");
  const [errors, setErrors] = useState<Partial<Record<"name" | "phone" | "age" | "wage", string>>>({});
  const [saving, setSaving] = useState(false);
  const global = wageService.getGlobal();

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setName(employee?.name ?? "");
    setProfile(employee?.workProfile ?? "");
    setPhone(employee?.phone ?? "");
    setAge(employee?.age?.toString() ?? "");
    setWage(employee?.wageSource === "individual" ? String(employee.wageAmount) : "");
    setWageType(employee?.wageType ?? global.type);
  }, [open, employee]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const errs: Partial<Record<"name" | "phone" | "age" | "wage", string>> = {};
    if (!name.trim()) errs.name = "Please enter the employee's name.";
    if (phone.trim()) {
      if (!/^\+?[\d\s-]{6,15}$/.test(phone.trim())) {
        errs.phone = "Please enter a valid phone number.";
      } else {
        const cleanPhone = phone.trim().replace(/[\s-]/g, "");
        const allEmployees = employeeService.listAllSync();
        const existing = allEmployees.find(
          (e) => e.phone && e.phone.trim().replace(/[\s-]/g, "") === cleanPhone && (!employee || e.id !== employee.id),
        );
        if (existing) {
          errs.phone = `An employee with phone number '${phone.trim()}' already exists (${existing.name}). Please update their existing profile instead.`;
        }
      }
    }
    if (age && (!Number.isInteger(Number(age)) || Number(age) <= 0 || Number(age) > 120)) errs.age = "Age must be a positive number.";
    if (wage && (isNaN(Number(wage)) || Number(wage) < 0)) errs.wage = "Wage must be 0 or more.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const input = {
        name,
        workProfile: profile,
        phone,
        age: age ? Number(age) : undefined,
        wageAmount: wage ? Number(wage) : undefined,
        wageType,
      };
      if (employee) {
        await employeeService.update(employee.id, input);
        toast.success("Employee updated successfully.");
      } else {
        await employeeService.create(input);
        toast.success("Employee added successfully.");
      }
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.fieldErrors) {
        const formErrors: Partial<Record<"name" | "phone" | "age" | "wage", string>> = {};
        if (err.fieldErrors["name"]) formErrors["name"] = err.fieldErrors["name"].join(" ");
        if (err.fieldErrors["phone_number"]) formErrors["phone"] = err.fieldErrors["phone_number"].join(" ");
        if (err.fieldErrors["age"]) formErrors["age"] = err.fieldErrors["age"].join(" ");
        if (err.fieldErrors["wage_amount"]) formErrors["wage"] = err.fieldErrors["wage_amount"].join(" ");
        setErrors((prev) => ({ ...prev, ...formErrors }));
      }
      toast.error(err instanceof Error ? err.message : "Failed to save employee.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={bigDialog}>
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl">{employee ? "Edit Employee" : "Add Employee"}</DialogTitle>
          <DialogDescription>Only the name is required.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4" noValidate>
          <Field label="Employee Name *" htmlFor="ef-name" error={errors.name}>
            <input id="ef-name" className={bigInput} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Work Profile" htmlFor="ef-prof">
            <input id="ef-prof" className={bigInput} value={profile} onChange={(e) => setProfile(e.target.value)} placeholder="e.g. Helper" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone Number" htmlFor="ef-phone" error={errors.phone}>
              <input id="ef-phone" type="tel" inputMode="tel" className={bigInput} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label="Age" htmlFor="ef-age" error={errors.age}>
              <input id="ef-age" type="number" inputMode="numeric" className={bigInput} value={age} onChange={(e) => setAge(e.target.value)} />
            </Field>
          </div>
          <Field
            label="Individual Wage"
            htmlFor="ef-wage"
            error={errors.wage}
            hint={`Leave empty to use the common wage (${formatWage(global.amount, global.type)}).`}
          >
            <RupeeInput id="ef-wage" value={wage} onChange={(e) => setWage(e.target.value)} placeholder="Common wage" />
          </Field>
          {wage && <WageTypePicker value={wageType} onChange={setWageType} />}
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
            <Button type="button" variant="outline" size="xl" className="w-full sm:flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="xl" className="w-full sm:flex-1" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} Save Employee
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
