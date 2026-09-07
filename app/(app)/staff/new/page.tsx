import { redirect } from 'next/navigation'
import { requireProfile, isOps } from '@/lib/auth'
import { createStaff } from '@/actions/staff'
import { ActionForm, SubmitButton } from '@/components/form'
import { Card, Field, Input, PageHeader, Select } from '@/components/ui'
import { todayIST } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function NewStaffPage() {
  const { profile } = await requireProfile()
  if (!isOps(profile.role)) redirect('/staff')

  return (
    <>
      <PageHeader
        title="New attendant or nurse"
        subtitle="Aadhaar, PAN and document uploads are added afterwards from the staff record — they are admin-only."
      />

      <ActionForm action={createStaff} className="space-y-5">
        <Card title="Identity">
          <div className="grid gap-4 p-4 sm:grid-cols-3">
            <Field label="Full name" required>
              <Input name="full_name" required placeholder="Ramesh Gupta" />
            </Field>
            <Field label="Category" required>
              <Select name="category" required defaultValue="general_attendant">
                <option value="general_attendant">General attendant</option>
                <option value="nurse">Nurse</option>
                <option value="physiotherapist">Physiotherapist</option>
                <option value="supervisor">Supervisor</option>
              </Select>
            </Field>
            <Field label="Gender">
              <Select name="gender" defaultValue="">
                <option value="">Not stated</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Date of birth">
              <Input name="date_of_birth" type="date" />
            </Field>
            <Field label="Phone" required hint="10 digits, no +91">
              <Input name="phone" required inputMode="numeric" pattern="[6-9][0-9]{9}" />
            </Field>
            <Field label="Alternate phone">
              <Input name="alternate_phone" inputMode="numeric" pattern="[6-9][0-9]{9}" />
            </Field>
          </div>
        </Card>

        <Card title="Emergency contact">
          <div className="grid gap-4 p-4 sm:grid-cols-3">
            <Field label="Name" required>
              <Input name="emergency_contact_name" required />
            </Field>
            <Field label="Phone" required>
              <Input name="emergency_contact_phone" required inputMode="numeric" pattern="[6-9][0-9]{9}" />
            </Field>
            <Field label="Relation">
              <Input name="emergency_contact_relation" placeholder="Wife" />
            </Field>
          </div>
        </Card>

        <Card title="Address">
          <div className="grid gap-4 p-4 sm:grid-cols-3">
            <Field label="Present address">
              <Input name="address_line1" placeholder="Room 12, Sai Krupa Chawl" />
            </Field>
            <Field label="Area">
              <Input name="area" placeholder="Kurla West" />
            </Field>
            <Field label="Pincode">
              <Input name="pincode" inputMode="numeric" pattern="[1-9][0-9]{5}" />
            </Field>
            <div className="sm:col-span-3">
              <Field label="Native place" hint="Most home-care staff are migrant workers; this is what reaches the family in an emergency.">
                <Input name="native_address" placeholder="Gorakhpur, Uttar Pradesh" />
              </Field>
            </div>
          </div>
        </Card>

        <Card title="Professional">
          <div className="grid gap-4 p-4 sm:grid-cols-3">
            <Field label="Qualification">
              <Input name="qualification" placeholder="GNM / Certified Home Health Aide" />
            </Field>
            <Field label="Specialization">
              <Input name="specialization" placeholder="Bed-bound and stroke care" />
            </Field>
            <Field label="Experience (years)">
              <Input name="experience_years" type="number" step="0.5" min={0} max={60} />
            </Field>
            <Field label="Languages" hint="Comma separated">
              <Input name="languages" placeholder="Hindi, Marathi" />
            </Field>
            <Field label="Nursing council reg. no.">
              <Input name="nursing_council_reg_no" />
            </Field>
            <Field label="Joining date" required>
              <Input name="joining_date" type="date" required defaultValue={todayIST()} />
            </Field>
          </div>
        </Card>

        <Card title="Pay">
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label="Default daily wage (INR)" required hint="Copied onto new postings; the posting's rate is what actually pays.">
              <Input name="default_daily_wage" type="number" min={0} step="1" required placeholder="1200" />
            </Field>
            <Field label="Overtime rate per hour (INR)">
              <Input name="default_ot_hourly_rate" type="number" min={0} step="1" defaultValue={0} />
            </Field>
          </div>
        </Card>

        <Card title="Bank account (optional)">
          <div className="grid gap-4 p-4 sm:grid-cols-3">
            <Field label="Account holder name">
              <Input name="account_holder_name" />
            </Field>
            <Field label="Account number">
              <Input name="account_number" inputMode="numeric" pattern="[0-9]{9,18}" />
            </Field>
            <Field label="IFSC">
              <Input name="ifsc_code" placeholder="SBIN0011456" style={{ textTransform: 'uppercase' }} />
            </Field>
            <Field label="Bank name">
              <Input name="bank_name" placeholder="State Bank of India" />
            </Field>
            <Field label="Branch">
              <Input name="branch_name" />
            </Field>
          </div>
        </Card>

        <div className="flex justify-end">
          <SubmitButton>Create staff record</SubmitButton>
        </div>
      </ActionForm>
    </>
  )
}
