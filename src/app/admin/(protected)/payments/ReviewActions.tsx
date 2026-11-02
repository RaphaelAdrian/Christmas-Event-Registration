"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageDraft } from "@/components/MessageDraft";
import { markPaid, rejectPayment, type ReviewResult } from "./actions";
import styles from "../../admin.module.css";

/** Mark Paid in one click, or Reject with a reason the registrant will see. */
export function ReviewActions({ submissionId, name }: { submissionId: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<ReviewResult | null>(null);

  // The list isn't refreshed straight away, so the ready-made message stays on screen
  const finish = (res: ReviewResult) => setResult(res);

  if (result?.ok) {
    return (
      <div className={styles.reviewActions}>
        <div className={styles.resultRow} role="status">
          <span className={styles.okText}>{result.message}</span>
          {result.draft ? <MessageDraft draft={result.draft} /> : null}
        </div>
        <button type="button" className="text-button" onClick={() => router.refresh()}>
          Done, update the list
        </button>
      </div>
    );
  }

  return (
    <div className={styles.reviewActions}>
      {!rejecting ? (
        <div className={styles.rowActions} style={{ justifyContent: "flex-start" }}>
          <button
            type="button"
            className="btn"
            disabled={pending}
            aria-busy={pending}
            onClick={() => startTransition(async () => finish(await markPaid(submissionId)))}
          >
            {pending ? "Saving…" : "Mark paid"}
          </button>
          <button type="button" className="btn btn-quiet" disabled={pending} onClick={() => setRejecting(true)}>
            Reject
          </button>
        </div>
      ) : (
        <form
          className={styles.rejectForm}
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => finish(await rejectPayment(submissionId, reason)));
          }}
        >
          <div className="field">
            <label className="label" htmlFor={`reason-${submissionId}`}>
              Reason {name} will see
            </label>
            <textarea
              id={`reason-${submissionId}`}
              className="textarea"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder="For example: the amount is short by ₱100, or the receipt is too blurry to read."
              required
            />
          </div>
          <div className={styles.rowActions} style={{ justifyContent: "flex-start" }}>
            <button type="submit" className="btn btn-danger" disabled={pending || !reason.trim()} aria-busy={pending}>
              {pending ? "Saving…" : "Reject payment"}
            </button>
            <button type="button" className="btn btn-quiet" disabled={pending} onClick={() => setRejecting(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {result ? (
        <div className={styles.resultRow} role="status">
          <span className={result.ok ? styles.okText : "error"}>{result.message}</span>
          {result.draft ? <MessageDraft draft={result.draft} /> : null}
        </div>
      ) : null}
    </div>
  );
}
