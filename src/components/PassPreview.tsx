"use client";

import { useState } from "react";
import Link from "next/link";
import { EventPass, type PassEvent } from "./EventPass";
import styles from "./PassPreview.module.css";

/** Home page: type a name, watch the pass fill in, then carry it into the form. */
export function PassPreview({ event, open }: { event: PassEvent; open: boolean }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const params = new URLSearchParams();
  if (firstName.trim()) params.set("first", firstName.trim().slice(0, 100));
  if (lastName.trim()) params.set("last", lastName.trim().slice(0, 100));
  const query = params.toString();
  const href = `/register${query ? `?${query}` : ""}`;
  const name = `${firstName.trim()} ${lastName.trim()}`.trim();

  return (
    <div className={styles.preview}>
      <div className={styles.fields}>
        <div className="field">
          <label className="label" htmlFor="preview-first">
            First name
          </label>
          <input
            id="preview-first"
            className="input"
            autoComplete="given-name"
            value={firstName}
            maxLength={100}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="preview-last">
            Last name
          </label>
          <input
            id="preview-last"
            className="input"
            autoComplete="family-name"
            value={lastName}
            maxLength={100}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        {open ? (
          <Link href={href} className={`btn ${styles.action}`}>
            {name ? "Continue registering" : "Start registering"}
          </Link>
        ) : null}
      </div>
      <div className={styles.passSide}>
        <EventPass event={event} name={name} />
      </div>
    </div>
  );
}
