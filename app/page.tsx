import { redirect } from "next/navigation";
import FinanceApp from "../components/finance-app";
import { loadFinanceSnapshot } from "../lib/finance-snapshot";

export const dynamic = "force-dynamic";

export default async function Page() {
  let initialData: Awaited<ReturnType<typeof loadFinanceSnapshot>> | undefined;
  let accessDenied = false;
  try {
    initialData = await loadFinanceSnapshot();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("401:")) redirect("/login");
    if (error instanceof Error && error.message.startsWith("403:")) accessDenied = true;
    else throw error;
  }
  if (accessDenied) {
    return <main className="authpage"><section className="authcard">
      <h1>Workspace Access Required</h1>
      <p>Your account does not have access to this workspace. Contact your superadmin.</p>
      <a className="primary" href="/login">Back to Sign In</a>
    </section></main>;
  }
  if (!initialData) throw new Error("Unable to load the workspace.");
  return <FinanceApp initialData={initialData} />;
}
