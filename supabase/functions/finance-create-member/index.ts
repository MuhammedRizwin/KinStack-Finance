import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const reply = (status: number, error?: string) => new Response(JSON.stringify(error ? { error } : { ok: true }), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return reply(405, "Use POST.");
  // Validate the user's token here; never trust client-provided role or workspace claims.
  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return reply(401, "Please sign in.");
  const url = Deno.env.get("SUPABASE_URL")!;
  const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await caller.auth.getUser(authorization.slice(7));
  if (authError || !user) return reply(401, "Please sign in again.");
  try {
    const workspace = await caller.from("finance_workspaces").select("id")
      .eq("slug", "kinstack-growth-solutions").single();
    if (workspace.error) return reply(403, "Only the superadmin can create accounts.");
    const membership = await caller.from("finance_members").select("role")
      .eq("workspace_id", workspace.data.id).eq("user_id", user.id).single();
    if (membership.error || membership.data.role !== "superadmin") return reply(403, "Only the superadmin can create accounts.");
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email === user.email?.toLowerCase()
      || !["editor", "viewer"].includes(body.role)) return reply(400, "Enter another valid email and choose Editor or Viewer.");
    if (password.length < 12 || password.length > 128) return reply(400, "Use a password between 12 and 128 characters.");
    // The privileged key is supplied by Supabase's server runtime, never by the web app.
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) {
      if (["email_exists", "user_already_exists"].includes(created.error?.code ?? "")) {
        return reply(409, "This email already has a login. Select Use existing login to grant access without changing its password.");
      }
      return reply(400, "Could not create this login. Check the email and password requirements, then try again.");
    }
    const assigned = await caller.rpc("finance_assign_member", {
      target_workspace: workspace.data.id, target_email: email, target_role: body.role,
    });
    if (assigned.error) {
      // Compensate only for the brand-new login if granting access fails.
      const rollback = await admin.auth.admin.deleteUser(created.data.user.id);
      return reply(500, rollback.error
        ? "Login created, but access was not assigned. Select Use existing login and try again."
        : "Could not assign access. No login was kept; please try again.");
    }
    return reply(201);
  } catch {
    return reply(400, "Unable to process this request.");
  }
});
