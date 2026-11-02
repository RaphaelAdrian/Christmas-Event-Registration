import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { formatPeso, manilaParts } from "@/lib/format";
import { RegistrationsChart, type DayCount } from "./RegistrationsChart";
import styles from "../admin.module.css";

export const metadata = { title: "Dashboard" };

type Stats = {
  registered: number;
  pending: number;
  approved: number;
  declined: number;
  submitted: number;
  paid: number;
  unpaid: number;
  invited: number;
  collected: number;
  by_day: DayCount[];
};

export default async function DashboardPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("dashboard_stats");
  const s = data as Stats | null;

  if (error || !s) {
    return (
      <div className={styles.formError}>
        Couldn&rsquo;t load the numbers. If this is a new setup, run the latest migration in the Supabase SQL Editor.
      </div>
    );
  }

  const cards: { label: string; value: string | number; href?: string }[] = [
    { label: "Total registered", value: s.registered, href: "/admin/registrants" },
    { label: "Pending approval", value: s.pending, href: "/admin/registrants?status=pending" },
    { label: "Approved", value: s.approved, href: "/admin/registrants?status=approved" },
    { label: "Declined", value: s.declined, href: "/admin/registrants?status=declined" },
    { label: "Payments to review", value: s.submitted, href: "/admin/payments" },
    { label: "Paid", value: s.paid, href: "/admin/registrants?pay=paid" },
    { label: "Not paid yet (pending or approved, nothing sent)", value: s.unpaid, href: "/admin/registrants?pay=notpaid" },
    { label: "Invited, not registered", value: s.invited, href: "/admin/invites" },
  ];

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>Dashboard</h1>
        <p className={styles.pageNote}>
          {s.pending ? (
            <>
              <Link href="/admin/registrants?status=pending">{s.pending} waiting for approval</Link>
              {s.submitted ? (
                <>
                  {" "}and <Link href="/admin/payments">{s.submitted} {s.submitted === 1 ? "payment" : "payments"} to review</Link>
                </>
              ) : null}
              .
            </>
          ) : s.submitted ? (
            <Link href="/admin/payments">
              {s.submitted} {s.submitted === 1 ? "payment" : "payments"} to review.
            </Link>
          ) : (
            "Nothing waiting for you right now."
          )}
        </p>
      </div>

      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="visually-hidden">
          Numbers
        </h2>
        <div className={styles.stats}>
          <div className={`${styles.stat} ${styles.statWide}`}>
            <span className={styles.statLabel}>Total collected (payments marked paid)</span>
            <span className={styles.statNumber}>{formatPeso(Number(s.collected))}</span>
          </div>
          {cards.map((c) =>
            c.href ? (
              <Link key={c.label} href={c.href} className={styles.stat}>
                <span className={styles.statLabel}>{c.label}</span>
                <span className={styles.statNumber}>{c.value}</span>
              </Link>
            ) : (
              <div key={c.label} className={styles.stat}>
                <span className={styles.statLabel}>{c.label}</span>
                <span className={styles.statNumber}>{c.value}</span>
              </div>
            ),
          )}
        </div>
      </section>

      <section className={styles.chartSection} aria-labelledby="chart-heading">
        <h2 id="chart-heading" className={styles.sectionTitle}>
          Registrations over time
        </h2>
        <RegistrationsChart data={s.by_day} today={manilaParts(new Date().toISOString()).date} />
      </section>
    </>
  );
}
