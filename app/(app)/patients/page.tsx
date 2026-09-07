import Link from 'next/link'
import { requireProfile, isOps } from '@/lib/auth'
import { Badge, Card, Empty, LinkButton, PageHeader, Table, Td } from '@/components/ui'
import { inr, shortDate, titleCase } from '@/lib/format'
import type { Enums } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const { profile, supabase } = await requireProfile()
  const { q, status } = await searchParams

  let query = supabase
    .from('v_patient_master')
    .select(
      'id, patient_code, full_name, area, service_type, default_daily_rate, status, start_date, current_attendants, outstanding_balance, primary_contact_phone'
    )
    .order('full_name')

  if (status && status !== 'all') query = query.eq('status', status as Enums<'patient_status'>)
  if (q) query = query.ilike('full_name', `%${q}%`)

  const { data: patients, error } = await query

  return (
    <>
      <PageHeader
        title="Patients"
        subtitle={`${patients?.length ?? 0} shown`}
        action={isOps(profile.role) ? <LinkButton href="/patients/new">Add patient</LinkButton> : null}
      />

      <form className="mb-4 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search by name…"
          className="w-full max-w-xs rounded-lg border-0 px-3 py-2 text-sm shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand-600 sm:w-auto"
        />
        <select
          name="status"
          defaultValue={status ?? 'active'}
          className="rounded-lg border-0 px-3 py-2 text-sm shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand-600"
        >
          {['active', 'enquiry', 'on_hold', 'discharged', 'all'].map((s) => (
            <option key={s} value={s}>
              {titleCase(s)}
            </option>
          ))}
        </select>
        <button className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
          Filter
        </button>
      </form>

      <Card>
        {error && <Empty>{error.message}</Empty>}
        {patients?.length ? (
          <Table head={['Code', 'Name', 'Area', 'Service', 'Rate/day', 'Attendant', 'Since', 'Outstanding', 'Status']}>
            {patients.map((p) => (
              <tr key={p.id ?? ''} className="hover:bg-slate-50">
                <Td className="font-mono text-xs text-slate-500">{p.patient_code}</Td>
                <Td className="font-medium text-slate-900">
                  <Link href={`/patients/${p.id}`} className="hover:underline">
                    {p.full_name}
                  </Link>
                  <div className="text-xs font-normal text-slate-500">{p.primary_contact_phone}</div>
                </Td>
                <Td>{p.area}</Td>
                <Td>{titleCase(p.service_type)}</Td>
                <Td numeric>{inr(p.default_daily_rate)}</Td>
                <Td>{p.current_attendants ?? '—'}</Td>
                <Td>{shortDate(p.start_date)}</Td>
                <Td numeric className={Number(p.outstanding_balance ?? 0) > 0 ? 'font-semibold text-rose-700' : ''}>
                  {inr(p.outstanding_balance)}
                </Td>
                <Td>
                  <Badge>{p.status ?? ''}</Badge>
                </Td>
              </tr>
            ))}
          </Table>
        ) : (
          !error && <Empty>No patients match this filter.</Empty>
        )}
      </Card>
    </>
  )
}
