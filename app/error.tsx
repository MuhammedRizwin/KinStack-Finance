"use client";

import { ThemeToggle } from "../components/theme-toggle";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="authpage">
    <div className="auth-theme"><ThemeToggle /></div>
    <section className="authcard">
      <img src="/kinstack-logo.png" alt="KinStack Growth Solutions" />
      <h1>Unable to Open Workspace</h1>
      <p>We couldn’t load your workspace. Check your connection and try again.</p>
      <button className="primary" type="button" onClick={reset}>Try Again</button>
      <a className="auth-link" href="/login">Back to Sign In</a>
    </section>
  </main>;
}
