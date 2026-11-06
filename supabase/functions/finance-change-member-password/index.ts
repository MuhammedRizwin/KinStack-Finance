import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const reply = (status: number, error?: string) => new Response(JSON.stringify(error ? { error } : { ok: true }), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return reply(405, "Use POST.");
  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return reply(401, "Please sign in.");
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await caller.auth.getUser(authorization.slice(7));
    if (authError || !user) return reply(401, "Please sign in again.");
    const workspace = await caller.from("finance_workspaces").select("id")
      .eq("slug", "kinstack-growth-solutions").single();
    if (workspace.error) return reply(403, "Only superadmins can change member passwords.");
    const membership = await caller.from("finance_members").select("role")
      .eq("workspace_id", workspace.data.id).eq("user_id", user.id).single();
    if (membership.error || membership.data.role !== "superadmin") return reply(403, "Only superadmins can change member passwords.");
    const body = await request.json();
    const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId)) return reply(400, "Choose a valid member.");
    if (targetUserId === user.id) return reply(400, "Use the password reset page to change your own password.");
    if (password.length < 12 || password.length > 128) return reply(400, "Use a password between 12 and 128 characters.");
    // Resolve the target from this workspace, never from client-provided email or role.
    const target = await caller.from("finance_members").select("user_id")
      .eq("workspace_id", workspace.data.id).eq("user_id", targetUserId).maybeSingle();
    if (target.error || !target.data) return reply(403, "This account is not a member of your workspace.");
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await admin.auth.admin.updateUserById(target.data.user_id, { password });
    if (error) return reply(400, "Could not change the password. Try a different password and check the member account.");
    // Never log, return, or store the submitted plaintext password in finance records.
    return reply(200);
  } catch {
    return reply(400, "Unable to process this password change.");
  }
});
