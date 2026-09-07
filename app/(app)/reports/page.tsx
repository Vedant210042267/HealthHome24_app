import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireProfile, isBackOffice } from '@/lib/auth'
import { Badge, Card, Empty, PageHeader, StatTile, Table, Td } from '@/components/ui'
import { InlineBar, Legend, SERIES, StackedBar } from '@/components/viz'
import { currentPeriod, inr, monthLabel, num, pct, shortDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

function recentPeriods() {
  const out: string[] = []
  const [y, m] = currentPeriod().slice(0, 7).split('-').map(Number)
  for (let i = 0; i < 12; i++) {
    out.push(new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 8) + '01')
  }
  return out
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { profile, supabase } = await requireProfile()
  if (!isBackOffice(profile.role)) redirect('/dashboard')

  const periods = recentPeriods()
  const period = (await searchParams).period ?? periods[0]

  const [{ data: pnl }, { data: byPatient }, { data: geoFlags }] = await Promise.all([
    supabase.from('v_agency_monthly_pnl').select('*').order('period_month', { ascending: false }).limit(12),
    supabase
      .from('v_patient_profitability_monthly')
      .select('*')
      .eq('period_month', period)
      .order('gross_contribution', { ascending: false }),
    supabase
      .from('v_attendance_detail')
      .select('duty_date, staff_name, patient_name, check_in_distance_m, check_in_on_site')
      .eq('check_in_on_site', false)
      .order('duty_date', { ascending: false })
      .limit(10),
  ])

  const months = (pnl ?? []).slice().reverse() // oldest first, so the bars read left to right
  const maxRevenue = Math.max(1, ...months.map((m) => Number(m.revenue ?? 0)))
  const thisMonth = (pnl ?? []).find((m) => m.period_month === period)

  const maxContribution = Math.max(1, ...(byPatient ?? []).map((p) => Number(p.gross_contribution ?? 0)))
  const totalRevenue = (byPatient ?? []).reduce((s, p) => s + Number(p.revenue ?? 0), 0)

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Revenue less attendant cost less directly attributed cost is the gross contribution. Office overhead is charged below that line."
        action={
          <form className="flex items-end gap-2">
            <select
              name="period"
              defaultValue={period}
              className="rounded-lg border-0 px-3 py-2 text-sm shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand-600"
            >
              {periods.map((p) => (
                <option key={p} value={p}>
                  {monthLabel(p)}
                </option>
              ))}
            </select>
            <button className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
              Go
            </button>
          </form>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={`Revenue — ${monthLabel(period)}`} value={inr(thisMonth?.revenue ?? 0)} />
        <StatTile label="Attendant cost" value={inr(Number(thisMonth?.attendant_wage_cost ?? 0) + Number(thisMonth?.overtime_cost ?? 0))} />
        <StatTile
          label="Gross contribution"
          value={inr(thisMonth?.gross_contribution ?? 0)}
          tone={Number(thisMonth?.gross_contribution ?? 0) >= 0 ? 'positive' : 'negative'}
        />
        <StatTile
          label="After overhead"
          value={inr(thisMonth?.net_contribution ?? 0)}
          sub={thisMonth?.net_margin_pct !== null ? `${pct(thisMonth?.net_margin_pct)} net margin` : undefined}
          tone={Number(thisMonth?.net_contribution ?? 0) >= 0 ? 'positive' : 'negative'}
        />
      </div>

      <Card title="Where each month's revenue goes">
        <div className="p-4">
          <Legend
            items={[
              { label: 'Attendant wages & overtime', color: SERIES.one },
              { label: 'Direct costs', color: SERIES.two },
              { label: 'Gross contribution', color: SERIES.three },
            ]}
          />
          <div className="mt-4 space-y-3">
            {months.length ? (
              months.map((m) => (
                <div key={m.period_month ?? ''} className="grid grid-cols-[7rem_1fr_6rem] items-center gap-3">
                  <div className="text-xs text-slate-600">{m.period_label}</div>
                  <StackedBar
                    max={maxRevenue}
                    segments={[
                      {
                        label: 'Attendant wages & overtime',
                        value: Number(m.attendant_wage_cost ?? 0) + Number(m.overtime_cost ?? 0),
                        color: SERIES.one,
                      },
                      { label: 'Direct costs', value: Number(m.direct_costs ?? 0), color: SERIES.two },
                      {
                        label: 'Gross contribution',
                        value: Math.max(0, Number(m.gross_contribution ?? 0)),
                        color: SERIES.three,
                      },
                    ]}
                  />
                  <div className="tnum text-right text-xs font-medium text-slate-900">{inr(m.revenue)}</div>
                </div>
              ))
            ) : (
              <Empty>No months to report on yet.</Empty>
            )}
          </div>
        </div>

        {months.length > 0 && (
          <div className="border-t border-slate-100">
            <Table head={['Month', 'Patients', 'Revenue', 'Wages', 'Overtime', 'Direct costs', 'Gross contribution', 'Overhead', 'After overhead', 'Net margin']}>
              {(pnl ?? []).map((m) => (
                <tr key={m.period_month ?? ''}>
                  <Td className="whitespace-nowrap font-medium text-slate-900">{m.period_label}</Td>
                  <Td numeric>{m.active_patients}</Td>
                  <Td numeric>{inr(m.revenue)}</Td>
                  <Td numeric>{inr(m.attendant_wage_cost)}</Td>
                  <Td numeric>{inr(m.overtime_cost)}</Td>
                  <Td numeric>{inr(m.direct_costs)}</Td>
                  <Td numeric className="font-semibold">{inr(m.gross_contribution)}</Td>
                  <Td numeric>{inr(m.overhead_costs)}</Td>
                  <Td
                    numeric
                    className={`font-semibold ${Number(m.net_contribution ?? 0) < 0 ? 'text-rose-700' : 'text-emerald-700'}`}
                  >
                    {inr(m.net_contribution)}
                  </Td>
                  <Td numeric>{pct(m.net_margin_pct)}</Td>
                </tr>
              ))}
            </Table>
          </div>
        )}
      </Card>

      <div className="mt-5">
        <Card title={`Contribution by patient — ${monthLabel(period)}`}>
          {byPatient?.length ? (
            <Table head={['Patient', 'Duties', 'Revenue', 'Wage cost', 'Other costs', 'Contribution', '', 'Margin']}>
              {byPatient.map((p) => {
                const contribution = Number(p.gross_contribution ?? 0)
                return (
                  <tr key={p.patient_id ?? ''}>
                    <Td className="font-medium text-slate-900">
                      <Link href={`/patients/${p.patient_id}`} className="hover:underline">
                        {p.patient_name}
                      </Link>
                      <div className="text-xs font-normal text-slate-500">
                        {totalRevenue > 0 ? `${((Number(p.revenue ?? 0) / totalRevenue) * 100).toFixed(0)}% of revenue` : ''}
                      </div>
                    </Td>
                    <Td numeric>{num(p.billable_units, 1)}</Td>
                    <Td numeric>{inr(p.revenue)}</Td>
                    <Td numeric>{inr(Number(p.attendant_wage_cost ?? 0) + Number(p.overtime_cost ?? 0))}</Td>
                    <Td numeric>{inr(p.other_direct_costs)}</Td>
                    <Td numeric className={`font-semibold ${contribution < 0 ? 'text-rose-700' : ''}`}>
                      {inr(contribution)}
                    </Td>
                    <Td className="w-32">
                      {contribution < 0 ? (
                        <Badge tone="red">loss</Badge>
                      ) : (
                        <InlineBar value={contribution} max={maxContribution} />
                      )}
                    </Td>
                    <Td numeric>{pct(p.margin_pct)}</Td>
                  </tr>
                )
              })}
            </Table>
          ) : (
            <Empty>No duties recorded in {monthLabel(period)}.</Empty>
          )}
        </Card>
      </div>

      <div className="mt-5">
        <Card
          title="Check-ins outside the patient's geo-fence"
          action={<span className="text-xs text-slate-500">Flagged, never blocked</span>}
        >
          {geoFlags?.length ? (
            <Table head={['Date', 'Attendant', 'Patient', 'Distance from address']}>
              {geoFlags.map((g, i) => (
                <tr key={i}>
                  <Td className="whitespace-nowrap">{shortDate(g.duty_date)}</Td>
                  <Td className="font-medium text-slate-900">{g.staff_name}</Td>
                  <Td>{g.patient_name}</Td>
                  <Td numeric className="text-rose-700">{num(g.check_in_distance_m, 0)} m</Td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty>Every check-in has been on site.</Empty>
          )}
        </Card>
      </div>
    </>
  )
}
