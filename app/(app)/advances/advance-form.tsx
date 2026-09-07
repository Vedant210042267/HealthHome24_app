'use client'

import { createAdvance } from '@/actions/money'
import { ActionForm, SubmitButton } from '@/components/form'
import { Field, Input, Select } from '@/components/ui'
import { todayIST } from '@/lib/format'

export function AdvanceForm({ staff }: { staff: { id: string; full_name: string }[] }) {
  return (
    <ActionForm action={createAdvance}>
      <div className="grid gap-4 p-4 sm:grid-cols-3">
        <Field label="Attendant" required>
          <Select name="staff_id" required defaultValue="">
            <option value="" disabled>
              Choose staff…
            </option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Type" required>
          <Select name="advance_type" defaultValue="advance">
            <option value="advance">Advance</option>
            <option value="loan">Loan</option>
            <option value="festival_advance">Festival advance</option>
          </Select>
        </Field>
        <Field label="Date given" required>
          <Input name="issued_on" type="date" required defaultValue={todayIST()} />
        </Field>
        <Field label="Amount (INR)" required>
          <Input name="amount" type="number" min={1} step="1" required placeholder="10000" />
        </Field>
        <Field label="Recover per payroll (INR)" hint="0 means recover the whole balance at the next payroll">
          <Input name="recovery_per_cycle" type="number" min={0} step="1" defaultValue={0} />
        </Field>
        <Field label="Paid by">
          <Select name="payment_mode" defaultValue="cash">
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cheque">Cheque</option>
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Reason">
            <Input name="reason" placeholder="Family medical emergency" />
          </Field>
        </div>
        <div className="flex items-end">
          <SubmitButton className="w-full">Record advance</SubmitButton>
        </div>
      </div>
    </ActionForm>
  )
}
