const TZ = "Asia/Manila";

/** "Thursday, 26 November 2026" */
export function formatLongDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

/** "26 Nov" */
export function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short" }).format(new Date(iso));
}

/** "Thu" */
export function formatWeekday(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short" }).format(new Date(iso));
}

/** "26 November" */
export function formatDayMonth(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "long" }).format(new Date(iso));
}

/** "8:00 AM" */
export function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true })
    .format(new Date(iso))
    .replace(/\s(AM|PM)$/i, "\u00a0$1");
}

/** "26 Nov 2026, 2:05 PM" in Philippine time, for admin tables */
export function formatDateTimePH(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" }).format(d);
  return `${date}, ${formatTime(iso)}`;
}

/** "₱2,500" (no decimals when the amount is whole) */
export function formatPeso(amount: number) {
  const whole = Number.isInteger(amount);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * "3:00 PM". The organisers write the end of the night (midnight) as
 * "12:00 PM", so midnight is shown that way instead of "12:00 AM".
 */
export function formatClock(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(iso));
  const hour = parts.find((p) => p.type === "hour")?.value;
  const minute = parts.find((p) => p.type === "minute")?.value;
  if (minute === "00" && hour === "00") return "12:00 PM";
  return formatTime(iso);
}

/** "3:00 PM – 12:00 PM" */
export function timeRange(startsAt: string, endsAt: string) {
  return `${formatClock(startsAt)} – ${formatClock(endsAt)}`;
}

/** Splits admin-entered text into paragraphs at blank lines. */
export function paragraphs(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** { date: "2026-12-12", time: "15:00" } in Philippine time, for date and time inputs. */
export function manilaParts(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}
