"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { PasswordField } from "../../components/password-field";
import { ThemeToggle } from "../../components/theme-toggle";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

type Status = "checking" | "ready" | "invalid" | "complete";

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function checkSession() {
      try {
        const supabase = createSupabaseBrowserClient();
        const result = await supabase.auth.getUser();
        if (!active) return;
        if (result.error || !result.data.user || new URLSearchParams(window.location.search).has("invalid")) {
          setStatus("invalid");
          return;
        }
        setEmail(result.data.user.email ?? "");
        setStatus("ready");
      } catch { if (active) setStatus("invalid"); }
    }
    void checkSession();
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || status !== "ready") return;
    setError("");
    if (password.length < 12 || password.length > 128) { setError("Use a password between 12 and 128 characters."); return; }
    if (password !== confirmation) { setError("Passwords do not match."); return; }
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw new Error("Could not update your password. Try a different password or request a new reset link.");
      const signOut = await supabase.auth.signOut({ scope: "global" });
      if (signOut.error) await supabase.auth.signOut({ scope: "local" });
      setPassword("");
      setConfirmation("");
      setStatus("complete");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Unable to update your password.");
    } finally { setBusy(false); }
  }

  return <main className="authpage">
    <div className="auth-theme"><ThemeToggle /></div>
    <form className="authcard" onSubmit={submit}>
      <img src="/kinstack-logo.png" alt="KinStack Growth Solutions" />
      <p className="eyebrow">Finance Workspace</p>
      <h1>Reset Password</h1>
      {status === "checking" && <p role="status">Checking your reset link…</p>}
      {status === "invalid" && <>
        <div className="error" role="alert">This reset link is missing, expired, or has already been used. Request a new link and open it in the same browser.</div>
        <Link className="primary" href="/forgot-password">Request New Link</Link>
      </>}
      {status === "ready" && <>
        <p>Choose a new password for {email || "your account"}. Use at least 12 characters.</p>
        <PasswordField label="New Password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy} value={password} onChange={event => setPassword(event.target.value)} />
        <PasswordField label="Confirm Password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy} value={confirmation} onChange={event => setConfirmation(event.target.value)} />
        {error && <div className="error" role="alert">{error}</div>}
        <button className="primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save New Password"}</button>
      </>}
      {status === "complete" && <div className="notice" role="status">Your password has been updated. Sign in with your new password.</div>}
      <Link className="auth-link" href="/login">Back to Sign In</Link>
    </form>
  </main>;
}
