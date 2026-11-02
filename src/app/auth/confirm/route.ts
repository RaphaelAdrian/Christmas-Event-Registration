import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/site";

export const dynamic = "force-dynamic";

const TYPES: EmailOtpType[] = ["invite", "recovery", "email", "magiclink", "signup"];

/**
 * GET /auth/confirm?token_hash=…&type=invite|recovery
 * The link in the invite and reset-password emails. Checks the one-time
 * token, signs the person in, and sends them on to set their password.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const setPassword = type === "invite" || type === "recovery";
  const next = safeNext(url.searchParams.get("next"), setPassword ? "/account/set-password" : "/account");

  const to = (path: string) => {
    const target = url.clone();
    const [pathname, search] = path.split("?");
    target.pathname = pathname!;
    target.search = search ? `?${search}` : "";
    return NextResponse.redirect(target);
  };

  if (!tokenHash || !type || !TYPES.includes(type)) return to("/login?error=link");

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return to("/login?error=link");

  return to(next);
}
