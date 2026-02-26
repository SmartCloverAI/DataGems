import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AdminAccountsPanel } from "@/components/AdminAccountsPanel";
import { getSessionFromCookies } from "@/lib/auth/session";

export default async function AdminAccountsPage() {
  const session = await getSessionFromCookies(cookies());
  if (!session) {
    redirect("/login");
  }
  if (session.role !== "admin") {
    redirect("/");
  }

  return (
    <main className="page">
      <section className="panel">
        <header className="panel__header">
          <div>
            <p className="eyebrow">Admin only</p>
            <h1>Account Management</h1>
            <p className="muted">
              View all current accounts (username, email, country) and remove any
              account except your own.
            </p>
          </div>
          <div className="panel__actions">
            <div className="pill">User accounts</div>
          </div>
        </header>

        <AdminAccountsPanel currentUsername={session.username} />
      </section>
    </main>
  );
}
