import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import {
  ATTENDEE_COLUMNS,
  PAYMENT_LABELS,
  PAYMENT_STATUSES,
  REGISTRATION_LABELS,
  isPaymentStatus,
  type Attendee,
} from "@/lib/statuses";
import { RegistrantsTable } from "./RegistrantsTable";
import styles from "../../admin.module.css";

export const metadata = { title: "Registrants" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const FILTERS = ["pending", "approved", "declined"] as const;

function one(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function RegistrantsPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const q = one(params.q).trim().slice(0, 100);
  const status = (FILTERS as readonly string[]).includes(one(params.status)) ? one(params.status) : "";
  const pay = isPaymentStatus(one(params.pay)) || one(params.pay) === "notpaid" ? one(params.pay) : "";

  const counts = await Promise.all(
    FILTERS.map(async (s) => {
      const { count } = await supabase
        .from("attendees")
        .select("id", { count: "exact", head: true })
        .eq("registration_status", s);
      return [s, count ?? 0] as const;
    }),
  );

  let query = supabase
    .from("attendees")
    .select(ATTENDEE_COLUMNS)
    .neq("registration_status", "invited")
    .order("registered_at", { ascending: false })
    .limit(2000);
  if (status) query = query.eq("registration_status", status);
  if (pay === "notpaid") query = query.in("payment_status", ["unpaid", "rejected"]);
  else if (pay) query = query.eq("payment_status", pay);
  if (q) {
    // Characters that would break the filter syntax are treated as spaces
    const term = q.replace(/[,()*%\\"']/g, " ").replace(/\s+/g, " ").trim();
    if (term) {
      const like = `%${term}%`;
      query = query.or(
        ["full_name", "name_as_entered", "email", "company", "reference_code"].map((c) => `${c}.ilike.${like}`).join(","),
      );
    }
  }
  const [{ data, error }, { data: logins }] = await Promise.all([query, supabase.rpc("registrant_logins")]);
  const rows = (data ?? []) as Attendee[];
  const signedIn = Object.fromEntries(
    ((logins ?? []) as { attendee_id: string; last_sign_in_at: string | null }[]).map((l) => [l.attendee_id, l.last_sign_in_at]),
  );

  const href = (next: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), ...(pay ? { pay } : {}), ...next });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    const s = p.toString();
    return `/admin/registrants${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>Registrants</h1>
        <p className={styles.pageNote}>
          Guests can pay as soon as they register; confirming their payment approves them too. Tick several rows to
          approve or decline them together. <strong>Mark as paid</strong> is for someone who paid you directly.{" "}
          <strong>Reset password link</strong> is only for a guest who forgot their password: send them the link it makes.
        </p>
      </div>

      <section className={styles.tableSection} aria-labelledby="registrants-heading">
        <h2 id="registrants-heading" className="visually-hidden">
          Registrant list
        </h2>
        <form method="get" action="/admin/registrants" className={styles.filters} role="search">
          <div className={styles.filterField}>
            <label className="label" htmlFor="q">
              Search
            </label>
            <input id="q" name="q" type="search" className="input" placeholder="Name, email, company, reference" defaultValue={q} />
          </div>
          <div className={styles.filterField}>
            <label className="label" htmlFor="status">
              Registration
            </label>
            <select id="status" name="status" className="select" defaultValue={status}>
              <option value="">All</option>
              {FILTERS.map((s, i) => (
                <option key={s} value={s}>
                  {REGISTRATION_LABELS[s]} ({counts[i]![1]})
                </option>
              ))}
            </select>
          </div>
          <div className={styles.filterField}>
            <label className="label" htmlFor="pay">
              Payment
            </label>
            <select id="pay" name="pay" className="select" defaultValue={pay}>
              <option value="">All</option>
              <option value="notpaid">Not paid yet (unpaid or rejected)</option>
              {PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PAYMENT_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.filterButtons}>
            <button type="submit" className="btn">
              Show
            </button>
            {q || status || pay ? (
              <Link href="/admin/registrants" className={styles.clearLink}>
                Clear
              </Link>
            ) : null}
          </div>
        </form>

        <p className={styles.resultCount} aria-live="polite">
          {error
            ? "Couldn't load the list. Reload the page."
            : `Showing ${rows.length} ${rows.length === 1 ? "person" : "people"}${status ? `, ${REGISTRATION_LABELS[status as "pending"].toLowerCase()}` : ""}${pay ? `, ${pay === "notpaid" ? "not paid yet" : PAYMENT_LABELS[pay as "unpaid"].toLowerCase()}` : ""}${q ? `, matching “${q}”` : ""}.`}{" "}
          {status !== "pending" ? <Link href={href({ status: "pending" })}>Show pending only</Link> : null}
        </p>

        {rows.length ? (
          <RegistrantsTable rows={rows} signedIn={signedIn} />
        ) : (
          <div className={styles.empty}>
            {q || status || pay ? (
              <p>
                No one matches. <Link href="/admin/registrants">Clear the search and filters</Link>.
              </p>
            ) : (
              <p>No registrations yet. They appear here as soon as people register.</p>
            )}
          </div>
        )}
      </section>
    </>
  );
}
