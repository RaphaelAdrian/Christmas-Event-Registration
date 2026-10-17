# Event registration

A registration website for one event: an event page, a five-step registration form with receipt upload, and an admin area with an attendee list, invite list and Excel export.

Built with Next.js (App Router, TypeScript), Supabase (database, admin login, receipt storage) and Vercel (hosting).

## Change the event details

Everything the public sees (name, date, venue, fee, payment accounts, schedule, instructions, terms, privacy notice, contact email) lives in one file:

**`src/config/event.ts`**

1. Open the file on GitHub (or in your editor) and change the values between the quotes.
2. Replace the payment accounts with your real GCash and bank details.
3. Replace the placeholder terms and review the privacy notice with your Data Protection Officer.
4. Set `isSample: false`. While it is `true`, every public page shows a strip saying the details are samples.
5. Save (on GitHub: **Commit changes**). Vercel publishes the change in about a minute.

To close registration, set `registrationOpen: false`.

## Who can register: the invite list

With `inviteOnly: true` in `src/config/event.ts` (the default), only people on the admin **Invite list** can register. Set it to `false` to let anyone register.

The list is by name: each person has a **first name** and a **last name**; email is optional. A registration matches someone on the list when:

- the **last name** is the same (capitals, accents, spaces, dots, dashes and Jr./Sr./III don't matter: "dela Cruz" = "DelaCruz"), and
- the **first name** fits: the full first name, or a word or the start of a word from it. "Jai Plantig" matches "Jairus Miguel Plantig"; so does "Miguel Plantig".

What the person sees:

| Situation | Result |
| --- | --- |
| Name matches an invited person | Registered; their status changes from Invited to Confirmed |
| Name matches someone already registered | Refused: "This name is already registered" (nothing is added) |
| Name is not on the list | Refused: "We can't find this name on the invite list" |
| Short name fits two invited people (e.g. "Maria Santos" with Maria Clara and Maria Luisa on the list) | Asked to type the first name in full |
| Email already used by a registration | Refused: "This email is already registered" |

The admin lists show the name from the invite list, with "Registered as …" underneath when the person typed it differently.

Add people on **Invite list** one at a time, or import an Excel (.xlsx) or CSV file with **First name**, **Last name** and (optional) **Email** columns. A single **Name** column also works ("Juan dela Cruz" is split into Juan / dela Cruz). People already on the list are skipped. **Copy invite link** gives a link that opens the form with their name (and email, if known) filled in.

## Add an admin

An admin needs two things: a login, and their email on the allowlist.

1. In Supabase, open **Authentication → Users → Add user → Create new user**. Enter their email and a password, tick **Auto Confirm User**, then **Create user**.
2. Open **Table Editor → admins → Insert → Insert row**. Type the same email in lower case, then **Save**.

They can now sign in at `your-site/admin`. To remove an admin, delete their row from the `admins` table (and the user, if you like).

Someone who has a login but is not on the allowlist is turned away, and the database refuses to show them any records.

## Export the Excel file

1. Sign in at `your-site/admin`.
2. Click **Download Excel** in the top bar.

The file has four sheets: **All Attendees**, **Paid**, **Will Join (Confirmed)** and **Invited – Not Confirmed**. Each has the columns reference code, name, email, mobile, company, status, payment reference, date registered and date paid (Philippine time), a frozen header row, filters and sized columns. The Status column has a dropdown with the four statuses.

The file is a snapshot: changing a status in Excel does not change the website. Change statuses in the admin area.

## Statuses

| Status | Meaning |
| --- | --- |
| Invited – Not Confirmed | On the invite list, hasn't registered |
| Confirmed – Will Join | Registered, payment not yet verified |
| Paid | An admin checked the receipt and marked them Paid |
| Cancelled | Cancelled |

Registering with a name (or email) that matches the invite list changes that person from Invited to Confirmed automatically. See **Who can register** above.

## One-time setup

### 1. Supabase

1. At [supabase.com](https://supabase.com), create a project (region: Southeast Asia (Singapore)). Save the database password somewhere safe.
2. Open **SQL Editor → New query**, paste the whole of `supabase/migrations/20261016000000_initial_schema.sql`, and click **Run**. Then do the same with `supabase/migrations/20261017000000_name_invite_list.sql`. Together they create the tables, the security rules, the name-based invite list and the private `receipts` storage bucket. (Already ran the first file earlier? Just run the second one.)
3. Open **Authentication → Sign In / Providers** and turn off **Allow new users to sign up**. Admins are added by hand (see above).
4. Add yourself as the first admin (see **Add an admin**).
5. Open **Project Settings → API Keys** and keep the page open. You need the **Publishable key** and the **Secret key**. The project URL is under **Project Settings → Data API** (or the **Connect** button).

### 2. Vercel

1. Put this folder in a GitHub repository (for example with GitHub Desktop: **File → Add local repository**, then **Publish repository**, keep it private).
2. At [vercel.com](https://vercel.com), sign in with GitHub, click **Add New… → Project**, and **Import** the repository.
3. Under **Environment Variables**, add these three, then click **Deploy**:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL, e.g. `https://abcd1234.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_…`), or the older "anon" key |
| `SUPABASE_SECRET_KEY` | Secret key (`sb_secret_…`), or the older "service_role" key |

The secret key stays on the server: only files that start with `import "server-only"` use it, and the build fails if browser code tries to.

### 3. Run it on your computer (optional)

```bash
npm install
cp .env.example .env.local   # then paste your three values into .env.local
npm run dev                  # open http://localhost:3000
```

## How it is protected

- Row Level Security is on for every table. Logged-out visitors have no access to any table or to the receipts.
- Registrations go through the server, which checks every field (zod), the hidden honeypot field, a minimum fill-in time and a rate limit per connection, then calls one locked-down database function. That function blocks duplicate emails, confirms invited people, checks the receipt really was uploaded and issues the reference code.
- Receipts go into a private bucket through one-time upload links (images or PDF, up to 5 MB). Admins open them through signed links that expire after two minutes.
- Only signed-in users whose confirmed email is on the `admins` list can read or change attendees.

## Where things are

| Path | What it is |
| --- | --- |
| `src/config/event.ts` | Event details (edit this) |
| `src/app/page.tsx` | Event page |
| `src/app/register/` | Registration form, its server actions and the confirmation page |
| `src/app/admin/` | Admin sign-in, attendees, invite list, Excel export, receipt links |
| `src/lib/validation.ts` | Form rules and error messages |
| `src/lib/excel.ts` | Excel file layout |
| `supabase/migrations/` | Database tables, security rules and storage bucket |
