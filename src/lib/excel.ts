import "server-only";
import ExcelJS from "exceljs";
import { STATUS_LABELS, type Attendee, type AttendeeStatus } from "@/lib/statuses";

const PH_OFFSET_MS = 8 * 60 * 60 * 1000;
const DATE_FORMAT = "yyyy-mm-dd h:mm AM/PM";

const COLUMNS = [
  { header: "Reference code", key: "reference_code" },
  { header: "Name", key: "full_name" },
  { header: "Email", key: "email" },
  { header: "Mobile", key: "mobile" },
  { header: "Company", key: "company" },
  { header: "Status", key: "status" },
  { header: "Payment reference", key: "payment_reference" },
  { header: "Date registered (PH time)", key: "registered_at" },
  { header: "Date paid (PH time)", key: "paid_at" },
] as const;

const STATUS_COLUMN = 6; // F
const DATE_KEYS = new Set(["registered_at", "paid_at"]);

/** Excel has no time zones: shift the moment to Philippine wall-clock time and store it as a date. */
function phDate(iso: string | null): Date | null {
  if (!iso) return null;
  return new Date(new Date(iso).getTime() + PH_OFFSET_MS);
}

/** The list for the Status dropdown, e.g. "Invited – Not Confirmed,Confirmed – Will Join,Paid,Cancelled". */
const STATUS_LIST = `"${Object.values(STATUS_LABELS).join(",")}"`;

/** What a cell shows, used to size the columns. */
function displayText(a: Attendee, key: (typeof COLUMNS)[number]["key"]): string {
  if (key === "status") return STATUS_LABELS[a.status];
  if (DATE_KEYS.has(key)) return a[key] ? "2026-12-31 12:00 PM" : "";
  return String(a[key] ?? "");
}

const SHEETS: { name: string; filter: (status: AttendeeStatus) => boolean }[] = [
  { name: "All Attendees", filter: () => true },
  { name: "Paid", filter: (s) => s === "paid" },
  { name: "Will Join (Confirmed)", filter: (s) => s === "confirmed" },
  { name: "Invited – Not Confirmed", filter: (s) => s === "invited" },
];

export async function buildAttendeeWorkbook(attendees: Attendee[], title: string): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = title;
  wb.created = new Date();

  for (const sheet of SHEETS) {
    const rows = attendees.filter((a) => sheet.filter(a.status));
    const ws = wb.addWorksheet(sheet.name, {
      views: [{ state: "frozen", ySplit: 1, xSplit: 0, topLeftCell: "A2", activeCell: "A2" }],
    });

    ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key }));

    for (const a of rows) {
      ws.addRow({
        reference_code: a.reference_code ?? "",
        full_name: a.full_name,
        email: a.email ?? "",
        mobile: a.mobile ?? "",
        company: a.company ?? "",
        status: STATUS_LABELS[a.status],
        payment_reference: a.payment_reference ?? "",
        registered_at: phDate(a.registered_at),
        paid_at: phDate(a.paid_at),
      });
    }

    // Header row
    const header = ws.getRow(1);
    header.height = 22;
    header.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E1822" } };
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

    // Status dropdown on every data row, plus spare rows for people added by hand
    const lastRow = Math.max(rows.length + 1, 2) + 200;
    for (let r = 2; r <= lastRow; r++) {
      ws.getCell(r, STATUS_COLUMN).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [STATUS_LIST],
        showErrorMessage: true,
        errorStyle: "error",
        errorTitle: "Status",
        error: "Pick a status from the list.",
      };
    }

    // Auto-width columns
    COLUMNS.forEach((c, i) => {
      let longest = c.header.length;
      for (const a of rows) longest = Math.max(longest, displayText(a, c.key).length);
      ws.getColumn(i + 1).width = Math.min(Math.max(longest + 3, 10), 60);
    });
  }

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
