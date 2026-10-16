import type { Metadata } from "next";
import Link from "next/link";
import { event } from "@/config/event";
import { SampleStrip } from "@/components/SampleStrip";
import { RegisterWizard } from "./RegisterWizard";
import styles from "./register.module.css";

export const metadata: Metadata = { title: "Register" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const email = first(params.email).trim().toLowerCase().slice(0, 254);
  const name = first(params.name).trim().slice(0, 100);
  const company = first(params.company).trim().slice(0, 150);

  if (!event.registrationOpen) {
    return (
      <>
        <SampleStrip />
        <main id="main" className={styles.closedPage}>
          <Link href="/" className={styles.wordmark}>
            {event.shortName}
          </Link>
          <h1 className={styles.closedHeading}>Registration is closed</h1>
          <p className={styles.closedText}>
            Write to <a href={`mailto:${event.contact.email}`}>{event.contact.email}</a> if you need help with an
            existing registration.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <SampleStrip />
      <RegisterWizard initialEmail={/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : ""} initialName={name}
        initialCompany={company}
      />
    </>
  );
}
