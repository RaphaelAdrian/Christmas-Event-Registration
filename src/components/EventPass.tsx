import { event } from "@/config/event";
import { formatShortDate } from "@/lib/format";
import styles from "./EventPass.module.css";

type Props = {
  name?: string;
  company?: string;
  jobTitle?: string;
  referenceCode?: string | null;
  /** Small line under the reference, e.g. "Payment being verified". */
  note?: string;
  size?: "regular" | "large";
  className?: string;
};

/** The attendee's event pass: fills in as people type, and carries the reference code at the end. */
export function EventPass({ name, company, jobTitle, referenceCode, note, size = "regular", className }: Props) {
  const year = new Date(event.startsAt).getFullYear();
  const hasName = Boolean(name && name.trim());
  return (
    <figure
      className={[styles.pass, size === "large" ? styles.large : "", className ?? ""].join(" ")}
      aria-label={`Event pass for ${hasName ? name : "you"}`}
    >
      <span className={styles.slot} aria-hidden="true" />
      <div className={styles.head}>
        <span className={styles.event}>{event.shortName}</span>
        <span className={styles.when}>
          {formatShortDate(event.startsAt)} {year}, {event.venue.city}
        </span>
      </div>
      <div className={styles.body}>
        <p className={[styles.name, hasName ? "" : styles.placeholder].join(" ")}>{hasName ? name : "Your name"}</p>
        <p className={[styles.company, company?.trim() ? "" : styles.placeholder].join(" ")}>
          {company?.trim() || "Company or organisation"}
        </p>
        {jobTitle?.trim() ? <p className={styles.job}>{jobTitle}</p> : null}
        <div className={styles.foot}>
          <span className={styles.refLabel}>Reference</span>
          <span className={[styles.ref, referenceCode ? "" : styles.placeholder].join(" ")}>
            {referenceCode ?? `${event.referencePrefix}-\u2022\u2022\u2022\u2022`}
          </span>
          {note ? <span className={styles.note}>{note}</span> : null}
        </div>
      </div>
      <div className={styles.band}>Attendee</div>
    </figure>
  );
}
