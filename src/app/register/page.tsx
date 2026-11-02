import type { Metadata } from "next";
import Link from "next/link";
import { getEventSettings } from "@/lib/event";
import { formatDayMonth } from "@/lib/format";
import { splitFullName } from "@/lib/names";
import { writeTo } from "@/lib/registrant";
import { RegisterWizard } from "./RegisterWizard";
import styles from "./register.module.css";

export const metadata: Metadata = { title: "Register" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const event = await getEventSettings();
  const email = first(params.email).trim().toLowerCase().slice(0, 254);
  // Invite links carry ?first=&last= ; older links may carry a single ?name=
  const split = splitFullName(first(params.name));
  const firstName = (first(params.first) || split.first).trim().slice(0, 100);
  const lastName = (first(params.last) || split.last).trim().slice(0, 100);
  const company = first(params.company).trim().slice(0, 150);

  if (!event.registrationOpen) {
    return (
      <main id="main" className={styles.closedPage}>
        <Link href="/" className={styles.wordmark}>
          {event.shortName}
        </Link>
        <div className={styles.closedBody}>
          <h1 className={styles.closedHeading}>Registration is closed</h1>
          <p className={styles.closedText}>
            Already registered? <Link href="/login">Sign in</Link> to pay and see your pass. For anything else,{" "}
            {writeTo(event.contactEmail)}.
          </p>
        </div>
      </main>
    );
  }

  return (
    <RegisterWizard
      event={{
        shortName: event.shortName,
        startsAt: event.startsAt,
        venueName: event.venueName,
        referencePrefix: event.referencePrefix,
        callTime: event.callTime,
        inviteOnly: event.inviteOnly,
        dateLine: `${formatDayMonth(event.startsAt)}, ${event.venueName}`,
      }}
      initialEmail={/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : ""}
      initialFirstName={firstName}
      initialLastName={lastName}
      initialCompany={company}
    />
  );
}
