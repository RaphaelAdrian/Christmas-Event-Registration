"use server";

import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";
import { IMAGE_TYPES } from "@/lib/validation";

const LIMITS = {
  gallery: { bucket: "gallery", folder: "", maxBytes: 10 * 1024 * 1024 },
  qr: { bucket: "event-private", folder: "qr/", maxBytes: 5 * 1024 * 1024 },
} as const;

export type UploadKind = keyof typeof LIMITS;

/** Gives an admin's browser a one-time link to upload one image straight into Storage. */
export async function prepareAdminUpload(
  kind: UploadKind,
  file: { type: string; size: number },
): Promise<{ ok: true; path: string; token: string; bucket: string } | { ok: false; error: string }> {
  await requireAdmin();
  const limit = LIMITS[kind];
  if (!limit) return { ok: false, error: "Unknown upload." };
  const ext = IMAGE_TYPES[file.type];
  if (!ext || (kind === "qr" && ext === "avif")) return { ok: false, error: "Choose a JPG, PNG or WEBP image." };
  if (file.size > limit.maxBytes) return { ok: false, error: `That image is over ${limit.maxBytes / 1024 / 1024} MB. Use a smaller one.` };

  const path = `${limit.folder}${randomUUID()}.${ext}`;
  const { data, error } = await createServiceClient().storage.from(limit.bucket).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "Couldn't start the upload. Try again." };
  return { ok: true, path: data.path, token: data.token, bucket: limit.bucket };
}
