import { adminOrNull } from "@/lib/admin";

export const dynamic = "force-dynamic";

/** GET /admin/invites-template: a CSV with the two columns the importer looks for. */
export async function GET() {
  const admin = await adminOrNull();
  if (!admin) return new Response("Sign in as an admin first.", { status: 401 });

  const csv = "﻿Name,Email\r\nJuan dela Cruz,juan@example.com\r\nMaria Santos,maria@example.com\r\n";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="invite-list-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
