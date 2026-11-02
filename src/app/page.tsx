import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { Countdown } from "@/components/Countdown";
import { Gallery } from "@/components/Gallery";
import { LoopVideo } from "@/components/LoopVideo";
import { Parol } from "@/components/Parol";
import { PassPreview } from "@/components/PassPreview";
import heroPhoto from "../../public/venue/pool-pavilion-dusk.jpg";
import poolDay from "../../public/venue/pool-day-view.jpg";
import poolNight from "../../public/venue/pool-dusk.jpg";
import { getEventDetails, getEventSettings, getGalleryPhotos } from "@/lib/event";
import { formatClock, formatDayMonth, formatLongDate, paragraphs, timeRange } from "@/lib/format";
import styles from "./home.module.css";

export const revalidate = 300;

/**
 * Splits the event name into at most two lines of similar length, breaking at
 * a space or after a hyphen, so it can be set as large as the screen allows.
 */
function monumentLines(name: string): string[] {
  const text = name.trim();
  if (text.length <= 14) return [text];
  let best: [string, string] = [text, ""];
  let bestLongest = Infinity;
  for (let i = 1; i < text.length; i++) {
    const breakHere = text[i - 1] === "-" || text[i] === " ";
    if (!breakHere) continue;
    const a = text.slice(0, i).trimEnd();
    const b = text.slice(i).trimStart();
    const longest = Math.max(a.length, b.length + 1); // the parol takes the space plus about one letter
    if (longest < bestLongest) {
      bestLongest = longest;
      best = [a, b];
    }
  }
  return best[1] ? best : [text];
}

/** Puts the parol in the word space before the last word of the line. */
function withParol(line: string) {
  const cut = line.lastIndexOf(" ");
  if (cut < 0) {
    return (
      <>
        {line}
        <Parol className={styles.glyph} />
      </>
    );
  }
  return (
    <>
      {line.slice(0, cut)}
      <Parol className={styles.glyph} />
      <span className="visually-hidden"> </span>
      {line.slice(cut + 1)}
    </>
  );
}

const delay = (i: number) => ({ "--i": i }) as CSSProperties;

export default async function HomePage() {
  const [event, details, photos] = await Promise.all([getEventSettings(), getEventDetails(), getGalleryPhotos()]);
  const lines = monumentLines(event.name);
  const chars = Math.max(...lines.map((l, i) => l.length + (i === lines.length - 1 ? 1 : 0)));
  const open = event.registrationOpen;
  const action = open ? { href: "/register", label: "Register" } : { href: "/login", label: "Sign in" };
  const passEvent = {
    shortName: event.shortName,
    startsAt: event.startsAt,
    venueName: event.venueName,
    referencePrefix: event.referencePrefix,
    callTime: event.callTime,
  };
  const year = new Date(event.startsAt).getFullYear();
  const footerName = event.shortName.trim();
  const footerLines = monumentLines(footerName);

  return (
    <>
      <header className={styles.hero}>
        <Image
          src={heroPhoto}
          alt={`The pool at ${event.venueName || "the resort"} at dusk, with palm trees and the lit pavilion above the city lights`}
          fill
          priority
          placeholder="blur"
          sizes="100vw"
          className={styles.heroPhoto}
        />
        <nav className={styles.topRow} aria-label="Main">
          <Link href="/" className={styles.wordmark}>
            {event.shortName}
          </Link>
          <ul className={styles.links}>
            <li className={styles.optionalLink}>
              <a href="#getting-there">Getting there</a>
            </li>
            <li className={styles.optionalLink}>
              <a href="#venue">The venue</a>
            </li>
            {details.length ? (
              <li className={styles.optionalLink}>
                <a href="#details">Details</a>
              </li>
            ) : null}
            {photos.length ? (
              <li className={styles.optionalLink}>
                <a href="#photos">Photos</a>
              </li>
            ) : null}
            <li>
              <Link href="/login">Sign in</Link>
            </li>
          </ul>
        </nav>

        <h1 className={styles.monument} style={{ "--chars": chars } as CSSProperties} id="main">
          {lines.map((line, i) => (
            <span className={styles.line} key={i}>
              <span className={styles.lineInner} style={{ animationDelay: `${100 + i * 120}ms` }}>
                {i === lines.length - 1 ? withParol(line) : line}
              </span>
            </span>
          ))}
        </h1>

        <div className={styles.heroFoot}>
          <div className={styles.heroFacts}>
            <p className={styles.heroDate}>
              {formatLongDate(event.startsAt)}
              <br />
              {timeRange(event.startsAt, event.endsAt)}
            </p>
            <p className={styles.heroVenue}>
              {event.venueName}
              {event.mapUrl ? (
                <>
                  {" "}
                  <a href={event.mapUrl} target="_blank" rel="noopener noreferrer">
                    Open the map
                  </a>
                </>
              ) : null}
            </p>
          </div>
          <div className={styles.heroAction}>
            {event.tagline ? <p className={styles.tagline}>{event.tagline}</p> : null}
            <Link href={action.href} className="btn">
              {action.label}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className={`${styles.countdown} ${styles.torn}`} aria-labelledby="countdown-heading">
          <h2 id="countdown-heading" className={styles.countdownHeading} data-reveal>
            Counting down to {formatClock(event.startsAt)}, {formatDayMonth(event.startsAt)}
          </h2>
          <div data-reveal style={delay(1)}>
            <Countdown startsAt={event.startsAt} />
          </div>
          <p className={styles.countdownNote} data-reveal style={delay(2)}>
            Philippine time, wherever you are reading this.
          </p>
        </section>

        <section id="getting-there" className={`${styles.route} ${styles.torn}`} aria-labelledby="route-heading">
          <h2 id="route-heading" className="visually-hidden">
            Getting there
          </h2>
          <ol className={styles.stairs}>
            {event.callTime ? (
              <li className={styles.stair} data-reveal>
                <p className={styles.stairLine}>Be there by {event.callTime}.</p>
                <p className={styles.stairNote}>{event.shuttleInfo || "Call time for the shuttle."}</p>
              </li>
            ) : null}
            <li className={styles.stair} data-reveal style={delay(1)}>
              <p className={styles.stairLine}>The party starts at {formatClock(event.startsAt)}.</p>
              <p className={styles.stairNote}>
                {[event.venueName, event.venueAddress].filter(Boolean).join(", ")}.{" "}
                {event.mapUrl ? (
                  <a href={event.mapUrl} target="_blank" rel="noopener noreferrer">
                    Open {event.venueName || "the venue"} in Google Maps
                  </a>
                ) : null}
              </p>
            </li>
            <li className={styles.stair} data-reveal style={delay(2)}>
              <p className={`${styles.stairLine} ${styles.stairLast}`}>It runs until {formatClock(event.endsAt)}.</p>
              <p className={styles.stairNote}>{formatLongDate(event.startsAt)}.</p>
            </li>
          </ol>
        </section>

        <section id="venue" className={`${styles.venue} ${styles.torn}`} aria-labelledby="venue-heading">
          <div className={styles.venueText}>
            <h2 id="venue-heading" className={styles.sectionHeading} data-reveal>
              {event.venueName || "The venue"}
            </h2>
            <p className={styles.venueLead} data-reveal style={delay(1)}>
              A pool, a pavilion, a garden deck and a dining hall, high above the city lights.
            </p>
            {event.mapUrl ? (
              <p data-reveal style={delay(2)}>
                <a href={event.mapUrl} target="_blank" rel="noopener noreferrer">
                  Open the map
                </a>
              </p>
            ) : null}
          </div>
          <div className={`${styles.venueVideo} ${styles.frame}`} data-reveal style={delay(1)}>
            <LoopVideo
              src="/venue/resort.mp4"
              label="A short clip panning across the resort terrace and the view over the city"
              className={styles.video}
            />
          </div>
          <figure className={styles.venueDay} data-reveal>
            <div className={styles.frame}>
              <Image
                src={poolDay}
                alt="The pool in the afternoon, reflecting the clouds, with the city below"
                sizes="(min-width: 900px) 58vw, 100vw"
                placeholder="blur"
                className={styles.venueImage}
              />
            </div>
            <figcaption className={styles.venueCaption}>In the afternoon</figcaption>
          </figure>
          <figure className={styles.venueNight} data-reveal style={delay(1)}>
            <div className={styles.frame}>
              <Image
                src={poolNight}
                alt="The pool after dark, under strings of lights, with the city lit up below"
                sizes="(min-width: 900px) 40vw, 100vw"
                placeholder="blur"
                className={styles.venueImage}
              />
            </div>
            <figcaption className={styles.venueCaption}>After dark</figcaption>
          </figure>
        </section>

        {details.length ? (
          <section id="details" className={`${styles.details} ${styles.torn}`} aria-labelledby="details-heading">
            <h2 id="details-heading" className={styles.sectionHeading} data-reveal>
              Good to know
            </h2>
            <dl className={styles.detailList}>
              {details.map((d, i) => (
                <div key={d.id} className={styles.detail} data-reveal style={delay(Math.min(i, 4))}>
                  <dt className={styles.detailTitle}>{d.title}</dt>
                  <dd className={styles.detailBody}>
                    {paragraphs(d.body).map((p, j) => (
                      <p key={j}>{p}</p>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        <section id="pass" className={`${styles.pass} ${styles.torn}`} aria-labelledby="pass-heading">
          <div className={styles.passText}>
            <h2 id="pass-heading" className={styles.sectionHeading} data-reveal>
              Your pass to the party
            </h2>
            <ol className={styles.steps}>
              {[
                "Register with your name, email and company, and choose a password.",
                "Pay now or whenever you’re ready: sign in any time to see the amount, the QR code and where to send your receipt.",
                "We check every registration and payment by hand. Sign in any time to see where yours is.",
                "Once we confirm your payment, your pass is ready.",
              ].map((s, i) => (
                <li key={s} data-reveal style={delay(i + 1)}>
                  {s}
                </li>
              ))}
            </ol>
          </div>
          <div data-reveal style={delay(2)}>
            <PassPreview event={passEvent} open={open} />
          </div>
        </section>

        {photos.length ? (
          <section id="photos" className={`${styles.photos} ${styles.torn}`} aria-labelledby="photos-heading">
            <Gallery
              title="Photos"
              headingId="photos-heading"
              photos={photos.map((p) => ({ id: p.id, url: p.url, caption: p.caption, width: p.width, height: p.height }))}
            />
          </section>
        ) : null}

        <a href={action.href} className={`${styles.band} ${styles.torn}`}>
          <span className={styles.bandNote}>
            {open
              ? "It takes a minute. Choose a password; pay now or come back whenever you’re ready."
              : "Registration is closed. Registered guests can sign in to pay and see their pass."}
          </span>
          <svg className={styles.bandArrow} viewBox="0 0 48 48" aria-hidden="true">
            <path d="M12 36L36 12M16 12h20v20" fill="none" stroke="currentColor" strokeWidth="3" />
          </svg>
          <span className={styles.bandWord}>{action.label}</span>
        </a>
      </main>

      <footer className={`${styles.close} ${styles.torn} theme-light`}>
        <div className={styles.closeTop}>
          <p className={styles.inviteLine}>See you on {formatDayMonth(event.startsAt)}.</p>
          <ul className={styles.closeLinks}>
            <li>
              <Link href="/login">Sign in</Link>
            </li>
            <li>
              <Link href="/terms">Terms and privacy</Link>
            </li>
            {event.contactEmail ? (
              <li>
                <a href={`mailto:${event.contactEmail}`}>{event.contactEmail}</a>
              </li>
            ) : null}
          </ul>
        </div>
        <p className={styles.legal}>
          <span>
            {year} {event.organizer || event.shortName}
          </span>
          <span>{event.venueName}</span>
        </p>
        {/* Two balanced lines on a phone, one line on wider screens; sized from the longest */}
        <p
          className={styles.footerName}
          aria-hidden="true"
          style={{ "--chars": footerName.length, "--line-chars": Math.max(...footerLines.map((l) => l.length)) } as CSSProperties}
        >
          {footerLines.map((line, i) => (
            <span key={i} className={styles.footerLine}>
              {i > 0 ? " " : ""}
              {line}
            </span>
          ))}
        </p>
      </footer>
    </>
  );
}
