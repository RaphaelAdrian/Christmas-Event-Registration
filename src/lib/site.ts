import "server-only";
import { headers } from "next/headers";

/**
 * The website's address for links in emails: NEXT_PUBLIC_SITE_URL when set
 * (use it on Vercel), otherwise the address of the current request.
 */
export async function siteUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Only same-site paths are allowed as a place to go after signing in. */
export function safeNext(value: string | null | undefined, fallback = "/account") {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}
