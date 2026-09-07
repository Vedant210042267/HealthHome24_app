import Link from 'next/link'
import { requireProfile, isBackOffice } from '@/lib/auth'
import { Badge, Card, Empty, LinkButton, PageHeader, StatTile, Table, Td } from '@/components/ui'
import { currentPeriod, inr, istTime, monthLabel, num, pct, shortDate, todayIST } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const { profile, supabase } = await requireProfile()
  const today = todayIST()
  const period = currentPeriod()

  if (!isBackOffice(profile.role)) {
    // ---------------- Attendant view ----------------
    const [{ data: myDuties }, { data: mySalary }, { data: myAdvances }] = await Promise.all([
      supabase
        .from('v_daily_roster')
        .select('*')
        .eq('duty_date', today)
        .order('patient_name'),
      supabase.from('v_staff_monthly_salary').select('*').eq('period_month', period).maybeSingle(),
      supabase.from('v_staff_advance_balances').select('*').eq('status', 'open'),
    ])

    const advanceBalance = (myAdvances ?? []).reduce((s, a) => s + Number(a.balance_amount ?? 0), 0)

    return (
      <>
        <PageHeader
          title={`Namaste, ${profile.full_name.split(' ')[0]}`}
          subtitle={`${monthLabel(period)} so far`}
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile label="Duties this month" value={num(mySalary?.payable_units ?? 0, 1)} />
          <StatTile
            label="Earnings so far"
            value={inr(mySalary?.net_payable ?? 0)}
            sub="After deductions and advance recovery"
            tone="positive"
          />
          <StatTile
            label="Advance outstanding"
            value={inr(advanceBalance)}
            tone={advanceBalance > 0 ? 'warn' : 'default'}
          />
        </div>

        <div className="mt-5">
          <Card
            title="Today's duty"
            action={<LinkButton href="/attendance" variant="secondary">Mark attendance</LinkButton>}
          >
            {myDuties?.length ? (
              <Table head={['Patient', 'Address', 'Shift', 'Check in', 'Check out', 'Status']}>
                {myDuties.map((d) => (
                  <tr key={d.duty_allocation_id ?? ''}>
                    <Td className="font-medium text-slate-900">{d.patient_name}</Td>
                    <Td>{[d.address_line1, d.area].filter(Boolean).join(', ')}</Td>
                    <Td>{d.duty_type?.replace('shift_', '').replace('_', ' ')}</Td>
                    <Td>{istTime(d.check_in_at)}</Td>
                    <Td>{istTime(d.check_out_at)}</Td>
                    <Td>
                      {d.attendance_status ? (
                        <Badge>{d.attendance_status}</Badge>
                      ) : (
                        <Badge tone="amber">not marked</Badge>
                      )}
                    </Td>
                  </tr>
                ))}
              </Table>
            ) : (
              <Empty>No duty scheduled for today.</Empty>
            )}
          </Card>
        </div>
      </>
    )
  }

  // ---------------- Back-office view ----------------
  const [
    { count: activePatients },
    { count: activeStaff },
    { data: pnl },
    { data: roster },
    { data: topPatients },
    { data: outstanding },
  ] = await Promise.all([
    supabase.from('patients').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('staff').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('v_agency_monthly_pnl').select('*').eq('period_month', period).maybeSingle(),
    supabase.from('v_daily_roster').select('*').eq('duty_date', today).order('patient_name'),
    supabase
      .from('v_patient_profitability_monthly')
      .select('*')
      .eq('period_month', period)
      .order('gross_contribution', { ascending: false })
      .limit(6),
    supabase
      .from('patient_invoices')
      .select('id, invoice_number, patient_id, balance_due, due_date, status, patients(full_name)')
      .in('status', ['issued', 'partially_paid'])
      .order('due_date')
      .limit(6),
  ])

  const unmarked = (roster ?? []).filter((r) => r.is_unmarked)

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`${shortDate(today)} · ${monthLabel(period)} to date`}
        action={<LinkButton href="/attendance">Mark today's attendance</LinkButton>}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Active patients" value={activePatients ?? 0} />
        <StatTile label="Active staff" value={activeStaff ?? 0} />
        <StatTile label="Revenue this month" value={inr(pnl?.revenue ?? 0)} />
        <StatTile
          label="Gross contribution"
          value={inr(pnl?.gross_contribution ?? 0)}
          sub={pnl?.revenue ? `${pct(((Number(pnl.gross_contribution) / Number(pnl.revenue)) * 100))} of revenue` : undefined}
          tone={Number(pnl?.gross_contribution ?? 0) >= 0 ? 'positive' : 'negative'}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title={`Unmarked duties today (${unmarked.length})`}
          action={<LinkButton href="/attendance" variant="secondary">Open board</LinkButton>}
        >
          {unmarked.length ? (
            <Table head={['Patient', 'Attendant', 'Shift', 'Area', 'Rate']}>
              {unmarked.map((r) => (
                <tr key={r.duty_allocation_id ?? ''}>
                  <Td className="font-medium text-slate-900">{r.patient_name}</Td>
                  <Td>{r.staff_name}</Td>
                  <Td>{r.duty_type?.replace('shift_', '').replace('_', ' ')}</Td>
                  <Td>{r.area}</Td>
                  <Td numeric>{inr(r.patient_daily_rate)}</Td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty>Every duty for today has been marked. Good going.</Empty>
          )}
        </Card>

        <Card title="Outstanding invoices">
          {outstanding?.length ? (
            <ul className="divide-y divide-slate-100">
              {outstanding.map((inv) => {
                const patient = inv.patients as { full_name: string } | null
                return (
                  <li key={inv.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900">
                        {patient?.full_name ?? '—'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {inv.invoice_number} · due {shortDate(inv.due_date)}
                      </div>
                    </div>
                    <div className="tnum shrink-0 text-sm font-semibold text-slate-900">
                      {inr(inv.balance_due)}
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <Empty>Nothing outstanding.</Empty>
          )}
        </Card>
      </div>

      <div className="mt-5">
        <Card title={`Contribution by patient — ${monthLabel(period)}`}>
          {topPatients?.length ? (
            <Table head={['Patient', 'Duties', 'Revenue', 'Wage cost', 'Other costs', 'Contribution', 'Margin']}>
              {topPatients.map((p) => (
                <tr key={p.patient_id ?? ''}>
                  <Td className="font-medium text-slate-900">
                    <Link href={`/patients/${p.patient_id}`} className="hover:underline">
                      {p.patient_name}
                    </Link>
                  </Td>
                  <Td numeric>{num(p.billable_units, 1)}</Td>
                  <Td numeric>{inr(p.revenue)}</Td>
                  <Td numeric>{inr(p.attendant_wage_cost)}</Td>
                  <Td numeric>{inr(Number(p.other_direct_costs ?? 0) + Number(p.overtime_cost ?? 0))}</Td>
                  <Td numeric className="font-semibold text-slate-900">{inr(p.gross_contribution)}</Td>
                  <Td numeric>{pct(p.margin_pct)}</Td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty>No duties recorded this month yet.</Empty>
          )}
        </Card>
      </div>
    </>
  )
}
