'use client'

import { runPayroll, approvePayroll, reopenPayroll, markPayslipPaid } from '@/actions/money'
import { ActionForm, SubmitButton } from '@/components/form'
import { Input, Select } from '@/components/ui'

export function RunPayrollButton({ period, exists }: { period: string; exists: boolean }) {
  return (
    <ActionForm action={runPayroll}>
      <input type="hidden" name="period_month" value={period} />
      <SubmitButton variant={exists ? 'secondary' : 'primary'}>
        {exists ? 'Rebuild draft' : 'Build payroll'}
      </SubmitButton>
    </ActionForm>
  )
}

export function ApprovePayrollButton({ runId }: { runId: string }) {
  return (
    <ActionForm action={approvePayroll}>
      <input type="hidden" name="run_id" value={runId} />
      <SubmitButton>Approve &amp; lock</SubmitButton>
    </ActionForm>
  )
}

export function ReopenPayrollButton({ runId }: { runId: string }) {
  return (
    <ActionForm action={reopenPayroll}>
      <input type="hidden" name="run_id" value={runId} />
      <SubmitButton variant="secondary">Reopen</SubmitButton>
    </ActionForm>
  )
}

export function MarkPaidForm({ itemId, amount }: { itemId: string; amount: number }) {
  return (
    <ActionForm action={markPayslipPaid} className="flex items-end gap-1.5">
      <input type="hidden" name="item_id" value={itemId} />
      <Input name="amount" type="number" step="0.01" defaultValue={amount} className="w-24" aria-label="Amount paid" />
      <Select name="mode" defaultValue="bank_transfer" className="w-28" aria-label="Payment mode">
        <option value="bank_transfer">Bank</option>
        <option value="upi">UPI</option>
        <option value="cash">Cash</option>
        <option value="cheque">Cheque</option>
      </Select>
      <Input name="reference" placeholder="Ref" className="w-24" aria-label="Reference" />
      <SubmitButton variant="secondary">Pay</SubmitButton>
    </ActionForm>
  )
}
