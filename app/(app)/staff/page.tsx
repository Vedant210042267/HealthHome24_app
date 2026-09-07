import Link from 'next/link'
import { requireProfile, isOps } from '@/lib/auth'
import { Badge, Card, Empty, LinkButton, PageHeader, Table, Td } from '@/components/ui'
import { inr, shortDate, titleCase } from '@/lib/format'
import type { Enums } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>
}) {
  const { profile, supabase } = await requireProfile()
  const { q, category } = await searchParams

  let query = supabase
    .from('staff')
    .select('id, staff_code, full_name, category, phone, area, qualification, joining_date, default_daily_wage, is_active')
    .order('is_active', { ascending: false })
    .order('full_name')

  if (category && category !== 'all') query = query.eq('category', category as Enums<'staff_category'>)
  if (q) query = query.ilike('full_name', `%${q}%`)

  const { data: staff } = await query

  // KYC status is admin-only under RLS, so an empty result here is expected for others.
  const { data: kyc } = await supabase.from('staff_kyc').select('staff_id, kyc_status, police_verified')
  const kycBy = new Map((kyc ?? []).map((k) => [k.staff_id, k]))

  return (
    <>
      <PageHeader
        title="Attendants & nurses"
        subtitle={`${staff?.length ?? 0} shown`}
        action={isOps(profile.role) ? <LinkButton href="/staff/new">Add staff</LinkButton> : null}
      />

      <form className="mb-4 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search by name…"
          className="w-full max-w-xs rounded-lg border-0 px-3 py-2 text-sm shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand-600 sm:w-auto"
        />
        <select
          name="category"
          defaultValue={category ?? 'all'}
          className="rounded-lg border-0 px-3 py-2 text-sm shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand-600"
        >
          <option value="all">All categories</option>
          <option value="nurse">Nurse</option>
          <option value="general_attendant">General attendant</option>
          <option value="physiotherapist">Physiotherapist</option>
          <option value="supervisor">Supervisor</option>
        </select>
        <button className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
          Filter
        </button>
      </form>

      <Card>
        {staff?.length ? (
          <Table head={['Code', 'Name', 'Category', 'Phone', 'Area', 'Joined', 'Wage/day', 'KYC', 'Status']}>
            {staff.map((s) => {
              const k = kycBy.get(s.id)
              return (
                <tr key={s.id} className="hover:bg-slate-50">
                  <Td className="font-mono text-xs text-slate-500">{s.staff_code}</Td>
                  <Td className="font-medium text-slate-900">
                    <Link href={`/staff/${s.id}`} className="hover:underline">
                      {s.full_name}
                    </Link>
                    <div className="text-xs font-normal text-slate-500">{s.qualification}</div>
                  </Td>
                  <Td>{titleCase(s.category)}</Td>
                  <Td>{s.phone}</Td>
                  <Td>{s.area}</Td>
                  <Td>{shortDate(s.joining_date)}</Td>
                  <Td numeric>{inr(s.default_daily_wage)}</Td>
                  <Td>{k ? <Badge>{k.kyc_status}</Badge> : <span className="text-xs text-slate-400">—</span>}</Td>
                  <Td>
                    <Badge tone={s.is_active ? 'green' : 'slate'}>{s.is_active ? 'active' : 'inactive'}</Badge>
                  </Td>
                </tr>
              )
            })}
          </Table>
        ) : (
          <Empty>No staff match this filter.</Empty>
        )}
      </Card>
    </>
  )
}
