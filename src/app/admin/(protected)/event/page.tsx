import { requireAdmin } from "@/lib/admin";
import { SETTINGS_COLUMNS, settingsFromRow } from "@/lib/event";
import { manilaParts } from "@/lib/format";
import { DetailsEditor } from "./DetailsEditor";
import { EventForm } from "./EventForm";
import { PaymentSettingsForm } from "./PaymentSettingsForm";
import styles from "../../admin.module.css";

export const metadata = { title: "Event details" };

export default async function EventDetailsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: row }, { data: details }, { data: payment }] = await Promise.all([
    supabase.from("event_settings").select(SETTINGS_COLUMNS).eq("id", 1).maybeSingle(),
    supabase.from("event_details").select("id, title, body").order("position").order("created_at"),
    supabase.from("payment_settings").select("amount, instructions, qr_path").eq("id", 1).maybeSingle(),
  ]);

  if (!row) {
    return (
      <div className={styles.formError}>
        The event details row is missing. Run supabase/migrations/20261102000000_approval_and_payments.sql in the
        Supabase SQL Editor.
      </div>
    );
  }

  const s = settingsFromRow(row as Parameters<typeof settingsFromRow>[0]);
  const start = manilaParts(s.startsAt);
  const end = manilaParts(s.endsAt);

  let qrUrl: string | null = null;
  if (payment?.qr_path) {
    const { data: signed } = await supabase.storage.from("event-private").createSignedUrl(payment.qr_path as string, 600);
    qrUrl = signed?.signedUrl ?? null;
  }

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>Event details</h1>
        <p className={styles.pageNote}>
          Everything on the public event page. Changes show on the website as soon as you save.
        </p>
      </div>

      <EventForm
        initial={{
          name: s.name,
          shortName: s.shortName,
          tagline: s.tagline,
          date: start.date,
          startTime: start.time,
          endTime: end.time,
          venueName: s.venueName,
          venueAddress: s.venueAddress,
          mapUrl: s.mapUrl,
          callTime: s.callTime,
          shuttleInfo: s.shuttleInfo,
          organizer: s.organizer,
          contactEmail: s.contactEmail,
          referencePrefix: s.referencePrefix,
          registrationOpen: s.registrationOpen,
          inviteOnly: s.inviteOnly,
          terms: s.terms,
          privacyNotice: s.privacyNotice,
        }}
      />

      <DetailsEditor initial={(details ?? []) as { id: string; title: string; body: string }[]} />

      <PaymentSettingsForm
        initial={{
          amount: payment?.amount === null || payment?.amount === undefined ? "" : String(payment.amount),
          instructions: String(payment?.instructions ?? ""),
          qrPath: (payment?.qr_path as string | null) ?? null,
        }}
        qrUrl={qrUrl}
      />
    </>
  );
}
