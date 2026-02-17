import { getR1fs } from "@/lib/ratio1/client";
import { envFlag } from "@/lib/env";

const logR1fsCalls = envFlag("DATAGEN_LOG_R1FS_CALLS");

function logR1fs(event: string, payload: Record<string, unknown>) {
  if (!logR1fsCalls) return;
  console.log(`[datagen:r1fs] ${event}`, payload);
}

export async function uploadJson(
  data: Record<string, unknown>,
  filename = "job-details.json",
) {
  const r1fs = getR1fs();
  logR1fs("uploadJson:start", {
    filename,
    keys: Object.keys(data ?? {}),
  });
  try {
    const result = await r1fs.addJson({ data, fn: filename });
    if (!result?.cid) {
      throw new Error("Failed to upload JSON to R1FS");
    }
    logR1fs("uploadJson:success", { filename, cid: result.cid });
    return result.cid;
  } catch (error) {
    logR1fs("uploadJson:error", {
      filename,
      message: error instanceof Error ? error.message : "Unknown R1FS error",
    });
    throw error;
  }
}

export async function uploadText(
  content: string | Buffer,
  filename: string,
) {
  const r1fs = getR1fs();
  const file = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
  logR1fs("uploadText:start", {
    filename,
    bytes: file.byteLength,
  });
  try {
    // Use base64 upload to avoid multipart boundary/interoperability issues.
    const result = await r1fs.addFileBase64({
      file_base64_str: file.toString("base64"),
      filename,
    });
    if (!result?.cid) {
      throw new Error("Failed to upload file to R1FS");
    }
    logR1fs("uploadText:success", { filename, cid: result.cid });
    return result.cid;
  } catch (error) {
    logR1fs("uploadText:error", {
      filename,
      message: error instanceof Error ? error.message : "Unknown R1FS error",
    });
    throw error;
  }
}

export async function downloadText(cid: string): Promise<string> {
  const r1fs = getR1fs();
  logR1fs("downloadText:start", { cid });
  try {
    const result = await r1fs.getFile({ cid });
    if (typeof result?.file_data === "string") {
      logR1fs("downloadText:success", { cid, mode: "plain" });
      return result.file_data;
    }
    const base64Result = await r1fs.getFileBase64({ cid });
    if (typeof base64Result?.file_base64_str === "string") {
      logR1fs("downloadText:success", { cid, mode: "base64" });
      return Buffer.from(base64Result.file_base64_str, "base64").toString("utf8");
    }
    throw new Error("Failed to download file from R1FS");
  } catch (error) {
    logR1fs("downloadText:error", {
      cid,
      message: error instanceof Error ? error.message : "Unknown R1FS error",
    });
    throw error;
  }
}
