import type { Metadata } from "next";
import Link from "next/link";
import { getEventSettings } from "@/lib/event";
import { Thanks } from "./Thanks";
import styles from "./thanks.module.css";

export const metadata: Metadata = { title: "Registration received", robots: { index: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ThanksPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const raw = Array.isArray(params.ref) ? params.ref[0] : params.ref;
  const referenceCode = /^[A-Z0-9]{1,10}-\d{4,}$/.test(raw ?? "") ? (raw as string) : null;
  const event = await getEventSettings();

  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <Link href="/" className={styles.wordmark}>
          {event.shortName}
        </Link>
      </header>
      <main id="main" className={styles.main}>
        <Thanks
          referenceCode={referenceCode}
          event={{
            shortName: event.shortName,
            startsAt: event.startsAt,
            venueName: event.venueName,
            referencePrefix: event.referencePrefix,
            callTime: event.callTime,
          }}
        />
      </main>
    </div>
  );
}
