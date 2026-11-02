import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Makes sure someone is signed in (registrant or admin). Returns a Supabase
 * client acting as them, so Row Level Security limits what it can read.
 */
export async function requireUser(next = "/account") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { supabase, user };
}
