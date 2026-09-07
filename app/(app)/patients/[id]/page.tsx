import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireProfile, isFinance } from '@/lib/auth'
import { Badge, Card, Empty, PageHeader, StatTile, Table, Td } from '@/components/ui'
import { inr, istTime, monthLabel, num, pct, shortDate, titleCase } from '@/lib/format'

export const dynamic = 'force-dynamic'

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value || '—'}</dd>
    </div>
  )
}

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { profile, supabase } = await requireProfile()

  const { data: patient } = await supabase.from('v_patient_master').select('*').eq('id', id).maybeSingle()
  if (!patient) notFound()

  const [{ data: allocations }, { data: months }, { data: duties }, { data: invoices }, { data: payments }] =
    await Promise.all([
      supabase
        .from('v_duty_allocation_summary')
        .select('*')
        .eq('patient_id', id)
        .order('start_date', { ascending: false }),
      supabase
        .from('v_patient_monthly_billing')
        .select('*')
        .eq('patient_id', id)
        .order('period_month', { ascending: false })
        .limit(12),
      supabase
        .from('v_attendance_detail')
        .select('*')
        .eq('patient_id', id)
        .order('duty_date', { ascending: false })
        .limit(12),
      isFinance(profile.role)
        ? supabase
            .from('patient_invoices')
            .select('*')
            .eq('patient_id', id)
            .order('period_month', { ascending: false })
        : Promise.resolve({ data: null }),
      isFinance(profile.role)
        ? supabase
            .from('patient_payments')
            .select('*')
            .eq('patient_id', id)
            .order('received_on', { ascending: false })
            .limit(10)
        : Promise.resolve({ data: null }),
    ])

  return (
    <>
      <PageHeader
        title={patient.full_name ?? ''}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{patient.patient_code}</span>
            <Badge>{patient.status ?? ''}</Badge>
            <span>{titleCase(patient.service_type)}</span>
            <span>· {inr(patient.default_daily_rate)}/day</span>
          </span>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <StatTile label="Billed to date" value={inr(patient.total_billed)} />
        <StatTile label="Advance received" value={inr(patient.advance_received)} />
        <StatTile
          label="Outstanding"
          value={inr(patient.outstanding_balance)}
          tone={Number(patient.outstanding_balance ?? 0) > 0 ? 'negative' : 'positive'}
        />
        <StatTile label="Deposit held" value={inr(patient.security_deposit_held)} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card title="Patient details" className="lg:col-span-2">
          <dl className="grid gap-4 p-4 sm:grid-cols-3">
            <Detail label="Age" value={patient.age ? `${patient.age} years` : null} />
            <Detail label="Gender" value={titleCase(patient.gender)} />
            <Detail label="Started" value={shortDate(patient.start_date)} />
            <Detail
              label="Address"
              value={
                <span className="whitespace-pre-line">
                  {[patient.address_line1, patient.address_line2, patient.landmark, patient.area, patient.pincode]
                    .filter(Boolean)
                    .join('\n')}
                </span>
              }
            />
            <Detail
              label="Primary contact"
              value={
                <>
                  {patient.primary_contact_name}
                  <div className="text-slate-500">
                    {patient.primary_contact_phone} · {patient.primary_contact_relation}
                  </div>
                </>
              }
            />
            <Detail
              label="Family contact"
              value={
                patient.family_contact_name ? (
                  <>
                    {patient.family_contact_name}
                    <div className="text-slate-500">
                      {patient.family_contact_phone} · {patient.family_contact_relation}
                    </div>
                  </>
                ) : null
              }
            />
            <Detail label="Referring doctor" value={patient.referring_doctor_name} />
            <Detail label="Diagnosis" value={patient.diagnosis} />
            <Detail label="Mobility" value={patient.mobility_status} />
            <div className="sm:col-span-3">
              <Detail label="Care requirements" value={patient.care_requirements} />
            </div>
          </dl>
        </Card>

        <Card title="Monthly statement">
          {months?.length ? (
            <Table head={['Month', 'Duties', 'Billed', 'Received', 'Closing']}>
              {months.map((m) => (
                <tr key={m.period_month ?? ''}>
                  <Td className="whitespace-nowrap">{m.period_label}</Td>
                  <Td numeric>{num(m.billable_units, 1)}</Td>
                  <Td numeric>{inr(m.billed_amount)}</Td>
                  <Td numeric>{inr(m.collections_applied)}</Td>
                  <Td numeric className="font-semibold">{inr(m.closing_balance)}</Td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty>No billing history yet.</Empty>
          )}
        </Card>
      </div>

      <div className="mt-5">
        <Card title="Postings">
          {allocations?.length ? (
            <Table head={['Attendant', 'Type', 'From', 'To', 'Bill/day', 'Wage/day', 'Margin', 'Revenue', 'Contribution', 'Status']}>
              {allocations.map((a) => (
                <tr key={a.id ?? ''}>
                  <Td className="font-medium text-slate-900">
                    <Link href={`/staff/${a.staff_id}`} className="hover:underline">
                      {a.staff_name}
                    </Link>
                  </Td>
                  <Td>{titleCase(a.duty_type?.replace('shift_', ''))}</Td>
                  <Td>{shortDate(a.start_date)}</Td>
                  <Td>{a.end_date ? shortDate(a.end_date) : '—'}</Td>
                  <Td numeric>{inr(a.patient_daily_rate)}</Td>
                  <Td numeric>{inr(a.staff_daily_wage)}</Td>
                  <Td numeric>{pct(a.daily_margin_pct)}</Td>
                  <Td numeric>{inr(a.revenue_to_date)}</Td>
                  <Td numeric className="font-semibold">{inr(a.contribution_to_date)}</Td>
                  <Td><Badge>{a.status ?? ''}</Badge></Td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty>No postings yet. Create one from the Postings page.</Empty>
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Recent duties">
          {duties?.length ? (
            <Table head={['Date', 'Attendant', 'Status', 'In', 'Out', 'Billed']}>
              {duties.map((d) => (
                <tr key={d.id ?? ''}>
                  <Td className="whitespace-nowrap">{shortDate(d.duty_date)}</Td>
                  <Td>{d.staff_name}</Td>
                  <Td><Badge>{d.status ?? ''}</Badge></Td>
                  <Td>{istTime(d.check_in_at)}</Td>
                  <Td>{istTime(d.check_out_at)}</Td>
                  <Td numeric>{inr(d.billed_amount)}</Td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty>No duties recorded.</Empty>
          )}
        </Card>

        {isFinance(profile.role) && (
          <Card title="Invoices & receipts">
            {invoices?.length ? (
              <Table head={['Invoice', 'Period', 'Total', 'Advance', 'Paid', 'Due', 'Status']}>
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <Td className="font-mono text-xs">{i.invoice_number}</Td>
                    <Td className="whitespace-nowrap">{monthLabel(i.period_month)}</Td>
                    <Td numeric>{inr(i.total_amount)}</Td>
                    <Td numeric>{inr(i.advance_adjusted)}</Td>
                    <Td numeric>{inr(i.amount_paid)}</Td>
                    <Td numeric className="font-semibold">{inr(i.balance_due)}</Td>
                    <Td><Badge>{i.status}</Badge></Td>
                  </tr>
                ))}
              </Table>
            ) : (
              <Empty>No invoices raised yet.</Empty>
            )}
            {payments?.length ? (
              <div className="border-t border-slate-100">
                <Table head={['Receipt', 'Date', 'Type', 'Mode', 'Amount']}>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <Td className="font-mono text-xs">{p.receipt_number}</Td>
                      <Td className="whitespace-nowrap">{shortDate(p.received_on)}</Td>
                      <Td>{titleCase(p.direction)}</Td>
                      <Td>{titleCase(p.payment_mode)}</Td>
                      <Td numeric>{inr(p.amount)}</Td>
                    </tr>
                  ))}
                </Table>
              </div>
            ) : null}
          </Card>
        )}
      </div>
    </>
  )
}
