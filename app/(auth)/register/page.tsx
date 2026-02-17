"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, country }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.error ?? "Unable to create account");
      setLoading(false);
      return;
    }

    setSuccess("Account created. Check your email for credentials.");
    setLoading(false);
  };

  return (
    <main className="page">
      <section className="panel">
        <header className="panel__header">
          <div>
            <p className="eyebrow">DataGen</p>
            <h1>Create account</h1>
            <p className="muted">
              We will email your credentials once the account is created. DataGen
              is an open-source system by{" "}
              <a
                className="inline-link"
                href="https://smartclover.ro/"
                target="_blank"
                rel="noreferrer"
              >
                SmartClover SRL
              </a>
              .
            </p>
          </div>
        </header>

        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Name</span>
            <input
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>Email</span>
            <input
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>Country</span>
            <input
              name="country"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              required
            />
          </label>

          {error ? <p className="error">{error}</p> : null}
          {success ? <p className="muted">{success}</p> : null}

          <div className="form__actions">
            <button className="button" type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create account"}
            </button>
            <Link className="button button--ghost" href="/login">
              Back to sign in
            </Link>
          </div>
          <p className="muted small">
            Ownership references:{" "}
            <a
              className="inline-link"
              href="https://smartclover.ro/about"
              target="_blank"
              rel="noreferrer"
            >
              About SmartClover
            </a>
            {" · "}
            <a
              className="inline-link"
              href="https://smartclover.ro/services"
              target="_blank"
              rel="noreferrer"
            >
              SmartClover products
            </a>
          </p>
        </form>
      </section>
    </main>
  );
}
