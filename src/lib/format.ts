import { event } from "@/config/event";

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

export function eventDateLine() {
  return `${formatLongDate(event.startsAt)}, ${formatTime(event.startsAt)} to ${formatTime(event.endsAt)}`;
}

export function venueLine() {
  return [event.venue.name, event.venue.address, event.venue.city].filter(Boolean).join(", ");
}

export function isRegistrationOpen() {
  return event.registrationOpen;
}
