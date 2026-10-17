"use client";

import { useActionState, useState, useTransition } from "react";
import { addInvite, importInvites, removeInvite, type ImportState, type InviteState } from "../actions";
import styles from "../../admin.module.css";

export function AddInviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(addInvite, { error: "", message: "", key: 0 });

  return (
    // Re-mount after a successful add so the fields clear
    <form action={action} className={styles.inlineForm} key={state.message ? state.key : "form"} noValidate>
      <div className={styles.twoFields}>
        <div className="field">
          <label className="label" htmlFor="invite-first">
            First name
          </label>
          <input id="invite-first" name="firstName" className="input" autoComplete="off" required />
        </div>
        <div className="field">
          <label className="label" htmlFor="invite-last">
            Last name
          </label>
          <input id="invite-last" name="lastName" className="input" autoComplete="off" required />
        </div>
      </div>
      <div className="field">
        <label className="label" htmlFor="invite-email">
          Email <span className="label-optional">(optional)</span>
        </label>
        <input id="invite-email" name="email" type="email" className="input" autoComplete="off" />
      </div>
      <button type="submit" className="btn" disabled={pending}>
        {pending ? "Adding…" : "Add to invite list"}
      </button>
      <p className={state.error ? "error" : styles.okText} aria-live="polite">
        {state.error || state.message}
      </p>
    </form>
  );
}

const IMPORT_START: ImportState = { error: "", added: 0, alreadyListed: 0, repeated: 0, invalidRows: [], done: false };

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importInvites, IMPORT_START);
  const [fileName, setFileName] = useState("");

  return (
    <form action={action} className={styles.inlineForm}>
      <label className={styles.filePick}>
        <input
          type="file"
          name="file"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className={styles.fileInput}
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
        />
        <span className={styles.filePickTitle}>{fileName || "Choose a file"}</span>
        <span className={styles.filePickMeta}>.xlsx or .csv, up to 2 MB</span>
      </label>
      <button type="submit" className="btn" disabled={pending || !fileName}>
        {pending ? "Importing…" : "Import"}
      </button>
      <div aria-live="polite">
        {state.error ? <p className="error">{state.error}</p> : null}
        {state.done ? (
          <p className={styles.okText}>
            Added {state.added}. {state.alreadyListed ? `${state.alreadyListed} already on the list. ` : ""}
            {state.repeated ? `${state.repeated} repeated in the file. ` : ""}
            {state.invalidRows.length ? `Skipped rows with a missing or invalid email: ${state.invalidRows.join(", ")}.` : ""}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function InviteActions({
  id,
  firstName,
  lastName,
  email,
  canRemove,
}: {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  canRemove: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  async function copy() {
    const params = new URLSearchParams();
    if (firstName) params.set("first", firstName);
    if (lastName) params.set("last", lastName);
    if (email) params.set("email", email);
    const link = `${window.location.origin}/register?${params.toString()}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this invite link:", link);
    }
  }

  function remove() {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 4000);
      return;
    }
    startTransition(async () => {
      const res = await removeInvite(id);
      if (!res.ok) setError(res.error ?? "Couldn't remove.");
    });
  }

  return (
    <div className={styles.rowActions}>
      <button type="button" className="btn btn-quiet btn-small" onClick={copy}>
        {copied ? "Link copied" : "Copy invite link"}
      </button>
      {canRemove ? (
        <button type="button" className={`text-button ${styles.removeButton}`} onClick={remove} disabled={pending}>
          {pending ? "Removing…" : confirming ? "Tap again to remove" : "Remove"}
        </button>
      ) : null}
      {error ? <span className="error">{error}</span> : null}
    </div>
  );
}
