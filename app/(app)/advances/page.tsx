import Link from 'next/link'
import { requireProfile, isFinance } from '@/lib/auth'
import { Badge, Card, Empty, PageHeader, StatTile, Table, Td } from '@/components/ui'
import { inr, shortDate, titleCase } from '@/lib/format'
import { AdvanceForm } from './advance-form'

export const dynamic = 'force-dynamic'

export default async function AdvancesPage() {
  const { profile, supabase } = await requireProfile()

  const [{ data: advances }, { data: staff }, { data: recoveries }] = await Promise.all([
    supabase.from('v_staff_advance_balances').select('*').order('issued_on', { ascending: false }),
    supabase.from('staff').select('id, full_name').eq('is_active', true).order('full_name'),
    supabase
      .from('advance_recoveries')
      .select('id, advance_id, recovery_date, amount, notes')
      .order('recovery_date', { ascending: false })
      .limit(15),
  ])

  const open = (advances ?? []).filter((a) => a.status === 'open')
  const outstanding = open.reduce((s, a) => s + Number(a.balance_amount ?? 0), 0)
  const nextCycle = open.reduce((s, a) => s + Number(a.next_cycle_recovery ?? 0), 0)
  const givenTotal = (advances ?? []).reduce((s, a) => s + Number(a.amount ?? 0), 0)

  return (
    <>
      <PageHeader
        title="Advances & loans"
        subtitle="Recovery is applied automatically when a payroll run is built — oldest advance first, never more than the payslip can bear."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatTile label="Total given" value={inr(givenTotal)} />
        <StatTile label="Outstanding" value={inr(outstanding)} tone={outstanding > 0 ? 'warn' : 'default'} />
        <StatTile label="Next payroll will recover" value={inr(nextCycle)} />
      </div>

      {isFinance(profile.role) && (
        <div className="mb-5">
          <Card title="Give an advance">
            <AdvanceForm staff={staff ?? []} />
          </Card>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Ledger" className="lg:col-span-2">
          {advances?.length ? (
            <Table head={['Given', 'Attendant', 'Type', 'Amount', 'Recovered', 'Balance', 'Per cycle', 'Next', 'Status']}>
              {advances.map((a) => (
                <tr key={a.advance_id ?? ''}>
                  <Td className="whitespace-nowrap">{shortDate(a.issued_on)}</Td>
                  <Td className="font-medium text-slate-900">
                    <Link href={`/staff/${a.staff_id}`} className="hover:underline">
                      {a.staff_name}
                    </Link>
                    {a.reason && <div className="text-xs font-normal text-slate-500">{a.reason}</div>}
                  </Td>
                  <Td>{titleCase(a.advance_type)}</Td>
                  <Td numeric>{inr(a.amount)}</Td>
                  <Td numeric>{inr(a.recovered_amount)}</Td>
                  <Td numeric className="font-semibold">{inr(a.balance_amount)}</Td>
                  <Td numeric>{inr(a.recovery_per_cycle)}</Td>
                  <Td numeric>{inr(a.next_cycle_recovery)}</Td>
                  <Td>
                    <Badge>{a.status ?? ''}</Badge>
                  </Td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty>No advances on record.</Empty>
          )}
        </Card>

        <Card title="Recent recoveries">
          {recoveries?.length ? (
            <ul className="divide-y divide-slate-100">
              {recoveries.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm text-slate-900">{shortDate(r.recovery_date)}</div>
                    <div className="truncate text-xs text-slate-500">{r.notes ?? 'Manual recovery'}</div>
                  </div>
                  <div className="tnum shrink-0 text-sm font-semibold">{inr(r.amount)}</div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nothing recovered yet.</Empty>
          )}
        </Card>
      </div>
    </>
  )
}
