import type { Metadata } from "next";
import Link from "next/link";
import { getEventSettings } from "@/lib/event";
import { paragraphs } from "@/lib/format";
import styles from "./terms.module.css";

export const metadata: Metadata = { title: "Terms and privacy" };
export const revalidate = 300;

export default async function TermsPage() {
  const event = await getEventSettings();
  const organizer = event.organizer || "The event organisers";
  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <Link href="/" className={styles.wordmark}>
          {event.shortName}
        </Link>
        {event.registrationOpen ? (
          <Link href="/register" className="btn btn-small">
            Register
          </Link>
        ) : null}
      </header>
      <main id="main" className={styles.main}>
        <h1 className={styles.title}>Terms and privacy</h1>
        <section className={styles.block} aria-labelledby="terms">
          <h2 id="terms" className={styles.heading}>
            Terms and conditions
          </h2>
          <div className={styles.body}>
            {paragraphs(event.terms).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>
        <section className={styles.block} aria-labelledby="privacy">
          <h2 id="privacy" className={styles.heading}>
            Privacy notice
          </h2>
          <div className={styles.body}>
            <p>{organizer} processes your personal data under Republic Act No. 10173, the Data Privacy Act of 2012.</p>
            {paragraphs(event.privacyNotice).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {event.contactEmail ? (
              <p>
                Contact: <a href={`mailto:${event.contactEmail}`}>{event.contactEmail}</a>
              </p>
            ) : null}
          </div>
        </section>
        <p className={styles.back}>
          <Link href="/">Back to the event page</Link>
        </p>
      </main>
    </div>
  );
}
