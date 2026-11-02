# EMC-Christmas-Party Fest! 2026: registration

A website for one event: an event page with a countdown and a photo gallery, a short registration form, admin approval, sign-in for guests, payment by QR with a receipt check, and an admin area with a dashboard, payment review and Excel export.

Built with Next.js (App Router, TypeScript), Supabase (database, logins, file storage) and Vercel (hosting). The site sends no email and needs no paid service: admins pass messages on from their own email, Messenger or Viber, using ready-made drafts.

## How it works

1. **Register.** A guest gives their last name, first name, email and company, and chooses a password. The name is checked against the invite list (see below). Their sign-in is created straight away (Supabase Auth stores the password hashed) and they see "Thank you!" with a **Pay now** button.
2. **Pay, now or later.** Paying isn't part of registering: whenever they're ready (straight away or days later), pending and approved guests sign in and see the QR code, the amount and the instructions, enter the reference number and upload a screenshot of the receipt (image or PDF, up to 5 MB). Declined guests can't pay.
3. **Approve or decline.** An admin opens **Registrants** and clicks **Approve** or **Decline** (or ticks several rows and does them together). A ready-made message then appears beside each person: **Email the message** opens it in your own email app with the address, subject and text filled in; **Copy the message** is for Messenger or Viber; **Share** opens your phone's share sheet.
4. **Check the payment.** An admin opens **Payments**, sees the receipt beside the reference number, amount, name and registration status, and clicks **Mark paid** or **Reject** (with a reason the guest sees, so they can send it again). Marking a payment paid also approves the registration. A red box warns when someone else already used the same reference number. A ready-made message appears here too.
5. **Paid directly?** If a guest paid you in cash or by a transfer outside the site, click **Mark as paid** next to them on **Registrants** and add a note if you like ("Cash, 3 Dec"). It counts toward Collected and shows in the export as a direct payment. This also approves the registration.
6. **Paid.** The guest's page shows their pass. Guests can sign in at `your-site/login` any time to see where they are.

| Registration | Meaning |
| --- | --- |
| Invited – Not registered | On the invite list, hasn't registered |
| Pending | Registered, waiting for an admin; can already pay |
| Approved | An admin approved them (or confirmed their payment) |
| Declined | Can sign in but can't pay |

| Payment | Meaning |
| --- | --- |
| Unpaid | Nothing sent yet |
| Payment Submitted | Waiting for an admin to check |
| Paid | An admin confirmed it |
| Rejected | Needs another look; the guest sees the reason and can send it again |

### Forgotten passwords

Guests choose their own password when they register, so you only need this when someone forgets theirs. The site can't email a reset link: on **Registrants**, click **Reset password link** next to the person. You get a one-time link that signs them in and lets them set a new password; copy it or use the ready-made message, and send it only to them. The same button gives a sign-in to anyone who registered before passwords were asked for.

The link expires after the time set in Supabase (one hour by default; see setup step 2 to make it a day).

## Change the event details

Sign in at `your-site/admin`, open **Event details** and save. The website updates straight away. There you can change:

- the name, date, start and end time (an end time earlier than the start means the next day, so 3:00 PM to 12:00 is shown as "3:00 PM – 12:00 PM"), venue, map link, call time and shuttle
- **Additional details**: add, edit, move up or down, delete
- whether registration is open, and whether only invited people can register
- the contact email, organiser, terms and privacy notice
- **Payment**: the amount, the instructions and the QR image (only signed-in guests who are pending or approved see these)

Venue photos go in **Gallery**: upload several at once, add captions, change the order, delete.

## Who can register: the invite list

With **Only people on the invite list can register** ticked (the default), only people on the admin **Invite list** can register. Untick it to let anyone register.

A registration matches someone on the list when the **last name** is the same (capitals, accents, spaces, dots, dashes and Jr./Sr./III don't matter) and the **first name** fits: the full first name, or a word or the start of a word from it. "Jai Plantig" matches "Jairus Miguel Plantig".

| Situation | Result |
| --- | --- |
| Name matches an invited person | Registered as Pending |
| Name or email already registered | Refused: "This name/email is already registered" |
| Name was declined | Refused: "This registration was declined" |
| Name is not on the list | Refused: "We can't find this name on the invite list" |
| Short name fits two invited people | Asked to type the first name in full |

Add people one at a time, or import an Excel (.xlsx) or CSV file with **First name**, **Last name** and (optional) **Email** columns.

## Export to Excel

Click **Export to Excel** in the admin bar. The file has four sheets: **Paid**, **Approved – Not Yet Paid**, **Pending** and **All Registrants**, with last name, first name, email, company, registration status, payment status, how they paid (online or directly), reference number (or your note, for direct payments), date registered and date paid (Philippine time), a frozen header row, filters and sized columns. The file is a snapshot: change statuses on the website, not in Excel.

## Add an admin

1. In Supabase, open **Authentication → Users → Add user → Create new user**. Enter their email and a password, tick **Auto Confirm User**, then **Create user**.
2. Open **Table Editor → admins → Insert → Insert row**. Type the same email in lower case, then **Save**.

They sign in at `your-site/admin`. Someone with a login who isn't on the `admins` list can't see anyone else's data.

## One-time setup

### 1. Database

1. Open your project at [supabase.com](https://supabase.com) → **SQL Editor → New query**.
2. New project only: paste and **Run** `supabase/migrations/20261016000000_initial_schema.sql`, then `supabase/migrations/20261017000000_name_invite_list.sql`.
3. Paste and **Run** `supabase/migrations/20261102000000_approval_and_payments.sql`. It adds the new statuses, the event details, payments and gallery tables, the `gallery` and `event-private` storage buckets and their security rules. Existing rows are kept: Confirmed becomes Pending (with their receipt as a submitted payment), Paid becomes Approved and Paid, Cancelled becomes Declined.
4. Paste and **Run** `supabase/migrations/20261103000000_pay_before_approval.sql`. Guests can then pay straight after registering, confirming a payment also approves the registration, and admins can mark someone Paid who paid them directly.

### 2. Sign-in settings in Supabase

1. **Authentication → Sign In / Providers**: keep **Allow new users to sign up** turned off. The website creates guests' sign-ins itself when they register, so nobody can sign up around the form.
2. Still there, open **Email** and set **Email OTP Expiration** to `86400` (one day), so password links last a day. **Save**.

Custom SMTP and the email templates are not needed: the site never asks Supabase to send email.

### 3. Vercel environment variables

1. [vercel.com](https://vercel.com) → your project → **Settings → Environment Variables**.
2. Add each of these (tick Production, Preview and Development), then **Save**:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API: Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys: Publishable key (or the older "anon" key) |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys: Secret key (or the older "service_role" key). Server only. |
| `NEXT_PUBLIC_SITE_URL` | Your live address, e.g. `https://your-site.vercel.app` (used in password links and messages) |

3. **Deployments** → the latest deployment → **⋯ → Redeploy**, so the new values are used.

### 4. Run it on your computer (optional)

```bash
npm install
cp .env.example .env.local   # then fill in your values in .env.local, never in .env.example
npm run dev                  # open http://localhost:3000
```

Checks: `npm run lint`, `npm run typecheck`, `npm run build`.

## How it is protected

- **Row Level Security on every table.** Logged-out visitors can read only the event details, the additional details and the gallery. A signed-in guest reads only their own registration and payments, and the payment details only while pending or approved. Only admins (signed in and on the `admins` list) see or change everyone's data.
- **Registration** goes through the server: form checks, a hidden honeypot field, a minimum fill-in time and a per-connection rate limit. The invite-list and duplicate checks run before a sign-in is created, and one locked-down database function saves the registration.
- **Passwords** are chosen by the guest, stored hashed by Supabase Auth, and never shown, saved in the browser or sent anywhere. Password links work once and expire.
- **Receipts** go into a private bucket through one-time upload links, each in the guest's own folder. Admins view them through links that expire within minutes. The payment QR is private too.
- **Payments** are written only through database functions: one for the guest (`submit_payment`), and for admins `review_payment` and `record_direct_payment` (payments received outside the site).
- The Supabase secret key is used only in files marked `import "server-only"`; the build fails if browser code imports them. Keep it in `.env.local` and Vercel, never in `.env.example` or a commit.

## Where things are

| Path | What it is |
| --- | --- |
| `src/app/page.tsx` | Event page: facts, countdown, getting there, details, pass preview, gallery |
| `src/app/register/` | Registration form and its server actions, thank-you page |
| `src/app/login/`, `src/app/forgot-password/`, `src/app/auth/confirm/` | Sign-in, forgotten password, password links |
| `src/app/account/` | My registration: status, pay, pass, set a new password |
| `src/app/admin/` | Dashboard, Registrants, Payments, Invite list, Event details, Gallery, export |
| `src/lib/event.ts` | Reads the event details from Supabase |
| `src/lib/drafts.ts` | The ready-made messages for approve, decline, payments and password links |
| `supabase/migrations/` | Tables, functions, security rules, storage buckets |
