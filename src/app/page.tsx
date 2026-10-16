import type { CSSProperties } from "react";
import Link from "next/link";
import { event } from "@/config/event";
import { PassPreview } from "@/components/PassPreview";
import { SampleStrip } from "@/components/SampleStrip";
import {
  formatDayMonth,
  formatLongDate,
  formatPeso,
  formatShortDate,
  formatTime,
  formatWeekday,
} from "@/lib/format";
import styles from "./home.module.css";

/** Splits the event name into two balanced lines for the masked headline. */
function twoLines(text: string): string[] {
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return [text];
  let best = 1;
  let bestScore = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ").length;
    const b = words.slice(i).join(" ").length;
    const score = Math.max(a, b);
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

const delay = (i: number) => ({ "--i": i }) as CSSProperties;

function shortTime(iso: string) {
  return formatTime(iso).replace(":00", "");
}

export default function HomePage() {
  const lines = twoLines(event.name);
  const open = event.registrationOpen;
  const year = new Date(event.startsAt).getFullYear();
  const deadline = formatDayMonth(event.paymentDeadline);
  const email = event.contact.email;
  const [emailUser, emailDomain] = email.split("@");
  const emailSize = `min(${(100 / (Math.min(email.length, 26) * 0.6)).toFixed(2)}vw, 9.5rem)`;

  const facts = [
    { big: formatShortDate(event.startsAt), small: `${formatWeekday(event.startsAt)}, ${year}` },
    {
      big: shortTime(event.startsAt),
      small: `Until ${shortTime(event.endsAt)}. Desk opens ${event.doorsOpen}`,
    },
    { big: event.venue.city, small: `${event.venue.name}, ${event.venue.address}` },
    { big: formatPeso(event.fee), small: `Pay by ${deadline}` },
  ];

  return (
    <>
      <SampleStrip />
      <header className={styles.hero}>
        <nav className={styles.topRow} aria-label="Main">
          <Link href="/" className={styles.wordmark}>
            {event.shortName}
          </Link>
          <ul className={styles.links}>
            <li>
              <a href="#schedule">Schedule</a>
            </li>
            <li>
              <a href="#payment">Payment</a>
            </li>
            <li>
              <a href="#instructions">Before you come</a>
            </li>
          </ul>
          {open ? (
            <Link href="/register" className={`btn ${styles.topAction}`}>
              Register
            </Link>
          ) : null}
        </nav>

        <div className={styles.heroBottom} id="main">
          <h1 className={styles.statement}>
            {lines.map((line, i) => (
              <span className={styles.line} key={i}>
                <span className={styles.lineInner} style={{ animationDelay: `${120 + i * 110}ms` }}>
                  {line}
                </span>
              </span>
            ))}
          </h1>
          <div className={styles.heroAside}>
            <p className={styles.when}>
              {formatLongDate(event.startsAt)}, {formatTime(event.startsAt)} to {formatTime(event.endsAt)}
            </p>
            <p className={styles.where}>
              {event.venue.name}, {event.venue.city}
            </p>
            {open ? (
              <Link href="/register" className={`btn ${styles.heroAction}`}>
                Register now
              </Link>
            ) : (
              <p className={styles.closed}>Registration is closed.</p>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className={styles.intro} aria-labelledby="about-heading">
          <div className={styles.introTop}>
            <h2 id="about-heading" className={styles.introHeading} data-reveal>
              {event.aboutHeading}
            </h2>
            <p className={styles.introNote} data-reveal style={delay(1)}>
              {event.summary} {event.feeIncludes}
            </p>
          </div>
          <dl className={styles.facts}>
            {facts.map((f, i) => (
              <div key={f.big} className={styles.fact} data-reveal style={delay(i)}>
                <dt className={styles.factBig}>{f.big}</dt>
                <dd className={styles.factSmall}>{f.small}</dd>
              </div>
            ))}
          </dl>
          {event.venue.mapUrl ? (
            <p className={styles.mapLink}>
              <a href={event.venue.mapUrl} target="_blank" rel="noreferrer">
                Open the venue in Google Maps
              </a>
            </p>
          ) : null}
        </section>

        {event.venue.photo.src ? (
          <figure className={styles.photoBand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={event.venue.photo.src} alt={event.venue.photo.alt} loading="lazy" decoding="async" />
          </figure>
        ) : null}

        <section id="schedule" className={`${styles.schedule} on-dark`} aria-labelledby="schedule-heading">
          <h2 id="schedule-heading" className={styles.scheduleHeading}>
            Schedule for {formatDayMonth(event.startsAt)}
          </h2>
          <ol className={styles.poster}>
            {event.schedule.map((item, i) => (
              <li key={item.title + item.time} className={styles.posterItem} data-reveal style={delay(i)}>
                <span className={styles.posterTitle}>{item.title}</span>
                {item.detail ? <span className={styles.posterDetail}>{item.detail}</span> : null}
                <span className={styles.posterTime}>{item.time}</span>
              </li>
            ))}
          </ol>
        </section>

        <section id="payment" className={styles.payment} aria-labelledby="payment-heading">
          <div className={styles.paymentHead}>
            <h2 id="payment-heading" className={styles.paymentHeading} data-reveal>
              Pay {formatPeso(event.fee)} by {deadline}
            </h2>
            <p className={styles.paymentNote} data-reveal style={delay(1)}>
              {event.feeIncludes} Pay with any of the accounts below, keep a screenshot of the receipt, then register.
              You&rsquo;ll enter the payment reference number and upload the receipt in step 4.
            </p>
          </div>

          <table className={styles.payTable} data-reveal style={delay(2)}>
            <caption className="visually-hidden">Payment accounts</caption>
            <thead>
              <tr>
                <td />
                {event.paymentMethods.map((m) => (
                  <th scope="col" key={m.name}>
                    {m.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Amount</th>
                {event.paymentMethods.map((m) => (
                  <td key={m.name} className="tabular">
                    {formatPeso(event.fee)}
                  </td>
                ))}
              </tr>
              {event.paymentMethods.some((m) => m.bank) ? (
                <tr>
                  <th scope="row">Bank</th>
                  {event.paymentMethods.map((m) => (
                    <td key={m.name}>{m.bank ?? "Not needed"}</td>
                  ))}
                </tr>
              ) : null}
              <tr>
                <th scope="row">Account name</th>
                {event.paymentMethods.map((m) => (
                  <td key={m.name}>{m.accountName}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Account number</th>
                {event.paymentMethods.map((m) => (
                  <td key={m.name} className={`tabular ${styles.accountNumber}`}>
                    {m.accountNumber}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">How</th>
                {event.paymentMethods.map((m) => (
                  <td key={m.name}>{m.note ?? ""}</td>
                ))}
              </tr>
            </tbody>
          </table>

          <div className={styles.payBlocks}>
            {event.paymentMethods.map((m) => (
              <div key={m.name} className={styles.payBlock}>
                <h3 className={styles.payBlockName}>{m.name}</h3>
                <dl>
                  {m.bank ? (
                    <>
                      <dt>Bank</dt>
                      <dd>{m.bank}</dd>
                    </>
                  ) : null}
                  <dt>Account name</dt>
                  <dd>{m.accountName}</dd>
                  <dt>Account number</dt>
                  <dd className={`tabular ${styles.accountNumber}`}>{m.accountNumber}</dd>
                  {m.note ? (
                    <>
                      <dt>How</dt>
                      <dd>{m.note}</dd>
                    </>
                  ) : null}
                </dl>
              </div>
            ))}
          </div>

          {open ? (
            <p className={styles.payAction}>
              <Link href="/register" className="btn">
                Register and upload your receipt
              </Link>
            </p>
          ) : null}
        </section>

        <section id="how" className={styles.how} aria-labelledby="how-heading">
          <div className={styles.howText}>
            <h2 id="how-heading" className={styles.howHeading} data-reveal>
              Register in five steps
            </h2>
            <ol className={styles.steps}>
              {[
                ["Your details", "Name, email, mobile number and company."],
                ["Event instructions", "Read them and tick to confirm."],
                ["Terms and privacy", "Agree to the terms and give consent under the Data Privacy Act of 2012."],
                ["Payment", "Enter the payment reference number and upload the receipt: an image or PDF up to 5 MB."],
                ["Review and submit", "Your reference code appears straight away. We then verify your payment."],
              ].map(([title, text], i) => (
                <li key={title} className={styles.step} data-reveal style={delay(i)}>
                  <strong>{title}.</strong> {text}
                </li>
              ))}
            </ol>
          </div>
          <div className={styles.howPass}>
            <p className={styles.howLead}>Type your name to see your pass. It carries into the form.</p>
            <PassPreview open={open} />
          </div>
        </section>

        <section id="instructions" className={styles.instructions} aria-labelledby="instructions-heading">
          <h2 id="instructions-heading" className={styles.instructionsHeading} data-reveal>
            Before you come
          </h2>
          <div className={styles.answers}>
            {event.instructions.map((item, i) => (
              <p key={item.question} className={styles.answer} data-reveal style={delay(Math.min(i, 4))}>
                <strong>{item.question}</strong> {item.answer}
              </p>
            ))}
            <p className={styles.answer} data-reveal>
              <strong>What are the terms?</strong> Read the{" "}
              <Link href="/terms">terms and conditions and privacy notice</Link>. You agree to them in step 3 of the form.
            </p>
          </div>
        </section>
      </main>

      <footer className={`${styles.close} on-dark`}>
        <p className={styles.closeLead}>Questions about registration or payment? Write to us.</p>
        <a className={styles.bigEmail} href={`mailto:${email}`} style={{ fontSize: emailSize }}>
          {email.length > 26 ? (
            <>
              {emailUser}@
              <br />
              {emailDomain}
            </>
          ) : (
            email
          )}
        </a>
        <div className={styles.closeRow}>
          <ul className={styles.closePlaces}>
            <li>
              <a href={`tel:${event.contact.phone.replace(/\s/g, "")}`}>{event.contact.phone}</a>
            </li>
            <li>
              {event.venue.name}, {event.venue.city}
            </li>
          </ul>
          <ul className={styles.closeLinks}>
            {open ? (
              <li>
                <Link href="/register">Register</Link>
              </li>
            ) : null}
            <li>
              <Link href="/terms">Terms and privacy</Link>
            </li>
            <li>
              <a href="#main">Back to top</a>
            </li>
          </ul>
        </div>
        <p className={styles.legal}>
          &copy; {year} {event.organizer}
        </p>
        <p
          className={styles.footerName}
          aria-hidden="true"
          style={{ fontSize: `${(100 / (event.shortName.length * 0.56)).toFixed(2)}vw` }}
        >
          {event.shortName}
        </p>
      </footer>
    </>
  );
}
