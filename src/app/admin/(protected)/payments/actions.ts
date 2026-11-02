"use server";

import { requireAdmin } from "@/lib/admin";
import { draftFor, type Draft } from "@/lib/drafts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REVIEW_ERRORS: Record<string, string> = {
  NOT_ADMIN: "Your account isn't on the admin list.",
  NOT_FOUND: "That payment wasn't found. Reload the page.",
  ALREADY_REVIEWED: "Someone already reviewed this payment. Reload the page.",
  REASON_REQUIRED: "Write the reason, so they know what to fix.",
};

export type ReviewResult = { ok: boolean; message: string; draft?: Draft };

async function review(submissionId: string, decision: "paid" | "rejected", reason: string): Promise<ReviewResult> {
  const { supabase } = await requireAdmin();
  if (!UUID_RE.test(submissionId)) return { ok: false, message: "That payment wasn't found." };

  const { data: attendeeId, error } = await supabase.rpc("review_payment", {
    p_submission_id: submissionId,
    p_decision: decision,
    p_reason: reason,
  });
  if (error) {
    return { ok: false, message: REVIEW_ERRORS[error.message] ?? "Couldn't save the review. Try again." };
  }
  // No revalidatePath here: it would re-render this page at once and drop the
  // reviewed card (and its ready-made message) before the admin can use it.
  // Admin and account pages are dynamic, so they always load fresh data.

  // A ready-made message the admin can send them
  const { data: person } = await supabase
    .from("attendees")
    .select("first_name, email, reference_code")
    .eq("id", attendeeId as string)
    .maybeSingle();
  const draft = person?.email
    ? await draftFor(
        { email: String(person.email), firstName: String(person.first_name ?? "") },
        decision === "paid" ? { kind: "paid", referenceCode: (person.reference_code as string | null) ?? null } : { kind: "rejected", reason },
      )
    : undefined;
  return { ok: true, message: decision === "paid" ? "Marked paid" : "Rejected", draft };
}

export async function markPaid(submissionId: string) {
  return review(submissionId, "paid", "");
}

export async function rejectPayment(submissionId: string, reason: string) {
  const clean = reason.trim().slice(0, 500);
  if (!clean) return { ok: false, message: REVIEW_ERRORS.REASON_REQUIRED! };
  return review(submissionId, "rejected", clean);
}
