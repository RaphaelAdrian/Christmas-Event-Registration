"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { EVENT_TAG } from "@/lib/event";
import { createServiceClient } from "@/lib/supabase/service";
import {
  detailSchema,
  eventSettingsSchema,
  fieldErrors,
  paymentSettingsSchema,
  type EventSettingsInput,
} from "@/lib/validation";

export type SaveResult = { ok: boolean; message: string; fieldErrors?: Record<string, string> };

function refreshPublic() {
  revalidateTag(EVENT_TAG);
  revalidatePath("/", "layout");
}

/** "2026-12-12" + "15:00" in Philippine time, as an ISO moment. */
function manila(date: string, time: string) {
  return new Date(`${date}T${time}:00+08:00`);
}

/** Saves the event facts. An end time at or before the start time means the next day (e.g. 3 PM to 12 midnight). */
export async function saveEventSettings(input: EventSettingsInput): Promise<SaveResult> {
  const { supabase, user } = await requireAdmin();
  const parsed = eventSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Some fields need fixing.", fieldErrors: fieldErrors(parsed.error) };
  const s = parsed.data;

  const start = manila(s.date, s.startTime);
  const end = manila(s.date, s.endTime);
  if (end <= start) end.setUTCDate(end.getUTCDate() + 1);
  if (Number.isNaN(start.getTime())) return { ok: false, message: "Check the date.", fieldErrors: { date: "Pick a real date." } };

  const { error } = await supabase
    .from("event_settings")
    .update({
      name: s.name,
      short_name: s.shortName,
      tagline: s.tagline,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      venue_name: s.venueName,
      venue_address: s.venueAddress,
      map_url: s.mapUrl,
      call_time: s.callTime,
      shuttle_info: s.shuttleInfo,
      organizer: s.organizer,
      contact_email: s.contactEmail,
      reference_prefix: s.referencePrefix,
      registration_open: s.registrationOpen,
      invite_only: s.inviteOnly,
      terms: s.terms,
      privacy_notice: s.privacyNotice,
      updated_by: user.email?.toLowerCase() ?? null,
    })
    .eq("id", 1);
  if (error) {
    console.error("save event settings failed", error.message);
    return { ok: false, message: "Couldn't save. Try again." };
  }
  refreshPublic();
  return { ok: true, message: "Saved. The website shows the new details now." };
}

/** Replaces the additional details with this list, in this order. */
export async function saveDetails(items: { id?: string; title: string; body: string }[]): Promise<SaveResult> {
  const { supabase } = await requireAdmin();
  if (!Array.isArray(items) || items.length > 50) return { ok: false, message: "Keep it to 50 details or fewer." };

  const clean: { id?: string; title: string; body: string }[] = [];
  for (const [i, item] of items.entries()) {
    const parsed = detailSchema.safeParse(item);
    if (!parsed.success) return { ok: false, message: `Detail ${i + 1}: ${parsed.error.issues[0]!.message}` };
    clean.push(parsed.data);
  }

  const { data: existing, error: readError } = await supabase.from("event_details").select("id");
  if (readError) return { ok: false, message: "Couldn't save. Try again." };
  const keep = new Set(clean.map((c) => c.id).filter(Boolean));
  const remove = (existing ?? []).map((r) => r.id as string).filter((id) => !keep.has(id));
  if (remove.length) {
    const { error } = await supabase.from("event_details").delete().in("id", remove);
    if (error) return { ok: false, message: "Couldn't remove a detail. Try again." };
  }

  for (const [position, item] of clean.entries()) {
    const row = { title: item.title, body: item.body, position };
    const { error } = item.id
      ? await supabase.from("event_details").update(row).eq("id", item.id)
      : await supabase.from("event_details").insert(row);
    if (error) {
      console.error("save detail failed", error.message);
      return { ok: false, message: `Couldn't save "${item.title}". Try again.` };
    }
  }
  refreshPublic();
  return { ok: true, message: clean.length ? "Details saved." : "All details removed." };
}

/**
 * Saves the amount and instructions, and the QR image when a new one was
 * uploaded (the old image is then deleted). Approved registrants see these.
 */
export async function savePaymentSettings(input: {
  amount: string;
  instructions: string;
  qrPath?: string | null;
}): Promise<SaveResult> {
  const { supabase, user } = await requireAdmin();
  const parsed = paymentSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Some fields need fixing.", fieldErrors: fieldErrors(parsed.error) };

  const { data: current } = await supabase.from("payment_settings").select("qr_path").eq("id", 1).maybeSingle();
  const update: Record<string, unknown> = {
    amount: parsed.data.amount,
    instructions: parsed.data.instructions,
    updated_by: user.email?.toLowerCase() ?? null,
  };

  const newQr = input.qrPath ?? null;
  if (newQr !== null && newQr !== current?.qr_path) {
    if (!/^qr\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(newQr)) return { ok: false, message: "Upload the QR image again." };
    update.qr_path = newQr;
  }

  const { error } = await supabase.from("payment_settings").update(update).eq("id", 1);
  if (error) {
    console.error("save payment settings failed", error.message);
    return { ok: false, message: "Couldn't save. Try again." };
  }
  if (update.qr_path && current?.qr_path) {
    await createServiceClient().storage.from("event-private").remove([current.qr_path as string]);
  }
  revalidatePath("/account");
  revalidatePath("/admin/event");
  return { ok: true, message: "Payment details saved. Approved guests see them on their page." };
}
