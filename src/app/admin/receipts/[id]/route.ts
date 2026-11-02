import { NextResponse } from "next/server";
import { adminOrNull } from "@/lib/admin";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /admin/receipts/:submissionId: sends an admin to a 2-minute signed link for that payment's receipt. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await adminOrNull();
  if (!admin) return new Response("Sign in as an admin first.", { status: 401 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return new Response("Not found.", { status: 404 });

  const { data } = await admin.supabase.from("payment_submissions").select("receipt_path").eq("id", id).maybeSingle();
  if (!data?.receipt_path) return new Response("No receipt for this payment.", { status: 404 });

  const { data: signed, error } = await admin.supabase.storage
    .from("receipts")
    .createSignedUrl(data.receipt_path as string, 120);
  if (error || !signed?.signedUrl) return new Response("Couldn't open the receipt. Try again.", { status: 500 });

  return NextResponse.redirect(signed.signedUrl, { status: 302, headers: { "Cache-Control": "no-store" } });
}
