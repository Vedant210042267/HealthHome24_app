'use client'

import { useState } from 'react'
import { markAttendance } from '@/actions/attendance'
import { ActionForm, SubmitButton } from '@/components/form'
import { Select, Input } from '@/components/ui'

const STATUSES = [
  ['present', 'Present'],
  ['half_day', 'Half day'],
  ['absent', 'Absent'],
  ['replaced', 'Replaced'],
  ['week_off', 'Week off'],
  ['paid_leave', 'Paid leave'],
  ['unpaid_leave', 'Unpaid leave'],
]

export function MarkForm({
  allocationId,
  staffId,
  patientId,
  dutyDate,
  current,
  reliefStaff,
}: {
  allocationId: string
  staffId: string
  patientId: string
  dutyDate: string
  current: { status: string; overtime_hours: number; notes: string | null; replacement_staff_id: string | null } | null
  reliefStaff: { id: string; full_name: string }[]
}) {
  const [status, setStatus] = useState(current?.status ?? 'present')

  return (
    <ActionForm action={markAttendance} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="duty_allocation_id" value={allocationId} />
      <input type="hidden" name="staff_id" value={staffId} />
      <input type="hidden" name="patient_id" value={patientId} />
      <input type="hidden" name="duty_date" value={dutyDate} />

      <Select
        name="status"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="w-36"
        aria-label="Attendance status"
      >
        {STATUSES.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>

      {status === 'replaced' && (
        <Select name="replacement_staff_id" defaultValue={current?.replacement_staff_id ?? ''} className="w-44" required>
          <option value="">Relief attendant…</option>
          {reliefStaff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </Select>
      )}

      <Input
        name="overtime_hours"
        type="number"
        step="0.5"
        min={0}
        max={24}
        defaultValue={current?.overtime_hours ?? 0}
        className="w-20"
        aria-label="Overtime hours"
        title="Overtime hours"
      />

      <Input
        name="notes"
        defaultValue={current?.notes ?? ''}
        placeholder="Note"
        className="w-40"
        aria-label="Notes"
      />

      <SubmitButton variant="secondary">Save</SubmitButton>
    </ActionForm>
  )
}
