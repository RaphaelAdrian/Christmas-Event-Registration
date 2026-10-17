import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { isStatus, STATUSES, STATUS_LABELS, type Attendee, type AttendeeStatus } from "@/lib/statuses";
import { AttendeeTable } from "./AttendeeTable";
import { Filters } from "./Filters";
import styles from "../admin.module.css";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const COLUMNS =
  "id, reference_code, first_name, last_name, full_name, name_as_entered, email, mobile, company, job_title, status, payment_reference, receipt_path, invited_at, registered_at, paid_at, cancelled_at, created_at";

function one(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function AttendeesPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const q = one(params.q).trim().slice(0, 100);
  const status = isStatus(one(params.status)) ? (one(params.status) as AttendeeStatus) : null;

  // Totals for each status
  const counts = await Promise.all(
    STATUSES.map(async (s) => {
      const { count } = await supabase.from("attendees").select("id", { count: "exact", head: true }).eq("status", s);
      return [s, count ?? 0] as const;
    }),
  );
  const totals = Object.fromEntries(counts) as Record<AttendeeStatus, number>;
  const total = counts.reduce((sum, [, n]) => sum + n, 0);

  // The table
  let query = supabase.from("attendees").select(COLUMNS).order("created_at", { ascending: false }).limit(1000);
  if (status) query = query.eq("status", status);
  if (q) {
    // Characters that would break the filter syntax are treated as spaces
    const term = q.replace(/[,()*%\\"']/g, " ").replace(/\s+/g, " ").trim();
    if (term) {
      const like = `%${term}%`;
      query = query.or(
        ["full_name", "name_as_entered", "email", "company", "mobile", "reference_code", "payment_reference"]
          .map((c) => `${c}.ilike.${like}`)
          .join(","),
      );
    }
  }
  const { data, error } = await query;
  const rows = (data ?? []) as Attendee[];

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>Attendees</h1>
        <p className={styles.pageNote}>Change a status from the list in each row. Changes save straight away.</p>
      </div>

      <dl className={styles.totals}>
        {STATUSES.map((s) => (
          <div key={s} className={styles.total} data-status={s} data-active={status === s}>
            <dt className={styles.totalLabel}>
              <Link href={status === s ? "/admin" : `/admin?status=${s}`}>{STATUS_LABELS[s]}</Link>
            </dt>
            <dd className={styles.totalNumber}>{totals[s]}</dd>
          </div>
        ))}
        <div className={styles.total} data-active={!status}>
          <dt className={styles.totalLabel}>
            <Link href="/admin">Everyone</Link>
          </dt>
          <dd className={styles.totalNumber}>{total}</dd>
        </div>
      </dl>

      <section className={styles.tableSection} aria-labelledby="table-heading">
        <h2 id="table-heading" className="visually-hidden">
          Attendee list
        </h2>
        <Filters q={q} status={status ?? ""} />
        <p className={styles.resultCount} aria-live="polite">
          {error
            ? "Couldn't load the list. Reload the page."
            : `Showing ${rows.length} ${rows.length === 1 ? "person" : "people"}${status ? ` with status ${STATUS_LABELS[status]}` : ""}${q ? ` matching “${q}”` : ""}.`}
        </p>
        {rows.length ? (
          <AttendeeTable rows={rows} />
        ) : (
          <div className={styles.empty}>
            {q || status ? (
              <p>
                No one matches. <Link href="/admin">Clear the search and filter</Link>.
              </p>
            ) : (
              <p>
                No one yet. Share the event link, or <Link href="/admin/invites">add people to the invite list</Link>.
              </p>
            )}
          </div>
        )}
      </section>
    </>
  );
}
