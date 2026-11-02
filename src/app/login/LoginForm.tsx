"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, type SignInState } from "./actions";

const initial: SignInState = { error: "", email: "" };

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, initial);

  return (
    <form action={action} noValidate style={{ display: "grid", gap: 24 }}>
      {state.error ? (
        <p className="notice" data-tone="error" role="alert">
          {state.error}
        </p>
      ) : null}
      <input type="hidden" name="next" value={next} />
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
      <p>
        <Link href="/forgot-password">Forgot your password?</Link>
      </p>
    </form>
  );
}
