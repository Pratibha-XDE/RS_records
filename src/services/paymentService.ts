import type { BackendDailyWorkRecord, BackendPayment, Payment, PaymentInput } from "@/types";
import { mapBackendPaymentToPayment, mapBackendWorkRecordToWorkRecord } from "@/types";
import { apiClient } from "./api";
import { setState } from "./store";

// Guard against concurrent in-flight payment submissions for the same work record
const pendingWorkRecordPayments = new Set<string>();

export const paymentService = {
  /**
   * Record a payment disbursement against a daily work record.
   * Supports both full and partial payments.
   * Uses backend validation and concurrency locks as source of truth.
   * Guarded against in-flight duplicates caused by rapid clicks or retries.
   */
  async create(input: PaymentInput): Promise<Payment> {
    const recordKey = String(input.workRecordId);

    if (input.amount <= 0) {
      throw new Error("Payment amount must be greater than zero.");
    }

    if (pendingWorkRecordPayments.has(recordKey)) {
      throw new Error("A payment transaction for this work record is already processing. Please wait.");
    }

    pendingWorkRecordPayments.add(recordKey);

    try {
      const payload = {
        work_record: Number(input.workRecordId),
        amount: Number(input.amount).toFixed(2),
        payment_date: input.paymentDate,
        payment_method: input.paymentMethod?.trim() || "Cash",
        notes: input.notes?.trim() || null,
      };

      const paymentDto = await apiClient.post<BackendPayment>("/api/payments/", payload);

      // Re-fetch the updated work record to synchronize backend-calculated total_paid, balance_due, and payment_status
      try {
        const updatedRecordDto = await apiClient.get<BackendDailyWorkRecord>(
          `/api/work-records/${input.workRecordId}/`,
        );
        const mappedRecord = mapBackendWorkRecordToWorkRecord(updatedRecordDto);
        setState((s) => ({
          ...s,
          records: s.records.some((r) => r.id === String(mappedRecord.id))
            ? s.records.map((r) => (r.id === String(mappedRecord.id) ? mappedRecord : r))
            : [...s.records, mappedRecord],
        }));
      } catch {
        // If re-fetch fails, payment was still logged successfully
      }

      return mapBackendPaymentToPayment(paymentDto);
    } finally {
      pendingWorkRecordPayments.delete(recordKey);
    }
  },

  /**
   * Fetch payment disbursement history for a specific daily work record.
   */
  async listForWorkRecord(workRecordId: number | string): Promise<Payment[]> {
    const res = await apiClient.get<BackendPayment[] | { results: BackendPayment[] }>("/api/payments/", {
      params: { work_record: String(workRecordId) },
    });
    const dtos = Array.isArray(res) ? res : (res?.results ?? []);
    return dtos.map(mapBackendPaymentToPayment);
  },

  /**
   * List all payment disbursements with optional date filter.
   */
  async listAll(params?: { paymentDate?: string }): Promise<Payment[]> {
    const queryParams: Record<string, string | undefined> = {};
    if (params?.paymentDate) {
      queryParams["payment_date"] = params.paymentDate;
    }
    const res = await apiClient.get<BackendPayment[] | { results: BackendPayment[] }>("/api/payments/", { params: queryParams });
    const dtos = Array.isArray(res) ? res : (res?.results ?? []);
    return dtos.map(mapBackendPaymentToPayment);
  },
};
