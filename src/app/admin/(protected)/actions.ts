"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { REGISTRATION_LABELS, type RegistrationStatus } from "@/lib/statuses";
import { inviteSchema } from "@/lib/validation";
import { parseCsv, parseXlsx, rowsToInvites } from "@/lib/invite-import";
import { lastNameKey, nameKey } from "@/lib/names";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refresh() {
  revalidatePath("/admin", "layout");
}

export type InviteState = { error: string; message: string; key: number };

type Person = { first_name: string; last_name: string; email: string | null; registration_status: RegistrationStatus };
type Supabase = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

/** Everyone already in the table, to spot duplicates by email or by name. */
async function loadPeople(supabase: Supabase): Promise<Person[] | null> {
  const people: Person[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("attendees")
      .select("first_name, last_name, email, registration_status")
      .range(from, from + 999);
    if (error) return null;
    people.push(...((data ?? []) as Person[]));
    if (!data || data.length < 1000) return people;
  }
}

/** Keys that identify a person: their exact name, and their email when they have one. */
function personKeys(first: string, last: string, email: string | null) {
  const keys = [`name:${nameKey(first)}|${lastNameKey(last)}`];
  if (email) keys.push(`email:${email}`);
  return keys;
}

function indexPeople(people: Person[]) {
  const index = new Map<string, Person>();
  for (const p of people) for (const k of personKeys(p.first_name, p.last_name, p.email)) index.set(k, p);
  return index;
}

function findDuplicate(index: Map<string, Person>, person: { firstName: string; lastName: string; email: string }) {
  for (const k of personKeys(person.firstName, person.lastName, person.email || null)) {
    const hit = index.get(k);
    if (hit) return hit;
  }
  return undefined;
}

/** Add one person to the invite list (first and last name; email optional). */
export async function addInvite(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const { supabase } = await requireAdmin();
  const parsed = inviteSchema.safeParse({
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    email: String(formData.get("email") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]!.message, message: "", key: Date.now() };
  const person = parsed.data;
  const name = `${person.firstName} ${person.lastName}`;

  const people = await loadPeople(supabase);
  if (!people) return { error: "Couldn't check the existing list. Try again.", message: "", key: Date.now() };
  const dup = findDuplicate(indexPeople(people), person);
  if (dup) {
    const who = `${dup.first_name} ${dup.last_name}`.trim() || dup.email;
    return {
      error: `Already on the list: ${who} (${REGISTRATION_LABELS[dup.registration_status]}).`,
      message: "",
      key: Date.now(),
    };
  }

  const { error } = await supabase.from("attendees").insert({
    first_name: person.firstName,
    last_name: person.lastName,
    email: person.email || null,
    registration_status: "invited",
  });
  if (error) return { error: "Couldn't add that person. Try again.", message: "", key: Date.now() };

  refresh();
  return { error: "", message: `Added ${name} to the invite list.`, key: Date.now() };
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

/** Import an Excel (.xlsx) or CSV file: First name, Last name, Email (optional), or one Name column. */
export async function importInvites(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const { supabase } = await requireAdmin();
  const empty: ImportState = { error: "", added: 0, alreadyListed: 0, repeated: 0, invalidRows: [], done: false };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ...empty, error: "Choose an Excel (.xlsx) or CSV file first." };
  if (file.size > MAX_IMPORT_BYTES) return { ...empty, error: "That file is over 2 MB. Split it into smaller files." };

  const fileName = file.name.toLowerCase();
  let rows: string[][];
  try {
    if (fileName.endsWith(".csv") || fileName.endsWith(".txt")) rows = parseCsv(await file.text());
    else if (fileName.endsWith(".xlsx")) rows = await parseXlsx(await file.arrayBuffer());
    else return { ...empty, error: "Use an .xlsx or .csv file. Old .xls files: open in Excel and save as .xlsx." };
  } catch {
    return { ...empty, error: "Couldn't read that file. Save it again as .xlsx or .csv and retry." };
  }

  const imported = rowsToInvites(rows);
  if (!imported.length) {
    return {
      ...empty,
      error: "No names found. Use columns named First name and Last name (Email is optional), or one Name column.",
    };
  }

  const people = await loadPeople(supabase);
  if (!people) return { ...empty, error: "Couldn't check the existing list. Try again." };

  const existing = indexPeople(people);
  const inFile = new Map<string, Person>();
  const invalidRows: number[] = [];
  const fresh: { firstName: string; lastName: string; email: string }[] = [];
  let repeated = 0;
  let alreadyListed = 0;
  for (const r of imported) {
    const parsed = inviteSchema.safeParse({ firstName: r.first, lastName: r.last, email: r.email });
    if (!parsed.success) {
      invalidRows.push(r.row);
      continue;
    }
    if (findDuplicate(inFile, parsed.data)) {
      repeated++;
      continue;
    }
    if (findDuplicate(existing, parsed.data)) {
      alreadyListed++;
      continue;
    }
    const p = parsed.data;
    const person: Person = { first_name: p.firstName, last_name: p.lastName, email: p.email || null, registration_status: "invited" };
    for (const k of personKeys(p.firstName, p.lastName, p.email || null)) inFile.set(k, person);
    fresh.push(p);
  }

  const toInsert = fresh.map((p) => ({
    first_name: p.firstName,
    last_name: p.lastName,
    email: p.email || null,
    registration_status: "invited" as const,
  }));

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
    alreadyListed,
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
    .eq("registration_status", "invited")
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Only people who haven't registered can be removed." };
  refresh();
  return { ok: true };
}
