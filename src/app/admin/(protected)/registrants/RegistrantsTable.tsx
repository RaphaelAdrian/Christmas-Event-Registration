"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDateTimePH } from "@/lib/format";
import { PAYMENT_LABELS, REGISTRATION_LABELS, type Attendee } from "@/lib/statuses";
import { MessageDraft } from "@/components/MessageDraft";
import { CopyButton } from "@/components/ShareTools";
import { approveRegistrants, declineRegistrants, passwordLink, recordDirectPayment, type BulkResult, type LinkResult } from "./actions";
import styles from "../../admin.module.css";

export function RegistrantsTable({ rows, signedIn }: { rows: Attendee[]; signedIn: Record<string, string | null> }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<BulkResult | null>(null);
  const [link, setLink] = useState<LinkResult | null>(null);
  const [declineIds, setDeclineIds] = useState<string[]>([]);
  const declineDialog = useRef<HTMLDialogElement>(null);
  const [paidTarget, setPaidTarget] = useState<Attendee | null>(null);
  const [paidNote, setPaidNote] = useState("");
  const paidDialog = useRef<HTMLDialogElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function run(ids: string[], action: () => Promise<BulkResult>) {
    setResult(null);
    setLink(null);
    setBusyIds(new Set(ids));
    startTransition(async () => {
      const res = await action();
      setResult(res);
      setBusyIds(new Set());
      setSelected(new Set());
      router.refresh();
      requestAnimationFrame(() => resultRef.current?.focus());
    });
  }

  const approve = (ids: string[]) => run(ids, () => approveRegistrants(ids));

  function askDecline(ids: string[]) {
    setDeclineIds(ids);
    declineDialog.current?.showModal();
  }

  function confirmDecline() {
    declineDialog.current?.close();
    const ids = declineIds;
    run(ids, () => declineRegistrants(ids));
  }

  function askPaid(r: Attendee) {
    setPaidTarget(r);
    setPaidNote("");
    paidDialog.current?.showModal();
  }

  function confirmPaid() {
    const target = paidTarget;
    paidDialog.current?.close();
    if (target) run([target.id], () => recordDirectPayment(target.id, paidNote));
  }

  function makeLink(id: string) {
    setResult(null);
    setLink(null);
    setBusyIds(new Set([id]));
    startTransition(async () => {
      setLink(await passwordLink(id));
      setBusyIds(new Set());
      router.refresh();
      requestAnimationFrame(() => resultRef.current?.focus());
    });
  }

  const ids = [...selected];

  return (
    <>
      {link ? (
        <div ref={resultRef} tabIndex={-1} className={styles.notice} role="status">
          {link.ok ? (
            <>
              <p>
                <strong>Reset password link for {link.name}</strong> ({link.email}). It works once and expires after the time
                set in Supabase. Send it only to them.
              </p>
              <input className="input" readOnly value={link.link} aria-label={`Reset password link for ${link.name}`} onFocus={(e) => e.target.select()} />
              <div className={styles.detailControls}>
                <CopyButton text={link.link} label="Copy link" />
                <MessageDraft draft={link.draft} />
              </div>
            </>
          ) : (
            <p className="error">{link.message}</p>
          )}
        </div>
      ) : null}

      {result ? (
        <div ref={resultRef} tabIndex={-1} className={styles.notice} role="status">
          {result?.stopped ? <p className="error">{result.stopped}</p> : null}
          {result?.results.length ? (
            <ul className={styles.resultList}>
              {result.results.map((r) => (
                <li key={r.id} className={styles.resultRow}>
                  <span className={r.ok ? "" : "error"}>
                    {r.name}: {r.message}
                  </span>
                  {r.draft ? <MessageDraft draft={r.draft} /> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Registrants, scrolls sideways">
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.checkCell}>
                <input
                  type="checkbox"
                  aria-label="Select everyone shown"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                />
              </th>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Registered</th>
              <th scope="col">Registration</th>
              <th scope="col">Payment</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const busy = busyIds.has(r.id);
              const login = signedIn[r.id];
              return (
                <tr key={r.id} data-selected={selected.has(r.id)}>
                  <td className={styles.checkCell}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.full_name}`}
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                    />
                  </td>
                  <td className={styles.nameCell}>
                    <span className={styles.name}>{r.full_name}</span>
                    {r.company ? <span className={styles.sub}>{r.company}</span> : null}
                    {r.name_as_entered && r.name_as_entered.toLowerCase() !== r.full_name.toLowerCase() ? (
                      <span className={styles.sub}>Registered as {r.name_as_entered}</span>
                    ) : null}
                  </td>
                  <td>{r.email}</td>
                  <td className={styles.nowrap}>{formatDateTimePH(r.registered_at)}</td>
                  <td>
                    <span className={styles.chip} data-status={r.registration_status}>
                      {REGISTRATION_LABELS[r.registration_status]}
                    </span>
                    <span className={styles.sub}>
                      {!r.user_id ? "No sign-in yet" : login ? "Has signed in" : "Hasn’t signed in yet"}
                    </span>
                  </td>
                  <td>
                    <span className={styles.chip} data-status={r.payment_status}>
                      {PAYMENT_LABELS[r.payment_status]}
                    </span>
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      {r.registration_status !== "approved" ? (
                        <button type="button" className="btn btn-small" disabled={pending} aria-busy={busy} onClick={() => approve([r.id])}>
                          {busy ? "Working…" : "Approve"}
                        </button>
                      ) : null}
                      {/* For someone who paid an organiser directly; a receipt waiting for review is handled on Payments */}
                      {r.registration_status !== "invited" && (r.payment_status === "unpaid" || r.payment_status === "rejected") ? (
                        <button type="button" className="btn btn-small btn-quiet" disabled={pending} onClick={() => askPaid(r)}>
                          Mark as paid
                        </button>
                      ) : null}
                      <button type="button" className="btn btn-small btn-quiet" disabled={pending} aria-busy={busy} onClick={() => makeLink(r.id)}>
                        Reset password link
                      </button>
                      {r.registration_status !== "declined" && r.payment_status !== "paid" ? (
                        <button type="button" className="btn btn-small btn-quiet" disabled={pending} onClick={() => askDecline([r.id])}>
                          Decline
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {ids.length ? (
        <div className={styles.bulkBar} role="region" aria-label="Selected registrants">
          <span>
            {ids.length} selected
          </span>
          <button type="button" className="btn btn-small" disabled={pending} onClick={() => approve(ids)}>
            Approve {ids.length}
          </button>
          <button type="button" className="btn btn-small btn-quiet" disabled={pending} onClick={() => askDecline(ids)}>
            Decline {ids.length}
          </button>
          <button type="button" className="text-button" onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </div>
      ) : null}

      {/* Hidden until a Decline button opens it */}
      <dialog ref={declineDialog} className={styles.confirmDialog} aria-labelledby="decline-title">
        <h2 id="decline-title" className={styles.sectionTitle}>
          Decline {declineIds.length === 1 ? "this registration" : `${declineIds.length} registrations`}?
        </h2>
        <p>They can still sign in, but they&rsquo;ll see they were declined and can&rsquo;t pay. People who have already paid are skipped.</p>
        <div className={styles.rowActions} style={{ justifyContent: "flex-start" }}>
          <button type="button" className="btn btn-danger" onClick={confirmDecline}>
            Decline
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => declineDialog.current?.close()}>
            Cancel
          </button>
        </div>
      </dialog>

      {/* Hidden until a Mark as paid button opens it */}
      <dialog ref={paidDialog} className={styles.confirmDialog} aria-labelledby="paid-title">
        <form
          className={styles.dialogForm}
          onSubmit={(e) => {
            e.preventDefault();
            confirmPaid();
          }}
        >
          <h2 id="paid-title" className={styles.sectionTitle}>
            Mark {paidTarget?.full_name || "them"} as paid?
          </h2>
          <p>For someone who paid you directly, in cash or by a transfer outside the site. It counts toward Collected, and their registration is approved.</p>
          <div className="field">
            <label className="label" htmlFor="paid-note">
              Note (optional)
            </label>
            <p className="hint" id="paid-note-hint">
              Only admins see it, for example &ldquo;Cash, 3 Dec&rdquo;.
            </p>
            <input
              id="paid-note"
              className="input"
              maxLength={100}
              value={paidNote}
              onChange={(e) => setPaidNote(e.target.value)}
              aria-describedby="paid-note-hint"
              autoComplete="off"
            />
          </div>
          <div className={styles.rowActions} style={{ justifyContent: "flex-start" }}>
            <button type="submit" className="btn">
              Mark as paid
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => paidDialog.current?.close()}>
              Cancel
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
