import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { ipKey } from "@/lib/request";

export const TOO_MANY = "Too many attempts from this connection. Wait 10 minutes, then try again.";

/**
 * Records one attempt for this visitor's connection and returns false once
 * `limit` attempts were made within the window. Fails open, so a database
 * hiccup never locks real people out.
 */
export async function allowed(scope: string, limit: number, windowSeconds = 600) {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("hit_rate_limit", {
    p_key: await ipKey(scope),
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate limit check failed", error.message);
    return true;
  }
  return data === true;
}
