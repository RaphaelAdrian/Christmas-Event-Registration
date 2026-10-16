import type { Metadata } from "next";
import Link from "next/link";
import { event } from "@/config/event";
import { SampleStrip } from "@/components/SampleStrip";
import styles from "./terms.module.css";

export const metadata: Metadata = { title: "Terms and privacy" };

export default function TermsPage() {
  return (
    <>
      <SampleStrip />
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
              {event.terms.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
          <section className={styles.block} aria-labelledby="privacy">
            <h2 id="privacy" className={styles.heading}>
              Privacy notice
            </h2>
            <div className={styles.body}>
              <p>
                {event.organizer} processes your personal data under Republic Act No. 10173, the Data Privacy Act of
                2012.
              </p>
              {event.privacy.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              <p>
                {event.privacy.dataProtectionOfficer}:{" "}
                <a href={`mailto:${event.privacy.dpoEmail}`}>{event.privacy.dpoEmail}</a>
              </p>
            </div>
          </section>
          <p className={styles.back}>
            <Link href="/">Back to the event page</Link>
          </p>
        </main>
      </div>
    </>
  );
}
