# HealthHome24

Home-care operations and management for a Mumbai agency — patients, attendants,
duty postings, GPS attendance, payroll, billing and margin.

Next.js 15 (App Router) · Tailwind CSS v4 · Supabase (PostgreSQL + Auth + RLS) · TypeScript

---

## What you need before you start

Just a **Supabase** account (free). Everything else depends on which path you take below.

### Step 1 — create the database (no installs, ~5 minutes)

1. Go to **supabase.com**, sign up, and click **New project**.
   - Name it `healthhome24`.
   - Set a database password and save it somewhere.
   - Region: **ap-south-1 (Mumbai)** if offered, otherwise Singapore.
2. Wait for it to finish provisioning.
3. In the left sidebar open **SQL Editor → New query**.
4. Open `supabase/schema.sql` from this project, copy the whole file, paste it in, and press **Run**.
5. Open **Table Editor** — you should see `patients`, `staff`, `attendance` and the rest,
   already populated with the August 2026 sample data.

> Delete Section 12 of `schema.sql` (the sample data) before you go live.
> The script is safe to re-run: it is idempotent and the seed block skips itself.

### Step 2 — get your two keys

**Project Settings → API**. You need:

| Value | Where it goes |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

The anon key is safe in the browser. Every table has Row Level Security, so the key
on its own grants access to nothing. **Never put the `service_role` key in this app.**

### Step 3 — create your first login

In Supabase, **Authentication → Users → Add user**, with an email and password
(tick "Auto Confirm User"). A `profiles` row is created automatically by a trigger,
with the role `attendant`. Promote yourself in the **SQL Editor**:

```sql
update public.profiles set role = 'admin' where id = '<the new user uuid>';
```

Sign in with that email and password.

---

## Running the app

### Option A — deploy it, no installs at all

1. Create a new repository on **github.com** and upload this folder
   (**Add file → Upload files**, then drag the folder in).
2. Go to **vercel.com**, sign in with GitHub, **Add New → Project**, and import that repo.
3. Under **Environment Variables** add the two values from Step 2.
4. **Deploy**. You get a URL you can open on any phone or laptop.

Nothing is installed on your machine, and every later change redeploys itself when
the repository changes.

### Option B — run it on your own machine

Needs **Node.js 20 or newer** (nodejs.org). Any editor, or none.

```bash
cp .env.local.example .env.local     # then paste your two values into it
npm install
npm run dev                          # http://localhost:3000
```

---

## The four roles

Set on `public.profiles.role`. Row Level Security enforces all of this in the
database, so the rules hold no matter what the client asks for.

| Role | Sees and does |
|---|---|
| `admin` | Everything, including KYC, bank details, and reopening a locked payroll run |
| `coordinator` | Patients, staff, postings, attendance. No money. |
| `accountant` | Advances, invoices, receipts, payroll, expenses. Read-only on operations. |
| `attendant` | Only their own record, their own duties, their own attendance and payslips |

An attendant signing in on their phone sees the patients they are posted to and
nothing else — not other attendants, not rates, not invoices. Link a login to a
staff record by setting `profiles.staff_id`.

---

## How the month works

1. **Postings** (`/allocations`) — put an attendant on a patient, with the daily
   billing rate and the daily wage. Both are copied onto every attendance row, so
   changing a rate later never restates a settled month.
2. **Attendance** (`/attendance`) — a coordinator marks the board, or the attendant
   checks in and out on their phone. Location is recorded with each punch and
   compared against the patient's registered address.
3. **Payroll** (`/payroll`) — build the draft, review it, approve it. Approving
   **locks that month's attendance**; advances are recovered automatically, oldest
   first, never more than the payslip can bear.
4. **Billing** (`/billing`) — generate each patient's invoice from fulfilled duties.
   Any advance sitting on the account is applied. Issuing the invoice locks that
   patient's month.
5. **Reports** (`/reports`) — revenue less attendant cost less direct cost is the
   gross contribution; office overhead is charged below that line.

To correct a settled month: reopen the payroll run (admin), or cancel the invoice.

---

## Project layout

```
app/
  login/              sign-in
  (app)/              everything behind auth — layout enforces the session
    dashboard/        today's board, KPIs, contribution by patient
    attendance/       duty board + GPS check-in/out
    patients/         list, detail, create
    staff/            list, detail, create
    allocations/      postings
    payroll/          build, approve, payslips, disbursement
    advances/         advances and loans ledger
    billing/          statements, invoices, receipts
    reports/          P&L, per-patient margin, geo-fence exceptions
actions/              server actions (all mutations)
components/           UI kit, nav, chart primitives
lib/
  supabase/           browser, server and middleware clients
  database.types.ts   generated from the SQL schema
  auth.ts             session + role helpers
  format.ts           INR, IST dates, Indian number formatting
supabase/schema.sql   the database
middleware.ts         session refresh + route protection
```

**Read from views, write to tables.** The heavy arithmetic — monthly salary,
patient statements, profitability — lives in SQL views, so the app never
recalculates money in JavaScript.

## Regenerating the types after a schema change

```bash
npx supabase gen types typescript --project-id <your-project-ref> > lib/database.types.ts
```

## Notes

- All money is `numeric(12,2)` in the database. Never read it into a float for
  anything other than display.
- Timestamps are `timestamptz`, rendered in Asia/Kolkata. `duty_date` is a plain
  date and is already the local calendar day.
- Create **private** Storage buckets `staff-kyc` and `staff-photos` for documents;
  only the path is stored in the database, and files are served with signed URLs.
- Aadhaar is stored masked (`XXXXXXXX1234`). Warehousing full Aadhaar numbers as a
  private agency is a liability under UIDAI rules, not a feature.
