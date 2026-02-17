"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { ACTIVE_POLL_SECONDS, IDLE_POLL_SECONDS } from "@/lib/datagen/polling";

type JobStatus = "queued" | "running" | "succeeded" | "failed";

type JobBase = {
  id: string;
  title: string;
  owner: string;
  status: JobStatus;
  totalRecords: number;
  totalGenerated: number;
  totalOk: number;
  totalFailed: number;
  peerCount: number;
  jobDetailsCid: string;
  createdAt: string;
  schemaGeneratedAt: string;
  jobStartedAt?: string;
  jobFinishedAt?: string;
  schemaDurationMs: number;
  recordsDurationMs?: number;
  schemaRefreshes: number;
  updatedAt: string;
};

type JobPeerState = {
  peerId: string;
  assigned: number;
  range: { start: number; end: number };
  generatedOk: number;
  generatedFailed: number;
  startedAt?: string;
  finishedAt?: string;
  resultCid?: string;
};

type JobDetails = {
  description: string;
  instructions: string;
  schema: unknown;
};

type UiTestPreset = {
  title?: string;
  description?: string;
  instructions?: string;
  totalRecords?: number;
  useExternalApi?: boolean;
  inferenceBaseUrl?: string;
  inferencePath?: string;
  inferenceApiKey?: string;
  inferenceModel?: string;
  inferenceParams?: Record<string, unknown>;
};

type SavedProfile = {
  id: string;
  name: string;
  baseUrl: string | null;
  path: string | null;
  model: string | null;
  hasApiKey: boolean;
};

function loadUiTestPreset(): UiTestPreset | null {
  const raw = process.env.NEXT_PUBLIC_DATAGEN_UI_TEST_PRESET;
  if (!raw || raw.trim().length === 0) return null;
  try {
    const parsed = JSON.parse(raw) as UiTestPreset;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function TasksPanel() {
  const [jobs, setJobs] = useState<JobBase[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [totalRecords, setTotalRecords] = useState(10);
  const datasetMode = true;
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [useExternalApi, setUseExternalApi] = useState(false);
  const [inferenceBaseUrl, setInferenceBaseUrl] = useState("");
  const [inferencePath, setInferencePath] = useState("");
  const [inferenceApiKey, setInferenceApiKey] = useState("");
  const [hasSavedApiKey, setHasSavedApiKey] = useState(false);
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [maxProfiles, setMaxProfiles] = useState(10);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [profileName, setProfileName] = useState("");
  const [inferenceModel, setInferenceModel] = useState("");
  const [inferenceParams, setInferenceParams] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const [draftToken, setDraftToken] = useState<string | null>(null);
  const [draftSchema, setDraftSchema] = useState<unknown | null>(null);
  const [schemaMeta, setSchemaMeta] = useState<{
    schemaGeneratedAt: string;
    schemaDurationMs: number;
    schemaRefreshes: number;
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsBusy, setSettingsBusy] = useState(false);

  const [jobDetails, setJobDetails] = useState<Record<string, JobDetails>>({});
  const [jobPeers, setJobPeers] = useState<Record<string, JobPeerState[]>>({});
  const [loadingJobIds, setLoadingJobIds] = useState<Record<string, boolean>>({});
  const [jobDetailErrors, setJobDetailErrors] = useState<Record<string, string>>({});
  const [schemaOpenByJobId, setSchemaOpenByJobId] = useState<Record<string, boolean>>({});
  const uiPresetAppliedRef = useRef(false);

  const latestJobsRef = useRef<JobBase[]>([]);

  const refresh = async () => {
    const res = await fetch("/api/tasks", { cache: "no-store" });
    if (!res.ok) {
      setError("Failed to load jobs");
      return;
    }
    const data = await res.json();
    setJobs(data.jobs ?? []);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;

    const schedule = (seconds: number) => {
      timer = setTimeout(tick, seconds * 1000);
    };

    const tick = async () => {
      await refresh();
      const hasActive = (latestJobsRef.current ?? []).some(
        (job) => job.status === "running" || job.status === "queued",
      );
      schedule(hasActive ? ACTIVE_POLL_SECONDS : IDLE_POLL_SECONDS);
    };

    tick();
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    latestJobsRef.current = jobs;
  }, [jobs]);

  useEffect(() => {
    if (uiPresetAppliedRef.current) return;
    const preset = loadUiTestPreset();
    if (!preset) return;
    uiPresetAppliedRef.current = true;

    if (typeof preset.title === "string") setTitle(preset.title);
    if (typeof preset.description === "string") setDescription(preset.description);
    if (typeof preset.instructions === "string") setInstructions(preset.instructions);
    if (typeof preset.totalRecords === "number" && Number.isFinite(preset.totalRecords)) {
      setTotalRecords(Math.max(1, Math.min(200, Math.floor(preset.totalRecords))));
    }
    if (typeof preset.inferenceBaseUrl === "string") {
      setInferenceBaseUrl(preset.inferenceBaseUrl);
      setAdvancedOpen(true);
      setUseExternalApi(true);
    }
    if (typeof preset.inferencePath === "string") {
      setInferencePath(preset.inferencePath);
      setAdvancedOpen(true);
      setUseExternalApi(true);
    }
    if (typeof preset.inferenceApiKey === "string") {
      setInferenceApiKey(preset.inferenceApiKey);
      setAdvancedOpen(true);
      setUseExternalApi(true);
    }
    if (typeof preset.useExternalApi === "boolean") {
      setUseExternalApi(preset.useExternalApi);
    }
    if (typeof preset.inferenceModel === "string") setInferenceModel(preset.inferenceModel);
    if (preset.inferenceParams && typeof preset.inferenceParams === "object") {
      setInferenceParams(JSON.stringify(preset.inferenceParams, null, 2));
      setAdvancedOpen(true);
    }
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      const res = await fetch("/api/user/settings", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const nextProfiles = Array.isArray(data.profiles) ? data.profiles : [];
      setProfiles(nextProfiles);
      setMaxProfiles(
        typeof data.maxProfiles === "number" && Number.isFinite(data.maxProfiles)
          ? data.maxProfiles
          : 10,
      );
      if (typeof data.activeProfileId === "string") {
        setSelectedProfileId(data.activeProfileId);
      }
      if (typeof data.baseUrl === "string") {
        setInferenceBaseUrl(data.baseUrl);
        setAdvancedOpen(true);
      }
      if (typeof data.path === "string") {
        setInferencePath(data.path);
      }
      if (typeof data.model === "string") {
        setInferenceModel(data.model);
      }
      setHasSavedApiKey(Boolean(data.hasApiKey));
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const loadModels = async () => {
      if (!advancedOpen || !useExternalApi || !inferenceBaseUrl) {
        setModels([]);
        setModelsError(null);
        return;
      }
      setModelsLoading(true);
      setModelsError(null);
      const res = await fetch("/api/user/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: selectedProfileId || undefined,
          baseUrl: inferenceBaseUrl,
          apiKey: inferenceApiKey || undefined,
        }),
      });
      setModelsLoading(false);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setModels([]);
        setModelsError(data?.error ?? "Could not load models");
        return;
      }
      const data = await res.json().catch(() => null);
      const normalized =
        Array.isArray(data?.models) && data.models.length > 0
          ? data.models
              .map((m: any) =>
                typeof m === "string"
                  ? m
                  : typeof m?.id === "string"
                    ? m.id
                    : typeof m?.name === "string"
                      ? m.name
                      : null,
              )
              .filter((m: string | null): m is string => Boolean(m))
          : [];
      setModels(normalized);
      if (normalized.length > 0 && !inferenceModel) {
        setInferenceModel(normalized[0]);
      }
    };
    loadModels();
  }, [
    advancedOpen,
    inferenceApiKey,
    inferenceBaseUrl,
    inferenceModel,
    selectedProfileId,
    useExternalApi,
  ]);

  useEffect(() => {
    if (!selectedProfileId) return;
    const selected = profiles.find((profile) => profile.id === selectedProfileId);
    if (!selected) return;
    setProfileName(selected.name);
    setInferenceBaseUrl(selected.baseUrl ?? "");
    setInferencePath(selected.path ?? "");
    setInferenceModel(selected.model ?? "");
    setHasSavedApiKey(selected.hasApiKey);
  }, [profiles, selectedProfileId]);

  const activeJobs = useMemo(
    () => jobs.filter((job) => job.status === "running" || job.status === "queued"),
    [jobs],
  );

  const parseParams = () => {
    if (!inferenceParams || inferenceParams.trim().length === 0) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(inferenceParams);
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
      return undefined;
    } catch {
      return null;
    }
  };

  const refreshSettings = async () => {
    const res = await fetch("/api/user/settings", { cache: "no-store" });
    if (!res.ok) return false;
    const data = await res.json();
    const nextProfiles = Array.isArray(data.profiles) ? data.profiles : [];
    setProfiles(nextProfiles);
    setMaxProfiles(
      typeof data.maxProfiles === "number" && Number.isFinite(data.maxProfiles)
        ? data.maxProfiles
        : 10,
    );
    if (typeof data.activeProfileId === "string") {
      setSelectedProfileId(data.activeProfileId);
    }
    setHasSavedApiKey(Boolean(data.hasApiKey));
    return true;
  };

  const saveSettings = async (options?: { asNew?: boolean }) => {
    const payload: Record<string, unknown> = {
      mode: "upsert",
      id: options?.asNew ? undefined : selectedProfileId || undefined,
      name: profileName || undefined,
      baseUrl: inferenceBaseUrl || undefined,
      path: inferencePath || undefined,
      model: inferenceModel || undefined,
      setActive: true,
    };
    if (inferenceApiKey) {
      payload.apiKey = inferenceApiKey;
    }
    const res = await fetch("/api/user/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return false;
    if (inferenceApiKey) setInferenceApiKey("");
    return refreshSettings();
  };

  const handleActivateProfile = async (profileId: string) => {
    setSettingsBusy(true);
    const res = await fetch("/api/user/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "activate", id: profileId }),
    });
    setSettingsBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Failed to activate profile");
      return;
    }
    const data = await res.json().catch(() => null);
    setSelectedProfileId(profileId);
    const active = data?.activeProfile;
    if (active) {
      setInferenceBaseUrl(active.baseUrl ?? "");
      setInferencePath(active.path ?? "");
      setInferenceModel(active.model ?? "");
      setHasSavedApiKey(Boolean(active.hasApiKey));
    }
  };

  const handleDeleteProfile = async () => {
    if (!selectedProfileId) return;
    setSettingsBusy(true);
    const res = await fetch("/api/user/settings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selectedProfileId }),
    });
    setSettingsBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Failed to delete profile");
      return;
    }
    await refreshSettings();
  };

  const handleGenerateSchema = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const params = parseParams();
    if (params === null) {
      setError("Inference params must be valid JSON");
      setSubmitting(false);
      return;
    }

    if (advancedOpen && useExternalApi) {
      const saved = await saveSettings();
      if (!saved) {
        setError("Failed to save advanced settings");
        setSubmitting(false);
        return;
      }
    }

    const res = await fetch("/api/tasks/schema", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        totalRecords,
        description,
        instructions,
        datasetMode,
        useExternalApi,
        inferenceBaseUrl: useExternalApi ? inferenceBaseUrl || undefined : undefined,
        inferencePath: useExternalApi ? inferencePath || undefined : undefined,
        profileId: useExternalApi ? selectedProfileId || undefined : undefined,
        inferenceModel: useExternalApi ? inferenceModel || undefined : undefined,
        inferenceParams: params,
        previousDraftToken: draftToken ?? undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Failed to generate schema");
      setSubmitting(false);
      return;
    }

    const data = await res.json();
    setDraftSchema(data.schema ?? null);
    setSchemaMeta({
      schemaGeneratedAt: data.schemaGeneratedAt,
      schemaDurationMs: data.schemaDurationMs,
      schemaRefreshes: data.schemaRefreshes,
    });
    setDraftToken(data.draftToken ?? null);
    setSubmitting(false);
  };

  const handleConfirmJob = async () => {
    if (!draftToken) return;
    setConfirming(true);
    setError(null);

    const params = parseParams();
    if (params === null) {
      setError("Inference params must be valid JSON");
      setConfirming(false);
      return;
    }

    if (advancedOpen && useExternalApi) {
      const saved = await saveSettings();
      if (!saved) {
        setError("Failed to save advanced settings");
        setConfirming(false);
        return;
      }
    }

    const res = await fetch("/api/tasks/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        draftToken,
        useExternalApi,
        profileId: useExternalApi ? selectedProfileId || undefined : undefined,
        inferenceBaseUrl: useExternalApi ? inferenceBaseUrl || undefined : undefined,
        inferencePath: useExternalApi ? inferencePath || undefined : undefined,
        inferenceModel: useExternalApi ? inferenceModel || undefined : undefined,
        inferenceParams: useExternalApi ? params : undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Failed to confirm job");
      setConfirming(false);
      return;
    }

    setDraftToken(null);
    setDraftSchema(null);
    setSchemaMeta(null);
    setTitle("");
    setDescription("");
    setInstructions("");
    setTotalRecords(10);
    setInferenceParams("");

    await refresh();
    setConfirming(false);
  };

  const loadJobDetails = async (jobId: string) => {
    if (loadingJobIds[jobId]) return;
    setLoadingJobIds((prev) => ({ ...prev, [jobId]: true }));
    const res = await fetch(`/api/tasks/${jobId}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data?.details) {
        setJobDetails((prev) => ({ ...prev, [jobId]: data.details }));
      }
      if (Array.isArray(data?.peers)) {
        setJobPeers((prev) => ({ ...prev, [jobId]: data.peers }));
      }
      setJobDetailErrors((prev) => ({ ...prev, [jobId]: "" }));
    } else {
      const data = await res.json().catch(() => null);
      setJobDetailErrors((prev) => ({
        ...prev,
        [jobId]: data?.error ?? "Failed to load job details",
      }));
    }
    setLoadingJobIds((prev) => ({ ...prev, [jobId]: false }));
  };

  return (
    <section className="panel__body">
      <div className="panel__header">
        <div>
          <h2>Create a generation job</h2>
          <p className="muted">
            Draft a schema first, then confirm to distribute records across peers.
            DataGen is maintained by{" "}
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
      </div>

      <form className="form" onSubmit={handleGenerateSchema}>
        <label className="field">
          <span>Job title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </label>

        <label className="field">
          <span>Description</span>
          <textarea
            className="textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
          />
        </label>

        <label className="field">
          <span>Instructions</span>
          <textarea
            className="textarea"
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            required
          />
        </label>

        <div className="field__row">
          <label className="field">
            <span>Total records</span>
            <input
              type="number"
              min={1}
              max={200}
              value={totalRecords}
              onChange={(event) => setTotalRecords(Number(event.target.value))}
            />
          </label>
        </div>

        <details
          className="panel__body"
          open={advancedOpen}
          onToggle={(event) =>
            setAdvancedOpen((event.target as HTMLDetailsElement).open)
          }
        >
          <summary><strong>Inference advanced settings</strong></summary>
          <p className="muted small">
            Optional settings for external inference providers. API token is saved
            on your account and reused on future jobs.
          </p>
          <label className="toggle-field">
            <input
              className="toggle-field__input"
              type="checkbox"
              checked={useExternalApi}
              onChange={(event) => {
                const nextExternal = event.target.checked;
                setUseExternalApi(nextExternal);
                if (!nextExternal) {
                  setModels([]);
                  setModelsError(null);
                }
              }}
            />
            <span className="toggle-field__switch" aria-hidden="true">
              <span className="toggle-field__thumb" />
            </span>
            <span className="toggle-field__label">Use external inference API</span>
          </label>
          {useExternalApi ? (
            <>
              <label className="field">
                <span>Saved configuration</span>
                <select
                  value={selectedProfileId}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelectedProfileId(value);
                    const profile = profiles.find((p) => p.id === value);
                    if (profile) {
                      setInferenceBaseUrl(profile.baseUrl ?? "");
                      setInferencePath(profile.path ?? "");
                      setInferenceModel(profile.model ?? "");
                      setHasSavedApiKey(profile.hasApiKey);
                      setProfileName(profile.name);
                      handleActivateProfile(value);
                    }
                  }}
                >
                  <option value="">Unsaved / ad-hoc configuration</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Configuration name</span>
                <input
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  placeholder="e.g. Internal Llama 70B"
                />
              </label>
              <label className="field">
                <span>Inference API base URL</span>
                <input
                  value={inferenceBaseUrl}
                  onChange={(event) => setInferenceBaseUrl(event.target.value)}
                  placeholder="http://host:port"
                />
              </label>
              <label className="field">
                <span>Inference endpoint path</span>
                <input
                  value={inferencePath}
                  onChange={(event) => setInferencePath(event.target.value)}
                  placeholder="/create_chat_completion"
                />
              </label>
              <label className="field">
                <span>Inference API token</span>
                <input
                  type="password"
                  value={inferenceApiKey}
                  onChange={(event) => setInferenceApiKey(event.target.value)}
                  placeholder={hasSavedApiKey ? "Saved token on account" : "Enter token"}
                />
              </label>
              {hasSavedApiKey ? (
                <p className="muted small">A token is already saved for your account.</p>
              ) : null}
              <div className="form__actions">
                <button
                  type="button"
                  className="button button--ghost"
                  disabled={settingsBusy}
                  onClick={async () => {
                    setSettingsBusy(true);
                    const ok = await saveSettings();
                    setSettingsBusy(false);
                    if (!ok) setError("Failed to save configuration");
                  }}
                >
                  Save configuration
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  disabled={settingsBusy || profiles.length >= maxProfiles}
                  onClick={async () => {
                    setSettingsBusy(true);
                    const ok = await saveSettings({ asNew: true });
                    setSettingsBusy(false);
                    if (!ok) setError("Failed to save new configuration");
                  }}
                >
                  Save as new
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  disabled={settingsBusy || !selectedProfileId}
                  onClick={handleDeleteProfile}
                >
                  Delete configuration
                </button>
              </div>
              <p className="muted small">
                {profiles.length}/{maxProfiles} saved configurations
              </p>
              <label className="field">
                <span>Inference model (optional)</span>
                <select
                  value={inferenceModel}
                  onChange={(event) => setInferenceModel(event.target.value)}
                >
                  <option value="">Auto / provider default</option>
                  {models.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </label>
              {modelsLoading ? <p className="muted small">Loading models...</p> : null}
              {modelsError ? <p className="muted small">{modelsError}</p> : null}

              <label className="field">
                <span>Inference params (JSON, optional)</span>
                <textarea
                  className="textarea"
                  value={inferenceParams}
                  onChange={(event) => setInferenceParams(event.target.value)}
                  placeholder='e.g. {"temperature":0.2,"max_tokens":700}'
                />
              </label>
            </>
          ) : (
            <p className="muted small">
              Using internal DataGen inference for this job.
            </p>
          )}
        </details>

        {error ? <p className="error">{error}</p> : null}

        <div className="form__actions">
          <button className="button" type="submit" disabled={submitting}>
            {submitting ? "Generating..." : "Generate schema"}
          </button>
          <button
            className="button button--ghost"
            type="button"
            onClick={handleConfirmJob}
            disabled={!draftToken || confirming}
          >
            {confirming ? "Confirming..." : "Confirm job"}
          </button>
        </div>
      </form>

      {draftSchema ? (
        <div className="panel__body">
          <h3>Draft schema</h3>
          <p className="muted small">
            Generated at {schemaMeta?.schemaGeneratedAt} · {schemaMeta?.schemaDurationMs}ms ·
            refreshes {schemaMeta?.schemaRefreshes}
          </p>
          <pre className="code-block">{JSON.stringify(draftSchema, null, 2)}</pre>
        </div>
      ) : null}

      <div className="panel__body">
        <h2>Jobs</h2>
        <p className="muted small">
          {activeJobs.length} active · {jobs.length} total
        </p>
        {jobs.length === 0 ? (
          <p className="muted">No jobs yet. Generate a schema to get started.</p>
        ) : (
          <div className="jobs">
            {jobs.map((job) => (
              <details
                key={job.id}
                className="job-card"
                onToggle={(event) => {
                  if ((event.target as HTMLDetailsElement).open) {
                    loadJobDetails(job.id);
                  }
                }}
              >
                <summary>
                  <div>
                    <strong>{job.title}</strong>
                    <p className="muted small">{job.status.toUpperCase()}</p>
                    <p className="muted small">ID: {job.id}</p>
                  </div>
                  <div className="job-progress">
                    <span>
                      {job.totalGenerated}/{job.totalRecords}
                    </span>
                    <div className="progress">
                      <div
                        className="progress__bar"
                        style={{
                          width: `${Math.min(
                            100,
                            (job.totalGenerated / Math.max(1, job.totalRecords)) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </summary>

                <div className="job-details">
                  {loadingJobIds[job.id] ? (
                    <p className="muted">Loading details…</p>
                  ) : (
                    <>
                      {jobDetailErrors[job.id] ? (
                        <p className="error">{jobDetailErrors[job.id]}</p>
                      ) : null}
                      <p className="muted">
                        Schema generated at {job.schemaGeneratedAt} · {job.schemaDurationMs}ms ·
                        refreshes {job.schemaRefreshes}
                      </p>
                      <p className="muted">Job started: {job.jobStartedAt ?? "—"}</p>
                      <p className="muted">Job finished: {job.jobFinishedAt ?? "—"}</p>
                      <p className="muted">
                        Records duration: {job.recordsDurationMs ?? 0}ms · workers {job.peerCount}
                      </p>

                      <p><strong>Description</strong></p>
                      <p className="muted">{jobDetails[job.id]?.description ?? "—"}</p>
                      <p><strong>Instructions</strong></p>
                      <p className="muted">{jobDetails[job.id]?.instructions ?? "—"}</p>

                      <button
                        className="button button--ghost"
                        type="button"
                        onClick={() =>
                          setSchemaOpenByJobId((prev) => ({
                            ...prev,
                            [job.id]: !prev[job.id],
                          }))
                        }
                      >
                        {schemaOpenByJobId[job.id] ? "Hide schema" : "Show schema"}
                      </button>
                      {schemaOpenByJobId[job.id] ? (
                        <pre className="code-block">
                          {JSON.stringify(jobDetails[job.id]?.schema ?? {}, null, 2)}
                        </pre>
                      ) : null}

                      <div className="peer-table">
                        <p><strong>Peer stats</strong></p>
                        <div className="peer-table__grid">
                          {(jobPeers[job.id] ?? []).map((peer) => (
                            <div key={peer.peerId} className="peer-row">
                              <span data-label="Peer">{peer.peerId}</span>
                              <span data-label="Generated">
                                {peer.generatedOk}/{peer.assigned}
                              </span>
                              <span data-label="Failed">{peer.generatedFailed}</span>
                              <span data-label="Result CID">{peer.resultCid ?? "—"}</span>
                              <span data-label="Started">{peer.startedAt ?? "—"}</span>
                              <span data-label="Finished">{peer.finishedAt ?? "—"}</span>
                            </div>
                          ))}
                          {(jobPeers[job.id] ?? []).length === 0 ? (
                            <p className="muted small">
                              Peer states are not available yet for this job.
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {job.status === "succeeded" ? (
                        <div className="download-row">
                          <a href={`/api/tasks/${job.id}/export?format=json`} className="button">
                            Download JSON
                          </a>
                          <a
                            href={`/api/tasks/${job.id}/export?format=csv`}
                            className="button button--ghost"
                          >
                            Download CSV
                          </a>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
