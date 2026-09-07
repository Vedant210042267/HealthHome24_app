'use client'

import { useState } from 'react'
import { createAllocation } from '@/actions/allocations'
import { ActionForm, SubmitButton } from '@/components/form'
import { Field, Input, Select } from '@/components/ui'
import { todayIST } from '@/lib/format'

type Patient = { id: string; full_name: string; service_type: string; default_daily_rate: number }
type Staff = { id: string; full_name: string; category: string; default_daily_wage: number; default_ot_hourly_rate: number }

export function NewAllocationForm({ patients, staff }: { patients: Patient[]; staff: Staff[] }) {
  const [dutyType, setDutyType] = useState('shift_24h')
  const [rate, setRate] = useState('')
  const [wage, setWage] = useState('')
  const [ot, setOt] = useState('')

  return (
    <ActionForm action={createAllocation}>
      <div className="grid gap-4 p-4 sm:grid-cols-3">
        <Field label="Patient" required>
          <Select
            name="patient_id"
            required
            defaultValue=""
            onChange={(e) => {
              const p = patients.find((x) => x.id === e.target.value)
              if (p) setRate(String(p.default_daily_rate))
            }}
          >
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

        <Field label="Attendant / nurse" required>
          <Select
            name="staff_id"
            required
            defaultValue=""
            onChange={(e) => {
              const s = staff.find((x) => x.id === e.target.value)
              if (s) {
                setWage(String(s.default_daily_wage))
                setOt(String(s.default_ot_hourly_rate))
              }
            }}
          >
            <option value="" disabled>
              Choose staff…
            </option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name} ({s.category.replace('_', ' ')})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Duty type" required>
          <Select name="duty_type" required value={dutyType} onChange={(e) => setDutyType(e.target.value)}>
            <option value="shift_24h">24-hour shift</option>
            <option value="shift_12h">12-hour shift</option>
            <option value="visit">Visit</option>
          </Select>
        </Field>

        {dutyType === 'shift_12h' && (
          <Field label="Which 12 hours" required>
            <Select name="shift_slot" defaultValue="day">
              <option value="day">Day (08:00 – 20:00)</option>
              <option value="night">Night (20:00 – 08:00)</option>
            </Select>
          </Field>
        )}

        <Field label="Start date" required>
          <Input name="start_date" type="date" required defaultValue={todayIST()} />
        </Field>
        <Field label="End date" hint="Leave blank for an open-ended posting">
          <Input name="end_date" type="date" />
        </Field>

        <Field label="Bill to patient per day (INR)" required>
          <Input
            name="patient_daily_rate"
            type="number"
            min={0}
            step="1"
            required
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="1800"
          />
        </Field>
        <Field label="Pay attendant per day (INR)" required>
          <Input
            name="staff_daily_wage"
            type="number"
            min={0}
            step="1"
            required
            value={wage}
            onChange={(e) => setWage(e.target.value)}
            placeholder="1200"
          />
        </Field>
        <Field label="Overtime per hour (INR)">
          <Input name="ot_hourly_rate" type="number" min={0} step="1" value={ot} onChange={(e) => setOt(e.target.value)} />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Notes">
            <Input name="notes" placeholder="Family provides meals. Sunday week-off." />
          </Field>
        </div>

        <div className="flex items-end">
          <SubmitButton className="w-full">Create posting</SubmitButton>
        </div>
      </div>

      {Number(rate) > 0 && Number(wage) > 0 && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-sm text-slate-600">
          Daily margin{' '}
          <span className="tnum font-semibold text-slate-900">
            ₹{(Number(rate) - Number(wage)).toLocaleString('en-IN')}
          </span>{' '}
          ({(((Number(rate) - Number(wage)) / Number(rate)) * 100).toFixed(1)}% of the billed rate)
        </div>
      )}
    </ActionForm>
  )
}
