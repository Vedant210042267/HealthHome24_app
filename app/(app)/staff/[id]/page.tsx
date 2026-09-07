import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireProfile, isFinance } from '@/lib/auth'
import { Badge, Card, Empty, PageHeader, StatTile, Table, Td } from '@/components/ui'
import { currentPeriod, inr, istTime, num, shortDate, titleCase } from '@/lib/format'

export const dynamic = 'force-dynamic'

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value || '—'}</dd>
    </div>
  )
}

export default async function StaffMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { profile, supabase } = await requireProfile()

  const { data: member } = await supabase.from('staff').select('*').eq('id', id).maybeSingle()
  if (!member) notFound()

  const [{ data: kyc }, { data: bank }, { data: allocations }, { data: salary }, { data: advances }, { data: duties }] =
    await Promise.all([
      supabase.from('staff_kyc').select('*').eq('staff_id', id).maybeSingle(),
      supabase.from('staff_bank_accounts').select('*').eq('staff_id', id).eq('is_primary', true).maybeSingle(),
      supabase.from('v_duty_allocation_summary').select('*').eq('staff_id', id).order('start_date', { ascending: false }),
      supabase
        .from('v_staff_monthly_salary')
        .select('*')
        .eq('staff_id', id)
        .order('period_month', { ascending: false })
        .limit(12),
      supabase.from('v_staff_advance_balances').select('*').eq('staff_id', id).order('issued_on', { ascending: false }),
      supabase
        .from('v_attendance_detail')
        .select('*')
        .eq('staff_id', id)
        .order('duty_date', { ascending: false })
        .limit(12),
    ])

  const thisMonth = salary?.find((s) => s.period_month === currentPeriod())
  const openAdvance = (advances ?? [])
    .filter((a) => a.status === 'open')
    .reduce((sum, a) => sum + Number(a.balance_amount ?? 0), 0)

  return (
    <>
      <PageHeader
        title={member.full_name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{member.staff_code}</span>
            <Badge tone={member.is_active ? 'green' : 'slate'}>{member.is_active ? 'active' : 'inactive'}</Badge>
            <span>{titleCase(member.category)}</span>
            <span>· {inr(member.default_daily_wage)}/day</span>
          </span>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <StatTile label="Duties this month" value={num(thisMonth?.payable_units ?? 0, 1)} />
        <StatTile label="Earnings this month" value={inr(thisMonth?.net_payable ?? 0)} tone="positive" />
        <StatTile label="Advance outstanding" value={inr(openAdvance)} tone={openAdvance > 0 ? 'warn' : 'default'} />
        <StatTile label="Active postings" value={(allocations ?? []).filter((a) => a.status === 'ongoing').length} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card title="Details" className="lg:col-span-2">
          <dl className="grid gap-4 p-4 sm:grid-cols-3">
            <Detail label="Phone" value={member.phone} />
            <Detail label="Alternate" value={member.alternate_phone} />
            <Detail label="Joined" value={shortDate(member.joining_date)} />
            <Detail
              label="Emergency contact"
              value={
                <>
                  {member.emergency_contact_name}
                  <div className="text-slate-500">
                    {member.emergency_contact_phone} · {member.emergency_contact_relation}
                  </div>
                </>
              }
            />
            <Detail label="Present address" value={[member.address_line1, member.area, member.pincode].filter(Boolean).join(', ')} />
            <Detail label="Native place" value={member.native_address} />
            <Detail label="Qualification" value={member.qualification} />
            <Detail label="Specialization" value={member.specialization} />
            <Detail label="Experience" value={member.experience_years ? `${member.experience_years} years` : null} />
            <Detail label="Languages" value={member.languages?.join(', ')} />
            <Detail label="Council reg. no." value={member.nursing_council_reg_no} />
            <Detail label="Overtime rate" value={`${inr(member.default_ot_hourly_rate)}/hour`} />
          </dl>
        </Card>

        <div className="space-y-5">
          <Card title="KYC">
            {kyc ? (
              <dl className="grid gap-4 p-4 sm:grid-cols-2">
                <Detail label="Status" value={<Badge>{kyc.kyc_status}</Badge>} />
                <Detail
                  label="Police verified"
                  value={<Badge tone={kyc.police_verified ? 'green' : 'amber'}>{kyc.police_verified ? 'yes' : 'no'}</Badge>}
                />
                <Detail label="Aadhaar" value={<span className="font-mono">{kyc.aadhaar_number}</span>} />
                <Detail label="PAN" value={<span className="font-mono">{kyc.pan_number}</span>} />
              </dl>
            ) : (
              <Empty>No KYC record, or your role cannot view it.</Empty>
            )}
          </Card>

          {isFinance(profile.role) && (
            <Card title="Bank account">
              {bank ? (
                <dl className="grid gap-4 p-4 sm:grid-cols-2">
                  <Detail label="Holder" value={bank.account_holder_name} />
                  <Detail label="Bank" value={`${bank.bank_name}${bank.branch_name ? ` — ${bank.branch_name}` : ''}`} />
                  <Detail label="Account" value={<span className="font-mono">{bank.account_number}</span>} />
                  <Detail label="IFSC" value={<span className="font-mono">{bank.ifsc_code}</span>} />
                </dl>
              ) : (
                <Empty>No bank account on file.</Empty>
              )}
            </Card>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Monthly earnings">
          {salary?.length ? (
            <Table head={['Month', 'Present', 'Units', 'Gross', 'OT', 'Deductions', 'Recovery', 'Net']}>
              {salary.map((s) => (
                <tr key={s.period_month ?? ''}>
                  <Td className="whitespace-nowrap">{s.period_label}</Td>
                  <Td numeric>{s.days_present}</Td>
                  <Td numeric>{num(s.payable_units, 1)}</Td>
                  <Td numeric>{inr(s.gross_wage)}</Td>
                  <Td numeric>{inr(s.overtime_amount)}</Td>
                  <Td numeric>{inr(s.other_deductions)}</Td>
                  <Td numeric>{inr(s.advance_recovered)}</Td>
                  <Td numeric className="font-semibold">{inr(s.net_payable)}</Td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty>No duties recorded yet.</Empty>
          )}
        </Card>

        <Card title="Advances & loans">
          {advances?.length ? (
            <Table head={['Given', 'Type', 'Amount', 'Recovered', 'Balance', 'Per cycle', 'Status']}>
              {advances.map((a) => (
                <tr key={a.advance_id ?? ''}>
                  <Td className="whitespace-nowrap">{shortDate(a.issued_on)}</Td>
                  <Td>{titleCase(a.advance_type)}</Td>
                  <Td numeric>{inr(a.amount)}</Td>
                  <Td numeric>{inr(a.recovered_amount)}</Td>
                  <Td numeric className="font-semibold">{inr(a.balance_amount)}</Td>
                  <Td numeric>{inr(a.recovery_per_cycle)}</Td>
                  <Td><Badge>{a.status ?? ''}</Badge></Td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty>No advances taken.</Empty>
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Postings">
          {allocations?.length ? (
            <Table head={['Patient', 'Type', 'From', 'To', 'Wage/day', 'Status']}>
              {allocations.map((a) => (
                <tr key={a.id ?? ''}>
                  <Td className="font-medium text-slate-900">
                    <Link href={`/patients/${a.patient_id}`} className="hover:underline">
                      {a.patient_name}
                    </Link>
                  </Td>
                  <Td>{titleCase(a.duty_type?.replace('shift_', ''))}</Td>
                  <Td>{shortDate(a.start_date)}</Td>
                  <Td>{a.end_date ? shortDate(a.end_date) : '—'}</Td>
                  <Td numeric>{inr(a.staff_daily_wage)}</Td>
                  <Td><Badge>{a.status ?? ''}</Badge></Td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty>No postings yet.</Empty>
          )}
        </Card>

        <Card title="Recent duties">
          {duties?.length ? (
            <Table head={['Date', 'Patient', 'Status', 'In', 'Out', 'On site', 'Wage']}>
              {duties.map((d) => (
                <tr key={d.id ?? ''}>
                  <Td className="whitespace-nowrap">{shortDate(d.duty_date)}</Td>
                  <Td>{d.patient_name}</Td>
                  <Td><Badge>{d.status ?? ''}</Badge></Td>
                  <Td>{istTime(d.check_in_at)}</Td>
                  <Td>{istTime(d.check_out_at)}</Td>
                  <Td>
                    {d.check_in_on_site === null ? (
                      '—'
                    ) : (
                      <Badge tone={d.check_in_on_site ? 'green' : 'red'}>
                        {d.check_in_on_site ? 'yes' : `${num(d.check_in_distance_m, 0)} m away`}
                      </Badge>
                    )}
                  </Td>
                  <Td numeric>{inr(d.total_staff_cost)}</Td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty>No duties recorded.</Empty>
          )}
        </Card>
      </div>
    </>
  )
}
