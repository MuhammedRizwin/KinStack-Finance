export function WorkspaceLoading({ message = "Opening Your Workspace…" }: { message?: string }) {
  return <main className="authpage workspace-loading" aria-busy="true">
    <section className="workspace-loader" role="status" aria-live="polite">
      <div className="workspace-logo-wrap" aria-hidden="true">
        <span className="workspace-loader-ring" />
        <img src="/kinstack-logo.png" className="workspace-loading-logo" alt="" />
      </div>
      <p>{message}</p>
    </section>
  </main>;
}
