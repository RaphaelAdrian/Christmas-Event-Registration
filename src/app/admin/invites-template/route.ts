import { adminOrNull } from "@/lib/admin";

export const dynamic = "force-dynamic";

/** GET /admin/invites-template: a CSV with the two columns the importer looks for. */
export async function GET() {
  const admin = await adminOrNull();
  if (!admin) return new Response("Sign in as an admin first.", { status: 401 });

  const csv =
    "\uFEFFFirst name,Last name,Email\r\n" +
    "Jairus Miguel,Plantig,\r\n" +
    "Juan,dela Cruz,juan@example.com\r\n" +
    "Maria Clara,Santos,\r\n";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="invite-list-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
