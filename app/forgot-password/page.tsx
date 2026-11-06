"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ThemeToggle } from "../../components/theme-toggle";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const result = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/recovery`,
      });
      if (result.error?.status === 429) throw new Error("Too many requests. Please wait a few minutes before trying again.");
      if (result.error) throw new Error("Recovery email could not be sent right now. Please contact your superadmin or try again later.");
      setSent(true);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Unable to request a reset. Please try again.");
    } finally { setBusy(false); }
  }

  return <main className="authpage">
    <div className="auth-theme"><ThemeToggle /></div>
    <form className="authcard" onSubmit={submit}>
      <img src="/kinstack-logo.png" alt="KinStack Growth Solutions" />
      <p className="eyebrow">Finance Workspace</p>
      <h1>Forgot Password?</h1>
      {sent ? <div className="notice" role="status">If an account exists for this email, you will receive a reset link. Check your inbox and spam folder. Open the link in this browser. If it does not arrive, contact your superadmin.</div> : <>
        <p>Enter the email you use to sign in. We’ll send a link so you can choose a new password.</p>
        <label>Email Address<input required type="email" maxLength={254} autoComplete="email" value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /></label>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="primary" type="submit" disabled={busy}>{busy ? "Sending…" : "Send Reset Link"}</button>
      </>}
      <Link className="auth-link" href="/login">Back to Sign In</Link>
    </form>
  </main>;
}
