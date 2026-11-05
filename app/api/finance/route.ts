import { access, failure, record } from "../../../lib/finance-server";
import { validDate, cents, total, dueDate } from "../../../lib/finance";

type Body = Record<string, any>;
const str = (value: unknown, max = 200) => String(value ?? "").trim().slice(0, max);
const jsonError = (message: string, status: number) => Response.json({ error: message }, { status });

export async function GET() {
  try {
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
    return Response.json({
      transactions: transactions.data,
      records: (records.data ?? []).map((item) => ({ id: item.id, kind: item.kind, ...item.data })),
      members: members.data,
      receipts: receipts.data,
      role: a.role,
      email: a.user.email,
    });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const a = await access(true);
    const b = await request.json() as Body;
    const id = b.id || crypto.randomUUID();

    if (b.action === "member") {
      if (a.role !== "superadmin") throw new Error("403:Only the superadmin can manage team access.");
      const email = str(b.email).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !["editor", "viewer"].includes(b.role) || email === a.user.email) {
        throw new Error("400:Enter another valid email address and choose Editor or Viewer.");
      }
      const name = typeof b.name === "string" ? b.name.trim() : "";
      const designation = typeof b.designation === "string" ? b.designation.trim() : "";
      if (!name || name.length > 120 || designation.length > 120) {
        throw new Error("400:Enter a member name and keep name and designation within 120 characters.");
      }
      if (!b.existing && b.accountMode !== "existing") {
        if (typeof b.password !== "string" || b.password.length < 12 || b.password.length > 128) {
          throw new Error("400:Use a password between 12 and 128 characters.");
        }
        const result = await a.supabase.functions.invoke("finance-create-member", {
          body: { email, password: b.password, role: b.role, name, designation },
        });
        if (result.error) {
          const response = result.error.context;
          if (response instanceof Response) {
            const details = await response.json().catch(() => ({}));
            return Response.json({ error: details.error || "Unable to create this account." }, {
              status: [400, 401, 403, 409].includes(response.status) ? response.status : 500,
            });
          }
          throw new Error("Unable to reach account creation. Please try again.");
        }
        return Response.json({ ok: true });
      }
      const saved = await a.supabase.rpc("finance_assign_member_profile", {
        target_workspace: a.workspaceId, target_email: email, target_role: b.role,
        target_name: name, target_designation: designation,
      });
      if (saved.error) throw new Error(saved.error.message.includes("account")
        ? `400:${saved.error.message}` : "403:Could not assign that account. Check that its Supabase Auth user exists.");
      return Response.json({ ok: true });
    }

    if (b.action === "record") {
      if (!["client", "invoice", "quotation", "recurring"].includes(b.kind)) throw new Error("400:Invalid record type.");
      if (b.id) await record(a.workspaceId, id, b.kind, a.supabase);
      let data: Body = {};
      if (b.kind === "client") {
        if (!str(b.name)) throw new Error("400:Client name is required.");
        data = { name: str(b.name), email: str(b.email), phone: str(b.phone), address: str(b.address, 1000), notes: str(b.notes, 2000) };
      } else if (b.kind === "recurring") {
        if (!str(b.name) || !cents(b.amount) || !validDate(b.start) || !["monthly", "yearly"].includes(b.frequency) || !["INR", "AED"].includes(b.currency)) throw new Error("400:Check the amount, start date and frequency.");
        data = { name: str(b.name), amount: b.amount, start: b.start, frequency: b.frequency, currency: b.currency, category: str(b.category) || "Other", active: b.active !== false };
      } else {
        if (!str(b.number) || !str(b.clientName) || !validDate(b.date) || !validDate(b.due) || b.due < b.date || !["INR", "AED"].includes(b.currency) || !Array.isArray(b.items) || !b.items.length || b.items.length > 50) throw new Error("400:Check document number, client, dates and items.");
        const items = b.items.map((item: Body) => ({ description: str(item.description, 500), qty: Number(item.qty), price: Number(item.price) }));
        if (items.some((item: Body) => !item.description || !Number.isFinite(item.qty) || item.qty <= 0 || item.qty > 1e6 || !cents(item.price))) throw new Error("400:Each item needs a description, quantity and positive price.");
        const subtotal = items.reduce((sum: number, item: Body) => sum + Math.round(item.qty * item.price), 0);
        if (!Number.isSafeInteger(b.discount) || b.discount < 0 || b.discount > subtotal || !Number.isFinite(b.tax) || b.tax < 0 || b.tax > 100) throw new Error("400:Check tax and discount.");
        if (b.id && b.kind === "invoice") {
          const { data: payments, error } = await a.supabase.from("finance_transactions").select("amount").eq("workspace_id", a.workspaceId).eq("document_id", id);
          if (error) throw error;
          if (payments.length) throw new Error("409:Paid invoices cannot be edited.");
        }
        data = { number: str(b.number), clientId: str(b.clientId), clientName: str(b.clientName), address: str(b.address, 1000), date: b.date, due: b.due, currency: b.currency, items, discount: b.discount, tax: b.tax, notes: str(b.notes, 2000) };
        data.total = total(data);
        if (!cents(data.total)) throw new Error("400:Document total must be positive and within the supported range.");
        if (data.clientId) await record(a.workspaceId, String(data.clientId), "client", a.supabase);
      }
      const saved = await a.supabase.from("finance_records").upsert({ id, workspace_id: a.workspaceId, kind: b.kind, data }, { onConflict: "id" });
      if (saved.error) throw saved.error;
      return Response.json({ ok: true, id });
    }

    if (b.action === "transaction") {
      if (!validDate(b.date) || !cents(b.amount) || !["income", "expense"].includes(b.type) || !["INR", "AED"].includes(b.currency) || !str(b.party)) throw new Error("400:Check payment date, amount, currency and name.");
      if (b.clientId) await record(a.workspaceId, String(b.clientId), "client", a.supabase);
      let transaction: Body = {
        id, workspace_id: a.workspaceId, date: b.date, type: b.type, amount: b.amount,
        party: str(b.party), category: str(b.category) || "Other", description: str(b.description, 1000),
        method: str(b.method) || "Bank transfer", reference: str(b.reference), currency: b.currency,
        client_id: b.clientId || null, document_id: null, recurring_id: null, period: null,
      };
      if (b.documentId) {
        const d = await record(a.workspaceId, b.documentId, "invoice", a.supabase);
        if (b.currency !== d.currency || b.type !== "income") throw new Error("400:Payment must match the invoice currency.");
        const { data: payments, error } = await a.supabase.from("finance_transactions").select("amount").eq("workspace_id", a.workspaceId).eq("document_id", b.documentId);
        if (error) throw error;
        const remaining = Number(d.total) - payments.reduce((sum, item) => sum + Number(item.amount), 0);
        if (b.amount > remaining) throw new Error("409:Payment exceeds the remaining invoice balance.");
        transaction = { ...transaction, party: d.clientName, category: "Invoice payment", reference: d.number, client_id: d.clientId || null, document_id: b.documentId };
      }
      if (b.recurringId) {
        const d = await record(a.workspaceId, b.recurringId, "recurring", a.supabase);
        const period = str(b.period);
        if (!d.active || !(d.frequency === "monthly" ? /^\d{4}-\d{2}$/.test(period) : /^\d{4}$/.test(period))) throw new Error("400:Invalid recurring period.");
        const due = dueDate(d.start, d.frequency, period);
        if (!validDate(due) || due < d.start || b.amount !== d.amount || b.currency !== d.currency || b.type !== "expense") throw new Error("400:Payment must match the recurring expense.");
        transaction = { ...transaction, party: d.name, category: d.category, recurring_id: d.id, period };
      }
      if (b.id) {
        const old = await a.supabase.from("finance_transactions").select("document_id,recurring_id")
          .eq("workspace_id", a.workspaceId).eq("id", id).maybeSingle();
        if (old.error || !old.data) throw new Error("400:Transaction not found.");
        if (old.data.document_id || old.data.recurring_id) throw new Error("409:Delete this linked payment and record it again to correct it.");
        const updated = await a.supabase.from("finance_transactions").update({ ...transaction, document_id: old.data.document_id, recurring_id: old.data.recurring_id })
          .eq("workspace_id", a.workspaceId).eq("id", id);
        if (updated.error) throw updated.error;
      } else {
        const inserted = await a.supabase.from("finance_transactions").insert(transaction);
        if (inserted.error?.code === "23505") throw new Error("409:This recurring period has already been paid.");
        if (inserted.error) throw inserted.error;
      }
      return Response.json({ ok: true, id });
    }
    return jsonError("Unknown action.", 400);
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  try {
    const a = await access(true);
    const b = await request.json() as Body;
    if (b.action === "member") {
      if (a.role !== "superadmin") throw new Error("403:Only the superadmin can manage access.");
      const removed = await a.supabase.from("finance_members").delete().eq("workspace_id", a.workspaceId).eq("email", str(b.email).toLowerCase()).neq("user_id", a.user.id);
      if (removed.error) throw removed.error;
    } else if (b.action === "record") {
      await record(a.workspaceId, str(b.id), undefined, a.supabase);
      const linked = await a.supabase.from("finance_transactions").select("id").eq("workspace_id", a.workspaceId)
        .or(`client_id.eq.${b.id},document_id.eq.${b.id},recurring_id.eq.${b.id}`);
      if (linked.error) throw linked.error;
      if (linked.data.length) throw new Error("409:This record has payment history and cannot be deleted.");
      const docs = await a.supabase.from("finance_records").select("data").eq("workspace_id", a.workspaceId).in("kind", ["invoice", "quotation"]);
      if (docs.error) throw docs.error;
      if (docs.data.some((item) => item.data.clientId === b.id)) throw new Error("409:This client is used by a document.");
      const removed = await a.supabase.from("finance_records").delete().eq("workspace_id", a.workspaceId).eq("id", b.id);
      if (removed.error) throw removed.error;
    } else if (b.action === "transaction") {
      const attached = await a.supabase.from("finance_receipts").select("id").eq("workspace_id", a.workspaceId).eq("transaction_id", b.id);
      if (attached.error) throw attached.error;
      if (attached.data.length) throw new Error("409:Remove attached receipts before deleting this transaction.");
      const removed = await a.supabase.from("finance_transactions").delete().eq("workspace_id", a.workspaceId).eq("id", b.id);
      if (removed.error) throw removed.error;
    } else return jsonError("Unknown action.", 400);
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}
