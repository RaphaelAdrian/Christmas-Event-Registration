import type { Metadata } from "next";
import Link from "next/link";
import { event } from "@/config/event";
import { Confirmation } from "./Confirmation";
import styles from "./confirmation.module.css";

export const metadata: Metadata = { title: "Registration received", robots: { index: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ConfirmationPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const raw = Array.isArray(params.ref) ? params.ref[0] : params.ref;
  const ref = (raw ?? "").trim().toUpperCase();

  if (!/^[A-Z0-9]{1,10}-\d{4,}$/.test(ref)) {
    return (
      <main id="main" className={styles.page}>
        <header className={styles.bar}>
          <Link href="/" className={styles.wordmark}>
            {event.shortName}
          </Link>
        </header>
        <div className={styles.missing}>
          <h1 className={styles.title}>No reference code here</h1>
          <p className={styles.lead}>
            This page shows your reference code right after you register. If you registered and lost it, write to{" "}
            <a href={`mailto:${event.contact.email}`}>{event.contact.email}</a>.
          </p>
          <p>
            <Link href="/register" className="btn">
              Go to registration
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return <Confirmation referenceCode={ref} />;
}
