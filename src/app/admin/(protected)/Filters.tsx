"use client";

import { useRef } from "react";
import Link from "next/link";
import { STATUSES, STATUS_LABELS } from "@/lib/statuses";
import styles from "../admin.module.css";

/** Search box and status filter. Plain GET form, so it also works without script. */
export function Filters({ q, status }: { q: string; status: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} method="get" action="/admin" className={styles.filters} role="search">
      <div className={styles.filterField}>
        <label className="label" htmlFor="q">
          Search
        </label>
        <input
          id="q"
          name="q"
          type="search"
          className="input"
          placeholder="Name, email, company, reference"
          defaultValue={q}
        />
      </div>
      <div className={styles.filterField}>
        <label className="label" htmlFor="status">
          Status
        </label>
        <select
          id="status"
          name="status"
          className="select"
          defaultValue={status}
          onChange={() => formRef.current?.requestSubmit()}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.filterButtons}>
        <button type="submit" className="btn btn-ink">
          Search
        </button>
        {q || status ? (
          <Link href="/admin" className={styles.clearLink}>
            Clear
          </Link>
        ) : null}
      </div>
    </form>
  );
}
