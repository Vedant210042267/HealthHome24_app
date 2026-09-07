import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/database.types'

export type Profile = Tables<'profiles'>
export type Role = Profile['role']

/**
 * The signed-in user and their profile row. RLS already restricts what the
 * queries return; the role is used only to decide what to *render*.
 */
export async function requireProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    // Authenticated but no profile row — the auth trigger should have made one.
    redirect('/login?error=no-profile')
  }

  return { user, profile: profile as Profile, supabase }
}

export const isBackOffice = (role: Role) =>
  role === 'admin' || role === 'coordinator' || role === 'accountant'
export const isFinance = (role: Role) => role === 'admin' || role === 'accountant'
export const isOps = (role: Role) => role === 'admin' || role === 'coordinator'
