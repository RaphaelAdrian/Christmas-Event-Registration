import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabasePublishableKey, supabaseUrl } from "./env";

/**
 * Supabase client acting as a logged-out visitor, with no cookies. Used to
 * read the public event details and gallery so those pages can be cached.
 * Row Level Security limits it to what anyone may see.
 */
export function createPublicClient() {
  return createClient(supabaseUrl(), supabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
