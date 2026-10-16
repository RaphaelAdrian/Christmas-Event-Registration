import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

/** The visitor's IP address as reported by Vercel (or "unknown" locally). */
export async function clientIp() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

/** A one-way hash of the IP, so the database never stores raw addresses. */
export async function ipKey(scope: string) {
  const ip = await clientIp();
  return `${scope}:${createHash("sha256").update(ip).digest("hex").slice(0, 32)}`;
}
