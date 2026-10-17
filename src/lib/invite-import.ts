import "server-only";
import ExcelJS from "exceljs";
import { splitFullName } from "@/lib/names";

export type ImportedRow = { row: number; first: string; last: string; email: string };

/** Minimal CSV parser: commas or semicolons, quoted fields, "" escapes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]!;
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text; // hyperlink
    if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((r) => r.text).join("");
    if ("result" in value && value.result != null) return String(value.result); // formula
  }
  return "";
}

export async function parseXlsx(buffer: ArrayBuffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const values: string[] = [];
    for (let c = 1; c <= Math.min(ws.columnCount, 30); c++) values.push(cellText(row.getCell(c).value).trim());
    rows.push(values);
  });
  return rows;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Finds the first name, last name and (optional) email columns, by header or
 * by looking at the data, and returns one entry per non-empty row.
 * Accepted headers: "First name" / "Given name", "Last name" / "Surname" /
 * "Family name", "Email" / "E-mail", or a single "Name" / "Full name" column
 * (split into first and last name: "Juan dela Cruz" -> Juan / dela Cruz).
 */
export function rowsToInvites(rows: string[][]): ImportedRow[] {
  const trimmed = rows.map((r) => r.map((c) => (c ?? "").trim()));
  const nonEmpty = trimmed.filter((r) => r.some((c) => c));
  if (!nonEmpty.length) return [];

  const first = trimmed.findIndex((r) => r.some((c) => c));
  const head = trimmed[first]!.map((c) => c.toLowerCase());
  const looksLikeHeader =
    !head.some((c) => EMAIL_RE.test(c)) &&
    head.some((c) => /e-?mail|first|given|last|sur ?name|family|^name$|full ?name/.test(c));

  let emailCol = -1;
  let firstCol = -1;
  let lastCol = -1;
  let nameCol = -1;

  if (looksLikeHeader) {
    emailCol = head.findIndex((c) => /e-?mail/.test(c));
    firstCol = head.findIndex((c) => /first|given/.test(c));
    lastCol = head.findIndex((c) => /last|sur ?name|family/.test(c));
    if (firstCol === -1 || lastCol === -1) {
      nameCol = head.findIndex((c) => /^(full ?name|name|attendee|guest|invitee)$/.test(c));
      if (nameCol === -1) nameCol = head.findIndex((c, i) => i !== emailCol && /name/.test(c));
    }
  } else {
    const width = Math.max(...nonEmpty.map((r) => r.length));
    let best = 0;
    for (let c = 0; c < width; c++) {
      const hits = nonEmpty.filter((r) => EMAIL_RE.test(r[c] ?? "")).length;
      if (hits > best) {
        best = hits;
        emailCol = c;
      }
    }
    const textCols: number[] = [];
    for (let c = 0; c < width; c++) {
      if (c !== emailCol && nonEmpty.some((r) => (r[c] ?? "") !== "")) textCols.push(c);
    }
    if (textCols.length >= 2) {
      firstCol = textCols[0]!;
      lastCol = textCols[1]!;
    } else if (textCols.length === 1) {
      nameCol = textCols[0]!;
    }
  }

  if (firstCol === -1 && lastCol === -1 && nameCol === -1) return [];

  const out: ImportedRow[] = [];
  trimmed.forEach((r, i) => {
    if (looksLikeHeader && i <= first) return;
    if (!r.some((c) => c)) return;
    let firstName = firstCol >= 0 ? (r[firstCol] ?? "") : "";
    let lastName = lastCol >= 0 ? (r[lastCol] ?? "") : "";
    if (nameCol >= 0 && (!firstName || !lastName)) {
      const split = splitFullName(r[nameCol] ?? "");
      firstName = firstName || split.first;
      lastName = lastName || split.last;
    }
    const email = emailCol >= 0 ? (r[emailCol] ?? "").replace(/^mailto:/i, "").trim().toLowerCase() : "";
    out.push({ row: i + 1, first: firstName.slice(0, 100), last: lastName.slice(0, 100), email });
  });
  return out;
}
