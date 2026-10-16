import { event } from "@/config/event";
import { adminOrNull } from "@/lib/admin";
import { buildAttendeeWorkbook } from "@/lib/excel";
import type { Attendee } from "@/lib/statuses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLUMNS =
  "id, reference_code, full_name, email, mobile, company, job_title, status, payment_reference, receipt_path, invited_at, registered_at, paid_at, cancelled_at, created_at";

/** GET /admin/export: downloads every attendee as an Excel file (admins only). */
export async function GET() {
  const admin = await adminOrNull();
  if (!admin) return new Response("Sign in as an admin first.", { status: 401 });

  const rows: Attendee[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await admin.supabase
      .from("attendees")
      .select(COLUMNS)
      .order("registered_at", { ascending: true, nullsFirst: false })
      .order("full_name", { ascending: true })
      .range(from, from + page - 1);
    if (error) return new Response("Couldn't read the attendee list. Try again.", { status: 500 });
    rows.push(...((data ?? []) as Attendee[]));
    if (!data || data.length < page) break;
  }

  const file = await buildAttendeeWorkbook(rows, event.name);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  const slug = event.shortName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "event";

  return new Response(file, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${slug}-attendees-${today}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
