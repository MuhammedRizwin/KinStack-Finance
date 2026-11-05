import { access, failure } from "../../../lib/finance-server";

const BUCKET = "kinstack-finance-receipts";
export async function POST(request: Request) {
  try {
    const a = await access(true);
    const form = await request.formData();
    const file = form.get("file");
    const transactionId = String(form.get("transactionId") ?? "");
    if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) {
      throw new Error("400:Upload a JPG, PNG, WebP or PDF up to 10 MB.");
    }
    const transaction = await a.supabase.from("finance_transactions").select("id")
      .eq("workspace_id", a.workspaceId).eq("id", transactionId).maybeSingle();
    if (transaction.error || !transaction.data) throw new Error("400:Save the transaction before uploading a receipt.");
    const id = crypto.randomUUID();
    const path = `${a.workspaceId}/${id}`;
    const uploaded = await a.supabase.storage.from(BUCKET).upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
    if (uploaded.error) throw uploaded.error;
    const saved = await a.supabase.from("finance_receipts").insert({
      id, workspace_id: a.workspaceId, transaction_id: transactionId,
      name: file.name.slice(0, 200), mime: file.type, size: file.size, object_path: path,
    });
    if (saved.error) {
      await a.supabase.storage.from(BUCKET).remove([path]);
      throw saved.error;
    }
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}

export async function GET(request: Request) {
  try {
    const a = await access();
    const id = new URL(request.url).searchParams.get("id");
    const receipt = await a.supabase.from("finance_receipts").select("*")
      .eq("workspace_id", a.workspaceId).eq("id", id).maybeSingle();
    if (receipt.error || !receipt.data) throw new Error("400:Receipt not found.");
    const downloaded = await a.supabase.storage.from(BUCKET).download(receipt.data.object_path);
    if (downloaded.error || !downloaded.data) throw new Error("400:Receipt unavailable.");
    return new Response(downloaded.data, { headers: {
      "Content-Type": receipt.data.mime,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(receipt.data.name)}`,
      "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store",
    } });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  try {
    const a = await access(true);
    const body = await request.json() as { id?: string };
    const receipt = await a.supabase.from("finance_receipts").select("object_path")
      .eq("workspace_id", a.workspaceId).eq("id", body.id).maybeSingle();
    if (receipt.error || !receipt.data) throw new Error("400:Receipt not found.");
    const removedFile = await a.supabase.storage.from(BUCKET).remove([receipt.data.object_path]);
    if (removedFile.error) throw removedFile.error;
    const removed = await a.supabase.from("finance_receipts").delete()
      .eq("workspace_id", a.workspaceId).eq("id", body.id);
    if (removed.error) throw removed.error;
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}
