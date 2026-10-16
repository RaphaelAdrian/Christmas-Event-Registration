import "server-only";
import ExcelJS from "exceljs";

export type ImportedRow = { row: number; name: string; email: string };

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

/** Finds the name and email columns (by header, or by looking at the data) and returns the rows. */
export function rowsToInvites(rows: string[][]): ImportedRow[] {
  const trimmed = rows.map((r) => r.map((c) => (c ?? "").trim()));
  const nonEmpty = trimmed.filter((r) => r.some((c) => c));
  if (!nonEmpty.length) return [];

  const first = trimmed.findIndex((r) => r.some((c) => c));
  const head = trimmed[first]!.map((c) => c.toLowerCase());
  const hasHeader = head.some((c) => /e-?mail/.test(c)) && !head.some((c) => EMAIL_RE.test(c));

  let emailCol = -1;
  let nameCol = -1;
  let firstNameCol = -1;
  let lastNameCol = -1;

  if (hasHeader) {
    emailCol = head.findIndex((c) => /e-?mail/.test(c));
    nameCol = head.findIndex((c) => /^(full\s*name|name|attendee|guest|invitee)$/.test(c));
    if (nameCol === -1) nameCol = head.findIndex((c, i) => i !== emailCol && /name/.test(c) && !/first|last|given|sur|family|company/.test(c));
    firstNameCol = head.findIndex((c) => /first|given/.test(c));
    lastNameCol = head.findIndex((c) => /last|sur|family/.test(c));
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
    for (let c = 0; c < width; c++) {
      if (c !== emailCol && nonEmpty.some((r) => (r[c] ?? "") !== "")) {
        nameCol = c;
        break;
      }
    }
  }

  if (emailCol === -1) return [];

  const out: ImportedRow[] = [];
  trimmed.forEach((r, i) => {
    if (hasHeader && i <= first) return;
    if (!r.some((c) => c)) return;
    let name = nameCol >= 0 ? (r[nameCol] ?? "") : "";
    if (!name && (firstNameCol >= 0 || lastNameCol >= 0)) {
      name = [firstNameCol >= 0 ? r[firstNameCol] : "", lastNameCol >= 0 ? r[lastNameCol] : ""].filter(Boolean).join(" ");
    }
    const email = (r[emailCol] ?? "").replace(/^mailto:/i, "").trim().toLowerCase();
    out.push({ row: i + 1, name: name.slice(0, 100), email });
  });
  return out;
}
