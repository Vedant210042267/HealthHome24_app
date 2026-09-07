'use client'

import { generateInvoice, recordPayment } from '@/actions/money'
import { ActionForm, SubmitButton } from '@/components/form'
import { Field, Input, Select } from '@/components/ui'
import { todayIST } from '@/lib/format'

export function GenerateInvoiceButton({
  patientId,
  period,
  label = 'Generate',
}: {
  patientId: string
  period: string
  label?: string
}) {
  return (
    <ActionForm action={generateInvoice} className="inline-flex">
      <input type="hidden" name="patient_id" value={patientId} />
      <input type="hidden" name="period_month" value={period} />
      <input type="hidden" name="issue" value="true" />
      <SubmitButton variant="secondary">{label}</SubmitButton>
    </ActionForm>
  )
}

export function PaymentForm({
  patients,
  invoices,
}: {
  patients: { id: string; full_name: string }[]
  invoices: { id: string; invoice_number: string; patient_id: string; balance_due: number | null }[]
}) {
  return (
    <ActionForm action={recordPayment}>
      <div className="grid gap-4 p-4 sm:grid-cols-3">
        <Field label="Patient" required>
          <Select name="patient_id" required defaultValue="">
            <option value="" disabled>
              Choose a patient…
            </option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Against invoice" hint="Leave blank for an advance or deposit">
          <Select name="invoice_id" defaultValue="">
            <option value="">None</option>
            {invoices.map((i) => (
              <option key={i.id} value={i.id}>
                {i.invoice_number} — due ₹{Number(i.balance_due ?? 0).toLocaleString('en-IN')}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Type" required>
          <Select name="direction" defaultValue="against_invoice">
            <option value="against_invoice">Payment against invoice</option>
            <option value="advance">Advance</option>
            <option value="security_deposit">Security deposit</option>
            <option value="refund">Refund</option>
          </Select>
        </Field>
        <Field label="Date received" required>
          <Input name="received_on" type="date" required defaultValue={todayIST()} />
        </Field>
        <Field label="Amount (INR)" required>
          <Input name="amount" type="number" min={1} step="0.01" required />
        </Field>
        <Field label="Mode" required>
          <Select name="payment_mode" defaultValue="upi">
            <option value="upi">UPI</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
            <option value="card">Card</option>
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Reference">
            <Input name="reference" placeholder="NEFT/HDFC/781902" />
          </Field>
        </div>
        <div className="flex items-end">
          <SubmitButton className="w-full">Record receipt</SubmitButton>
        </div>
      </div>
    </ActionForm>
  )
}
