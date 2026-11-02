"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { allowed, TOO_MANY } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { RECEIPT_TYPES, fieldErrors, paymentSchema, receiptFileProblem } from "@/lib/validation";

type Failure = { ok: false; error: string; fieldErrors?: Record<string, string> };

const NOT_ALLOWED: Failure = { ok: false, error: "Payment isn't open for this registration. Reload the page." };

/** The signed-in registrant's own row, read through Row Level Security. */
async function currentRegistrant() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("attendees")
    .select("id, registration_status, payment_status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return null;
  return { supabase, user, row: data as { id: string; registration_status: string; payment_status: string } };
}

/** Gives the browser a one-time link to upload the receipt into the person's own folder of the private bucket. */
export async function prepareReceiptUpload(file: {
  type: string;
  size: number;
}): Promise<{ ok: true; path: string; token: string } | Failure> {
  const me = await currentRegistrant();
  if (!me) return { ok: false, error: "Sign in again to upload your receipt." };
  // Pending and approved registrants can pay; declined ones can't
  if (!["pending", "approved"].includes(me.row.registration_status) || !["unpaid", "rejected"].includes(me.row.payment_status)) {
    return NOT_ALLOWED;
  }
  const problem = receiptFileProblem(file);
  if (problem) return { ok: false, error: problem };
  if (!(await allowed("receipt-upload", 12))) return { ok: false, error: TOO_MANY };

  const path = `${me.user.id}/${randomUUID()}.${RECEIPT_TYPES[file.type]}`;
  const { data, error } = await createServiceClient().storage.from("receipts").createSignedUploadUrl(path);
  if (error || !data) {
    console.error("signed upload failed", error?.message);
    return { ok: false, error: "We couldn't start the upload. Check your connection and try again." };
  }
  return { ok: true, path: data.path, token: data.token };
}

const SUBMIT_ERRORS: Record<string, Failure> = {
  NOT_SIGNED_IN: { ok: false, error: "Sign in again to send your payment." },
  CANNOT_PAY: NOT_ALLOWED,
  // Raised by the database until 20261103000000_pay_before_approval.sql is run
  NOT_APPROVED: NOT_ALLOWED,
  ALREADY_SUBMITTED: { ok: false, error: "Your payment is already waiting for review. Reload the page." },
  ALREADY_PAID: { ok: false, error: "Your payment is already confirmed. Reload the page." },
  PAYMENT_NOT_READY: { ok: false, error: "The payment details aren't ready yet. Try again later." },
  INVALID_REFERENCE: {
    ok: false,
    error: "Check the reference number.",
    fieldErrors: { paymentReference: "Use letters, numbers, spaces and dashes only (4 to 64 characters)." },
  },
  RECEIPT_NOT_FOUND: {
    ok: false,
    error: "We couldn't find your uploaded receipt. Upload it again.",
    fieldErrors: { receiptPath: "Upload your receipt again." },
  },
  RECEIPT_ALREADY_USED: {
    ok: false,
    error: "That receipt was already sent. Upload it again.",
    fieldErrors: { receiptPath: "Upload your receipt again." },
  },
};

/** Sends the reference number and the uploaded receipt for review. */
export async function submitPayment(input: {
  paymentReference: string;
  receiptPath: string;
}): Promise<{ ok: true } | Failure> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Some details need fixing.", fieldErrors: fieldErrors(parsed.error) };
  if (!(await allowed("payment-submit", 10))) return { ok: false, error: TOO_MANY };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_payment", {
    p_reference: parsed.data.paymentReference,
    p_receipt_path: parsed.data.receiptPath,
  });
  if (error) {
    const known = SUBMIT_ERRORS[error.message];
    if (known) return known;
    console.error("submit_payment failed", error.message);
    return { ok: false, error: "We couldn't send your payment. Try again in a minute." };
  }
  revalidatePath("/account");
  revalidatePath("/admin", "layout");
  return { ok: true };
}
