"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { event } from "@/config/event";
import { EventPass } from "@/components/EventPass";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { formatDayMonth, formatLongDate, formatPeso, formatTime } from "@/lib/format";
import { fieldErrors, receiptFileProblem, registrationSchema, stepSchemas } from "@/lib/validation";
import { CONFIRMATION_KEY, DRAFT_KEY } from "@/lib/keys";
import { checkEmail, prepareReceiptUpload, submitRegistration } from "./actions";
import styles from "./register.module.css";

const STEPS = ["Your details", "Event instructions", "Terms and privacy", "Payment", "Review"] as const;
const STEP_TITLES = ["Your details", "Event instructions", "Terms and privacy", "Payment", "Review and submit"];

type FormData = {
  fullName: string;
  email: string;
  mobile: string;
  company: string;
  jobTitle: string;
  instructionsAck: boolean;
  termsAccepted: boolean;
  privacyConsent: boolean;
  paymentReference: string;
  receiptPath: string;
};

type Receipt = {
  name: string;
  size: number;
  status: "uploading" | "done";
};

const EMPTY: FormData = {
  fullName: "",
  email: "",
  mobile: "",
  company: "",
  jobTitle: "",
  instructionsAck: false,
  termsAccepted: false,
  privacyConsent: false,
  paymentReference: "",
  receiptPath: "",
};

function fileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function RegisterWizard({
  initialEmail,
  initialName,
  initialCompany = "",
}: {
  initialEmail: string;
  initialName: string;
  initialCompany?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>({
    ...EMPTY,
    email: initialEmail,
    fullName: initialName,
    company: initialCompany,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState<"" | "checking" | "submitting">("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [website, setWebsite] = useState("");
  const [copied, setCopied] = useState("");
  const startedAt = useRef<number>(Date.now());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const restored = useRef(false);
  const firstRender = useRef(true);

  // Restore a draft after a refresh (the receipt itself stays uploaded).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as { data: FormData; step: number; receipt: Receipt | null };
        const merged = { ...EMPTY, ...draft.data };
        if (initialEmail && initialEmail !== merged.email) {
          // A different invite link: start fresh for that person.
          sessionStorage.removeItem(DRAFT_KEY);
        } else {
          // Details passed in the link (invite or home page) win over the saved draft
          if (initialName) merged.fullName = initialName;
          if (initialCompany) merged.company = initialCompany;
          setData(merged);
          setStep(Math.min(Math.max(0, draft.step), 4));
          if (draft.receipt?.status === "done") setReceipt(draft.receipt);
        }
      }
    } catch {
      /* storage can be unavailable in private mode */
    }
    restored.current = true;
  }, [initialEmail, initialName, initialCompany]);

  useEffect(() => {
    if (!restored.current) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ data, step, receipt: receipt?.status === "done" ? receipt : null }));
    } catch {
      /* ignore */
    }
  }, [data, step, receipt]);

  // Move focus to the step heading when the step changes.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const set = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setData((d) => ({ ...d, [key]: value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  }, []);

  function focusFirstError(errs: Record<string, string>) {
    const firstKey = Object.keys(errs)[0];
    if (!firstKey) return;
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-field="${firstKey}"]`);
      el?.focus();
    });
  }

  async function next() {
    setFormError("");
    const result = stepSchemas[step].safeParse(data);
    if (!result.success) {
      const errs = fieldErrors(result.error);
      setErrors(errs);
      focusFirstError(errs);
      return;
    }
    if (step === 0) {
      // Keep the cleaned-up values (trimmed, lower-case email, +63 mobile format)
      const clean = result.data as Partial<FormData>;
      setData((d) => ({ ...d, ...clean }));
      setBusy("checking");
      const check = await checkEmail(clean.email ?? data.email);
      setBusy("");
      if (!check.ok) {
        setFormError(check.error);
        return;
      }
      if (check.registered) {
        const errs = {
          email: `This email is already registered. To change your registration, write to ${event.contact.email}.`,
        };
        setErrors(errs);
        focusFirstError(errs);
        return;
      }
    }
    setErrors({});
    setStep((s) => Math.min(s + 1, 4));
  }

  function back() {
    setFormError("");
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  }

  async function onReceiptChosen(file: File | undefined) {
    if (!file) return;
    setFormError("");
    const problem = receiptFileProblem(file);
    if (problem) {
      setErrors((e) => ({ ...e, receiptPath: problem }));
      return;
    }
    setReceipt({ name: file.name, size: file.size, status: "uploading" });
    set("receiptPath", "");
    const prepared = await prepareReceiptUpload({ type: file.type, size: file.size });
    if (!prepared.ok) {
      setReceipt(null);
      setErrors((e) => ({ ...e, receiptPath: prepared.error }));
      return;
    }
    const supabase = createBrowserSupabase();
    const { error } = await supabase.storage
      .from("receipts")
      .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
    if (error) {
      setReceipt(null);
      setErrors((e) => ({ ...e, receiptPath: "The upload didn't finish. Check your connection and choose the file again." }));
      return;
    }
    setReceipt({ name: file.name, size: file.size, status: "done" });
    set("receiptPath", prepared.path);
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text.replace(/\s/g, ""));
      setCopied(text);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      /* clipboard blocked; the number is visible anyway */
    }
  }

  async function submit() {
    setFormError("");
    const result = registrationSchema.safeParse(data);
    if (!result.success) {
      const errs = fieldErrors(result.error);
      setErrors(errs);
      setFormError("Some details need fixing. Use the Edit links to go back.");
      return;
    }
    setBusy("submitting");
    const res = await submitRegistration({ ...data }, { website, startedAt: startedAt.current });
    if (!res.ok) {
      setBusy("");
      setFormError(res.error);
      if (res.fieldErrors) {
        setErrors(res.fieldErrors);
        if (res.fieldErrors.receiptPath) {
          setReceipt(null);
          set("receiptPath", "");
        }
      }
      if (typeof res.step === "number" && res.step < 4) setStep(res.step);
      return;
    }
    try {
      sessionStorage.setItem(
        CONFIRMATION_KEY,
        JSON.stringify({
          referenceCode: res.referenceCode,
          fullName: result.data.fullName,
          company: result.data.company,
          jobTitle: result.data.jobTitle,
          email: result.data.email,
          paymentReference: result.data.paymentReference,
        }),
      );
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    router.push(`/register/confirmation?ref=${encodeURIComponent(res.referenceCode)}`);
  }

  const err = (key: keyof FormData) => errors[key];
  const describedBy = (key: string, hint?: boolean) =>
    [hint ? `${key}-hint` : "", errors[key] ? `${key}-error` : ""].filter(Boolean).join(" ") || undefined;

  const pass = (
    <EventPass
      name={data.fullName}
      company={data.company}
      jobTitle={data.jobTitle}
      note={step === 4 ? "Reference issued when you submit" : undefined}
    />
  );

  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <Link href="/" className={styles.wordmark}>
          {event.shortName}
        </Link>
        <span className={styles.barWhen}>
          {formatDayMonth(event.startsAt)}, {event.venue.city}
        </span>
      </header>

      <main id="main" className={styles.main}>
        <div className={styles.top}>
          <nav aria-label="Registration progress" className={styles.progressWrap}>
            <p className={styles.progressCount} aria-live="polite">
              Step {step + 1} of {STEPS.length}
            </p>
            <ol className={styles.progress}>
              {STEPS.map((label, i) => {
                const state = i < step ? "done" : i === step ? "current" : "todo";
                return (
                  <li key={label} className={styles.progressItem} data-state={state} aria-current={i === step ? "step" : undefined}>
                    {i < step ? (
                      <button type="button" className={styles.progressButton} onClick={() => setStep(i)}>
                        <span className={styles.progressBar} aria-hidden="true" />
                        <span className={styles.progressLabel}>
                          {label}
                          <span className="visually-hidden"> (done, go back)</span>
                        </span>
                      </button>
                    ) : (
                      <span className={styles.progressButton}>
                        <span className={styles.progressBar} aria-hidden="true" />
                        <span className={styles.progressLabel}>{label}</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
          <h1 ref={headingRef} tabIndex={-1} className={styles.stepTitle}>
            {STEP_TITLES[step]}
          </h1>
        </div>

        <div className={styles.layout}>
          <form
            className={styles.sheet}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (step < 4) void next();
              else void submit();
            }}
          >
            {formError ? (
              <p className={styles.formError} role="alert">
                {formError}
              </p>
            ) : null}

            {step === 0 ? (
              <fieldset className={styles.fieldset}>
                <legend className="visually-hidden">Your details</legend>
                <p className={styles.lead}>
                  These go on your event pass and let us match your payment. All fields are required unless marked
                  optional.
                </p>
                <div className="field">
                  <label className="label" htmlFor="fullName">
                    Full name
                  </label>
                  <p className="hint" id="fullName-hint">
                    As it should appear on your pass.
                  </p>
                  <input
                    id="fullName"
                    data-field="fullName"
                    className="input"
                    autoComplete="name"
                    value={data.fullName}
                    onChange={(e) => set("fullName", e.target.value)}
                    aria-invalid={Boolean(err("fullName"))}
                    aria-describedby={describedBy("fullName", true)}
                  />
                  {err("fullName") ? (
                    <p className="error" id="fullName-error">
                      {err("fullName")}
                    </p>
                  ) : null}
                </div>
                <div className="field">
                  <label className="label" htmlFor="email">
                    Email address
                  </label>
                  <input
                    id="email"
                    data-field="email"
                    className="input"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={data.email}
                    onChange={(e) => set("email", e.target.value)}
                    aria-invalid={Boolean(err("email"))}
                    aria-describedby={describedBy("email")}
                  />
                  {err("email") ? (
                    <p className="error" id="email-error">
                      {err("email")}
                    </p>
                  ) : null}
                </div>
                <div className="field">
                  <label className="label" htmlFor="mobile">
                    Mobile number
                  </label>
                  <p className="hint" id="mobile-hint">
                    For example 0917 123 4567. We only use it to reach you about this event.
                  </p>
                  <input
                    id="mobile"
                    data-field="mobile"
                    className="input"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={data.mobile}
                    onChange={(e) => set("mobile", e.target.value)}
                    aria-invalid={Boolean(err("mobile"))}
                    aria-describedby={describedBy("mobile", true)}
                  />
                  {err("mobile") ? (
                    <p className="error" id="mobile-error">
                      {err("mobile")}
                    </p>
                  ) : null}
                </div>
                <div className="field">
                  <label className="label" htmlFor="company">
                    Company or organisation
                  </label>
                  <input
                    id="company"
                    data-field="company"
                    className="input"
                    autoComplete="organization"
                    value={data.company}
                    onChange={(e) => set("company", e.target.value)}
                    aria-invalid={Boolean(err("company"))}
                    aria-describedby={describedBy("company")}
                  />
                  {err("company") ? (
                    <p className="error" id="company-error">
                      {err("company")}
                    </p>
                  ) : null}
                </div>
                <div className="field">
                  <label className="label" htmlFor="jobTitle">
                    Job title <span className="label-optional">(optional)</span>
                  </label>
                  <input
                    id="jobTitle"
                    data-field="jobTitle"
                    className="input"
                    autoComplete="organization-title"
                    value={data.jobTitle}
                    onChange={(e) => set("jobTitle", e.target.value)}
                    aria-invalid={Boolean(err("jobTitle"))}
                    aria-describedby={describedBy("jobTitle")}
                  />
                  {err("jobTitle") ? (
                    <p className="error" id="jobTitle-error">
                      {err("jobTitle")}
                    </p>
                  ) : null}
                </div>
              </fieldset>
            ) : null}

            {step === 1 ? (
              <fieldset className={styles.fieldset}>
                <legend className="visually-hidden">Event instructions</legend>
                <p className={styles.lead}>
                  {formatLongDate(event.startsAt)}, {formatTime(event.startsAt)} to {formatTime(event.endsAt)} at the{" "}
                  {event.venue.name}, {event.venue.address}, {event.venue.city}.
                </p>
                <dl className={styles.instructions}>
                  {event.instructions.map((item) => (
                    <div key={item.question} className={styles.instruction}>
                      <dt>{item.question}</dt>
                      <dd>{item.answer}</dd>
                    </div>
                  ))}
                </dl>
                <label className="check" data-invalid={Boolean(err("instructionsAck"))}>
                  <input
                    type="checkbox"
                    data-field="instructionsAck"
                    checked={data.instructionsAck}
                    onChange={(e) => set("instructionsAck", e.target.checked)}
                    aria-describedby={describedBy("instructionsAck")}
                  />
                  <span className="check-text">I have read the event instructions</span>
                </label>
                {err("instructionsAck") ? (
                  <p className={`error ${styles.checkError}`} id="instructionsAck-error">
                    {err("instructionsAck")}
                  </p>
                ) : null}
              </fieldset>
            ) : null}

            {step === 2 ? (
              <fieldset className={styles.fieldset}>
                <legend className="visually-hidden">Terms and privacy</legend>
                <h2 className={styles.subhead}>Terms and conditions</h2>
                <div className={styles.scrollText} tabIndex={0} role="region" aria-label="Terms and conditions">
                  {event.terms.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
                <h2 className={styles.subhead}>Privacy notice</h2>
                <div className={styles.scrollText} tabIndex={0} role="region" aria-label="Privacy notice">
                  {event.privacy.paragraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                  <p>
                    Contact: {event.privacy.dataProtectionOfficer},{" "}
                    <a href={`mailto:${event.privacy.dpoEmail}`}>{event.privacy.dpoEmail}</a>
                  </p>
                </div>
                <p className={styles.smallLink}>
                  <Link href="/terms" target="_blank">
                    Open the terms and privacy notice in a new tab
                  </Link>
                </p>
                <div className={styles.checks}>
                  <label className="check" data-invalid={Boolean(err("termsAccepted"))}>
                    <input
                      type="checkbox"
                      data-field="termsAccepted"
                      checked={data.termsAccepted}
                      onChange={(e) => set("termsAccepted", e.target.checked)}
                      aria-describedby={describedBy("termsAccepted")}
                    />
                    <span className="check-text">I agree to the terms and conditions</span>
                  </label>
                  {err("termsAccepted") ? (
                    <p className={`error ${styles.checkError}`} id="termsAccepted-error">
                      {err("termsAccepted")}
                    </p>
                  ) : null}
                  <label className="check" data-invalid={Boolean(err("privacyConsent"))}>
                    <input
                      type="checkbox"
                      data-field="privacyConsent"
                      checked={data.privacyConsent}
                      onChange={(e) => set("privacyConsent", e.target.checked)}
                      aria-describedby={describedBy("privacyConsent")}
                    />
                    <span className="check-text">
                      I consent to {event.organizer} collecting and processing my personal data for this event
                      <small>
                        As described in the privacy notice, under the Data Privacy Act of 2012 (Republic Act No. 10173).
                      </small>
                    </span>
                  </label>
                  {err("privacyConsent") ? (
                    <p className={`error ${styles.checkError}`} id="privacyConsent-error">
                      {err("privacyConsent")}
                    </p>
                  ) : null}
                </div>
              </fieldset>
            ) : null}

            {step === 3 ? (
              <fieldset className={styles.fieldset}>
                <legend className="visually-hidden">Payment</legend>
                <div className={styles.amount}>
                  <p className={styles.amountFigure}>{formatPeso(event.fee)}</p>
                  <p className={styles.amountNote}>
                    Pay by {formatDayMonth(event.paymentDeadline)}. {event.feeIncludes}
                  </p>
                </div>
                <div className={styles.methods}>
                  {event.paymentMethods.map((m) => (
                    <section key={m.name} className={styles.method} aria-label={m.name}>
                      <h2 className={styles.methodName}>{m.name}</h2>
                      <dl className={styles.methodRows}>
                        {m.bank ? (
                          <div>
                            <dt>Bank</dt>
                            <dd>{m.bank}</dd>
                          </div>
                        ) : null}
                        <div>
                          <dt>Account name</dt>
                          <dd>{m.accountName}</dd>
                        </div>
                        <div>
                          <dt>Account number</dt>
                          <dd className={styles.numberRow}>
                            <span className="tabular">{m.accountNumber}</span>
                            <button type="button" className="btn btn-quiet btn-small" onClick={() => copy(m.accountNumber)}>
                              {copied === m.accountNumber ? "Copied" : "Copy number"}
                            </button>
                          </dd>
                        </div>
                      </dl>
                      {m.note ? <p className={styles.methodNote}>{m.note}</p> : null}
                    </section>
                  ))}
                </div>

                <div className="field">
                  <label className="label" htmlFor="paymentReference">
                    Payment reference number
                  </label>
                  <p className="hint" id="paymentReference-hint">
                    The reference or transaction number on your GCash or bank receipt.
                  </p>
                  <input
                    id="paymentReference"
                    data-field="paymentReference"
                    className="input"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    value={data.paymentReference}
                    onChange={(e) => set("paymentReference", e.target.value)}
                    aria-invalid={Boolean(err("paymentReference"))}
                    aria-describedby={describedBy("paymentReference", true)}
                  />
                  {err("paymentReference") ? (
                    <p className="error" id="paymentReference-error">
                      {err("paymentReference")}
                    </p>
                  ) : null}
                </div>

                <div className="field">
                  <span className="label" id="receipt-label">
                    Receipt
                  </span>
                  <p className="hint" id="receiptPath-hint">
                    A screenshot or photo of your receipt, or a PDF. Up to 5 MB.
                  </p>
                  <label
                    className={styles.drop}
                    data-state={receipt?.status ?? "empty"}
                    data-invalid={Boolean(err("receiptPath"))}
                  >
                    <input
                      type="file"
                      data-field="receiptPath"
                      className={styles.fileInput}
                      accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
                      aria-labelledby="receipt-label"
                      aria-describedby={describedBy("receiptPath", true)}
                      disabled={receipt?.status === "uploading"}
                      onChange={(e) => {
                        void onReceiptChosen(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    {receipt ? (
                      <>
                        <span className={styles.dropTitle}>{receipt.name}</span>
                        <span className={styles.dropMeta} aria-live="polite">
                          {receipt.status === "uploading" ? "Uploading…" : `Uploaded, ${fileSize(receipt.size)}. Tap to replace.`}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className={styles.dropTitle}>Choose your receipt</span>
                        <span className={styles.dropMeta}>JPG, PNG, HEIC or PDF</span>
                      </>
                    )}
                  </label>
                  {err("receiptPath") ? (
                    <p className="error" id="receiptPath-error">
                      {err("receiptPath")}
                    </p>
                  ) : null}
                </div>
              </fieldset>
            ) : null}

            {step === 4 ? (
              <div className={styles.review}>
                <div className={styles.reviewPass}>{pass}</div>
                <ReviewGroup title="Your details" onEdit={() => setStep(0)}>
                  <Row label="Full name" value={data.fullName} error={errors.fullName} />
                  <Row label="Email" value={data.email} error={errors.email} />
                  <Row label="Mobile" value={data.mobile} error={errors.mobile} />
                  <Row label="Company" value={data.company} error={errors.company} />
                  {data.jobTitle ? <Row label="Job title" value={data.jobTitle} /> : null}
                </ReviewGroup>
                <ReviewGroup title="Event instructions" onEdit={() => setStep(1)}>
                  <Row
                    label="Instructions"
                    value={data.instructionsAck ? "Read" : "Not yet confirmed"}
                    error={errors.instructionsAck}
                  />
                </ReviewGroup>
                <ReviewGroup title="Terms and privacy" onEdit={() => setStep(2)}>
                  <Row label="Terms" value={data.termsAccepted ? "Agreed" : "Not agreed"} error={errors.termsAccepted} />
                  <Row
                    label="Data privacy consent"
                    value={data.privacyConsent ? "Given" : "Not given"}
                    error={errors.privacyConsent}
                  />
                </ReviewGroup>
                <ReviewGroup title="Payment" onEdit={() => setStep(3)}>
                  <Row label="Amount" value={formatPeso(event.fee)} />
                  <Row label="Reference number" value={data.paymentReference} error={errors.paymentReference} />
                  <Row
                    label="Receipt"
                    value={receipt?.status === "done" ? receipt.name : "Not uploaded"}
                    error={errors.receiptPath}
                  />
                </ReviewGroup>

                <div className="hp" aria-hidden="true">
                  <label htmlFor="website">Website</label>
                  <input
                    id="website"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>
              </div>
            ) : null}

            <div className={styles.actions}>
              {step > 0 ? (
                <button type="button" className="btn btn-quiet" onClick={back} disabled={busy !== ""}>
                  Back
                </button>
              ) : (
                <Link href="/" className="btn btn-quiet">
                  Event details
                </Link>
              )}
              <button
                type="submit"
                className="btn"
                disabled={busy !== "" || receipt?.status === "uploading"}
                aria-busy={busy !== ""}
              >
                {step < 4
                  ? busy === "checking"
                    ? "Checking…"
                    : "Continue"
                  : busy === "submitting"
                    ? "Submitting…"
                    : "Submit registration"}
              </button>
            </div>
          </form>

          <aside className={styles.passCol} aria-label="Your event pass preview">
            <div className={styles.passSticky}>
              {pass}
              <p className={styles.passCaption}>
                Your pass fills in as you type. The reference code arrives when you submit.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function ReviewGroup({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <section className={styles.reviewGroup} aria-label={title}>
      <div className={styles.reviewHead}>
        <h2 className={styles.reviewTitle}>{title}</h2>
        <button type="button" className="text-button" onClick={onEdit}>
          Edit<span className="visually-hidden"> {title.toLowerCase()}</span>
        </button>
      </div>
      <dl className={styles.reviewRows}>{children}</dl>
    </section>
  );
}

function Row({ label, value, error }: { label: string; value: string; error?: string }) {
  return (
    <div className={styles.reviewRow}>
      <dt>{label}</dt>
      <dd>
        {value || "Missing"}
        {error ? <span className={`error ${styles.reviewError}`}>{error}</span> : null}
      </dd>
    </div>
  );
}
