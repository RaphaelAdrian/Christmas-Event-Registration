import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { getEventSettings } from "@/lib/event";
import { safeNext } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(next);

  const event = await getEventSettings();
  const linkProblem = params.error === "link";

  return (
    <AuthShell eventName={event.shortName}>
      <h1 style={{ fontSize: "var(--step-head)" }}>Sign in</h1>
      <p>Use the email and password you chose when you registered. Pay, check your status and see your pass here.</p>
      {linkProblem ? (
        <p className="notice" data-tone="error" role="alert">
          That link has expired or was already used. Sign in below, or ask the organisers for a new password link.
        </p>
      ) : null}
      {params["signed-out"] ? (
        <p className="notice" role="status">
          You&rsquo;re signed out.
        </p>
      ) : null}
      <LoginForm next={next} />
    </AuthShell>
  );
}
