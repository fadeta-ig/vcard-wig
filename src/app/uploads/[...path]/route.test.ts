import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetEnvironmentForTests } from "@/lib/env";
import { GET, HEAD } from "./route";

const request = new Request("http://localhost/uploads/test");
const originalUploadDirectory = process.env.UPLOAD_DIR;
let uploadDirectory = "";

function context(pathSegments: string[]) {
  return { params: Promise.resolve({ path: pathSegments }) };
}

beforeEach(async () => {
  uploadDirectory = await mkdtemp(path.join(tmpdir(), "vcard-runtime-uploads-"));
  process.env.UPLOAD_DIR = uploadDirectory;
  resetEnvironmentForTests();
});

afterEach(async () => {
  if (originalUploadDirectory === undefined) delete process.env.UPLOAD_DIR;
  else process.env.UPLOAD_DIR = originalUploadDirectory;
  resetEnvironmentForTests();
  await rm(uploadDirectory, { recursive: true, force: true });
});

describe("runtime upload route", () => {
  it("serves a file created after application startup with immutable caching", async () => {
    const segments = ["companies", "company-1", "logo-12345678-1234-1234-1234-123456789abc.webp"];
    const directory = path.join(uploadDirectory, ...segments.slice(0, -1));
    const contents = Buffer.from([0x52, 0x49, 0x46, 0x46]);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(uploadDirectory, ...segments), contents);

    const response = await GET(request, context(segments));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(contents);
  });

  it("supports HEAD without returning the file body", async () => {
    const segments = ["profiles", "company-1", "profile-1", "thumb-file.webp"];
    const filePath = path.join(uploadDirectory, ...segments);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, Buffer.from([1, 2, 3]));

    const response = await HEAD(request, context(segments));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Length")).toBe("3");
    expect((await response.arrayBuffer()).byteLength).toBe(0);
  });

  it("rejects traversal, unsupported categories, and unsupported file types", async () => {
    const responses = await Promise.all([
      GET(request, context(["companies", "..", "secret.png"])),
      GET(request, context(["other", "company-1", "logo.webp"])),
      GET(request, context(["companies", "company-1", "logo.svg"])),
    ]);

    expect(responses.map((response) => response.status)).toEqual([404, 404, 404]);
    for (const response of responses) {
      expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    }
  });
});
