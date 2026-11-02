import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { getEventSettings } from "@/lib/event";
import { requireUser } from "@/lib/user";
import { SetPasswordForm } from "./SetPasswordForm";

export const metadata: Metadata = { title: "Set your password", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SetPasswordPage() {
  const { user } = await requireUser("/account/set-password");
  const event = await getEventSettings();
  return (
    <AuthShell eventName={event.shortName}>
      <h1 style={{ fontSize: "var(--step-head)" }}>Set your password</h1>
      <p>
        You&rsquo;ll sign in with <strong>{user.email}</strong> and this password to pay and to see your pass.
      </p>
      <SetPasswordForm email={user.email ?? ""} />
    </AuthShell>
  );
}
