"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";
import styles from "../admin.module.css";

const initial: LoginState = { error: "", email: "" };

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initial);

  return (
    <form action={action} className={styles.loginForm} noValidate>
      {state.error ? (
        <p className={styles.formError} role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="field">
        <label className="label" htmlFor="email">
          Email address
        </label>
        <input
          id="email"
          name="email"
          className="input"
          type="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          defaultValue={state.email}
          required
        />
      </div>
      <div className="field">
        <label className="label" htmlFor="password">
          Password
        </label>
        <input id="password" name="password" className="input" type="password" autoComplete="current-password" required />
      </div>
      <button type="submit" className="btn btn-block" disabled={pending} aria-busy={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
