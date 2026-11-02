"use client";

import { useState } from "react";
import styles from "./chart.module.css";

export type DayCount = { day: string; count: number };

const BAR = "#8B3DFF"; // UV, validated against the white surface (dataviz validator: all checks pass)
const W = 720;
const H = 240;
const PAD = { top: 28, right: 8, bottom: 30, left: 36 };

const dayLabel = (day: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));

/** Every day from the first registration to today (Philippine time), at most the last 60. */
function fillDays(data: DayCount[], today: string): DayCount[] {
  if (!data.length) return [];
  const counts = new Map(data.map((d) => [d.day, d.count]));
  const start = new Date(`${data[0]!.day}T00:00:00Z`);
  const lastData = data[data.length - 1]!.day;
  const end = new Date(`${(today > lastData ? today : lastData)}T00:00:00Z`);
  const out: DayCount[] = [];
  for (let d = start; d <= end; d = new Date(d.getTime() + 86400000)) {
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, count: counts.get(key) ?? 0 });
  }
  return out.slice(-60);
}

function niceMax(n: number) {
  if (n <= 4) return 4;
  const step = Math.pow(10, Math.floor(Math.log10(n)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * step >= n) return m * step;
  return 10 * step;
}

/** Registrations per day: one series, columns from a shared baseline, hover or focus a day for its count. */
export function RegistrationsChart({ data, today }: { data: DayCount[]; today: string }) {
  const days = fillDays(data, today);
  const [hover, setHover] = useState<number | null>(null);
  if (!days.length) return <p className={styles.empty}>No registrations yet. The chart fills in as people register.</p>;

  const max = niceMax(Math.max(...days.map((d) => d.count)));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const band = plotW / days.length;
  const barW = Math.max(2, Math.min(24, band - 2));
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];
  const peak = days.reduce((best, d, i) => (d.count > days[best]!.count ? i : best), 0);
  const labelEvery = Math.max(1, Math.ceil(days.length / 6));
  const total = days.reduce((s, d) => s + d.count, 0);

  // Column with a 4px rounded top, square at the baseline
  const column = (x: number, top: number) => {
    const h = PAD.top + plotH - top;
    if (h <= 0) return "";
    const r = Math.min(4, barW / 2, h);
    const base = PAD.top + plotH;
    return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${base} Z`;
  };

  const active = hover === null ? null : days[hover]!;

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>
        Registrations per day, {dayLabel(days[0]!.day)} to {dayLabel(days[days.length - 1]!.day)}: {total} in all
      </figcaption>
      <div className={styles.plot}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={`Registrations per day, ${total} in all. A table follows.`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className={styles.grid} />
              <text x={PAD.left - 8} y={y(t)} className={styles.tick} textAnchor="end" dominantBaseline="middle">
                {Number.isInteger(t) ? t : t.toFixed(1)}
              </text>
            </g>
          ))}
          {days.map((d, i) => {
            const x = PAD.left + i * band + (band - barW) / 2;
            const showLabel = i === peak && d.count > 0;
            return (
              <g key={d.day}>
                <path d={column(x, y(d.count))} fill={BAR} opacity={hover === null || hover === i ? 1 : 0.45} />
                {showLabel ? (
                  <text x={x + barW / 2} y={y(d.count) - 8} className={styles.value} textAnchor="middle">
                    {d.count}
                  </text>
                ) : null}
                {i % labelEvery === 0 || i === days.length - 1 ? (
                  <text x={x + barW / 2} y={H - 8} className={styles.tick} textAnchor="middle">
                    {dayLabel(d.day)}
                  </text>
                ) : null}
                {/* Hit target: the whole day's band, taller than the bar */}
                <rect
                  x={PAD.left + i * band}
                  y={PAD.top}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${dayLabel(d.day)}: ${d.count} registration${d.count === 1 ? "" : "s"}`}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className={styles.hit}
                />
              </g>
            );
          })}
        </svg>
        {active ? (
          <div
            className={styles.tooltip}
            style={{ left: `${((PAD.left + hover! * band + band / 2) / W) * 100}%`, top: `${(y(active.count) / H) * 100}%` }}
            aria-hidden="true"
          >
            <strong>{active.count}</strong> {active.count === 1 ? "registration" : "registrations"}
            <span>{dayLabel(active.day)}</span>
          </div>
        ) : null}
      </div>
      <details className={styles.table}>
        <summary>Show as a table</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Registrations</th>
            </tr>
          </thead>
          <tbody>
            {days
              .filter((d) => d.count > 0)
              .map((d) => (
                <tr key={d.day}>
                  <td>{dayLabel(d.day)}</td>
                  <td>{d.count}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
