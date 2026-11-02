"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { IMAGE_TYPES } from "@/lib/validation";
import { prepareAdminUpload } from "../uploads";
import { addGalleryPhoto, deletePhoto, movePhoto, updateCaption } from "./actions";
import styles from "../../admin.module.css";

type Photo = { id: string; caption: string; url: string };

async function imageSize(file: File): Promise<{ width: number; height: number }> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return { width: 0, height: 0 };
  }
}

export function GalleryManager({ photos }: { photos: Photo[] }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [captions, setCaptions] = useState<Record<string, string>>(() => Object.fromEntries(photos.map((p) => [p.id, p.caption])));
  const [pending, startTransition] = useTransition();

  async function onFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    setUploading(true);
    const problems: string[] = [];
    let added = 0;
    for (const [i, file] of files.entries()) {
      setStatus(`Uploading ${i + 1} of ${files.length}…`);
      if (!IMAGE_TYPES[file.type]) {
        problems.push(`${file.name}: use JPG, PNG, WEBP or AVIF`);
        continue;
      }
      const prepared = await prepareAdminUpload("gallery", { type: file.type, size: file.size });
      if (!prepared.ok) {
        problems.push(`${file.name}: ${prepared.error}`);
        continue;
      }
      const { error } = await createBrowserSupabase()
        .storage.from(prepared.bucket)
        .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
      if (error) {
        problems.push(`${file.name}: the upload didn't finish`);
        continue;
      }
      const size = await imageSize(file);
      const res = await addGalleryPhoto({ path: prepared.path, ...size, caption: "" });
      if (res.ok) added++;
      else problems.push(`${file.name}: ${res.message}`);
    }
    setUploading(false);
    setStatus(
      [added ? `${added} photo${added === 1 ? "" : "s"} added.` : "", problems.length ? `Not added: ${problems.join("; ")}.` : ""]
        .filter(Boolean)
        .join(" "),
    );
    router.refresh();
  }

  const act = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (res.message) setStatus(res.message);
      router.refresh();
    });

  return (
    <>
      <div className={styles.formBlock}>
        <label className={styles.filePick}>
          <input
            type="file"
            multiple
            className={styles.fileInput}
            accept="image/jpeg,image/png,image/webp,image/avif"
            disabled={uploading}
            aria-describedby="gallery-status"
            onChange={(e) => {
              void onFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <span className={styles.filePickTitle}>{uploading ? "Uploading…" : "Upload photos"}</span>
          <span className={styles.filePickMeta}>JPG, PNG, WEBP or AVIF, up to 10 MB each. Landscape or portrait.</span>
        </label>
        <p id="gallery-status" className={styles.okText} aria-live="polite">
          {status}
        </p>
      </div>

      {photos.length ? (
        <ol className={styles.galleryGrid}>
          {photos.map((p, i) => (
            <li key={p.id} className={styles.galleryItem}>
              <div className={styles.galleryThumb}>
                <Image src={p.url} alt={p.caption || `Photo ${i + 1}`} fill sizes="260px" />
              </div>
              <form
                className={styles.rejectForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  act(() => updateCaption(p.id, captions[p.id] ?? ""));
                }}
              >
                <div className="field">
                  <label className="label" htmlFor={`caption-${p.id}`}>
                    Caption
                  </label>
                  <input
                    id={`caption-${p.id}`}
                    className="input"
                    maxLength={200}
                    value={captions[p.id] ?? ""}
                    onChange={(e) => setCaptions((c) => ({ ...c, [p.id]: e.target.value }))}
                  />
                </div>
                <div className={styles.detailControls}>
                  <button type="submit" className="btn btn-small" disabled={pending || (captions[p.id] ?? "") === p.caption}>
                    Save caption
                  </button>
                </div>
              </form>
              <div className={styles.detailControls}>
                <button type="button" className="btn btn-small btn-quiet" disabled={pending || i === 0} onClick={() => act(() => movePhoto(p.id, -1))}>
                  Earlier<span className="visually-hidden">: photo {i + 1}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-small btn-quiet"
                  disabled={pending || i === photos.length - 1}
                  onClick={() => act(() => movePhoto(p.id, 1))}
                >
                  Later<span className="visually-hidden">: photo {i + 1}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-small btn-danger"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm("Delete this photo from the gallery?")) act(() => deletePhoto(p.id));
                  }}
                >
                  Delete<span className="visually-hidden">: photo {i + 1}</span>
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className={styles.empty}>
          <p>No photos yet. The gallery section stays hidden on the website until you add one.</p>
        </div>
      )}
    </>
  );
}
