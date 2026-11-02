"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { EVENT_TAG } from "@/lib/event";
import { createServiceClient } from "@/lib/supabase/service";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH_RE = /^[0-9a-f-]{36}\.(jpg|png|webp|avif)$/;

export type GalleryResult = { ok: boolean; message: string };

function refresh() {
  revalidateTag(EVENT_TAG);
  revalidatePath("/");
  revalidatePath("/admin/gallery");
}

/** Adds an uploaded photo to the end of the gallery. */
export async function addGalleryPhoto(input: { path: string; width: number; height: number; caption: string }): Promise<GalleryResult> {
  const { supabase } = await requireAdmin();
  if (!PATH_RE.test(input.path)) return { ok: false, message: "Upload the photo again." };
  const { data: last } = await supabase.from("gallery_photos").select("position").order("position", { ascending: false }).limit(1);
  const position = ((last?.[0]?.position as number | undefined) ?? -1) + 1;
  const size = (n: number) => (Number.isInteger(n) && n > 0 && n < 100000 ? n : null);
  const { error } = await supabase.from("gallery_photos").insert({
    storage_path: input.path,
    caption: input.caption.trim().slice(0, 200),
    width: size(input.width),
    height: size(input.height),
    position,
  });
  if (error) {
    console.error("add photo failed", error.message);
    return { ok: false, message: "Couldn't add the photo. Try again." };
  }
  refresh();
  return { ok: true, message: "Photo added." };
}

export async function updateCaption(id: string, caption: string): Promise<GalleryResult> {
  const { supabase } = await requireAdmin();
  if (!UUID_RE.test(id)) return { ok: false, message: "That photo wasn't found." };
  const { error } = await supabase.from("gallery_photos").update({ caption: caption.trim().slice(0, 200) }).eq("id", id);
  if (error) return { ok: false, message: "Couldn't save the caption." };
  refresh();
  return { ok: true, message: "Caption saved." };
}

/** Moves a photo one place earlier (-1) or later (+1) by swapping positions with its neighbour. */
export async function movePhoto(id: string, by: -1 | 1): Promise<GalleryResult> {
  const { supabase } = await requireAdmin();
  if (!UUID_RE.test(id)) return { ok: false, message: "That photo wasn't found." };
  const { data } = await supabase.from("gallery_photos").select("id, position").order("position").order("created_at");
  const list = (data ?? []) as { id: string; position: number }[];
  const i = list.findIndex((p) => p.id === id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= list.length) return { ok: true, message: "" };
  // Renumber the whole list so positions stay unique
  [list[i], list[j]] = [list[j]!, list[i]!];
  for (const [position, p] of list.entries()) {
    const { error } = await supabase.from("gallery_photos").update({ position }).eq("id", p.id);
    if (error) return { ok: false, message: "Couldn't reorder. Try again." };
  }
  refresh();
  return { ok: true, message: "" };
}

export async function deletePhoto(id: string): Promise<GalleryResult> {
  const { supabase } = await requireAdmin();
  if (!UUID_RE.test(id)) return { ok: false, message: "That photo wasn't found." };
  const { data, error } = await supabase.from("gallery_photos").delete().eq("id", id).select("storage_path");
  if (error || !data?.length) return { ok: false, message: "Couldn't delete the photo." };
  await createServiceClient().storage.from("gallery").remove([data[0]!.storage_path as string]);
  refresh();
  return { ok: true, message: "Photo deleted." };
}
