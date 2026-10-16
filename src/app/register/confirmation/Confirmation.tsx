"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { event } from "@/config/event";
import { EventPass } from "@/components/EventPass";
import { formatLongDate } from "@/lib/format";
import { CONFIRMATION_KEY } from "@/lib/keys";
import styles from "./confirmation.module.css";

type Saved = {
  referenceCode: string;
  fullName: string;
  company: string;
  jobTitle?: string;
  email: string;
  paymentReference: string;
};

export function Confirmation({ referenceCode }: { referenceCode: string }) {
  const [saved, setSaved] = useState<Saved | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CONFIRMATION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Saved;
        if (parsed.referenceCode === referenceCode) setSaved(parsed);
      }
    } catch {
      /* storage unavailable: show the code only */
    }
  }, [referenceCode]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(referenceCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the code is on screen anyway */
    }
  }

  return (
    <main id="main" className={styles.page}>
      <header className={styles.bar}>
        <Link href="/" className={styles.wordmark}>
          {event.shortName}
        </Link>
      </header>

      <div className={styles.layout}>
        <h1 className={styles.title}>
          <span className={styles.line}>
            <span className={styles.lineInner}>You&rsquo;re registered</span>
          </span>
        </h1>
        <div className={styles.text}>
          <p className={styles.lead}>
            We have your registration and receipt. Your reference code is{" "}
            <strong>{referenceCode}</strong>.
          </p>
          <p className={styles.codeActions}>
            <button type="button" className="btn btn-ink" onClick={copyCode}>
              {copied ? "Copied" : "Copy reference code"}
            </button>
          </p>

          <h2 className={styles.nextHeading}>What happens next</h2>
          <ol className={styles.next}>
            <li>
              <strong>We&rsquo;ll verify your payment.</strong>{" "}
              {saved?.paymentReference
                ? `We match reference ${saved.paymentReference} and your receipt with our records, then mark you as Paid.`
                : "We match your payment reference and receipt with our records, then mark you as Paid."}
            </li>
            <li>
              <strong>Keep your reference code.</strong> Show {referenceCode} at the registration desk on{" "}
              {formatLongDate(event.startsAt)}. A screenshot of this page is fine.
            </li>
            <li>
              <strong>Need to change something?</strong> Write to{" "}
              <a href={`mailto:${event.contact.email}?subject=${encodeURIComponent(`Registration ${referenceCode}`)}`}>
                {event.contact.email}
              </a>{" "}
              and include your reference code.
            </li>
          </ol>
          <p className={styles.back}>
            <Link href="/">Back to the event page</Link>
          </p>
        </div>

        <div className={styles.passWrap}>
          <EventPass
            size="large"
            name={saved?.fullName}
            company={saved?.company}
            jobTitle={saved?.jobTitle}
            referenceCode={referenceCode}
            note="Payment being verified"
          />
        </div>
      </div>
    </main>
  );
}
