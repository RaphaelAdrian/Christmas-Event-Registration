import "server-only";
import ExcelJS from "exceljs";
import { PAYMENT_LABELS, REGISTRATION_LABELS, type Attendee } from "@/lib/statuses";

const PH_OFFSET_MS = 8 * 60 * 60 * 1000;
const DATE_FORMAT = "yyyy-mm-dd h:mm AM/PM";

/** One registrant as a row of the export, with the payment reference (and how they paid) already picked. */
export type ExportRow = Attendee & { payment_reference: string | null; payment_method: "online" | "direct" | null };

const METHOD_LABELS = { online: "Online", direct: "Directly" } as const;
/** How a paid registrant paid; empty until they have paid. */
const paidHow = (r: ExportRow) => (r.payment_status === "paid" && r.payment_method ? METHOD_LABELS[r.payment_method] : "");

const COLUMNS = [
  { header: "Last name", key: "last_name" },
  { header: "First name", key: "first_name" },
  { header: "Email", key: "email" },
  { header: "Company", key: "company" },
  { header: "Registration status", key: "registration_status" },
  { header: "Payment status", key: "payment_status" },
  { header: "Paid how", key: "payment_method" },
  { header: "Reference number", key: "payment_reference" },
  { header: "Date registered (PH time)", key: "registered_at" },
  { header: "Date paid (PH time)", key: "paid_at" },
] as const;

type Key = (typeof COLUMNS)[number]["key"];
const DATE_KEYS = new Set<Key>(["registered_at", "paid_at"]);

/** Excel has no time zones: shift the moment to Philippine wall-clock time and store it as a date. */
function phDate(iso: string | null): Date | null {
  if (!iso) return null;
  return new Date(new Date(iso).getTime() + PH_OFFSET_MS);
}

/** What a cell shows, used to size the columns. */
function displayText(r: ExportRow, key: Key): string {
  if (key === "registration_status") return REGISTRATION_LABELS[r.registration_status];
  if (key === "payment_status") return PAYMENT_LABELS[r.payment_status];
  if (key === "payment_method") return paidHow(r);
  if (DATE_KEYS.has(key)) return r[key] ? "2026-12-31 12:00 PM" : "";
  return String(r[key] ?? "");
}

const SHEETS: { name: string; filter: (r: ExportRow) => boolean }[] = [
  { name: "Paid", filter: (r) => r.payment_status === "paid" },
  { name: "Approved – Not Yet Paid", filter: (r) => r.registration_status === "approved" && r.payment_status !== "paid" },
  { name: "Pending", filter: (r) => r.registration_status === "pending" },
  { name: "All Registrants", filter: () => true },
];

export async function buildRegistrantWorkbook(rows: ExportRow[], title: string): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = title;
  wb.created = new Date();

  for (const sheet of SHEETS) {
    const list = rows.filter(sheet.filter);
    const ws = wb.addWorksheet(sheet.name, {
      views: [{ state: "frozen", ySplit: 1, xSplit: 0, topLeftCell: "A2", activeCell: "A2" }],
    });

    ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key }));

    for (const r of list) {
      ws.addRow({
        last_name: r.last_name,
        first_name: r.first_name,
        email: r.email ?? "",
        company: r.company ?? "",
        registration_status: REGISTRATION_LABELS[r.registration_status],
        payment_status: PAYMENT_LABELS[r.payment_status],
        payment_method: paidHow(r),
        payment_reference: r.payment_reference ?? "",
        registered_at: phDate(r.registered_at),
        paid_at: phDate(r.paid_at),
      });
    }

    // Header row
    const header = ws.getRow(1);
    header.height = 22;
    header.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
      cell.alignment = { vertical: "middle" };
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };

    // Date formats
    COLUMNS.forEach((c, i) => {
      if (DATE_KEYS.has(c.key)) ws.getColumn(i + 1).numFmt = DATE_FORMAT;
    });
    header.eachCell((cell) => {
      cell.numFmt = "General";
    });

    // Auto-width columns
    COLUMNS.forEach((c, i) => {
      let longest = c.header.length;
      for (const r of list) longest = Math.max(longest, displayText(r, c.key).length);
      ws.getColumn(i + 1).width = Math.min(Math.max(longest + 3, 10), 60);
    });
  }

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
