import { redirect } from 'next/navigation'
import { requireProfile, isOps } from '@/lib/auth'
import { createPatient } from '@/actions/patients'
import { ActionForm, SubmitButton } from '@/components/form'
import { Card, Field, Input, PageHeader, Select, Textarea } from '@/components/ui'
import { todayIST } from '@/lib/format'

export const dynamic = 'force-dynamic'

const SERVICE_TYPES = [
  ['attendant_24h', '24-hour attendant'],
  ['attendant_12h', '12-hour attendant'],
  ['nurse_24h', '24-hour nurse'],
  ['nurse_12h', '12-hour nurse'],
  ['nurse_visit', 'Nurse visit'],
]

export default async function NewPatientPage() {
  const { profile, supabase } = await requireProfile()
  if (!isOps(profile.role)) redirect('/patients')

  const { data: doctors } = await supabase
    .from('doctors')
    .select('id, full_name, hospital_name')
    .eq('is_active', true)
    .order('full_name')

  return (
    <>
      <PageHeader title="New patient" subtitle="Everything except name, address, contact and rate can be filled in later." />

      <ActionForm action={createPatient} className="space-y-5">
        <Card title="Identity">
          <div className="grid gap-4 p-4 sm:grid-cols-3">
            <Field label="Full name" required>
              <Input name="full_name" required placeholder="Sunanda Deshmukh" />
            </Field>
            <Field label="Gender">
              <Select name="gender" defaultValue="">
                <option value="">Not stated</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Date of birth" hint="Leave blank and enter age instead if unknown">
              <Input name="date_of_birth" type="date" />
            </Field>
            <Field label="Age (if DOB unknown)">
              <Input name="age_years" type="number" min={0} max={130} />
            </Field>
          </div>
        </Card>

        <Card title="Address">
          <div className="grid gap-4 p-4 sm:grid-cols-3">
            <Field label="Address line 1" required>
              <Input name="address_line1" required placeholder="Flat 402, Shanti Sadan" />
            </Field>
            <Field label="Address line 2">
              <Input name="address_line2" placeholder="Ranade Road, Shivaji Park" />
            </Field>
            <Field label="Landmark">
              <Input name="landmark" />
            </Field>
            <Field label="Area">
              <Input name="area" placeholder="Dadar West" />
            </Field>
            <Field label="Pincode">
              <Input name="pincode" inputMode="numeric" pattern="[1-9][0-9]{5}" placeholder="400028" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude" hint="For the check-in geo-fence">
                <Input name="latitude" type="number" step="0.000001" placeholder="19.027000" />
              </Field>
              <Field label="Longitude">
                <Input name="longitude" type="number" step="0.000001" placeholder="72.841000" />
              </Field>
            </div>
          </div>
        </Card>

        <Card title="Contacts">
          <div className="grid gap-4 p-4 sm:grid-cols-3">
            <Field label="Primary contact name" required>
              <Input name="primary_contact_name" required />
            </Field>
            <Field label="Primary contact phone" required hint="10 digits, no +91">
              <Input name="primary_contact_phone" required inputMode="numeric" pattern="[6-9][0-9]{9}" />
            </Field>
            <Field label="Relation">
              <Input name="primary_contact_relation" placeholder="Son" />
            </Field>
            <Field label="Family contact name">
              <Input name="family_contact_name" />
            </Field>
            <Field label="Family contact phone">
              <Input name="family_contact_phone" inputMode="numeric" pattern="[6-9][0-9]{9}" />
            </Field>
            <Field label="Relation">
              <Input name="family_contact_relation" />
            </Field>
          </div>
        </Card>

        <Card title="Clinical">
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label="Referring doctor">
              <Select name="referring_doctor_id" defaultValue="">
                <option value="">None</option>
                {doctors?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name}
                    {d.hospital_name ? ` — ${d.hospital_name}` : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Mobility status">
              <Input name="mobility_status" placeholder="Bed-bound, needs two-person transfer" />
            </Field>
            <Field label="Diagnosis">
              <Textarea name="diagnosis" />
            </Field>
            <Field label="Care requirements">
              <Textarea name="care_requirements" placeholder="Bed transfers, sponge bath, BP and sugar log twice daily…" />
            </Field>
          </div>
        </Card>

        <Card title="Commercials">
          <div className="grid gap-4 p-4 sm:grid-cols-3">
            <Field label="Service type" required>
              <Select name="service_type" required defaultValue="attendant_24h">
                {SERVICE_TYPES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Rate per day / visit (INR)" required>
              <Input name="default_daily_rate" type="number" min={0} step="1" required placeholder="1800" />
            </Field>
            <Field label="Security deposit (INR)">
              <Input name="security_deposit" type="number" min={0} step="1" defaultValue={0} />
            </Field>
            <Field label="Start date" required>
              <Input name="start_date" type="date" required defaultValue={todayIST()} />
            </Field>
            <Field label="Referral source">
              <Input name="referral_source" placeholder="Hospital discharge desk" />
            </Field>
            <Field label="Notes">
              <Input name="notes" />
            </Field>
          </div>
        </Card>

        <div className="flex justify-end">
          <SubmitButton>Create patient</SubmitButton>
        </div>
      </ActionForm>
    </>
  )
}
