"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw new Error("Email or password is incorrect.");
      router.replace("/");
      router.refresh();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Unable to sign in. Please try again.");
    } finally { setBusy(false); }
  }

  return <main className="authpage">
    <form className="authcard" onSubmit={submit}>
      <img src="/kinstack-logo.png" alt="KinStack Growth Solutions" />
      <p className="eyebrow">FINANCE WORKSPACE</p>
      <h1>Sign in</h1>
      <p>Use the email and password provided by your workspace superadmin.</p>
      <label>Email address<input autoComplete="username" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label>Password<input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      {error && <div className="error" role="alert">{error}</div>}
      <button className="primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in securely"}</button>
      <small>Access is limited to invited KinStack team members.</small>
    </form>
  </main>;
}
