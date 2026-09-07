'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Enums } from '@/lib/database.types'
import { type ActionState, toMessage } from './types'

function str(fd: FormData, key: string) {
  const v = fd.get(key)
  const s = typeof v === 'string' ? v.trim() : ''
  return s === '' ? null : s
}

/**
 * Coordinator marking a duty. The rates, patient and shift come from the
 * allocation via trg_attendance_defaults, so they are never posted by the client.
 */
export async function markAttendance(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient()

  const status = str(fd, 'status') as Enums<'attendance_status'>
  const replacement = str(fd, 'replacement_staff_id')

  const { error } = await supabase.from('attendance').upsert(
    {
      duty_allocation_id: String(fd.get('duty_allocation_id')),
      staff_id: String(fd.get('staff_id')),
      patient_id: String(fd.get('patient_id')),
      duty_date: String(fd.get('duty_date')),
      status,
      overtime_hours: Number(fd.get('overtime_hours') ?? 0),
      replacement_staff_id: status === 'replaced' ? replacement : null,
      notes: str(fd, 'notes'),
    },
    { onConflict: 'duty_allocation_id,duty_date,visit_sequence,staff_id' }
  )

  if (error) return { error: toMessage(error) }
  revalidatePath('/attendance')
  revalidatePath('/dashboard')
  return { ok: 'Saved.' }
}

/** Attendant punching in from the mobile app, with coordinates from the device. */
export async function checkIn(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient()

  const { error } = await supabase.from('attendance').upsert(
    {
      duty_allocation_id: String(fd.get('duty_allocation_id')),
      staff_id: String(fd.get('staff_id')),
      patient_id: String(fd.get('patient_id')),
      duty_date: String(fd.get('duty_date')),
      status: 'present',
      check_in_at: new Date().toISOString(),
      check_in_lat: fd.get('lat') ? Number(fd.get('lat')) : null,
      check_in_lng: fd.get('lng') ? Number(fd.get('lng')) : null,
      check_in_accuracy_m: fd.get('accuracy') ? Number(fd.get('accuracy')) : null,
      check_in_source: 'mobile_gps',
    },
    { onConflict: 'duty_allocation_id,duty_date,visit_sequence,staff_id' }
  )

  if (error) return { error: toMessage(error) }
  revalidatePath('/attendance')
  revalidatePath('/dashboard')
  return { ok: 'Checked in.' }
}

export async function checkOut(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('attendance')
    .update({
      check_out_at: new Date().toISOString(),
      check_out_lat: fd.get('lat') ? Number(fd.get('lat')) : null,
      check_out_lng: fd.get('lng') ? Number(fd.get('lng')) : null,
      check_out_accuracy_m: fd.get('accuracy') ? Number(fd.get('accuracy')) : null,
      check_out_source: 'mobile_gps',
    })
    .eq('id', String(fd.get('attendance_id')))

  if (error) return { error: toMessage(error) }
  revalidatePath('/attendance')
  revalidatePath('/dashboard')
  return { ok: 'Checked out.' }
}
