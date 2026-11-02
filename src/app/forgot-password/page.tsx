import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { getEventSettings } from "@/lib/event";

export const metadata: Metadata = { title: "Forgot your password" };

export default async function ForgotPasswordPage() {
  const event = await getEventSettings();
  return (
    <AuthShell eventName={event.shortName}>
      <h1 style={{ fontSize: "var(--step-head)" }}>Forgot your password?</h1>
      <p>
        Ask the organisers for a password link. It&rsquo;s a one-time link that lets you set a new password, sent to you
        directly by email or chat.
      </p>
      {event.contactEmail ? (
        <p>
          <a
            className="btn"
            href={`mailto:${event.contactEmail}?subject=${encodeURIComponent(`Password link: ${event.name}`)}&body=${encodeURIComponent(
              "Hi,\n\nI forgot my password for the event registration. Could you send me a password link?\n\nMy name:\nThe email I registered with:\n",
            )}`}
          >
            Write to {event.contactEmail}
          </a>
        </p>
      ) : null}
      <p>
        <Link href="/login">Back to sign in</Link>
      </p>
    </AuthShell>
  );
}
