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

// ---------------------------------------------------------------- payroll ---

export async function runPayroll(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient()
  const period = String(fd.get('period_month'))

  const { error } = await supabase.rpc('fn_create_payroll_run', {
    p_period: period,
    p_notes: str(fd, 'notes'),
  })

  if (error) return { error: toMessage(error) }
  revalidatePath('/payroll')
  return { ok: 'Draft payroll built from attendance.' }
}

export async function approvePayroll(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_approve_payroll_run', {
    p_run_id: String(fd.get('run_id')),
  })
  if (error) return { error: toMessage(error) }
  revalidatePath('/payroll')
  return { ok: 'Payroll approved. That month of attendance is now locked.' }
}

export async function reopenPayroll(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_reopen_payroll_run', {
    p_run_id: String(fd.get('run_id')),
  })
  if (error) return { error: toMessage(error) }
  revalidatePath('/payroll')
  return { ok: 'Payroll reopened for editing.' }
}

export async function markPayslipPaid(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_mark_payslip_paid', {
    p_item_id: String(fd.get('item_id')),
    p_amount: fd.get('amount') ? Number(fd.get('amount')) : null,
    p_mode: (str(fd, 'mode') as Enums<'payment_mode'>) ?? 'bank_transfer',
    p_reference: str(fd, 'reference'),
  })
  if (error) return { error: toMessage(error) }
  revalidatePath('/payroll')
  return { ok: 'Marked paid.' }
}

// --------------------------------------------------------------- advances ---

export async function createAdvance(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient()

  const { error } = await supabase.from('staff_advances').insert({
    staff_id: String(fd.get('staff_id')),
    advance_type: (str(fd, 'advance_type') as Enums<'advance_type'>) ?? 'advance',
    issued_on: str(fd, 'issued_on') ?? undefined,
    amount: Number(fd.get('amount') ?? 0),
    reason: str(fd, 'reason'),
    recovery_per_cycle: Number(fd.get('recovery_per_cycle') ?? 0),
    payment_mode: (str(fd, 'payment_mode') as Enums<'payment_mode'>) ?? 'cash',
    payment_reference: str(fd, 'payment_reference'),
  })

  if (error) return { error: toMessage(error) }
  revalidatePath('/advances')
  return { ok: 'Advance recorded.' }
}

// ---------------------------------------------------------------- billing ---

export async function generateInvoice(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('fn_generate_patient_invoice', {
    p_patient_id: String(fd.get('patient_id')),
    p_period: String(fd.get('period_month')),
    p_issue: fd.get('issue') === 'true',
  })

  if (error) return { error: toMessage(error) }
  revalidatePath('/billing')
  return { ok: 'Invoice generated.' }
}

export async function recordPayment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient()

  const { error } = await supabase.from('patient_payments').insert({
    patient_id: String(fd.get('patient_id')),
    invoice_id: str(fd, 'invoice_id'),
    direction: (str(fd, 'direction') as Enums<'payment_direction'>) ?? 'against_invoice',
    received_on: str(fd, 'received_on') ?? undefined,
    amount: Number(fd.get('amount') ?? 0),
    payment_mode: (str(fd, 'payment_mode') as Enums<'payment_mode'>) ?? 'upi',
    reference: str(fd, 'reference'),
    notes: str(fd, 'notes'),
  })

  if (error) return { error: toMessage(error) }
  revalidatePath('/billing')
  return { ok: 'Receipt recorded.' }
}

export async function cancelInvoice(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('patient_invoices')
    .update({ status: 'cancelled' })
    .eq('id', String(fd.get('invoice_id')))
  if (error) return { error: toMessage(error) }
  revalidatePath('/billing')
  return { ok: 'Invoice cancelled.' }
}
