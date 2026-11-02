"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { prepareAdminUpload } from "../uploads";
import { savePaymentSettings, type SaveResult } from "./actions";
import styles from "../../admin.module.css";

/** The amount, instructions and QR image that approved guests see on their page. */
export function PaymentSettingsForm({
  initial,
  qrUrl,
}: {
  initial: { amount: string; instructions: string; qrPath: string | null };
  qrUrl: string | null;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(initial.amount);
  const [instructions, setInstructions] = useState(initial.instructions);
  const [qrPath, setQrPath] = useState<string | null>(initial.qrPath);
  const [preview, setPreview] = useState<string | null>(qrUrl);
  const [upload, setUpload] = useState<"" | "uploading" | "done" | string>("");
  const [result, setResult] = useState<SaveResult | null>(null);
  const [pending, startTransition] = useTransition();
  const fe = result?.fieldErrors ?? {};

  async function onQrChosen(file: File | undefined) {
    if (!file) return;
    setResult(null);
    setUpload("uploading");
    const prepared = await prepareAdminUpload("qr", { type: file.type, size: file.size });
    if (!prepared.ok) {
      setUpload(prepared.error);
      return;
    }
    const { error } = await createBrowserSupabase()
      .storage.from(prepared.bucket)
      .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
    if (error) {
      setUpload("The upload didn't finish. Try again.");
      return;
    }
    setQrPath(prepared.path);
    setPreview(URL.createObjectURL(file));
    setUpload("done");
  }

  return (
    <form
      className={styles.editorBlock}
      noValidate
      aria-labelledby="payment-heading"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await savePaymentSettings({ amount, instructions, qrPath });
          setResult(res);
          if (res.ok) router.refresh();
        });
      }}
    >
      <h2 id="payment-heading" className={styles.sectionTitle}>
        Payment
      </h2>
      <p className={styles.pageNote}>Only approved guests who are signed in can see these.</p>

      <div className={styles.editorGrid}>
        <div className="field">
          <label className="label" htmlFor="pay-amount">
            Amount in pesos
          </label>
          <input
            id="pay-amount"
            className="input"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            aria-invalid={Boolean(fe.amount)}
            aria-describedby={fe.amount ? "pay-amount-error" : undefined}
          />
          {fe.amount ? (
            <p className="error" id="pay-amount-error">
              {fe.amount}
            </p>
          ) : null}
        </div>

        <div className="field">
          <span className="label" id="qr-label">
            Payment QR code
          </span>
          {preview ? <Image src={preview} alt="Current payment QR code" width={200} height={200} unoptimized className={styles.qrPreview} /> : null}
          <label className={styles.filePick}>
            <input
              type="file"
              className={styles.fileInput}
              accept="image/png,image/jpeg,image/webp"
              aria-labelledby="qr-label"
              aria-describedby="qr-meta"
              onChange={(e) => void onQrChosen(e.target.files?.[0])}
            />
            <span className={styles.filePickTitle}>{preview ? "Replace the QR image" : "Upload the QR image"}</span>
            <span className={styles.filePickMeta} id="qr-meta" aria-live="polite">
              {upload === "uploading"
                ? "Uploading…"
                : upload === "done"
                  ? "Uploaded. Save to use it."
                  : upload || "PNG, JPG or WEBP, up to 5 MB."}
            </span>
          </label>
        </div>

        <div className={`field ${styles.full}`}>
          <label className="label" htmlFor="pay-instructions">
            Instructions
          </label>
          <p className="hint">How to pay, in plain steps. Leave a blank line between paragraphs.</p>
          <textarea id="pay-instructions" className="textarea" rows={6} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        </div>
      </div>

      <div className={styles.saveRow} style={{ position: "static", background: "transparent" }}>
        <button type="submit" className="btn" disabled={pending || upload === "uploading"} aria-busy={pending}>
          {pending ? "Saving…" : "Save payment details"}
        </button>
        {result ? (
          <p className={result.ok ? styles.okText : "error"} role="status">
            {result.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
