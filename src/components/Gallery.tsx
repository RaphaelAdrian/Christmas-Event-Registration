"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import styles from "./Gallery.module.css";

export type GalleryItem = { id: string; url: string; caption: string; width: number | null; height: number | null };

/** How many photos the sheet shows: counts that tile evenly on two and four columns. */
function sheetSize(count: number) {
  if (count >= 9) return 9;
  if (count >= 5) return 5;
  if (count >= 3) return 3;
  return count;
}

/**
 * A contact sheet: a large first photo and a grid of frames, the last one
 * saying how many more there are. Tapping one opens it large in a dialog;
 * arrow keys, the on-screen buttons or a swipe move through all of them,
 * Escape closes.
 */
export function Gallery({ photos, title, headingId }: { photos: GalleryItem[]; title: string; headingId: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState<number | null>(null);
  // Photos whose resized copy failed (e.g. a slow link to Storage); they load the original instead
  const [direct, setDirect] = useState<Set<string>>(new Set());
  const loadOriginal = (id: string) => setDirect((s) => (s.has(id) ? s : new Set(s).add(id)));
  const swipeStart = useRef<number | null>(null);
  const count = photos.length;

  const open = (i: number) => {
    setIndex(i);
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();
  const step = useCallback((by: number) => setIndex((i) => (i === null ? i : (i + by + count) % count)), [count]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    const onClose = () => setIndex(null);
    dialog.addEventListener("keydown", onKey);
    dialog.addEventListener("close", onClose);
    return () => {
      dialog.removeEventListener("keydown", onKey);
      dialog.removeEventListener("close", onClose);
    };
  }, [step]);

  const current = index === null ? null : photos[index];
  const shown = photos.slice(0, sheetSize(count));
  const more = count - shown.length;

  return (
    <>
      <div className={styles.sheet}>
        <div className={styles.head} data-reveal>
          <h2 id={headingId} className={styles.title}>
            {title} <span className={styles.count}>{count}</span>
          </h2>
          <p className={styles.hint}>Tap a photo to see it full size.</p>
        </div>
        <ul className={styles.grid} data-size={shown.length} data-reveal>
          {shown.map((p, i) => {
            const last = i === shown.length - 1 && more > 0;
            const label = `Open photo ${i + 1} of ${count}${p.caption ? `: ${p.caption}` : ""}${last ? `, and ${more} more` : ""}`;
            return (
              <li key={p.id} className={styles.frame}>
                <button type="button" className={styles.open} onClick={() => open(i)} aria-label={label}>
                  <Image
                    src={p.url}
                    alt=""
                    fill
                    sizes={i === 0 ? "(max-width: 760px) 100vw, 50vw" : "(max-width: 760px) 50vw, 25vw"}
                    className={styles.thumb}
                    unoptimized={direct.has(p.id)}
                    onError={() => loadOriginal(p.id)}
                  />
                  {last ? (
                    <span className={styles.more} aria-hidden="true">
                      +{more}
                      <span className={styles.moreWord}>more</span>
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <dialog
        ref={dialogRef}
        className={styles.lightbox}
        aria-label="Photo viewer"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        onPointerDown={(e) => {
          swipeStart.current = e.clientX;
        }}
        onPointerUp={(e) => {
          if (swipeStart.current === null) return;
          const dx = e.clientX - swipeStart.current;
          swipeStart.current = null;
          if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
        }}
      >
        {current ? (
          <figure className={styles.figure}>
            <div className={styles.stage}>
              <Image
                key={current.id}
                src={current.url}
                alt={current.caption || `Photo ${index! + 1} of ${count}`}
                fill
                sizes="100vw"
                className={styles.full}
                draggable={false}
                unoptimized={direct.has(`full-${current.id}`)}
                onError={() => loadOriginal(`full-${current.id}`)}
              />
            </div>
            <figcaption className={styles.caption}>
              <span>{current.caption}</span>
              <span className="tabular">
                {index! + 1} of {count}
              </span>
            </figcaption>
          </figure>
        ) : null}
        <div className={styles.controls}>
          <button type="button" className={styles.control} onClick={() => step(-1)} aria-label="Previous photo">
            <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
              <path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
          <button type="button" className={styles.control} onClick={() => step(1)} aria-label="Next photo">
            <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
              <path d="M9 4l8 8-8 8" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
          <button type="button" className={styles.closeButton} onClick={close}>
            Close
          </button>
        </div>
      </dialog>
    </>
  );
}
