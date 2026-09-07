import Link from 'next/link'
import { requireProfile, isFinance, isBackOffice } from '@/lib/auth'
import { Badge, Card, Empty, PageHeader, StatTile, Table, Td } from '@/components/ui'
import { currentPeriod, inr, monthLabel, num, shortDate } from '@/lib/format'
import { ApprovePayrollButton, MarkPaidForm, ReopenPayrollButton, RunPayrollButton } from './payroll-actions'

export const dynamic = 'force-dynamic'

/** Last 12 months, newest first, as YYYY-MM-01. */
function recentPeriods() {
  const out: string[] = []
  const [y, m] = currentPeriod().slice(0, 7).split('-').map(Number)
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1))
    out.push(d.toISOString().slice(0, 8) + '01')
  }
  return out
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { profile, supabase } = await requireProfile()
  const periods = recentPeriods()
  const period = (await searchParams).period ?? periods[0]

  const { data: run } = await supabase
    .from('payroll_runs')
    .select('*')
    .eq('period_month', period)
    .maybeSingle()

  const [{ data: payslips }, { data: live }] = await Promise.all([
    supabase.from('v_staff_payslips').select('*').eq('period_month', period).order('staff_name'),
    supabase.from('v_staff_monthly_salary').select('*').eq('period_month', period).order('staff_name'),
  ])

  type Payslip = NonNullable<typeof payslips>[number]

  // Once a run exists its frozen payslips are the truth; before that, the live
  // view previews what the run would produce.
  const usingFrozen = Boolean(run && payslips?.length)
  const rows = usingFrozen
    ? payslips!.map((p) => ({
        staff_id: p.staff_id,
        staff_name: p.staff_name,
        days_present: p.days_present,
        half_days: p.half_days,
        days_absent: p.days_absent,
        payable_units: p.payable_units,
        overtime_hours: p.overtime_hours,
        gross_wage: p.gross_wage,
        overtime_amount: p.overtime_amount,
        additions: p.additions,
        other_deductions: p.other_deductions,
        advance_recovery: p.advance_recovery,
        net_payable: p.net_payable,
        frozen: p as Payslip | null,
      }))
    : (live ?? []).map((l) => ({
        staff_id: l.staff_id,
        staff_name: l.staff_name,
        days_present: l.days_present,
        half_days: l.half_days,
        days_absent: l.days_absent,
        payable_units: l.payable_units,
        overtime_hours: l.overtime_hours,
        gross_wage: l.gross_wage,
        overtime_amount: l.overtime_amount,
        additions: l.additions,
        other_deductions: l.other_deductions,
        advance_recovery: l.advance_recovered,
        net_payable: l.net_payable,
        frozen: null as Payslip | null,
      }))

  const totalNet = rows.reduce((s, r) => s + Number(r.net_payable ?? 0), 0)
  const totalRecovery = rows.reduce((s, r) => s + Number(r.advance_recovery ?? 0), 0)

  return (
    <>
      <PageHeader
        title="Payroll"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {monthLabel(period)}
            {run ? <Badge>{run.status}</Badge> : <Badge tone="slate">not built</Badge>}
            {usingFrozen ? (
              <span className="text-xs">Frozen payslips</span>
            ) : (
              <span className="text-xs">Live figures from attendance</span>
            )}
          </span>
        }
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

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <StatTile label="Staff on payroll" value={rows.length} />
        <StatTile label="Net payable" value={inr(totalNet)} tone="positive" />
        <StatTile label="Advance recovered" value={inr(totalRecovery)} />
        <StatTile
          label="Status"
          value={run ? run.status.replace('_', ' ') : 'Not built'}
          sub={run?.approved_at ? `Approved ${shortDate(run.approved_at.slice(0, 10))}` : undefined}
        />
      </div>

      {isFinance(profile.role) && (
        <div className="mb-5 flex flex-wrap gap-2">
          {(!run || run.status === 'draft') && <RunPayrollButton period={period} exists={Boolean(run)} />}
          {run?.status === 'draft' && <ApprovePayrollButton runId={run.id} />}
          {run?.status === 'approved' && <ReopenPayrollButton runId={run.id} />}
        </div>
      )}

      {run?.status === 'approved' && (
        <div className="mb-5 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900 ring-1 ring-inset ring-sky-600/20">
          This month is approved, so its attendance is locked. Reopen the run to correct a duty.
        </div>
      )}

      <Card title="Payslips">
        {rows.length ? (
          <Table
            head={[
              'Attendant',
              'Present',
              'Half',
              'Absent',
              'Units',
              'OT hrs',
              'Gross',
              'OT',
              'Additions',
              'Deductions',
              'Advance',
              'Net',
              ...(usingFrozen && isFinance(profile.role) ? ['Paid', 'Record payment'] : []),
            ]}
          >
            {rows.map((r, i) => {
              const frozen = r.frozen
              return (
                <tr key={(r.staff_id ?? '') + i}>
                  <Td className="font-medium text-slate-900">
                    <Link href={`/staff/${r.staff_id}`} className="hover:underline">
                      {r.staff_name}
                    </Link>
                  </Td>
                  <Td numeric>{r.days_present}</Td>
                  <Td numeric>{r.half_days}</Td>
                  <Td numeric>{r.days_absent}</Td>
                  <Td numeric>{num(r.payable_units, 1)}</Td>
                  <Td numeric>{num(r.overtime_hours, 1)}</Td>
                  <Td numeric>{inr(r.gross_wage)}</Td>
                  <Td numeric>{inr(r.overtime_amount)}</Td>
                  <Td numeric>{inr(r.additions)}</Td>
                  <Td numeric>{inr(r.other_deductions)}</Td>
                  <Td numeric>{inr(r.advance_recovery)}</Td>
                  <Td numeric className="font-semibold text-slate-900">{inr(r.net_payable)}</Td>
                  {usingFrozen && isFinance(profile.role) && (
                    <>
                      <Td>
                        <Badge>{frozen?.payment_status ?? 'unpaid'}</Badge>
                      </Td>
                      <Td>
                        {frozen?.payment_status !== 'paid' && frozen?.payroll_item_id && (
                          <MarkPaidForm itemId={frozen.payroll_item_id} amount={Number(frozen.net_payable ?? 0)} />
                        )}
                      </Td>
                    </>
                  )}
                </tr>
              )
            })}
          </Table>
        ) : (
          <Empty>
            No attendance recorded for {monthLabel(period)}
            {isBackOffice(profile.role) ? ', so there is nothing to pay yet.' : '.'}
          </Empty>
        )}
      </Card>
    </>
  )
}
