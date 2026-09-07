import Link from 'next/link'
import { requireProfile, isOps } from '@/lib/auth'
import { Badge, Card, Empty, PageHeader, Table, Td } from '@/components/ui'
import { inr, pct, shortDate, titleCase } from '@/lib/format'
import { NewAllocationForm } from './new-allocation-form'

export const dynamic = 'force-dynamic'

export default async function AllocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { profile, supabase } = await requireProfile()
  const { status = 'ongoing' } = await searchParams

  const [{ data: allocations }, { data: patients }, { data: staff }] = await Promise.all([
    supabase
      .from('v_duty_allocation_summary')
      .select('*')
      .order('start_date', { ascending: false }),
    supabase
      .from('patients')
      .select('id, full_name, service_type, default_daily_rate')
      .eq('status', 'active')
      .order('full_name'),
    supabase
      .from('staff')
      .select('id, full_name, category, default_daily_wage, default_ot_hourly_rate')
      .eq('is_active', true)
      .order('full_name'),
  ])

  const rows = (allocations ?? []).filter((a) => status === 'all' || a.status === status)

  return (
    <>
      <PageHeader
        title="Postings"
        subtitle="Which attendant is on which patient, at what rate, from when."
      />

      {isOps(profile.role) && (
        <div className="mb-5">
          <Card title="New posting">
            <NewAllocationForm patients={patients ?? []} staff={staff ?? []} />
          </Card>
        </div>
      )}

      <form className="mb-4 flex gap-2">
        <select
          name="status"
          defaultValue={status}
          className="rounded-lg border-0 px-3 py-2 text-sm shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand-600"
        >
          {['ongoing', 'completed', 'cancelled', 'on_hold', 'all'].map((s) => (
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
        {rows.length ? (
          <Table
            head={['Patient', 'Attendant', 'Type', 'From', 'To', 'Bill/day', 'Wage/day', 'Margin', 'Revenue', 'Contribution', 'Status']}
          >
            {rows.map((a) => (
              <tr key={a.id ?? ''} className="hover:bg-slate-50">
                <Td className="font-medium text-slate-900">
                  <Link href={`/patients/${a.patient_id}`} className="hover:underline">
                    {a.patient_name}
                  </Link>
                </Td>
                <Td>
                  <Link href={`/staff/${a.staff_id}`} className="hover:underline">
                    {a.staff_name}
                  </Link>
                </Td>
                <Td>{titleCase(a.duty_type?.replace('shift_', ''))}{a.shift_slot && a.shift_slot !== 'full_day' && a.shift_slot !== 'visit' ? ` (${a.shift_slot})` : ''}</Td>
                <Td>{shortDate(a.start_date)}</Td>
                <Td>{a.end_date ? shortDate(a.end_date) : '—'}</Td>
                <Td numeric>{inr(a.patient_daily_rate)}</Td>
                <Td numeric>{inr(a.staff_daily_wage)}</Td>
                <Td numeric className={Number(a.daily_margin_pct ?? 0) < 20 ? 'text-amber-700' : ''}>
                  {pct(a.daily_margin_pct)}
                </Td>
                <Td numeric>{inr(a.revenue_to_date)}</Td>
                <Td numeric className="font-semibold">{inr(a.contribution_to_date)}</Td>
                <Td>
                  <Badge>{a.status ?? ''}</Badge>
                </Td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>No postings match this filter.</Empty>
        )}
      </Card>
    </>
  )
}
