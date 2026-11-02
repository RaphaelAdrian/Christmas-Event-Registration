"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { fieldErrors, paymentSchema, receiptFileProblem } from "@/lib/validation";
import { prepareReceiptUpload, submitPayment } from "./actions";
import styles from "./account.module.css";

type Receipt = { name: string; size: number; status: "uploading" | "done"; path: string };

function fileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Reference number plus receipt upload. The receipt goes straight into the private bucket. */
export function PaymentForm({ resubmit }: { resubmit: boolean }) {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onReceiptChosen(file: File | undefined) {
    if (!file) return;
    setFormError("");
    const problem = receiptFileProblem(file);
    if (problem) {
      setErrors((e) => ({ ...e, receiptPath: problem }));
      return;
    }
    setErrors((e) => {
      const next = { ...e };
      delete next.receiptPath;
      return next;
    });
    setReceipt({ name: file.name, size: file.size, status: "uploading", path: "" });
    const prepared = await prepareReceiptUpload({ type: file.type, size: file.size });
    if (!prepared.ok) {
      setReceipt(null);
      setErrors((e) => ({ ...e, receiptPath: prepared.error }));
      return;
    }
    const { error } = await createBrowserSupabase()
      .storage.from("receipts")
      .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
    if (error) {
      setReceipt(null);
      setErrors((e) => ({ ...e, receiptPath: "The upload didn't finish. Check your connection and choose the file again." }));
      return;
    }
    setReceipt({ name: file.name, size: file.size, status: "done", path: prepared.path });
  }

  async function submit() {
    setFormError("");
    const input = { paymentReference: reference, receiptPath: receipt?.status === "done" ? receipt.path : "" };
    const parsed = paymentSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setBusy(true);
    const res = await submitPayment(parsed.data);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.error);
      if (res.fieldErrors) {
        setErrors(res.fieldErrors);
        if (res.fieldErrors.receiptPath) setReceipt(null);
      }
      return;
    }
    router.refresh();
  }

  return (
    <form
      className={styles.payForm}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h2 className={styles.formHeading}>{resubmit ? "Send your payment again" : "Send your payment"}</h2>
      {formError ? (
        <p className="notice" data-tone="error" role="alert">
          {formError}
        </p>
      ) : null}
      <div className="field">
        <label className="label" htmlFor="paymentReference">
          Reference number
        </label>
        <p className="hint" id="paymentReference-hint">
          The reference or transaction number on your receipt.
        </p>
        <input
          id="paymentReference"
          className="input"
          value={reference}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={64}
          onChange={(e) => {
            setReference(e.target.value);
            setErrors((e) => {
              const next = { ...e };
              delete next.paymentReference;
              return next;
            });
          }}
          aria-invalid={Boolean(errors.paymentReference)}
          aria-describedby={["paymentReference-hint", errors.paymentReference ? "paymentReference-error" : ""].filter(Boolean).join(" ")}
        />
        {errors.paymentReference ? (
          <p className="error" id="paymentReference-error">
            {errors.paymentReference}
          </p>
        ) : null}
      </div>

      <div className="field">
        <span className="label" id="receipt-label">
          Receipt
        </span>
        <label className={styles.drop} data-state={receipt?.status ?? "empty"} data-invalid={Boolean(errors.receiptPath)}>
          <input
            type="file"
            className={styles.dropInput}
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
            aria-labelledby="receipt-label"
            aria-describedby={["receipt-meta", errors.receiptPath ? "receipt-error" : ""].filter(Boolean).join(" ")}
            onChange={(e) => void onReceiptChosen(e.target.files?.[0])}
            disabled={busy || receipt?.status === "uploading"}
          />
          <span className={styles.dropTitle}>
            {receipt ? receipt.name : "Choose a screenshot or photo of your receipt"}
          </span>
          <span className={styles.dropMeta} id="receipt-meta" aria-live="polite">
            {receipt?.status === "uploading"
              ? "Uploading…"
              : receipt?.status === "done"
                ? `Uploaded, ${fileSize(receipt.size)}. Choose another file to replace it.`
                : "JPG, PNG, WEBP, HEIC or PDF, up to 5 MB."}
          </span>
        </label>
        {errors.receiptPath ? (
          <p className="error" id="receipt-error">
            {errors.receiptPath}
          </p>
        ) : null}
      </div>

      <button type="submit" className="btn btn-block" disabled={busy || receipt?.status === "uploading"} aria-busy={busy}>
        {busy ? "Sending…" : "Send payment for review"}
      </button>
    </form>
  );
}
