"use client";

import { useActionState } from "react";
import { createAccount, submitRegistrationGate } from "./actions";

export function RegistrationGateForm() {
  const [state, formAction, pending] = useActionState(submitRegistrationGate, {});

  return (
    <form action={formAction} className="auth-panel">
      <h1>Registration Access</h1>
      <label htmlFor="accessPassword">Access password</label>
      <input id="accessPassword" name="accessPassword" type="password" autoComplete="off" required />
      {state.error ? <p role="alert">{state.error}</p> : null}
      <button type="submit" disabled={pending}>
        Continue
      </button>
    </form>
  );
}

export function AccountRegistrationForm() {
  const [state, formAction, pending] = useActionState(createAccount, {});

  return (
    <form action={formAction} className="auth-panel">
      <h1>Create Account</h1>
      <label htmlFor="displayName">Display name</label>
      <input id="displayName" name="displayName" type="text" autoComplete="name" required />
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="email" required />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      {state.error ? <p role="alert">{state.error}</p> : null}
      <button type="submit" disabled={pending}>
        Register
      </button>
    </form>
  );
}
