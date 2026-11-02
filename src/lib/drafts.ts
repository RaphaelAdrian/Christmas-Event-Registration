import "server-only";
import { getEventSettings } from "./event";
import { formatLongDate, timeRange } from "./format";
import { siteUrl } from "./site";

/**
 * Ready-made messages the admin sends from their own email, Messenger or
 * Viber. Nothing here sends anything: the site has no email service.
 */
export type Draft = { to: string; subject: string; body: string };

type Ctx = { name: string; when: string; venue: string; site: string; contact: string };

async function context(): Promise<Ctx> {
  const event = await getEventSettings();
  return {
    name: event.name,
    when: `${formatLongDate(event.startsAt)}, ${timeRange(event.startsAt, event.endsAt)}`,
    venue: event.venueName,
    site: await siteUrl(),
    contact: event.contactEmail ? `Questions? Write to ${event.contactEmail}.` : "Questions? Reply to this message.",
  };
}

const sign = (c: Ctx) => [`${c.when}`, `${c.venue}`, "", c.contact].join("\n");

export type DraftKind =
  | { kind: "approved" }
  | { kind: "declined" }
  | { kind: "paid"; referenceCode: string | null }
  | { kind: "rejected"; reason: string }
  | { kind: "password"; link: string };

/** One message for one person. */
export async function draftFor(person: { email: string; firstName: string }, what: DraftKind): Promise<Draft> {
  const c = await context();
  const hi = `Hi ${person.firstName || "there"},`;
  let subject: string;
  let lines: string[];
  switch (what.kind) {
    case "approved":
      subject = `You're approved: ${c.name}`;
      lines = [
        hi,
        `Your registration for ${c.name} is approved.`,
        `If you haven't paid yet, sign in at ${c.site}/login with ${person.email} and the password you chose when you registered. You'll see the amount, the QR code and how to send your receipt.`,
      ];
      break;
    case "declined":
      subject = `Your registration for ${c.name}`;
      lines = [
        hi,
        `Thank you for registering for ${c.name}. We're sorry, but we can't confirm your place this time.`,
        "If you think this is a mistake, reply and we'll take another look.",
      ];
      break;
    case "paid":
      subject = `Payment confirmed: ${c.name}`;
      lines = [
        hi,
        `We've checked your payment and your place at ${c.name} is confirmed.`,
        what.referenceCode
          ? `Your reference code is ${what.referenceCode}. Your pass is on ${c.site}/account; show it, or the code, on the day.`
          : `Your pass is on ${c.site}/account; show it on the day.`,
      ];
      break;
    case "rejected":
      subject = `Your payment for ${c.name} needs another look`;
      lines = [
        hi,
        "We checked your payment and couldn't confirm it yet:",
        what.reason,
        `Sign in at ${c.site}/login to send it again.`,
      ];
      break;
    case "password":
      subject = `Set your password: ${c.name}`;
      lines = [
        hi,
        `Use this link to set a password for ${person.email}. It works once, so please don't forward it:`,
        what.link,
        `Then sign in at ${c.site}/login whenever you need to.`,
      ];
      break;
  }
  return { to: person.email, subject, body: [...lines, "", sign(c)].join("\n\n").replace(/\n\n\n\n/g, "\n\n") };
}
