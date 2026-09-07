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

export async function createStaff(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient()

  const payload: TablesInsert<'staff'> = {
    full_name: str(fd, 'full_name') ?? '',
    category: str(fd, 'category') as TablesInsert<'staff'>['category'],
    gender: (str(fd, 'gender') as TablesInsert<'staff'>['gender']) ?? null,
    date_of_birth: str(fd, 'date_of_birth'),
    phone: str(fd, 'phone') ?? '',
    alternate_phone: str(fd, 'alternate_phone'),
    emergency_contact_name: str(fd, 'emergency_contact_name') ?? '',
    emergency_contact_phone: str(fd, 'emergency_contact_phone') ?? '',
    emergency_contact_relation: str(fd, 'emergency_contact_relation'),
    address_line1: str(fd, 'address_line1'),
    area: str(fd, 'area'),
    pincode: str(fd, 'pincode'),
    native_address: str(fd, 'native_address'),
    qualification: str(fd, 'qualification'),
    specialization: str(fd, 'specialization'),
    experience_years: str(fd, 'experience_years') ? Number(fd.get('experience_years')) : null,
    languages: str(fd, 'languages')
      ? String(fd.get('languages'))
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : null,
    nursing_council_reg_no: str(fd, 'nursing_council_reg_no'),
    joining_date: str(fd, 'joining_date') ?? undefined,
    default_daily_wage: Number(fd.get('default_daily_wage') ?? 0),
    default_ot_hourly_rate: Number(fd.get('default_ot_hourly_rate') ?? 0),
  }

  const { data, error } = await supabase.from('staff').insert(payload).select('id').single()
  if (error) return { error: toMessage(error) }

  // Optional bank details in the same form.
  const account = str(fd, 'account_number')
  if (account) {
    await supabase.from('staff_bank_accounts').insert({
      staff_id: data.id,
      account_holder_name: str(fd, 'account_holder_name') ?? payload.full_name,
      account_number: account,
      ifsc_code: str(fd, 'ifsc_code') ?? '',
      bank_name: str(fd, 'bank_name') ?? '',
      branch_name: str(fd, 'branch_name'),
      account_type: 'savings',
    })
  }

  revalidatePath('/staff')
  redirect(`/staff/${data.id}`)
}

export async function setStaffActive(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient()
  const id = String(fd.get('staff_id'))
  const active = fd.get('is_active') === 'true'

  const { error } = await supabase
    .from('staff')
    .update(
      active
        ? { is_active: true, exit_date: null, exit_reason: null }
        : {
            is_active: false,
            exit_date: str(fd, 'exit_date') ?? new Date().toISOString().slice(0, 10),
            exit_reason: str(fd, 'exit_reason'),
          }
    )
    .eq('id', id)

  if (error) return { error: toMessage(error) }
  revalidatePath(`/staff/${id}`)
  return { ok: active ? 'Marked active.' : 'Marked inactive.' }
}
