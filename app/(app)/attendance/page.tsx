import Link from 'next/link'
import { requireProfile, isBackOffice } from '@/lib/auth'
import { Badge, Card, Empty, PageHeader, StatTile, Table, Td } from '@/components/ui'
import { inr, istTime, num, shortDate, titleCase, todayIST } from '@/lib/format'
import { MarkForm } from './mark-form'
import { CheckInCard } from './check-in-card'

export const dynamic = 'force-dynamic'

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const { profile, supabase } = await requireProfile()
  const { date } = await searchParams
  const dutyDate = date ?? todayIST()

  // Every ongoing posting that covers this date. RLS narrows this to their own
  // postings when an attendant is signed in.
  const { data: allocations } = await supabase
    .from('duty_allocations')
    .select(
      'id, patient_id, staff_id, duty_type, shift_slot, patient_daily_rate, staff_daily_wage, patients(full_name, area, address_line1, primary_contact_phone), staff(full_name, phone)'
    )
    .in('status', ['ongoing', 'on_hold'])
    .lte('start_date', dutyDate)
    .or(`end_date.is.null,end_date.gte.${dutyDate}`)

  const { data: marked } = await supabase
    .from('attendance')
    .select('*')
    .eq('duty_date', dutyDate)

  const { data: reliefStaff } = await supabase
    .from('staff')
    .select('id, full_name')
    .eq('is_active', true)
    .order('full_name')

  const byAllocation = new Map((marked ?? []).filter((m) => !m.is_replacement).map((m) => [m.duty_allocation_id, m]))
  const reliefRows = (marked ?? []).filter((m) => m.is_replacement)

  const rows = (allocations ?? []).map((a) => ({
    allocation: a,
    attendance: byAllocation.get(a.id) ?? null,
  }))

  const unmarked = rows.filter((r) => !r.attendance).length
  const present = rows.filter((r) => r.attendance?.status === 'present').length
  const billed = rows.reduce((s, r) => s + Number(r.attendance?.patient_units ?? 0) * Number(r.attendance?.patient_rate_applied ?? 0), 0)

  const staffNames = new Map((reliefStaff ?? []).map((s) => [s.id, s.full_name]))

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={shortDate(dutyDate)}
        action={
          <form className="flex items-end gap-2">
            <input
              type="date"
              name="date"
              defaultValue={dutyDate}
              className="rounded-lg border-0 px-3 py-2 text-sm shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand-600"
            />
            <button className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
              Go
            </button>
          </form>
        }
      />

      {isBackOffice(profile.role) && (
        <div className="mb-5 grid gap-3 sm:grid-cols-4">
          <StatTile label="Duties scheduled" value={rows.length} />
          <StatTile label="Marked present" value={present} tone="positive" />
          <StatTile label="Not yet marked" value={unmarked} tone={unmarked ? 'warn' : 'default'} />
          <StatTile label="Billed for the day" value={inr(billed)} />
        </div>
      )}

      <Card title={isBackOffice(profile.role) ? 'Duty board' : 'My duty'}>
        {rows.length === 0 ? (
          <Empty>No postings cover this date.</Empty>
        ) : isBackOffice(profile.role) ? (
          <Table head={['Patient', 'Attendant', 'Shift', 'In', 'Out', 'Marked as', 'Update']}>
            {rows.map(({ allocation: a, attendance: att }) => {
              const patient = a.patients as { full_name: string; area: string | null } | null
              const staff = a.staff as { full_name: string; phone: string } | null
              return (
                <tr key={a.id}>
                  <Td className="font-medium text-slate-900">
                    <Link href={`/patients/${a.patient_id}`} className="hover:underline">
                      {patient?.full_name}
                    </Link>
                    <div className="text-xs font-normal text-slate-500">{patient?.area}</div>
                  </Td>
                  <Td>
                    <Link href={`/staff/${a.staff_id}`} className="hover:underline">
                      {staff?.full_name}
                    </Link>
                    <div className="text-xs text-slate-500">{staff?.phone}</div>
                  </Td>
                  <Td>{titleCase(a.duty_type.replace('shift_', ''))}</Td>
                  <Td>{istTime(att?.check_in_at)}</Td>
                  <Td>{istTime(att?.check_out_at)}</Td>
                  <Td>
                    {att ? <Badge>{att.status}</Badge> : <Badge tone="amber">not marked</Badge>}
                    {att?.status === 'replaced' && att.replacement_staff_id && (
                      <div className="mt-0.5 text-xs text-slate-500">
                        by {staffNames.get(att.replacement_staff_id) ?? '—'}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <MarkForm
                      allocationId={a.id}
                      staffId={a.staff_id}
                      patientId={a.patient_id}
                      dutyDate={dutyDate}
                      current={
                        att
                          ? {
                              status: att.status,
                              overtime_hours: Number(att.overtime_hours),
                              notes: att.notes,
                              replacement_staff_id: att.replacement_staff_id,
                            }
                          : null
                      }
                      reliefStaff={reliefStaff ?? []}
                    />
                  </Td>
                </tr>
              )
            })}
          </Table>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map(({ allocation: a, attendance: att }) => {
              const patient = a.patients as {
                full_name: string
                area: string | null
                address_line1: string
                primary_contact_phone: string
              } | null
              return (
                <div key={a.id} className="p-4">
                  <div className="mb-3">
                    <div className="text-base font-semibold text-slate-900">{patient?.full_name}</div>
                    <div className="text-sm text-slate-500">
                      {[patient?.address_line1, patient?.area].filter(Boolean).join(', ')}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      Family: {patient?.primary_contact_phone} · {titleCase(a.duty_type.replace('shift_', ''))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm">
                      <span>In: {istTime(att?.check_in_at)}</span>
                      <span>Out: {istTime(att?.check_out_at)}</span>
                      {att && <Badge>{att.status}</Badge>}
                    </div>
                  </div>
                  {dutyDate >= todayIST() || att ? (
                    <CheckInCard
                      duty={{
                        allocationId: a.id,
                        staffId: a.staff_id,
                        patientId: a.patient_id,
                        dutyDate,
                        attendanceId: att?.id ?? null,
                        checkedIn: Boolean(att?.check_in_at),
                        checkedOut: Boolean(att?.check_out_at),
                      }}
                    />
                  ) : (
                    <p className="text-sm text-slate-500">
                      This date is closed for self-marking. Ask a coordinator to record it.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {isBackOffice(profile.role) && reliefRows.length > 0 && (
        <div className="mt-5">
          <Card title="Relief duties on this date">
            <Table head={['Relief attendant', 'Patient', 'In', 'Out', 'Paid to relief', 'Billed to patient']}>
              {reliefRows.map((r) => (
                <tr key={r.id}>
                  <Td className="font-medium text-slate-900">{staffNames.get(r.staff_id) ?? '—'}</Td>
                  <Td>{r.patient_id}</Td>
                  <Td>{istTime(r.check_in_at)}</Td>
                  <Td>{istTime(r.check_out_at)}</Td>
                  <Td numeric>{inr(Number(r.staff_units) * Number(r.staff_wage_applied))}</Td>
                  <Td numeric>{num(Number(r.patient_units), 0)} units</Td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      )}
    </>
  )
}
