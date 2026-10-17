"use client";

import { useState, useTransition } from "react";
import { formatDateTimePH } from "@/lib/format";
import { STATUSES, STATUS_LABELS, type Attendee, type AttendeeStatus } from "@/lib/statuses";
import { updateStatus } from "./actions";
import styles from "../admin.module.css";

export function AttendeeTable({ rows }: { rows: Attendee[] }) {
  return (
    <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Attendees table, scrolls sideways">
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Reference</th>
            <th scope="col">Name</th>
            <th scope="col">Mobile</th>
            <th scope="col">Company</th>
            <th scope="col">Payment reference</th>
            <th scope="col">Receipt</th>
            <th scope="col">Registered</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <Row key={a.id} attendee={a} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ attendee: a }: { attendee: Attendee }) {
  const [status, setStatus] = useState<AttendeeStatus>(a.status);
  const [paidAt, setPaidAt] = useState<string | null>(a.paid_at);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function change(next: AttendeeStatus) {
    const previous = status;
    setStatus(next);
    setMessage(null);
    startTransition(async () => {
      const res = await updateStatus(a.id, next);
      if (res.ok) {
        setPaidAt(res.paidAt);
        setMessage({ kind: "ok", text: "Saved" });
        setTimeout(() => setMessage(null), 2500);
      } else {
        setStatus(previous);
        setMessage({ kind: "error", text: res.error });
      }
    });
  }

  return (
    <tr>
      <td className={styles.ref}>{a.reference_code ?? <span className={styles.muted}>None yet</span>}</td>
      <td className={styles.nameCell}>
        <span className={styles.name}>{a.full_name || <span className={styles.muted}>No name</span>}</span>
        {a.name_as_entered && a.name_as_entered.trim().toLowerCase() !== a.full_name.trim().toLowerCase() ? (
          <span className={styles.sub}>Registered as {a.name_as_entered}</span>
        ) : null}
        <span className={styles.sub}>{a.email ?? "No email yet"}</span>
        {a.job_title ? <span className={styles.sub}>{a.job_title}</span> : null}
      </td>
      <td className={styles.nowrap}>{a.mobile ?? ""}</td>
      <td>{a.company ?? ""}</td>
      <td className={styles.ref}>{a.payment_reference ?? ""}</td>
      <td>
        {a.receipt_path ? (
          <a className="btn btn-quiet btn-small" href={`/admin/receipts/${a.id}`} target="_blank" rel="noopener">
            View receipt
          </a>
        ) : (
          <span className={styles.muted}>None</span>
        )}
      </td>
      <td className={styles.nowrap}>
        {a.registered_at ? formatDateTimePH(a.registered_at) : <span className={styles.muted}>Not registered</span>}
        {paidAt && status === "paid" ? <span className={styles.sub}>Paid {formatDateTimePH(paidAt)}</span> : null}
      </td>
      <td>
        <label className="visually-hidden" htmlFor={`status-${a.id}`}>
          Status for {a.full_name || a.email || "this person"}
        </label>
        <select
          id={`status-${a.id}`}
          className={`select ${styles.statusSelect}`}
          data-status={status}
          value={status}
          disabled={pending}
          onChange={(e) => change(e.target.value as AttendeeStatus)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <span className={styles.saveState} aria-live="polite" data-kind={message?.kind}>
          {pending ? "Saving…" : (message?.text ?? "")}
        </span>
      </td>
    </tr>
  );
}
