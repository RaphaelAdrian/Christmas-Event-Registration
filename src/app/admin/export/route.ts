import { adminOrNull } from "@/lib/admin";
import { getEventSettings } from "@/lib/event";
import { buildRegistrantWorkbook, type ExportRow } from "@/lib/excel";
import { ATTENDEE_COLUMNS, type Attendee } from "@/lib/statuses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE = 1000;

/** GET /admin/export: downloads every registrant as an Excel file (admins only). */
export async function GET() {
  const admin = await adminOrNull();
  if (!admin) return new Response("Sign in as an admin first.", { status: 401 });
  const { supabase } = admin;

  const people: Attendee[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("attendees")
      .select(ATTENDEE_COLUMNS)
      .neq("registration_status", "invited")
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return new Response("Couldn't read the registrants. Try again.", { status: 500 });
    people.push(...((data ?? []) as Attendee[]));
    if (!data || data.length < PAGE) break;
  }

  // The reference number to show: the paid payment if there is one, otherwise the latest sent.
  // A direct payment's reference is the admin's note.
  const references = new Map<string, { reference: string; method: "online" | "direct"; paid: boolean; at: string }>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("payment_submissions")
      .select("attendee_id, reference, status, method, submitted_at")
      .order("submitted_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return new Response("Couldn't read the payments. Try again.", { status: 500 });
    for (const p of data ?? []) {
      const current = references.get(p.attendee_id as string);
      const paid = p.status === "paid";
      if (!current || (!current.paid && (paid || (p.submitted_at as string) > current.at))) {
        references.set(p.attendee_id as string, {
          reference: p.reference as string,
          method: p.method === "direct" ? "direct" : "online",
          paid,
          at: p.submitted_at as string,
        });
      }
    }
    if (!data || data.length < PAGE) break;
  }

  const rows: ExportRow[] = people.map((p) => ({
    ...p,
    payment_reference: references.get(p.id)?.reference ?? null,
    payment_method: references.get(p.id)?.method ?? null,
  }));
  const event = await getEventSettings();
  const file = await buildRegistrantWorkbook(rows, event.name);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  const slug = event.shortName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "event";

  return new Response(file, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${slug}-registrants-${today}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
