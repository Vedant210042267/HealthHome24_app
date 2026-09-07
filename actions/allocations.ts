'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { TablesInsert } from '@/lib/database.types'
import { type ActionState, toMessage } from './types'

function str(fd: FormData, key: string) {
  const v = fd.get(key)
  const s = typeof v === 'string' ? v.trim() : ''
  return s === '' ? null : s
}

export async function createAllocation(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient()
  const dutyType = str(fd, 'duty_type') as TablesInsert<'duty_allocations'>['duty_type']

  // The schema's duty_alloc_slot_chk requires the slot to agree with the duty type.
  const slot: TablesInsert<'duty_allocations'>['shift_slot'] =
    dutyType === 'shift_24h' ? 'full_day' : dutyType === 'visit' ? 'visit' : (str(fd, 'shift_slot') as 'day' | 'night') ?? 'day'

  const payload: TablesInsert<'duty_allocations'> = {
    patient_id: str(fd, 'patient_id') ?? '',
    staff_id: str(fd, 'staff_id') ?? '',
    duty_type: dutyType,
    shift_slot: slot,
    start_date: str(fd, 'start_date') ?? '',
    end_date: str(fd, 'end_date'),
    patient_daily_rate: Number(fd.get('patient_daily_rate') ?? 0),
    staff_daily_wage: Number(fd.get('staff_daily_wage') ?? 0),
    ot_hourly_rate: Number(fd.get('ot_hourly_rate') ?? 0),
    notes: str(fd, 'notes'),
  }

  const { error } = await supabase.from('duty_allocations').insert(payload)
  if (error) return { error: toMessage(error) }

  revalidatePath('/allocations')
  return { ok: 'Posting created.' }
}

export async function closeAllocation(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient()
  const id = String(fd.get('allocation_id'))

  const { error } = await supabase
    .from('duty_allocations')
    .update({
      status: 'completed',
      end_date: str(fd, 'end_date') ?? new Date().toISOString().slice(0, 10),
      end_reason: str(fd, 'end_reason'),
    })
    .eq('id', id)

  if (error) return { error: toMessage(error) }
  revalidatePath('/allocations')
  return { ok: 'Posting closed.' }
}
