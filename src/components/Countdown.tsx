"use client";

import { useEffect, useState } from "react";
import styles from "./Countdown.module.css";

type Parts = { days: number; hours: number; minutes: number; seconds: number };

function partsUntil(target: number, now: number): Parts | null {
  const ms = target - now;
  if (ms <= 0) return null;
  const total = Math.floor(ms / 1000);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

const UNITS: { key: keyof Parts; one: string; many: string }[] = [
  { key: "days", one: "Day", many: "Days" },
  { key: "hours", one: "Hour", many: "Hours" },
  { key: "minutes", one: "Minute", many: "Minutes" },
  { key: "seconds", one: "Second", many: "Seconds" },
];

/**
 * Counts down to a fixed moment (an ISO time with its offset, e.g. 3:00 PM
 * +08:00), so it is right whatever the visitor's own time zone is.
 * Renders dashes until the browser takes over, to avoid a hydration mismatch.
 */
export function Countdown({ startsAt, partyMessage = "It’s party time!" }: { startsAt: string; partyMessage?: string }) {
  const target = new Date(startsAt).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const parts = now === null ? undefined : partsUntil(target, now);

  if (parts === null) {
    return (
      <p className={styles.party} role="status">
        {partyMessage}
      </p>
    );
  }

  const spoken = parts
    ? `${parts.days} ${parts.days === 1 ? "day" : "days"}, ${parts.hours} ${parts.hours === 1 ? "hour" : "hours"} and ${parts.minutes} ${parts.minutes === 1 ? "minute" : "minutes"} to go.`
    : "";

  return (
    <div className={styles.countdown}>
      <dl className={styles.units} aria-hidden="true">
        {UNITS.map((u) => {
          const value = parts ? parts[u.key] : null;
          return (
            <div key={u.key} className={styles.unit}>
              <dt className={styles.label}>{value === 1 ? u.one : u.many}</dt>
              {/* Keyed by its value, so the seconds digit re-mounts and jolts each tick */}
              <dd className={styles.value} key={u.key === "seconds" ? String(value) : u.key}>
                {value === null ? "–" : String(value)}
              </dd>
            </div>
          );
        })}
      </dl>
      {/* Read out once a minute, not every second */}
      <p className="visually-hidden" aria-live="polite">
        {spoken}
      </p>
    </div>
  );
}
