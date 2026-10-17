"use server";

import { randomUUID } from "node:crypto";
import { event } from "@/config/event";
import { createServiceClient } from "@/lib/supabase/service";
import { ipKey } from "@/lib/request";
import { outcomeMessage } from "@/lib/registrant";
import {
  FIELD_STEP,
  RECEIPT_TYPES,
  detailsSchema,
  fieldErrors,
  receiptFileProblem,
  registrationSchema,
} from "@/lib/validation";

type Failure = { ok: false; error: string; fieldErrors?: Record<string, string>; step?: number };

const CLOSED: Failure = { ok: false, error: "Registration is closed." };
const TOO_MANY: Failure = {
  ok: false,
  error: "Too many attempts from this connection. Wait 10 minutes, then try again.",
};

async function allowed(scope: string, limit: number, windowSeconds = 600) {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("hit_rate_limit", {
    p_key: await ipKey(scope),
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate limit check failed", error.message);
    return true; // never lock real people out because of a hiccup
  }
  return data === true;
}

/**
 * Step 1: check the name against the invite list (and the email against
 * existing registrations) before anyone pays or uploads a receipt.
 * The final submit repeats the same check inside the database.
 */
export async function checkRegistrant(input: {
  firstName: string;
  lastName: string;
  email: string;
}): Promise<{ ok: true } | Failure> {
  if (!event.registrationOpen) return CLOSED;
  const parsed = detailsSchema.pick({ firstName: true, lastName: true, email: true }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Some details need fixing.", fieldErrors: fieldErrors(parsed.error), step: 0 };
  }
  if (!(await allowed("check-name", 30))) return TOO_MANY;

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("resolve_registrant", {
    p_first_name: parsed.data.firstName,
    p_last_name: parsed.data.lastName,
    p_email: parsed.data.email,
    p_invite_only: event.inviteOnly,
  });
  if (error) {
    console.error("invite check failed", error.message);
    return { ok: false, error: "We couldn't check the invite list just now. Try again in a minute." };
  }
  const outcome = String((Array.isArray(data) ? data[0] : data)?.outcome ?? "");
  if (outcome === "INVITED" || outcome === "NEW") return { ok: true };

  const problem = outcomeMessage(outcome);
  if (!problem) return { ok: false, error: "We couldn't check the invite list just now. Try again in a minute." };
  return { ok: false, error: problem.message, fieldErrors: { [problem.field]: problem.message }, step: 0 };
}

/** Step 4: give the browser a one-time link to upload the receipt straight into the private bucket. */
export async function prepareReceiptUpload(file: {
  type: string;
  size: number;
}): Promise<{ ok: true; path: string; token: string } | Failure> {
  if (!event.registrationOpen) return CLOSED;
  const problem = receiptFileProblem(file);
  if (problem) return { ok: false, error: problem };
  if (!(await allowed("upload", 12))) return TOO_MANY;

  const now = new Date();
  // Receipts are grouped by month, e.g. 2026-10/<random id>.png
  const folder = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`; // taste-skill-ignore
  const path = `${folder}/${randomUUID()}.${RECEIPT_TYPES[file.type]}`;

  const supabase = createServiceClient();
  const { data, error } = await supabase.storage.from("receipts").createSignedUploadUrl(path);
  if (error || !data) {
    console.error("signed upload failed", error?.message);
    return { ok: false, error: "We couldn't start the upload. Check your connection and try again." };
  }
  return { ok: true, path: data.path, token: data.token };
}

/** Step 5: validate everything again on the server and save the registration. */
export async function submitRegistration(
  input: Record<string, unknown>,
  guard: { website: string; startedAt: number },
): Promise<{ ok: true; referenceCode: string } | Failure> {
  if (!event.registrationOpen) return CLOSED;

  // Spam protection: the hidden "website" field must stay empty, and a person
  // needs more than a few seconds to fill in five steps.
  const tooFast = !Number.isFinite(guard.startedAt) || Date.now() - guard.startedAt < 4000;
  if (guard.website.trim() !== "" || tooFast) {
    return { ok: false, error: "We couldn't submit your registration. Reload the page and try again." };
  }

  if (!(await allowed("submit", 6))) return TOO_MANY;

  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    const step = Math.min(...Object.keys(errors).map((k) => FIELD_STEP[k] ?? 4));
    return { ok: false, error: "Some details need fixing.", fieldErrors: errors, step };
  }
  const r = parsed.data;

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("register_attendee", {
    p_first_name: r.firstName,
    p_last_name: r.lastName,
    p_email: r.email,
    p_mobile: r.mobile,
    p_company: r.company,
    p_job_title: r.jobTitle ?? "",
    p_payment_reference: r.paymentReference,
    p_receipt_path: r.receiptPath,
    p_reference_prefix: event.referencePrefix,
    p_invite_only: event.inviteOnly,
  });

  if (error) {
    const problem = outcomeMessage(error.message);
    if (problem) {
      return { ok: false, error: problem.message, fieldErrors: { [problem.field]: problem.message }, step: 0 };
    }
    switch (error.message) {
      case "RECEIPT_NOT_FOUND":
      case "RECEIPT_ALREADY_USED":
        return {
          ok: false,
          error: "We couldn't find your uploaded receipt. Upload it again.",
          fieldErrors: { receiptPath: "Upload your receipt again." },
          step: 3,
        };
      default:
        console.error("register_attendee failed", error.message);
        return { ok: false, error: "We couldn't save your registration. Try again in a minute." };
    }
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.reference_code) {
    return { ok: false, error: "We couldn't save your registration. Try again in a minute." };
  }
  return { ok: true, referenceCode: row.reference_code as string };
}
