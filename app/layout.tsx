import Image from "next/image";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Mona_Sans, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { getAppVersion } from "@/lib/version";
import { LogoutButton } from "@/components/LogoutButton";
import { getSessionFromCookies } from "@/lib/auth/session";

const monaSans = Mona_Sans({
  variable: "--font-mona-sans",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DataGems",
  description:
    "Generate synthetic datasets with one-call-per-record inference. Open-source system by SmartClover SRL.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [version, session] = await Promise.all([
    getAppVersion(),
    getSessionFromCookies(cookies()),
  ]);

  return (
    <html lang="en">
      <body className={`${monaSans.variable} ${robotoMono.variable}`}>
        <div className="app-shell">
          <header className="topbar">
            <div className="brand">
              <Image
                src="/datagems.svg"
                alt="DataGems logo"
                width={180}
                height={32}
                className="brand__logo"
                priority
              />
              <div className="brand__copy">
                <p className="brand__tagline">Synthetic dataset generator</p>
                <p className="brand__owner">
                  Open source by{" "}
                  <a
                    className="inline-link"
                    href="https://smartclover.ro/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    SmartClover SRL
                  </a>
                </p>
                <p className="brand__version">Version {version}</p>
              </div>
            </div>
            {session ? (
              <div className="panel__actions">
                <div className="pill">
                  Signed in as <strong>{session.username}</strong>
                </div>
                {session.role === "admin" ? (
                  <Link className="button button--ghost" href="/admin">
                    Admin
                  </Link>
                ) : null}
                <LogoutButton />
              </div>
            ) : (
              <div className="pill">CStore-secured workspace</div>
            )}
          </header>
          {children}
          <footer className="site-footer">
            <p className="muted small">
              DataGems is maintained by SmartClover SRL.
            </p>
            <div className="site-footer__links">
              <a
                className="inline-link"
                href="https://smartclover.ro/"
                target="_blank"
                rel="noreferrer"
              >
                smartclover.ro
              </a>
              <a
                className="inline-link"
                href="https://smartclover.ro/about"
                target="_blank"
                rel="noreferrer"
              >
                About
              </a>
              <a
                className="inline-link"
                href="https://smartclover.ro/products"
                target="_blank"
                rel="noreferrer"
              >
                Products
              </a>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
