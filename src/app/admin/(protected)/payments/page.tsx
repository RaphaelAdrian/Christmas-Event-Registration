import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { formatDateTimePH, formatPeso } from "@/lib/format";
import { REGISTRATION_LABELS, SUBMISSION_COLUMNS, type PaymentSubmission, type RegistrationStatus } from "@/lib/statuses";
import { ReviewActions } from "./ReviewActions";
import styles from "../../admin.module.css";

export const metadata = { title: "Payments to review" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Person = {
  id: string;
  full_name: string;
  email: string | null;
  company: string | null;
  reference_code: string | null;
  registration_status: RegistrationStatus;
};
type Item = PaymentSubmission & { attendee: Person | null };

const TABS = [
  { key: "submitted", label: "To review" },
  { key: "rejected", label: "Rejected" },
  { key: "paid", label: "Paid" },
] as const;

const SUBMISSION_STATUS_LABEL = { submitted: "Payment Submitted", paid: "Paid", rejected: "Rejected" } as const;

export default async function PaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const tab = TABS.find((t) => t.key === params.tab)?.key ?? "submitted";

  const counts = await Promise.all(
    TABS.map(async (t) => {
      const { count } = await supabase.from("payment_submissions").select("id", { count: "exact", head: true }).eq("status", t.key);
      return count ?? 0;
    }),
  );

  const { data, error } = await supabase
    .from("payment_submissions")
    .select(`${SUBMISSION_COLUMNS}, attendee:attendees(id, full_name, email, company, reference_code, registration_status)`)
    .eq("status", tab)
    .order("submitted_at", { ascending: tab === "submitted" })
    .limit(200);
  const items = (data ?? []) as unknown as Item[];

  // Every other use of the same reference number, by anyone else. Direct
  // payments are left out: their "reference" is the admin's own note.
  const keys = [...new Set(items.filter((i) => i.method === "online").map((i) => i.reference_key).filter(Boolean))];
  const { data: sameRef } = keys.length
    ? await supabase
        .from("payment_submissions")
        .select("id, attendee_id, reference_key, status, submitted_at, attendee:attendees(full_name)")
        .eq("method", "online")
        .in("reference_key", keys)
    : { data: [] };
  const uses = (sameRef ?? []) as unknown as {
    id: string;
    attendee_id: string;
    reference_key: string;
    status: keyof typeof SUBMISSION_STATUS_LABEL;
    submitted_at: string;
    attendee: { full_name: string } | null;
  }[];

  // Short-lived links to view each receipt (admins can read the private bucket)
  const signed = await Promise.all(
    items.map(async (i) => {
      if (!i.receipt_path) return [i.id, null] as const;
      const { data: s } = await supabase.storage.from("receipts").createSignedUrl(i.receipt_path, 600);
      return [i.id, s?.signedUrl ?? null] as const;
    }),
  );
  const urls = Object.fromEntries(signed);

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>Payments to review</h1>
        <p className={styles.pageNote}>
          Check each receipt against your account, then mark it paid or reject it with a reason. Marking a payment
          paid also approves the registration. A red box means someone else already used the same reference number.
          People who paid you directly are marked paid from Registrants.
        </p>
      </div>

      <nav aria-label="Payment lists" className={styles.filters}>
        {TABS.map((t, i) => (
          <Link
            key={t.key}
            href={t.key === "submitted" ? "/admin/payments" : `/admin/payments?tab=${t.key}`}
            className={`btn btn-small ${t.key === tab ? "" : "btn-quiet"}`}
            aria-current={t.key === tab ? "page" : undefined}
          >
            {t.label} ({counts[i]})
          </Link>
        ))}
      </nav>

      {error ? <p className={styles.formError}>Couldn&rsquo;t load the payments. Reload the page.</p> : null}

      {items.length ? (
        <ul className={styles.reviewList}>
          {items.map((item) => {
            const person = item.attendee;
            const direct = item.method === "direct";
            const others = direct ? [] : uses.filter((u) => u.reference_key === item.reference_key && u.attendee_id !== item.attendee_id);
            const url = urls[item.id];
            const ext = item.receipt_path?.split(".").pop()?.toLowerCase() ?? "";
            const name = person?.full_name || "this person";
            return (
              <li key={item.id} className={styles.reviewItem}>
                {direct ? (
                  <div className={styles.receipt}>
                    <p className={styles.muted}>Paid directly to an organiser. There&rsquo;s no receipt.</p>
                  </div>
                ) : (
                  <div>
                    <div className={styles.receipt}>
                      {!url ? (
                        <p className={styles.muted}>The receipt couldn&rsquo;t be loaded.</p>
                      ) : ext === "pdf" ? (
                        <iframe src={url} title={`Receipt from ${name}`} className={styles.receiptPdf} />
                      ) : ext === "heic" || ext === "heif" ? (
                        <p className={styles.muted}>HEIC photos don&rsquo;t preview in most browsers. Open it below.</p>
                      ) : (
                        <Image src={url} alt={`Receipt from ${name}`} width={900} height={1200} unoptimized />
                      )}
                    </div>
                    <p className={styles.receiptLink}>
                      <a href={`/admin/receipts/${item.id}`} target="_blank" rel="noopener noreferrer">
                        Open the receipt full size
                      </a>
                    </p>
                  </div>
                )}

                <div className={styles.reviewFacts}>
                  {others.length ? (
                    <div className={styles.dupWarning} role="alert">
                      <strong>This reference number was already used by someone else.</strong>
                      <ul>
                        {others.map((o) => (
                          <li key={o.id}>
                            {o.attendee?.full_name ?? "Another registrant"}: {SUBMISSION_STATUS_LABEL[o.status]},{" "}
                            {formatDateTimePH(o.submitted_at)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <dl className={styles.reviewFacts}>
                    <div>
                      <dt>Name</dt>
                      <dd className={styles.bigRef}>{person?.full_name}</dd>
                      <dd className={styles.sub}>
                        {[person?.email, person?.company, person?.reference_code].filter(Boolean).join(", ")}
                      </dd>
                    </div>
                    {person ? (
                      <div>
                        <dt>Registration</dt>
                        <dd>
                          <span className={styles.chip} data-status={person.registration_status}>
                            {REGISTRATION_LABELS[person.registration_status]}
                          </span>
                        </dd>
                        {item.status === "submitted" && person.registration_status !== "approved" ? (
                          <dd className={styles.sub}>Not approved yet. Marking this paid approves them too.</dd>
                        ) : null}
                      </div>
                    ) : null}
                    <div>
                      <dt>{direct ? "Note" : "Reference number"}</dt>
                      <dd className={styles.bigRef}>{item.reference}</dd>
                    </div>
                    <div>
                      <dt>Amount due</dt>
                      <dd className={styles.bigRef}>{item.amount === null ? "Not recorded" : formatPeso(Number(item.amount))}</dd>
                    </div>
                    <div>
                      <dt>{direct ? "Recorded" : "Sent"}</dt>
                      <dd>{formatDateTimePH(item.submitted_at)}</dd>
                    </div>
                    {item.status !== "submitted" ? (
                      <div>
                        <dt>{item.status === "paid" ? "Marked paid" : "Rejected"}</dt>
                        <dd>
                          {formatDateTimePH(item.reviewed_at)}
                          {item.reviewed_by ? ` by ${item.reviewed_by}` : ""}
                        </dd>
                        {item.reject_reason ? <dd className={styles.sub}>Reason: {item.reject_reason}</dd> : null}
                      </div>
                    ) : null}
                  </dl>
                  {item.status === "submitted" ? <ReviewActions submissionId={item.id} name={name} /> : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className={styles.empty}>
          <p>{tab === "submitted" ? "Nothing to review right now. New payments appear here as soon as they're sent." : "None yet."}</p>
        </div>
      )}
    </>
  );
}
