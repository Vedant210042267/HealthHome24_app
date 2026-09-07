'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { TablesInsert } from '@/lib/database.types'
import { type ActionState, toMessage } from './types'

function str(fd: FormData, key: string) {
  const v = fd.get(key)
  const s = typeof v === 'string' ? v.trim() : ''
  return s === '' ? null : s
}
function numOrNull(fd: FormData, key: string) {
  const s = str(fd, key)
  return s === null ? null : Number(s)
}

export async function createPatient(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient()

  const payload: TablesInsert<'patients'> = {
    full_name: str(fd, 'full_name') ?? '',
    gender: (str(fd, 'gender') as TablesInsert<'patients'>['gender']) ?? null,
    date_of_birth: str(fd, 'date_of_birth'),
    age_years: numOrNull(fd, 'age_years'),
    address_line1: str(fd, 'address_line1') ?? '',
    address_line2: str(fd, 'address_line2'),
    landmark: str(fd, 'landmark'),
    area: str(fd, 'area'),
    pincode: str(fd, 'pincode'),
    latitude: numOrNull(fd, 'latitude'),
    longitude: numOrNull(fd, 'longitude'),
    primary_contact_name: str(fd, 'primary_contact_name') ?? '',
    primary_contact_phone: str(fd, 'primary_contact_phone') ?? '',
    primary_contact_relation: str(fd, 'primary_contact_relation'),
    family_contact_name: str(fd, 'family_contact_name'),
    family_contact_phone: str(fd, 'family_contact_phone'),
    family_contact_relation: str(fd, 'family_contact_relation'),
    referring_doctor_id: str(fd, 'referring_doctor_id'),
    diagnosis: str(fd, 'diagnosis'),
    care_requirements: str(fd, 'care_requirements'),
    mobility_status: str(fd, 'mobility_status'),
    service_type: str(fd, 'service_type') as TablesInsert<'patients'>['service_type'],
    default_daily_rate: Number(fd.get('default_daily_rate') ?? 0),
    security_deposit: numOrNull(fd, 'security_deposit') ?? 0,
    start_date: str(fd, 'start_date') ?? undefined,
    referral_source: str(fd, 'referral_source'),
    notes: str(fd, 'notes'),
  }

  const { data, error } = await supabase.from('patients').insert(payload).select('id').single()
  if (error) return { error: toMessage(error) }

  revalidatePath('/patients')
  redirect(`/patients/${data.id}`)
}

export async function dischargePatient(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient()
  const id = String(fd.get('patient_id'))

  const { error } = await supabase
    .from('patients')
    .update({
      status: 'discharged',
      end_date: str(fd, 'end_date') ?? new Date().toISOString().slice(0, 10),
      discharge_reason: str(fd, 'discharge_reason'),
    })
    .eq('id', id)

  if (error) return { error: toMessage(error) }
  revalidatePath(`/patients/${id}`)
  return { ok: 'Patient discharged.' }
}
