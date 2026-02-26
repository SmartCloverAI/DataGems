"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      router.push("/");
      router.refresh();
      return;
    }

    const data = await response.json().catch(() => null);
    setError(data?.error ?? "Login failed");
    setLoading(false);
  };

  return (
    <main className="page">
      <section className="panel">
        <header className="panel__header">
          <div>
            <p className="eyebrow">DataGems</p>
            <h1>Sign in</h1>
            <p className="muted">
              Use your cstore-auth credentials to access the DataGems dashboard.
              This open-source system is owned by{" "}
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

        <div className="auth-split">
          <section className="auth-pane auth-pane--primary">
            <h2>Sign in</h2>
            <form className="form auth-form" onSubmit={handleSubmit}>
              <label className="field">
                <span>Username</span>
                <input
                  name="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </label>

              <label className="field">
                <span>Password</span>
                <div className="password-input">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    className="password-input__reveal"
                    type="button"
                    aria-label="Hold to show password"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setShowPassword(true);
                    }}
                    onMouseUp={() => setShowPassword(false)}
                    onMouseLeave={() => setShowPassword(false)}
                    onTouchStart={(event) => {
                      event.preventDefault();
                      setShowPassword(true);
                    }}
                    onTouchEnd={() => setShowPassword(false)}
                    onTouchCancel={() => setShowPassword(false)}
                    onKeyDown={(event) => {
                      if (event.key === " " || event.key === "Enter") {
                        event.preventDefault();
                        setShowPassword(true);
                      }
                    }}
                    onKeyUp={() => setShowPassword(false)}
                    onBlur={() => setShowPassword(false)}
                  >
                    <span className="sr-only">Show password while pressed</span>
                    <svg
                      className="password-input__eye"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6zm10 3.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                </div>
              </label>

              {error ? <p className="error">{error}</p> : null}

              <button className="button" type="submit" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>
          </section>

          <aside className="auth-pane auth-pane--secondary auth-pane--signup">
            <p className="eyebrow">New to DataGems</p>
            <h2>Create an account</h2>
            <p className="muted">
              New here? Create a DataGems account and receive credentials by email.
            </p>
            <div className="signup-meta">
              <span className="signup-pill">~1 minute setup</span>
              <span className="signup-pill">Credentials by email</span>
            </div>
            <div className="signup-checklist">
              <div className="signup-item">
                <span className="signup-item__icon" aria-hidden="true">
                  1
                </span>
                <div>
                  <strong>Share basic profile details</strong>
                  <p className="muted small">Name, email, and country are required.</p>
                </div>
              </div>
              <div className="signup-item">
                <span className="signup-item__icon" aria-hidden="true">
                  2
                </span>
                <div>
                  <strong>Receive your login credentials</strong>
                  <p className="muted small">
                    A generated username and password are sent automatically.
                  </p>
                </div>
              </div>
              <div className="signup-item">
                <span className="signup-item__icon" aria-hidden="true">
                  3
                </span>
                <div>
                  <strong>Resend if delivery fails</strong>
                  <p className="muted small">
                    Use the resend action on the registration page if needed.
                  </p>
                </div>
              </div>
            </div>
            <div className="signup-actions">
              <Link className="button auth-pane__cta" href="/register">
                Create account
              </Link>
            </div>
            <p className="muted small">
              Project owner references:{" "}
              <a
                className="inline-link"
                href="https://smartclover.ro/about"
                target="_blank"
                rel="noreferrer"
              >
                SmartClover About
              </a>
              {" · "}
              <a
                className="inline-link"
                href="https://smartclover.ro/products"
                target="_blank"
                rel="noreferrer"
              >
                SmartClover Products
              </a>
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}
