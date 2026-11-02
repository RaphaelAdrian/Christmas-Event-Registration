import { formatShortDate, formatTime } from "@/lib/format";
import { Parol } from "./Parol";
import styles from "./EventPass.module.css";

/** The few event facts printed on the pass. */
export type PassEvent = {
  shortName: string;
  startsAt: string;
  venueName: string;
  referencePrefix: string;
  callTime: string;
};

type Props = {
  event: PassEvent;
  name?: string;
  company?: string;
  referenceCode?: string | null;
  /** Small line at the foot, e.g. "Waiting for approval". */
  note?: string;
  size?: "regular" | "large";
  className?: string;
};

/** The guest's pass: a ticket from the shuttle to the party. Fills in as people type. */
export function EventPass({ event, name, company, referenceCode, note, size = "regular", className }: Props) {
  const year = new Date(event.startsAt).getFullYear();
  const hasName = Boolean(name && name.trim());
  return (
    <figure
      className={[styles.pass, size === "large" ? styles.large : "", className ?? ""].join(" ")}
      aria-label={`Event pass for ${hasName ? name : "you"}`}
    >
      <div className={styles.stub}>
        <span className={styles.event}>{event.shortName}</span>
        <Parol className={styles.parol} />
      </div>
      <div className={styles.body}>
        <p className={[styles.name, hasName ? "" : styles.placeholder].join(" ")}>{hasName ? name : "Your name"}</p>
        <p className={[styles.company, company?.trim() ? "" : styles.placeholder].join(" ")}>
          {company?.trim() || "Company"}
        </p>
        <dl className={styles.facts}>
          <div className={styles.wide}>
            <dt>Date and place</dt>
            <dd>
              {formatShortDate(event.startsAt)} {year}, {event.venueName}
            </dd>
          </div>
          {event.callTime ? (
            <div>
              <dt>Call time</dt>
              <dd>{event.callTime}</dd>
            </div>
          ) : null}
          <div>
            <dt>Party starts</dt>
            <dd>{formatTime(event.startsAt)}</dd>
          </div>
          <div>
            <dt>Reference</dt>
            <dd className={referenceCode ? styles.code : styles.placeholder}>
              {referenceCode ?? `${event.referencePrefix}-••••`}
            </dd>
          </div>
        </dl>
        {note ? <p className={styles.note}>{note}</p> : null}
      </div>
    </figure>
  );
}
