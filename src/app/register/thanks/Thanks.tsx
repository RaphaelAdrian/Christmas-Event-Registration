"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EventPass, type PassEvent } from "@/components/EventPass";
import { CONFIRMATION_KEY } from "@/lib/keys";
import styles from "./thanks.module.css";

type Saved = { referenceCode: string; fullName: string; company: string; email: string };

export function Thanks({ referenceCode, event }: { referenceCode: string | null; event: PassEvent }) {
  const [saved, setSaved] = useState<Saved | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CONFIRMATION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Saved;
        if (!referenceCode || parsed.referenceCode === referenceCode) setSaved(parsed);
      }
    } catch {
      /* storage unavailable: the message stands on its own */
    }
  }, [referenceCode]);

  return (
    <div className={styles.layout}>
      <div className={styles.text}>
        <h1 className={styles.heading}>Thank you!</h1>
        <p className={styles.message} role="status">
          Your registration is in. Pay now, or come back whenever you&rsquo;re ready: your place is confirmed once we confirm your payment.
        </p>
        <p>
          You can sign in any time{saved?.email ? (
            <>
              {" "}
              with <strong>{saved.email}</strong> and your password
            </>
          ) : null}{" "}
          to pay, check your status and see your pass.
        </p>
        <p className={styles.links}>
          <Link href="/account" className="btn">
            Pay now
          </Link>{" "}
          <Link href="/">Back to the event page</Link>
        </p>
      </div>
      <div className={styles.passSide}>
        <EventPass
          event={event}
          size="large"
          name={saved?.fullName}
          company={saved?.company}
          referenceCode={referenceCode ?? saved?.referenceCode ?? null}
          note="Waiting for payment"
        />
      </div>
    </div>
  );
}
