"use client";

import { useActionState } from "react";
import { setPassword, type PasswordState } from "./actions";

const initial: PasswordState = { error: "", fieldErrors: {} };

export function SetPasswordForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(setPassword, initial);
  const fe = state.fieldErrors;

  return (
    <form action={action} noValidate style={{ display: "grid", gap: 24 }}>
      {state.error ? (
        <p className="notice" data-tone="error" role="alert">
          {state.error}
        </p>
      ) : null}
      {/* Lets password managers save the new password against the right email */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <div className="field">
        <label className="label" htmlFor="password">
          New password
        </label>
        <p className="hint" id="password-hint">
          At least 7 characters.
        </p>
        <input
          id="password"
          name="password"
          className="input"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(fe.password)}
          aria-describedby={["password-hint", fe.password ? "password-error" : ""].filter(Boolean).join(" ")}
          required
        />
        {fe.password ? (
          <p className="error" id="password-error">
            {fe.password}
          </p>
        ) : null}
      </div>
      <div className="field">
        <label className="label" htmlFor="confirm">
          Type it again
        </label>
        <input
          id="confirm"
          name="confirm"
          className="input"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(fe.confirm)}
          aria-describedby={fe.confirm ? "confirm-error" : undefined}
          required
        />
        {fe.confirm ? (
          <p className="error" id="confirm-error">
            {fe.confirm}
          </p>
        ) : null}
      </div>
      <button type="submit" className="btn btn-block" disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
