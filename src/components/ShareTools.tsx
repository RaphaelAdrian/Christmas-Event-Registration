"use client";

import { useEffect, useState } from "react";

/** Copies text to the clipboard and says so for two seconds. */
export function CopyButton({ text, label, className = "btn btn-small btn-quiet" }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copy this:", text);
        }
      }}
    >
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}

/**
 * Opens the phone's share sheet (Messenger, Viber, SMS ...). Shown only on
 * devices that have one; elsewhere Copy does the job.
 */
export function ShareButton({ title, text, className = "btn btn-small btn-quiet" }: { title: string; text: string; className?: string }) {
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);
  if (!canShare) return null;
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        navigator.share({ title, text }).catch(() => {
          /* closed the share sheet */
        });
      }}
    >
      Share
    </button>
  );
}
