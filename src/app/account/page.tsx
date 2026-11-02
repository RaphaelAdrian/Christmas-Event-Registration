import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { EventPass } from "@/components/EventPass";
import { getEventSettings } from "@/lib/event";
import { formatDateTimePH, formatPeso, paragraphs } from "@/lib/format";
import { writeTo } from "@/lib/registrant";
import { ATTENDEE_COLUMNS, SUBMISSION_COLUMNS, type Attendee, type PaymentSubmission } from "@/lib/statuses";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/user";
import { signOut } from "../login/actions";
import { PaymentForm } from "./PaymentForm";
import styles from "./account.module.css";

export const metadata: Metadata = { title: "My registration", robots: { index: false } };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AccountPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  const event = await getEventSettings();
  const passEvent = {
    shortName: event.shortName,
    startsAt: event.startsAt,
    venueName: event.venueName,
    referencePrefix: event.referencePrefix,
    callTime: event.callTime,
  };

  const signOutButton = (
    <form action={signOut}>
      <button type="submit" className="text-button" title={user.email ?? undefined}>
        Sign out
      </button>
    </form>
  );

  // Row Level Security returns only this person's own registration
  const { data: me } = await supabase.from("attendees").select(ATTENDEE_COLUMNS).eq("user_id", user.id).maybeSingle();
  const attendee = me as Attendee | null;

  if (!attendee) {
    const { data: isAdmin } = await supabase.rpc("is_admin");
    return (
      <AuthShell eventName={event.shortName} aside={signOutButton}>
        <h1 className={styles.title}>No registration on this sign-in</h1>
        <p>
          {user.email} isn&rsquo;t linked to a registration.{" "}
          {isAdmin === true ? (
            <>
              Admins work in the <Link href="/admin">admin area</Link>.
            </>
          ) : (
            <>If you think that&rsquo;s a mistake, {writeTo(event.contactEmail)}.</>
          )}
        </p>
      </AuthShell>
    );
  }

  const name = `${attendee.first_name} ${attendee.last_name}`.trim();
  const welcome = params.welcome ? (
    <p className="notice" data-tone="ok" role="status">
      Your password is saved. Next time, sign in with {user.email}.
    </p>
  ) : null;

  // Declined people can't pay. Pending and approved people can, straight after registering.
  if (attendee.registration_status === "declined" || attendee.registration_status === "invited") {
    return (
      <AuthShell eventName={event.shortName} aside={signOutButton}>
        {welcome}
        <h1 className={styles.title}>
          {attendee.registration_status === "declined" ? "Your registration was declined" : "Waiting for approval"}
        </h1>
        <p>
          {attendee.registration_status === "declined"
            ? `If you think that's a mistake, ${writeTo(event.contactEmail)}.`
            : "The organisers will let you know once it’s reviewed. You can check here any time; the payment details appear as soon as you’re approved."}
        </p>
      </AuthShell>
    );
  }

  const { data: subs } = await supabase
    .from("payment_submissions")
    .select(SUBMISSION_COLUMNS)
    .eq("attendee_id", attendee.id)
    .order("submitted_at", { ascending: false })
    .limit(10);
  const latest = ((subs ?? []) as PaymentSubmission[])[0];
  const status = attendee.payment_status;
  const reviewing =
    attendee.registration_status === "pending" ? (
      <p className="notice" role="status">
        Your registration is still being reviewed. You can pay now or come back later: once we confirm your payment, your place is confirmed too.
      </p>
    ) : null;

  // Paid: the pass is ready (even if the payment was marked by hand before approval)
  if (status === "paid") {
    return (
      <AuthShell eventName={event.shortName} aside={signOutButton} wide>
        {welcome}
        <div className={styles.split}>
          <div className={styles.text}>
            <h1 className={styles.title}>You&rsquo;re all set, {attendee.first_name}.</h1>
            <p className={styles.lead}>Your payment is confirmed. Show this pass, or your reference code, on the day.</p>
            <dl className={styles.facts}>
              <div>
                <dt>Reference code</dt>
                <dd>{attendee.reference_code}</dd>
              </div>
              {latest ? (
                <div>
                  <dt>Payment</dt>
                  {/* A direct payment's reference is the admin's own note, so it isn't shown */}
                  <dd>{latest.method === "direct" ? "Paid directly to the organisers" : latest.reference}</dd>
                </div>
              ) : null}
              <div>
                <dt>Paid</dt>
                <dd>{formatDateTimePH(attendee.paid_at)}</dd>
              </div>
            </dl>
          </div>
          <div className={styles.passSide}>
            <EventPass event={passEvent} size="large" name={name} company={attendee.company ?? ""} referenceCode={attendee.reference_code} note="Paid" />
          </div>
        </div>
      </AuthShell>
    );
  }

  // Submitted: waiting for an admin to check it
  if (status === "submitted") {
    return (
      <AuthShell eventName={event.shortName} aside={signOutButton} wide>
        {welcome}
        {reviewing}
        <div className={styles.split}>
          <div className={styles.text}>
            <h1 className={styles.title}>Payment sent</h1>
            <p className={styles.lead}>
              We check every payment by hand and email you once it&rsquo;s confirmed. Nothing else to do for now.
            </p>
            {latest ? (
              <dl className={styles.facts}>
                <div>
                  <dt>Reference number</dt>
                  <dd>{latest.reference}</dd>
                </div>
                <div>
                  <dt>Sent</dt>
                  <dd>{formatDateTimePH(latest.submitted_at)}</dd>
                </div>
                {latest.amount !== null ? (
                  <div>
                    <dt>Amount</dt>
                    <dd>{formatPeso(Number(latest.amount))}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </div>
          <div className={styles.passSide}>
            <EventPass event={passEvent} size="large" name={name} company={attendee.company ?? ""} referenceCode={attendee.reference_code} note="Payment being checked" />
          </div>
        </div>
      </AuthShell>
    );
  }

  // Unpaid or rejected: show how to pay. Row Level Security lets only pending and approved people read this.
  const { data: settings } = await supabase.from("payment_settings").select("amount, instructions, qr_path").eq("id", 1).maybeSingle();
  const amount = settings?.amount === null || settings?.amount === undefined ? null : Number(settings.amount);
  let qrUrl: string | null = null;
  if (settings?.qr_path) {
    const { data: signed } = await createServiceClient().storage.from("event-private").createSignedUrl(settings.qr_path as string, 900);
    qrUrl = signed?.signedUrl ?? null;
  }

  return (
    <AuthShell eventName={event.shortName} aside={signOutButton} wide>
      {welcome}
      {reviewing}
      <h1 className={styles.title}>Pay for your place, {attendee.first_name}</h1>
      {status === "rejected" && latest?.reject_reason ? (
        <div className="notice" data-tone="error" role="alert">
          <p>
            <strong>Your last payment needs another look.</strong> {latest.reject_reason}
          </p>
          <p>Fix it and send it again below.</p>
        </div>
      ) : null}

      {amount === null ? (
        <p className="notice">The payment details are being prepared. Check back soon; we&rsquo;ll also email you.</p>
      ) : (
        <div className={styles.pay}>
          <section className={styles.howToPay} aria-labelledby="pay-heading">
            <h2 id="pay-heading" className="visually-hidden">
              How to pay
            </h2>
            <p className={styles.amountLabel}>Amount to pay</p>
            <p className={styles.amount}>{formatPeso(amount)}</p>
            {qrUrl ? (
              <figure className={styles.qr}>
                <Image src={qrUrl} alt="Payment QR code" width={560} height={560} unoptimized priority className={styles.qrImage} />
              </figure>
            ) : null}
            <div className={styles.instructions}>
              {paragraphs(String(settings?.instructions ?? "")).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
          <PaymentForm resubmit={status === "rejected"} />
        </div>
      )}
    </AuthShell>
  );
}
