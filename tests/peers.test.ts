import { getPeerList, splitAssignments } from "@/lib/datagen/peers";

describe("peer assignments", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("splits records evenly with remainder", () => {
    const peers = ["a", "b", "c"];
    const assignments = splitAssignments(10, peers);
    expect(assignments.map((a) => a.assigned)).toEqual([4, 3, 3]);
    expect(assignments[0].range).toEqual({ start: 0, end: 4 });
    expect(assignments[1].range).toEqual({ start: 4, end: 7 });
    expect(assignments[2].range).toEqual({ start: 7, end: 10 });
  });

  it("parses peers from JSON array format", () => {
    process.env.R1EN_CHAINSTORE_PEERS = '["peerA","peerB"]';
    expect(getPeerList()).toEqual(["peerA", "peerB"]);
  });
});
