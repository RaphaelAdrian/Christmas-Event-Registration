"use client";

import { CopyButton, ShareButton } from "./ShareTools";

export type DraftMessage = { to: string; subject: string; body: string };

/**
 * A ready-made message: open it in the admin's own email app with the
 * address, subject and text filled in, copy it for Messenger or Viber, or
 * share it from a phone. Nothing is sent by the website.
 */
export function MessageDraft({ draft, label = "message" }: { draft: DraftMessage; label?: string }) {
  const mailto = `mailto:${encodeURIComponent(draft.to)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
  const plain = `${draft.subject}\n\n${draft.body}`;
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 8 }}>
      <a href={mailto} className="btn btn-small">
        Email the {label}
      </a>
      <CopyButton text={plain} label={`Copy the ${label}`} />
      <ShareButton title={draft.subject} text={plain} />
    </span>
  );
}
