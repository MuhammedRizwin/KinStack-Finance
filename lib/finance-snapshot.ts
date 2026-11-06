import { access } from "./finance-server";

export async function loadFinanceSnapshot() {
    const a = await access();
    const [transactions, records, members, receipts] = await Promise.all([
      a.supabase.from("finance_transactions").select("*").eq("workspace_id", a.workspaceId).order("date", { ascending: false }),
      a.supabase.from("finance_records").select("id,kind,data").eq("workspace_id", a.workspaceId),
      a.role === "superadmin"
        ? a.supabase.from("finance_members").select("user_id,email,role,name,designation").eq("workspace_id", a.workspaceId).neq("user_id", a.user.id).order("email")
        : Promise.resolve({ data: [], error: null }),
      a.supabase.from("finance_receipts").select("id,transaction_id,name,mime,size").eq("workspace_id", a.workspaceId),
    ]);
    for (const result of [transactions, records, members, receipts]) if (result.error) throw result.error;
    return {
      transactions: transactions.data ?? [],
      records: (records.data ?? []).map((item) => ({ id: item.id, kind: item.kind, ...item.data })),
      members: members.data ?? [],
      receipts: receipts.data ?? [],
      role: a.role,
      email: a.user.email,
    };
}
