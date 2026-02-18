import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionFromCookies } from "@/lib/auth/session";
import { getMetricsSafe } from "@/lib/datagen/metrics";
import { TasksPanel } from "@/components/TasksPanel";

export default async function DashboardPage() {
  const session = await getSessionFromCookies(cookies());
  if (!session) {
    redirect("/login");
  }

  const metrics = await getMetricsSafe();

  return (
    <main className="page">
      <section className="panel">
        <header className="panel__header">
          <div>
            <p className="eyebrow">Welcome</p>
            <h1>DataGems Dashboard</h1>
            <p className="muted">
              Track generation jobs, see progress, and export results. Metrics are
              persisted in CStore. DataGems is maintained by{" "}
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
          <div className="panel__actions">
            <div className="pill">CStore-secured workspace</div>
          </div>
        </header>

        <div className="summary-grid">
          <MetricCard
            label="Total jobs"
            value={metrics?.totalJobs ?? 0}
            hint={metrics ? "Persisted" : "Metrics unavailable"}
          />
          <MetricCard
            label="Records requested"
            value={metrics?.totalRecordsRequested ?? 0}
            hint="Since first run"
          />
          <MetricCard
            label="Records generated"
            value={metrics?.totalRecordsGenerated ?? 0}
            hint="Successful completions"
          />
          <MetricCard
            label="Active jobs"
            value={metrics?.activeJobs ?? 0}
            hint="Currently running"
          />
          <MetricCard
            label="Failed jobs"
            value={metrics?.failedJobs ?? 0}
            hint="Needs attention"
          />
          <MetricCard
            label="Last job"
            value={
              metrics?.lastJobAt
                ? new Date(metrics.lastJobAt).toLocaleString()
                : "N/A"
            }
            hint="UTC time"
          />
        </div>

        <div className="panel__body">
          <h2>Next up</h2>
          <ul className="list">
            <li>Draft schema first, then confirm to start distributed jobs.</li>
            <li>Jobs persist in CStore/R1FS; UI polls for updates.</li>
            <li>JSON/CSV downloads appear after completion.</li>
            <li>
              Ownership reference:{" "}
              <a
                className="inline-link"
                href="https://smartclover.ro/services"
                target="_blank"
                rel="noreferrer"
              >
                SmartClover product portfolio
              </a>
              .
            </li>
          </ul>
        </div>

        <TasksPanel />
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="metric">
      <p className="muted">{label}</p>
      <p className="metric__value">{value}</p>
      {hint ? <p className="muted small">{hint}</p> : null}
    </div>
  );
}
