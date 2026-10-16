"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { isStatus, STATUS_LABELS, type AttendeeStatus } from "@/lib/statuses";
import { inviteSchema } from "@/lib/validation";
import { parseCsv, parseXlsx, rowsToInvites } from "@/lib/invite-import";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refresh() {
  revalidatePath("/admin");
  revalidatePath("/admin/invites");
}

/** Change one person's status (e.g. mark as Paid). */
export async function updateStatus(
  id: string,
  status: AttendeeStatus,
): Promise<{ ok: true; paidAt: string | null } | { ok: false; error: string }> {
  const { supabase } = await requireAdmin();
  if (!UUID_RE.test(id) || !isStatus(status)) return { ok: false, error: "That change isn't valid." };

  const { data, error } = await supabase
    .from("attendees")
    .update({ status })
    .eq("id", id)
    .select("id, paid_at")
    .maybeSingle();

  if (error || !data) return { ok: false, error: "Couldn't save the status. Reload the page and try again." };
  refresh();
  return { ok: true, paidAt: data.paid_at as string | null };
}

export type InviteState = { error: string; message: string; key: number };

/** Add one person to the invite list. */
export async function addInvite(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const { supabase } = await requireAdmin();
  const parsed = inviteSchema.safeParse({
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]!.message, message: "", key: Date.now() };

  const { data: existing } = await supabase
    .from("attendees")
    .select("status")
    .eq("email", parsed.data.email)
    .maybeSingle();
  if (existing) {
    return {
      error: `${parsed.data.email} is already on the list (${STATUS_LABELS[existing.status as AttendeeStatus]}).`,
      message: "",
      key: Date.now(),
    };
  }

  const { error } = await supabase
    .from("attendees")
    .insert({ full_name: parsed.data.fullName, email: parsed.data.email, status: "invited" });
  if (error) return { error: "Couldn't add that person. Try again.", message: "", key: Date.now() };

  refresh();
  return {
    error: "",
    message: `Added ${parsed.data.fullName || parsed.data.email} to the invite list.`,
    key: Date.now(),
  };
}

export type ImportState = {
  error: string;
  added: number;
  alreadyListed: number;
  repeated: number;
  invalidRows: number[];
  done: boolean;
};

const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

/** Import an Excel (.xlsx) or CSV file of names and emails. */
export async function importInvites(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const { supabase } = await requireAdmin();
  const empty: ImportState = { error: "", added: 0, alreadyListed: 0, repeated: 0, invalidRows: [], done: false };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ...empty, error: "Choose an Excel (.xlsx) or CSV file first." };
  if (file.size > MAX_IMPORT_BYTES) return { ...empty, error: "That file is over 2 MB. Split it into smaller files." };

  const name = file.name.toLowerCase();
  let rows: string[][];
  try {
    if (name.endsWith(".csv") || name.endsWith(".txt")) rows = parseCsv(await file.text());
    else if (name.endsWith(".xlsx")) rows = await parseXlsx(await file.arrayBuffer());
    else return { ...empty, error: "Use an .xlsx or .csv file. Old .xls files: open in Excel and save as .xlsx." };
  } catch {
    return { ...empty, error: "Couldn't read that file. Save it again as .xlsx or .csv and retry." };
  }

  const imported = rowsToInvites(rows);
  if (!imported.length) {
    return { ...empty, error: "No email addresses found. Put names in one column and emails in another." };
  }

  const invalidRows: number[] = [];
  const unique = new Map<string, string>();
  let repeated = 0;
  for (const r of imported) {
    const parsed = inviteSchema.safeParse({ fullName: r.name, email: r.email });
    if (!parsed.success) {
      invalidRows.push(r.row);
      continue;
    }
    if (unique.has(parsed.data.email)) {
      repeated++;
      continue;
    }
    unique.set(parsed.data.email, parsed.data.fullName);
  }

  const emails = [...unique.keys()];
  const existing = new Set<string>();
  for (let i = 0; i < emails.length; i += 200) {
    const { data, error } = await supabase.from("attendees").select("email").in("email", emails.slice(i, i + 200));
    if (error) return { ...empty, error: "Couldn't check the existing list. Try again." };
    for (const row of data ?? []) existing.add(row.email as string);
  }

  const toInsert = emails
    .filter((e) => !existing.has(e))
    .map((email) => ({ email, full_name: unique.get(email) ?? "", status: "invited" as const }));

  for (let i = 0; i < toInsert.length; i += 500) {
    const { error } = await supabase.from("attendees").insert(toInsert.slice(i, i + 500));
    if (error) {
      return {
        ...empty,
        error: `Stopped after adding ${i} people: ${error.message}. Fix the file and import again; people already added are skipped.`,
      };
    }
  }

  refresh();
  return {
    error: "",
    added: toInsert.length,
    alreadyListed: existing.size,
    repeated,
    invalidRows: invalidRows.slice(0, 50),
    done: true,
  };
}

/** Remove someone from the invite list (only if they haven't registered). */
export async function removeInvite(id: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requireAdmin();
  if (!UUID_RE.test(id)) return { ok: false, error: "That person wasn't found." };
  const { data, error } = await supabase
    .from("attendees")
    .delete()
    .eq("id", id)
    .eq("status", "invited")
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Only people who haven't registered can be removed." };
  refresh();
  return { ok: true };
}
