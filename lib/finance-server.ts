import { createSupabaseServerClient } from "./supabase/server";

export type FinanceAccess = {
  user: { id: string; email: string };
  workspaceId: string;
  role: "superadmin" | "editor" | "viewer";
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
};

export async function access(write = false, superadminOnly = false): Promise<FinanceAccess> {
  const session = await createSupabaseServerClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user || !user.email) throw new Error("401:Please sign in with your email and password.");

  const isBootstrapUser = user.email.toLowerCase() === process.env.SUPERADMIN_EMAIL?.toLowerCase();
  const findMembership = () => session.from("finance_members")
    .select("role,workspace_id,finance_workspaces!inner(slug)")
    .eq("user_id", user.id).eq("finance_workspaces.slug", "kinstack-growth-solutions").maybeSingle();
  let membership = await findMembership();
  if (membership.error) throw new Error("Unable to check workspace access.");
  if (!membership.data && isBootstrapUser) {
    const bootstrap = await session.rpc("finance_bootstrap_workspace");
    if (bootstrap.error) throw new Error("403:Unable to initialize this account's finance workspace.");
    membership = await findMembership();
    if (membership.error) throw new Error("Unable to check workspace access.");
  }
  const role = membership.data?.role as FinanceAccess["role"] | undefined;
  if (!role) throw new Error("403:Your account does not have access to this workspace.");
  if (write && role === "viewer") throw new Error("403:Viewers can read and export records but cannot make changes.");
  if (superadminOnly && role !== "superadmin") throw new Error("403:Only the superadmin can manage team access.");
  return { user: { id: user.id, email: user.email.toLowerCase() }, workspaceId: membership.data!.workspace_id, role, supabase: session };
}

export function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to complete request.";
  const match = message.match(/^(401|403|400|409):(.+)$/);
  return Response.json({ error: match?.[2] ?? message }, { status: match ? Number(match[1]) : 500 });
}

export async function record(workspaceId: string, id: string, kind?: string, supabase?: FinanceAccess["supabase"]): Promise<Record<string, any>> {
  const client = supabase ?? await createSupabaseServerClient();
  const { data, error } = await client.from("finance_records")
    .select("id,kind,data").eq("workspace_id", workspaceId).eq("id", id).maybeSingle();
  if (error || !data || (kind && data.kind !== kind)) throw new Error("400:Record not found.");
  return { id: data.id, ...(data.data as Record<string, any>) };
}
