const mockR1fs = {
  addJson: vi.fn(),
  addFileBase64: vi.fn(),
  getFile: vi.fn(),
  getFileBase64: vi.fn(),
};

vi.mock("@/lib/ratio1/client", () => ({
  getR1fs: () => mockR1fs,
}));

import { downloadText, uploadJson, uploadText } from "@/lib/ratio1/r1fs";

describe("r1fs helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads JSON and returns cid", async () => {
    mockR1fs.addJson.mockResolvedValue({ cid: "cid_json_1" });
    const cid = await uploadJson({ hello: "world" });
    expect(cid).toBe("cid_json_1");
  });

  it("throws when JSON upload has no cid", async () => {
    mockR1fs.addJson.mockResolvedValue({});
    await expect(uploadJson({ hello: "world" })).rejects.toThrow(
      "Failed to upload JSON to R1FS",
    );
  });

  it("uploads text and returns cid", async () => {
    mockR1fs.addFileBase64.mockResolvedValue({ cid: "cid_file_1" });
    const cid = await uploadText("abc", "a.txt");
    expect(cid).toBe("cid_file_1");
  });

  it("throws when file upload has no cid", async () => {
    mockR1fs.addFileBase64.mockResolvedValue({});
    await expect(uploadText("abc", "a.txt")).rejects.toThrow(
      "Failed to upload file to R1FS",
    );
  });

  it("downloads plain text from file_data", async () => {
    mockR1fs.getFile.mockResolvedValue({ file_data: "hello" });
    const content = await downloadText("cid_1");
    expect(content).toBe("hello");
  });

  it("falls back to base64 download", async () => {
    mockR1fs.getFile.mockResolvedValue({});
    mockR1fs.getFileBase64.mockResolvedValue({
      file_base64_str: Buffer.from("hello-base64", "utf8").toString("base64"),
    });

    const content = await downloadText("cid_2");
    expect(content).toBe("hello-base64");
  });

  it("throws when both file_data and file_base64_str are missing", async () => {
    mockR1fs.getFile.mockResolvedValue({});
    mockR1fs.getFileBase64.mockResolvedValue({});

    await expect(downloadText("cid_3")).rejects.toThrow(
      "Failed to download file from R1FS",
    );
  });
});
