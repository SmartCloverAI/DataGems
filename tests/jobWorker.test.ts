import { rmSync } from "fs";

const updatePeerState = vi.fn();
const updateJobBase = vi.fn();
const updateMetrics = vi.fn();

vi.mock("@/lib/datagen/jobStore", () => ({
  getJobBase: vi.fn(async () => ({
    id: "job_1",
    owner: "u1",
    title: "t",
    status: "queued",
    totalRecords: 1,
    peers: ["peerA"],
    peerCount: 1,
    totalGenerated: 0,
    totalOk: 0,
    totalFailed: 0,
    jobDetailsCid: "details_cid",
    createdAt: new Date().toISOString(),
    schemaGeneratedAt: new Date().toISOString(),
    schemaDurationMs: 100,
    schemaRefreshes: 0,
    updatedAt: new Date().toISOString(),
  })),
  getPeerState: vi.fn(async () => ({
    peerId: "peerA",
    assigned: 1,
    range: { start: 0, end: 1 },
    generatedOk: 0,
    generatedFailed: 0,
  })),
  updatePeerState,
  updateJobBase,
  listJobsForPeer: vi.fn(async () => []),
  listPeerStates: vi.fn(async () => []),
}));

vi.mock("@/lib/ratio1/r1fs", () => ({
  downloadText: vi.fn(async () =>
    JSON.stringify({
      id: "job_1",
      owner: "u1",
      description: "d",
      instructions: "i",
      schema: {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        properties: { a: { type: "string" } },
        required: ["a"],
        additionalProperties: false,
      },
      inference: { baseUrl: "http://x", path: "/create_chat_completion" },
      createdAt: new Date().toISOString(),
      schemaGeneratedAt: new Date().toISOString(),
      schemaDurationMs: 100,
      schemaRefreshes: 0,
    }),
  ),
  uploadText: vi.fn(async () => {
    throw new Error("Request failed with status 400");
  }),
}));

vi.mock("@/lib/datagen/inference", () => ({
  generateRecord: vi.fn(async () => ({
    record: { a: "ok" },
    failedAttempts: 0,
  })),
}));

vi.mock("@/lib/datagen/metrics", () => ({
  updateMetrics,
}));

vi.mock("@/lib/datagen/userSettings", () => ({
  readUserSettings: vi.fn(async () => ({ profiles: [], activeProfileId: undefined })),
  getProfileById: vi.fn(() => null),
  getActiveProfile: vi.fn(() => null),
}));

describe("jobWorker failure path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.R1EN_HOST_ADDR = "peerA";
    process.env.DATAGEN_LOCAL_CACHE_DIR = "/tmp/datagen-jobworker-tests";
    rmSync("/tmp/datagen-jobworker-tests", { recursive: true, force: true });
  });

  it("marks job failed when upload to R1FS fails after generation", async () => {
    const { __jobWorkerTest } = await import("@/lib/datagen/jobWorker");
    await __jobWorkerTest.runJobForPeer("job_1");

    expect(updatePeerState).toHaveBeenCalled();
    const lastPeerUpdate = updatePeerState.mock.calls.at(-1);
    expect(lastPeerUpdate?.[0]).toBe("job_1");
    expect(lastPeerUpdate?.[1]).toBe("peerA");
    expect(lastPeerUpdate?.[2]?.finishedAt).toBeTruthy();
    expect(lastPeerUpdate?.[2]?.errors).toBeUndefined();

    expect(updateJobBase).toHaveBeenCalledWith(
      "job_1",
      expect.objectContaining({ status: "failed" }),
    );
    expect(updateMetrics).toHaveBeenCalledWith(
      expect.objectContaining({ failedJobs: 1 }),
    );
  });
});
