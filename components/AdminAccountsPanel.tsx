"use client";

import { useEffect, useState } from "react";

type AdminAccount = {
  username: string;
  email: string | null;
  country: string | null;
};

export function AdminAccountsPanel({ currentUsername }: { currentUsername: string }) {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deletingUsername, setDeletingUsername] = useState<string | null>(null);

  const loadAccounts = async () => {
    setError(null);
    const response = await fetch("/api/admin/accounts", { cache: "no-store" });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const message =
        response.status === 401
          ? "Session expired. Please sign in again."
          : payload?.error ?? "Unable to load accounts";
      setError(message);
      setAccounts([]);
      return;
    }
    const payload = await response
      .json()
      .catch(() => ({ accounts: [] as AdminAccount[] }));
    setAccounts(Array.isArray(payload.accounts) ? payload.accounts : []);
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      await loadAccounts();
      if (!cancelled) {
        setLoading(false);
      }
    };
    run().catch(() => {
      if (!cancelled) {
        setError("Unable to load accounts");
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDelete = async (username: string) => {
    if (!window.confirm(`Delete account "${username}"?`)) return;
    setDeletingUsername(username);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error ?? "Failed to delete account");
        return;
      }

      setNotice(`Deleted ${username}`);
      await loadAccounts();
    } catch {
      setError("Failed to delete account");
    } finally {
      setDeletingUsername(null);
    }
  };

  return (
    <section className="panel__body">
      <div className="task__actions">
        <h2>Accounts</h2>
        <button
          className="button button--ghost"
          type="button"
          onClick={() => {
            setLoading(true);
            loadAccounts()
              .catch(() => {
                setError("Unable to load accounts");
              })
              .finally(() => setLoading(false));
          }}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="muted">{notice}</p> : null}

      <div className="peer-table admin-table">
        <div className="peer-table__grid">
          <div className="admin-row admin-row--header">
            <span>Username</span>
            <span>Email</span>
            <span>Country</span>
            <span>Actions</span>
          </div>
          {accounts.map((account) => {
            const isCurrentUser = account.username === currentUsername;
            return (
              <div key={account.username} className="admin-row">
                <span>{account.username}</span>
                <span>{account.email ?? "—"}</span>
                <span>{account.country ?? "—"}</span>
                <span>
                  <button
                    className="button button--ghost"
                    type="button"
                    onClick={() => handleDelete(account.username)}
                    disabled={isCurrentUser || deletingUsername === account.username}
                  >
                    {isCurrentUser
                      ? "Current session"
                      : deletingUsername === account.username
                        ? "Deleting..."
                        : "Delete"}
                  </button>
                </span>
              </div>
            );
          })}
          {!loading && accounts.length === 0 ? (
            <div className="admin-row">
              <span>No accounts found.</span>
              <span>—</span>
              <span>—</span>
              <span>—</span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
