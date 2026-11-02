"use client";

import { useState, useTransition } from "react";
import { saveDetails, type SaveResult } from "./actions";
import styles from "../../admin.module.css";

type Item = { key: string; id?: string; title: string; body: string };

let counter = 0;
const newKey = () => `new-${Date.now()}-${counter++}`;

/** Additional details on the home page: add, edit, move up or down, delete, then save the whole list. */
export function DetailsEditor({ initial }: { initial: { id: string; title: string; body: string }[] }) {
  const [items, setItems] = useState<Item[]>(initial.map((d) => ({ key: d.id, ...d })));
  const [dirty, setDirty] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [pending, startTransition] = useTransition();

  const change = (next: Item[]) => {
    setItems(next);
    setDirty(true);
    setResult(null);
  };

  const update = (key: string, patch: Partial<Item>) => change(items.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const move = (index: number, by: -1 | 1) => {
    const target = index + by;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    change(next);
  };

  const add = () => {
    const key = newKey();
    change([...items, { key, title: "", body: "" }]);
    requestAnimationFrame(() => document.getElementById(`detail-title-${key}`)?.focus());
  };

  return (
    <section className={styles.editorBlock} aria-labelledby="details-heading">
      <h2 id="details-heading" className={styles.sectionTitle}>
        Additional details
      </h2>
      <p className={styles.pageNote}>
        Shown on the home page under &ldquo;Good to know&rdquo;, in this order. Leave a blank line between paragraphs.
      </p>

      {items.length ? (
        <ol className={styles.detailItems}>
          {items.map((item, i) => (
            <li key={item.key} className={styles.detailItem}>
              <div className="field">
                <label className="label" htmlFor={`detail-title-${item.key}`}>
                  Title
                </label>
                <input
                  id={`detail-title-${item.key}`}
                  className="input"
                  value={item.title}
                  maxLength={120}
                  onChange={(e) => update(item.key, { title: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor={`detail-body-${item.key}`}>
                  Text
                </label>
                <textarea
                  id={`detail-body-${item.key}`}
                  className="textarea"
                  rows={4}
                  value={item.body}
                  maxLength={3000}
                  onChange={(e) => update(item.key, { body: e.target.value })}
                />
              </div>
              <div className={styles.detailControls}>
                <button type="button" className="btn btn-small btn-quiet" onClick={() => move(i, -1)} disabled={i === 0}>
                  Move up<span className="visually-hidden">: {item.title || `detail ${i + 1}`}</span>
                </button>
                <button type="button" className="btn btn-small btn-quiet" onClick={() => move(i, 1)} disabled={i === items.length - 1}>
                  Move down<span className="visually-hidden">: {item.title || `detail ${i + 1}`}</span>
                </button>
                <button type="button" className="btn btn-small btn-danger" onClick={() => change(items.filter((x) => x.key !== item.key))}>
                  Delete<span className="visually-hidden">: {item.title || `detail ${i + 1}`}</span>
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.muted}>No additional details yet.</p>
      )}

      <div className={styles.saveRow} style={{ position: "static", background: "transparent" }}>
        <button type="button" className="btn btn-quiet" onClick={add}>
          Add a detail
        </button>
        <button
          type="button"
          className="btn"
          disabled={pending || !dirty}
          aria-busy={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await saveDetails(items.map(({ id, title, body }) => ({ id, title, body })));
              setResult(res);
              if (res.ok) setDirty(false);
            })
          }
        >
          {pending ? "Saving…" : "Save details"}
        </button>
        {result ? (
          <p className={result.ok ? styles.okText : "error"} role="status">
            {result.message}
          </p>
        ) : dirty ? (
          <p className={styles.muted}>Unsaved changes.</p>
        ) : null}
      </div>
    </section>
  );
}
