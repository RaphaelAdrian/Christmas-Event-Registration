"use client";

import { useState, useTransition, type InputHTMLAttributes, type ReactNode } from "react";
import type { EventSettingsInput } from "@/lib/validation";
import { saveEventSettings, type SaveResult } from "./actions";
import styles from "../../admin.module.css";

type Values = Required<EventSettingsInput>;
type TextKey = { [K in keyof Values]: Values[K] extends string ? K : never }[keyof Values];

/** The event facts: name, date and time, venue, getting there, contact, and registration switches. */
export function EventForm({ initial }: { initial: Values }) {
  const [values, setValues] = useState<Values>(initial);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [pending, startTransition] = useTransition();
  const fe = result?.fieldErrors ?? {};

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((v) => ({ ...v, [key]: value }));

  const field = (key: TextKey, label: string, props: InputHTMLAttributes<HTMLInputElement> = {}, hint?: ReactNode, full = false) => (
    <div className={`field ${full ? styles.full : ""}`}>
      <label className="label" htmlFor={`ev-${key}`}>
        {label}
      </label>
      {hint ? (
        <p className="hint" id={`ev-${key}-hint`}>
          {hint}
        </p>
      ) : null}
      <input
        id={`ev-${key}`}
        className="input"
        value={values[key]}
        onChange={(e) => set(key, e.target.value)}
        aria-invalid={Boolean(fe[key])}
        aria-describedby={[hint ? `ev-${key}-hint` : "", fe[key] ? `ev-${key}-error` : ""].filter(Boolean).join(" ") || undefined}
        {...props}
      />
      {fe[key] ? (
        <p className="error" id={`ev-${key}-error`}>
          {fe[key]}
        </p>
      ) : null}
    </div>
  );

  const area = (key: "terms" | "privacyNotice", label: string, hint: string) => (
    <div className={`field ${styles.full}`}>
      <label className="label" htmlFor={`ev-${key}`}>
        {label}
      </label>
      <p className="hint">{hint}</p>
      <textarea id={`ev-${key}`} className="textarea" rows={7} value={values[key]} onChange={(e) => set(key, e.target.value)} />
    </div>
  );

  return (
    <form
      className={styles.editor}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => setResult(await saveEventSettings(values)));
      }}
    >
      <section className={styles.editorBlock} aria-labelledby="ev-event">
        <h2 id="ev-event" className={styles.sectionTitle}>
          The event
        </h2>
        <div className={styles.editorGrid}>
          {field("name", "Event name", {}, "Set very large on the home page.", true)}
          {field("shortName", "Short name", {}, "For the top bar, the pass and emails.")}
          {field("referencePrefix", "Reference code letters", { autoCapitalize: "characters" }, "EMC gives codes like EMC-0042.")}
          {field("tagline", "One-line description", {}, "Shown under the event name.", true)}
          {field("date", "Date", { type: "date" })}
          <div className={styles.twoFields}>
            {field("startTime", "Starts", { type: "time" })}
            {field("endTime", "Ends", { type: "time" }, "Earlier than the start means the next day.")}
          </div>
        </div>
      </section>

      <section className={styles.editorBlock} aria-labelledby="ev-place">
        <h2 id="ev-place" className={styles.sectionTitle}>
          Venue and getting there
        </h2>
        <div className={styles.editorGrid}>
          {field("venueName", "Venue")}
          {field("venueAddress", "Address", {}, "Optional.")}
          {field("mapUrl", "Map link", { type: "url", inputMode: "url" }, "A Google Maps link that starts with https://", true)}
          {field("callTime", "Call time", {}, "For example 1:00 PM.")}
          {field("shuttleInfo", "Shuttle", {}, "Where the shuttle leaves from.")}
        </div>
      </section>

      <section className={styles.editorBlock} aria-labelledby="ev-reg">
        <h2 id="ev-reg" className={styles.sectionTitle}>
          Registration and contact
        </h2>
        <div className={styles.toggles}>
          <label className="check">
            <input type="checkbox" checked={values.registrationOpen} onChange={(e) => set("registrationOpen", e.target.checked)} />
            <span className="check-text">Registration is open</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={values.inviteOnly} onChange={(e) => set("inviteOnly", e.target.checked)} />
            <span className="check-text">Only people on the invite list can register</span>
          </label>
        </div>
        <div className={styles.editorGrid}>
          {field("organizer", "Organiser", {}, "Named in the footer and the privacy notice.")}
          {field("contactEmail", "Contact email", { type: "email", inputMode: "email" }, "Where guests write with questions.")}
          {area("terms", "Terms", "Leave a blank line between paragraphs.")}
          {area("privacyNotice", "Privacy notice", "Leave a blank line between paragraphs.")}
        </div>
      </section>

      <div className={styles.saveRow}>
        <button type="submit" className="btn" disabled={pending} aria-busy={pending}>
          {pending ? "Saving…" : "Save event details"}
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
