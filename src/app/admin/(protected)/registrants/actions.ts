"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { draftFor, type Draft } from "@/lib/drafts";
import { siteUrl } from "@/lib/site";
import { createServiceClient } from "@/lib/supabase/service";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AT_ONCE = 200;

export type RowResult = { id: string; name: string; ok: boolean; message: string; draft?: Draft };
export type BulkResult = { results: RowResult[]; stopped?: string };

type Row = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  registration_status: string;
  payment_status: string;
  user_id: string | null;
};

function cleanIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return Array.from(new Set(ids.filter((id): id is string => typeof id === "string" && UUID_RE.test(id)))).slice(0, MAX_AT_ONCE);
}

async function loadRows(supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"], ids: string[]) {
  const { data, error } = await supabase
    .from("attendees")
    .select("id, first_name, last_name, email, registration_status, payment_status, user_id")
    .in("id", ids);
  if (error) throw new Error(error.message);
  const byId = new Map((data as Row[]).map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is Row => Boolean(r));
}

const nameOf = (r: Row) => `${r.first_name} ${r.last_name}`.trim() || r.email || "This person";

/**
 * Approves registrations. Guests made their login (with their own password)
 * when they registered, so approval just unlocks the payment details for them.
 */
export async function approveRegistrants(ids: string[]): Promise<BulkResult> {
  const { supabase, user } = await requireAdmin();
  const rows = await loadRows(supabase, cleanIds(ids));
  const results: RowResult[] = [];

  for (const r of rows) {
    const name = nameOf(r);
    if (r.registration_status === "approved") {
      results.push({ id: r.id, name, ok: true, message: "Already approved" });
      continue;
    }
    if (r.registration_status === "invited") {
      results.push({ id: r.id, name, ok: false, message: "Hasn't registered yet" });
      continue;
    }
    const { error } = await supabase
      .from("attendees")
      .update({ registration_status: "approved", reviewed_by: user.email?.toLowerCase() ?? null })
      .eq("id", r.id);
    if (error) {
      console.error("approve failed", error.message);
      results.push({ id: r.id, name, ok: false, message: "Couldn't save. Try again." });
      continue;
    }
    results.push({
      id: r.id,
      name,
      ok: true,
      message: r.user_id ? "Approved" : "Approved, but they have no sign-in yet: give them a password link",
      draft: r.user_id && r.email ? await draftFor({ email: r.email, firstName: r.first_name }, { kind: "approved" }) : undefined,
    });
  }

  revalidatePath("/admin", "layout");
  return { results };
}

/**
 * Declines registrations. Guests keep their login, so they can sign in and see
 * that they were declined, but they can't see the payment details or pay.
 * People who have paid are left alone.
 */
export async function declineRegistrants(ids: string[]): Promise<BulkResult> {
  const { supabase, user } = await requireAdmin();
  const rows = await loadRows(supabase, cleanIds(ids));
  const results: RowResult[] = [];

  for (const r of rows) {
    const name = nameOf(r);
    if (r.registration_status === "declined") {
      results.push({ id: r.id, name, ok: true, message: "Already declined" });
      continue;
    }
    if (r.registration_status === "invited") {
      results.push({ id: r.id, name, ok: false, message: "Hasn't registered yet" });
      continue;
    }
    if (r.payment_status === "paid") {
      results.push({ id: r.id, name, ok: false, message: "Already paid; sort out a refund first" });
      continue;
    }
    const { error } = await supabase
      .from("attendees")
      .update({ registration_status: "declined", reviewed_by: user.email?.toLowerCase() ?? null })
      .eq("id", r.id);
    if (error) {
      results.push({ id: r.id, name, ok: false, message: "Couldn't save. Try again." });
      continue;
    }
    results.push({
      id: r.id,
      name,
      ok: true,
      message: "Declined",
      draft: r.email ? await draftFor({ email: r.email, firstName: r.first_name }, { kind: "declined" }) : undefined,
    });
  }

  revalidatePath("/admin", "layout");
  return { results };
}

const DIRECT_ERRORS: Record<string, string> = {
  NOT_ADMIN: "Your account isn't on the admin list.",
  NOT_FOUND: "That person wasn't found. Reload the page.",
  NOT_REGISTERED: "They haven't registered yet.",
  ALREADY_PAID: "Already paid",
  PAYMENT_WAITING: "They've sent a payment for review: confirm it on the Payments page instead.",
};

/**
 * Marks someone Paid who paid an organiser directly (cash, or a transfer
 * outside the site). The payment is kept with the admin's note and counts
 * toward Collected; their registration is approved too.
 */
export async function recordDirectPayment(id: string, note: string): Promise<BulkResult> {
  const { supabase } = await requireAdmin();
  const [row] = UUID_RE.test(id) ? await loadRows(supabase, [id]) : [];
  if (!row) return { results: [], stopped: "That person wasn't found. Reload the page." };
  const name = nameOf(row);

  const { error } = await supabase.rpc("record_direct_payment", {
    p_attendee_id: row.id,
    p_note: String(note ?? "").trim().slice(0, 100),
  });
  if (error) {
    // PGRST202: the function isn't in the database yet
    if (error.code === "PGRST202") {
      return { results: [], stopped: "Run supabase/migrations/20261103000000_pay_before_approval.sql in Supabase first." };
    }
    const known = DIRECT_ERRORS[error.message];
    if (!known) console.error("record_direct_payment failed", error.message);
    return { results: [{ id: row.id, name, ok: false, message: known ?? "Couldn't save. Try again." }] };
  }

  revalidatePath("/admin", "layout");
  const { data: saved } = await supabase.from("attendees").select("reference_code").eq("id", row.id).maybeSingle();
  return {
    results: [
      {
        id: row.id,
        name,
        ok: true,
        message: "Marked paid (paid directly)",
        draft: row.email
          ? await draftFor({ email: row.email, firstName: row.first_name }, { kind: "paid", referenceCode: (saved?.reference_code as string | null) ?? null })
          : undefined,
      },
    ],
  };
}

export type LinkResult =
  | { ok: true; id: string; name: string; email: string; link: string; draft: Draft }
  | { ok: false; message: string };

/**
 * Makes a one-time link that signs the person in and opens "Set your
 * password". Nothing is emailed: the admin passes the link on. For someone
 * who forgot their password, or who registered before passwords were asked
 * for (they get a login now).
 */
export async function passwordLink(id: string): Promise<LinkResult> {
  const { supabase } = await requireAdmin();
  if (!UUID_RE.test(id)) return { ok: false, message: "That person wasn't found." };
  const [row] = await loadRows(supabase, [id]);
  if (!row || row.registration_status === "invited") return { ok: false, message: "They haven't registered yet." };
  if (!row.email) return { ok: false, message: "They have no email address to sign in with." };

  const service = createServiceClient();
  let userId = row.user_id;
  if (!userId) {
    const { data: existing } = await service.rpc("auth_user_id", { p_email: row.email });
    if (typeof existing === "string" && existing) userId = existing;
  }

  const { data, error } = userId
    ? await service.auth.admin.generateLink({ type: "recovery", email: row.email })
    : await service.auth.admin.generateLink({
        type: "invite",
        email: row.email,
        options: { data: { first_name: row.first_name, last_name: row.last_name } },
      });
  if (error || !data?.properties?.hashed_token) {
    console.error("generate link failed", error?.message);
    return { ok: false, message: "Couldn't make the link. Try again." };
  }

  // Link a login made just now (or found by email) to the registration
  const loginId = userId ?? data.user?.id ?? null;
  if (loginId && loginId !== row.user_id) {
    const { error: linkError } = await service.from("attendees").update({ user_id: loginId }).eq("id", row.id);
    if (linkError) console.error("link login failed", linkError.message);
    revalidatePath("/admin", "layout");
  }

  const type = data.properties.verification_type === "invite" ? "invite" : "recovery";
  const link = `${await siteUrl()}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=${type}`;
  const draft = await draftFor({ email: row.email, firstName: row.first_name }, { kind: "password", link });
  return { ok: true, id: row.id, name: nameOf(row), email: row.email, link, draft };
}
