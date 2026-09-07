import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireProfile, isFinance, isBackOffice } from '@/lib/auth'
import { Badge, Card, Empty, PageHeader, StatTile, Table, Td } from '@/components/ui'
import { currentPeriod, inr, monthLabel, num, shortDate } from '@/lib/format'
import { GenerateInvoiceButton, PaymentForm } from './billing-actions'

export const dynamic = 'force-dynamic'

function recentPeriods() {
  const out: string[] = []
  const [y, m] = currentPeriod().slice(0, 7).split('-').map(Number)
  for (let i = 0; i < 12; i++) {
    out.push(new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 8) + '01')
  }
  return out
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { profile, supabase } = await requireProfile()
  if (!isBackOffice(profile.role)) redirect('/dashboard')

  const periods = recentPeriods()
  const period = (await searchParams).period ?? periods[0]

  const [{ data: billing }, { data: invoices }, { data: patients }, { data: openInvoices }] = await Promise.all([
    supabase.from('v_patient_monthly_billing').select('*').eq('period_month', period).order('patient_name'),
    supabase
      .from('patient_invoices')
      .select('id, invoice_number, patient_id, status, total_amount, advance_adjusted, amount_paid, balance_due, invoice_date, due_date')
      .eq('period_month', period),
    supabase.from('patients').select('id, full_name').order('full_name'),
    supabase
      .from('patient_invoices')
      .select('id, invoice_number, patient_id, balance_due')
      .in('status', ['issued', 'partially_paid'])
      .order('invoice_date', { ascending: false }),
  ])

  const invoiceByPatient = new Map((invoices ?? []).map((i) => [i.patient_id, i]))

  const billed = (billing ?? []).reduce((s, b) => s + Number(b.billed_amount ?? 0), 0)
  const collected = (billing ?? []).reduce((s, b) => s + Number(b.collections_applied ?? 0), 0)
  const outstanding = (billing ?? []).reduce((s, b) => s + Number(b.closing_balance ?? 0), 0)

  return (
    <>
      <PageHeader
        title="Billing"
        subtitle={`${monthLabel(period)} — invoices are built from fulfilled duties, with any advance on account applied automatically.`}
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

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatTile label="Billed this month" value={inr(billed)} />
        <StatTile label="Collected" value={inr(collected)} tone="positive" />
        <StatTile label="Closing balance" value={inr(outstanding)} tone={outstanding > 0 ? 'negative' : 'positive'} />
      </div>

      <Card title="Patient statements">
        {billing?.length ? (
          <Table
            head={['Patient', 'Duties', 'Billed', 'Advance', 'Payments', 'Opening', 'Closing', 'Invoice', 'Due', 'Action']}
          >
            {billing.map((b) => {
              const inv = invoiceByPatient.get(b.patient_id ?? '')
              return (
                <tr key={b.patient_id ?? ''}>
                  <Td className="font-medium text-slate-900">
                    <Link href={`/patients/${b.patient_id}`} className="hover:underline">
                      {b.patient_name}
                    </Link>
                  </Td>
                  <Td numeric>{num(b.billable_units, 1)}</Td>
                  <Td numeric>{inr(b.billed_amount)}</Td>
                  <Td numeric>{inr(b.advances_received)}</Td>
                  <Td numeric>{inr(b.payments_received)}</Td>
                  <Td numeric>{inr(b.opening_balance)}</Td>
                  <Td numeric className="font-semibold">{inr(b.closing_balance)}</Td>
                  <Td>
                    {inv ? (
                      <>
                        <div className="font-mono text-xs">{inv.invoice_number}</div>
                        <Badge>{inv.status}</Badge>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">none</span>
                    )}
                  </Td>
                  <Td numeric>{inv ? inr(inv.balance_due) : '—'}</Td>
                  <Td>
                    {isFinance(profile.role) && !inv && Number(b.billed_amount ?? 0) > 0 && (
                      <GenerateInvoiceButton patientId={b.patient_id ?? ''} period={period} />
                    )}
                  </Td>
                </tr>
              )
            })}
          </Table>
        ) : (
          <Empty>No duties or receipts in {monthLabel(period)}.</Empty>
        )}
      </Card>

      {isFinance(profile.role) && (
        <div className="mt-5">
          <Card title="Record a receipt">
            <PaymentForm patients={patients ?? []} invoices={openInvoices ?? []} />
          </Card>
        </div>
      )}

      {invoices?.length ? (
        <div className="mt-5">
          <Card title={`Invoices — ${monthLabel(period)}`}>
            <Table head={['Invoice', 'Date', 'Due date', 'Total', 'Advance applied', 'Paid', 'Balance', 'Status']}>
              {invoices.map((i) => (
                <tr key={i.id}>
                  <Td className="font-mono text-xs">{i.invoice_number}</Td>
                  <Td>{shortDate(i.invoice_date)}</Td>
                  <Td>{shortDate(i.due_date)}</Td>
                  <Td numeric>{inr(i.total_amount)}</Td>
                  <Td numeric>{inr(i.advance_adjusted)}</Td>
                  <Td numeric>{inr(i.amount_paid)}</Td>
                  <Td numeric className="font-semibold">{inr(i.balance_due)}</Td>
                  <Td>
                    <Badge>{i.status}</Badge>
                  </Td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      ) : null}
    </>
  )
}
