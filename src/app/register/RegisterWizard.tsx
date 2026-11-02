"use client";

import { useCallback, useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EventPass, type PassEvent } from "@/components/EventPass";
import { fieldErrors, registrationSchema, stepSchemas } from "@/lib/validation";
import { CONFIRMATION_KEY, DRAFT_KEY } from "@/lib/keys";
import { checkRegistrant, submitRegistration } from "./actions";
import styles from "./register.module.css";

const STEPS = ["Your name", "Email and company", "Password", "Review"] as const;
const STEP_TITLES = ["Your name", "Email and company", "Choose a password", "Review and submit"];
const PASSWORD_STEP = 2;
const LAST = STEPS.length - 1;

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  password: string;
  confirm: string;
  consent: boolean;
};

const EMPTY: FormData = { firstName: "", lastName: "", email: "", company: "", password: "", confirm: "", consent: false };

export type WizardEvent = PassEvent & { inviteOnly: boolean; dateLine: string };

export function RegisterWizard({
  event,
  initialEmail,
  initialFirstName = "",
  initialLastName = "",
  initialCompany = "",
}: {
  event: WizardEvent;
  initialEmail: string;
  initialFirstName?: string;
  initialLastName?: string;
  initialCompany?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>({
    ...EMPTY,
    email: initialEmail,
    firstName: initialFirstName,
    lastName: initialLastName,
    company: initialCompany,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState<"" | "checking" | "submitting">("");
  const [website, setWebsite] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const startedAt = useRef<number>(Date.now());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const restored = useRef(false);
  const firstRender = useRef(true);

  // Restore a draft after a refresh.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as { data: FormData; step: number };
        // Passwords are never saved, so a restored draft goes back to that step at most
        const merged = { ...EMPTY, ...draft.data, password: "", confirm: "" };
        if (initialEmail && initialEmail !== merged.email) {
          // A different invite link: start fresh for that person.
          sessionStorage.removeItem(DRAFT_KEY);
        } else {
          // Details passed in the link (invite or home page) win over the saved draft
          if (initialFirstName) merged.firstName = initialFirstName;
          if (initialLastName) merged.lastName = initialLastName;
          if (initialCompany) merged.company = initialCompany;
          setData(merged);
          setStep(Math.min(Math.max(0, draft.step), PASSWORD_STEP));
        }
      }
    } catch {
      /* storage can be unavailable in private mode */
    }
    restored.current = true;
  }, [initialEmail, initialFirstName, initialLastName, initialCompany]);

  useEffect(() => {
    if (!restored.current) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ data: { ...data, password: "", confirm: "" }, step }));
    } catch {
      /* ignore */
    }
  }, [data, step]);

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
    // A name message is about the whole name, so editing either part clears it
    const keys: string[] = key === "firstName" || key === "lastName" ? ["firstName", "lastName"] : [key];
    setErrors((e) => {
      if (!keys.some((k) => e[k])) return e;
      const next = { ...e };
      for (const k of keys) delete next[k];
      return next;
    });
  }, []);

  function focusFirstError(errs: Record<string, string>) {
    const firstKey = Object.keys(errs)[0];
    if (!firstKey) return;
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-field="${firstKey}"]`)?.focus();
    });
  }

  function showFailure(res: { error: string; fieldErrors?: Record<string, string>; step?: number }) {
    if (typeof res.step === "number" && res.step < step) setStep(res.step);
    if (res.fieldErrors) {
      setErrors(res.fieldErrors);
      focusFirstError(res.fieldErrors);
    } else {
      setFormError(res.error);
    }
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
    // Keep the cleaned-up values (trimmed, lower-case email)
    const clean = { ...data, ...(result.data as Partial<FormData>) };
    setData(clean);

    // Check the name against the invite list, then the email against registrations
    if (step < PASSWORD_STEP) {
      setBusy("checking");
      const check = await checkRegistrant({
        firstName: clean.firstName,
        lastName: clean.lastName,
        email: step === 1 ? clean.email : undefined,
      });
      setBusy("");
      if (!check.ok) {
        showFailure(check);
        return;
      }
    }
    setErrors({});
    setStep((s) => Math.min(s + 1, LAST));
  }

  function back() {
    setFormError("");
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit() {
    setFormError("");
    const result = registrationSchema.safeParse(data);
    if (!result.success) {
      const errs = fieldErrors(result.error);
      setErrors(errs);
      if (errs.consent) focusFirstError(errs);
      else setFormError("Some details need fixing. Use the Edit links to go back.");
      return;
    }
    setBusy("submitting");
    const res = await submitRegistration({ ...data }, { website, startedAt: startedAt.current });
    if (!res.ok) {
      setBusy("");
      showFailure(res);
      return;
    }
    try {
      sessionStorage.setItem(
        CONFIRMATION_KEY,
        JSON.stringify({
          referenceCode: res.referenceCode,
          fullName: `${result.data.firstName} ${result.data.lastName}`,
          company: result.data.company,
          email: result.data.email,
        }),
      );
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    router.push(`/register/thanks?ref=${encodeURIComponent(res.referenceCode)}`);
  }

  const err = (key: keyof FormData) => errors[key];
  const describedBy = (key: string, hint?: boolean) =>
    [hint ? `${key}-hint` : "", errors[key] ? `${key}-error` : ""].filter(Boolean).join(" ") || undefined;

  const pass = (
    <EventPass
      event={event}
      name={`${data.firstName} ${data.lastName}`.trim()}
      company={data.company}
      note={step === LAST ? "Reference issued when you submit" : undefined}
    />
  );

  const textField = (
    key: "firstName" | "lastName" | "email" | "company" | "password" | "confirm",
    label: string,
    props: InputHTMLAttributes<HTMLInputElement> = {},
    hint?: string,
  ) => (
    <div className="field">
      <label className="label" htmlFor={key}>
        {label}
      </label>
      {hint ? (
        <p className="hint" id={`${key}-hint`}>
          {hint}
        </p>
      ) : null}
      <input
        id={key}
        data-field={key}
        className="input"
        value={data[key]}
        onChange={(e) => set(key, e.target.value)}
        aria-invalid={Boolean(err(key))}
        aria-describedby={describedBy(key, Boolean(hint))}
        {...props}
      />
      {err(key) ? (
        <p className="error" id={`${key}-error`}>
          {err(key)}
        </p>
      ) : null}
    </div>
  );

  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <Link href="/" className={styles.wordmark}>
          {event.shortName}
        </Link>
        <span className={styles.barWhen}>{event.dateLine}</span>
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
          <h1 ref={headingRef} tabIndex={-1} className={styles.stepTitle} key={step}>
            {STEP_TITLES[step]}
          </h1>
        </div>

        <div className={styles.layout}>
          <form
            className={styles.sheet}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (step < LAST) void next();
              else void submit();
            }}
          >
            {formError ? (
              <p className="notice" data-tone="error" role="alert">
                {formError}
              </p>
            ) : null}

            <div className={styles.stepBody} key={step}>
              {step === 0 ? (
                <fieldset className={styles.fieldset}>
                  <legend className="visually-hidden">Your name</legend>
                  <p className={styles.lead}>
                    {event.inviteOnly
                      ? "Registration is by invitation. Use the last name on your invitation; your first name can be the short form you go by, like Jai for Jairus."
                      : "Your name as it should appear on your pass."}
                  </p>
                  <div className={styles.nameRow}>
                    {textField("firstName", "First name", { autoComplete: "given-name" })}
                    {textField("lastName", "Last name", { autoComplete: "family-name" })}
                  </div>
                </fieldset>
              ) : null}

              {step === 1 ? (
                <fieldset className={styles.fieldset}>
                  <legend className="visually-hidden">Email and company</legend>
                  <p className={styles.lead}>
                    You&rsquo;ll sign in with this email. The company goes on your pass.
                  </p>
                  {textField("email", "Email address", {
                    type: "email",
                    inputMode: "email",
                    autoComplete: "email",
                    autoCapitalize: "none",
                    spellCheck: false,
                  })}
                  {textField("company", "Company", { autoComplete: "organization" }, "As it should appear on your pass.")}
                </fieldset>
              ) : null}

              {step === PASSWORD_STEP ? (
                <fieldset className={styles.fieldset}>
                  <legend className="visually-hidden">Choose a password</legend>
                  <p className={styles.lead}>
                    You&rsquo;ll sign in with {data.email || "your email"} and this password to pay, check your status
                    and see your pass.
                  </p>
                  {/* Lets password managers save the password against the right email */}
                  <input type="email" name="username" autoComplete="username" value={data.email} readOnly hidden />
                  {textField(
                    "password",
                    "Password",
                    { type: showPassword ? "text" : "password", autoComplete: "new-password" },
                    "At least 7 characters.",
                  )}
                  {textField("confirm", "Type it again", { type: showPassword ? "text" : "password", autoComplete: "new-password" })}
                  <label className={styles.showPassword}>
                    <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
                    Show the passwords
                  </label>
                </fieldset>
              ) : null}

              {step === LAST ? (
                <div className={styles.review}>
                  <div className={styles.reviewPass}>{pass}</div>
                  <ReviewGroup title="Your name" onEdit={() => setStep(0)}>
                    <Row label="First name" value={data.firstName} error={errors.firstName} />
                    <Row label="Last name" value={data.lastName} error={errors.lastName} />
                  </ReviewGroup>
                  <ReviewGroup title="Email and company" onEdit={() => setStep(1)}>
                    <Row label="Email" value={data.email} error={errors.email} />
                    <Row label="Company" value={data.company} error={errors.company} />
                  </ReviewGroup>
                  <ReviewGroup title="Password" onEdit={() => setStep(PASSWORD_STEP)}>
                    <Row
                      label="Password"
                      value={data.password ? "Chosen (hidden)" : ""}
                      error={errors.password || errors.confirm}
                    />
                  </ReviewGroup>

                  <label className="check" data-invalid={Boolean(errors.consent)}>
                    <input
                      type="checkbox"
                      data-field="consent"
                      checked={data.consent}
                      onChange={(e) => set("consent", e.target.checked)}
                      aria-invalid={Boolean(errors.consent)}
                      aria-describedby={errors.consent ? "consent-error" : undefined}
                    />
                    <span className="check-text">
                      I agree to the{" "}
                      <Link href="/terms" target="_blank">
                        terms and the privacy notice
                      </Link>
                      , and to the organisers using my details for this event.
                    </span>
                  </label>
                  {errors.consent ? (
                    <p className="error" id="consent-error">
                      {errors.consent}
                    </p>
                  ) : null}

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
            </div>

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
              <button type="submit" className="btn" disabled={busy !== ""} aria-busy={busy !== ""}>
                {step < LAST
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
              <p className={styles.passCaption}>Your pass fills in as you type. The reference code arrives when you submit.</p>
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
