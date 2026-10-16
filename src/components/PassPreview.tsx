"use client";

import { useState } from "react";
import Link from "next/link";
import { EventPass } from "./EventPass";
import styles from "./PassPreview.module.css";

/** Home page: type a name, watch the pass fill in, then carry it into the form. */
export function PassPreview({ open }: { open: boolean }) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");

  const params = new URLSearchParams();
  if (name.trim()) params.set("name", name.trim().slice(0, 100));
  if (company.trim()) params.set("company", company.trim().slice(0, 150));
  const query = params.toString();
  const href = `/register${query ? `?${query}` : ""}`;

  return (
    <div className={styles.preview}>
      <div className={styles.fields}>
        <div className="field">
          <label className="label" htmlFor="preview-name">
            Your name
          </label>
          <input
            id="preview-name"
            className="input"
            autoComplete="name"
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="preview-company">
            Company or organisation
          </label>
          <input
            id="preview-company"
            className="input"
            autoComplete="organization"
            value={company}
            maxLength={150}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>
        {open ? (
          <Link href={href} className={`btn ${styles.action}`}>
            {name.trim() ? "Continue registering" : "Start registering"}
          </Link>
        ) : null}
      </div>
      <div className={styles.passSide}>
        <EventPass name={name} company={company} />
      </div>
    </div>
  );
}
