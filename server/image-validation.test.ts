import { describe, expect, it } from "vitest";
import { validateImageDataUrl } from "./image-validation";
import { normalizeContent, parseCitationMetadata, validateCitationMarkers } from "./recall-utils";
import { getDemoMemories } from "./echo-db";

function syntheticPng(width = 2, height = 3) {
  const bytes = Buffer.alloc(57);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes, 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12, 4, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  bytes.writeUInt32BE(0, 45);
  bytes.write("IEND", 49, 4, "ascii");
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

describe("server-side upload validation", () => {
  it("accepts a PNG with a matching signature and bounded dimensions", () => {
    expect(validateImageDataUrl(syntheticPng())).toMatchObject({ mimeType: "image/png", width: 2, height: 3, byteLength: 57 });
  });

  it("rejects MIME/signature mismatches and non-image payloads", () => {
    const data = Buffer.from("not an image").toString("base64");
    expect(() => validateImageDataUrl(`data:image/png;base64,${data}`)).toThrow(/malformed|match/i);
    const headerOnly = Buffer.alloc(24);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(headerOnly, 0);
    headerOnly.writeUInt32BE(13, 8); headerOnly.write("IHDR", 12, 4, "ascii"); headerOnly.writeUInt32BE(1, 16); headerOnly.writeUInt32BE(1, 20);
    expect(() => validateImageDataUrl(`data:image/png;base64,${headerOnly.toString("base64")}`)).toThrow(/malformed/i);
    expect(() => validateImageDataUrl(`data:image/svg+xml;base64,${data}`)).toThrow(/valid PNG/i);
  });

  it("rejects images over the decoded-byte limit and oversized pixel dimensions", () => {
    const large = Buffer.alloc(8 * 1024 * 1024 + 1, 1);
    expect(() => validateImageDataUrl(`data:image/png;base64,${large.toString("base64")}`)).toThrow(/8 MB/i);
    expect(() => validateImageDataUrl(syntheticPng(10_000, 10_000))).toThrow(/dimensions/i);
  });
});

describe("recall relevance safeguards", () => {
  it("keeps short technical acronyms such as AI and UX", () => {
    expect(normalizeContent("AI and UX for ECHO")).toEqual(["ai", "ux", "echo"]);
  });

  it("returns only validated citations and strips fabricated ids", () => {
    expect(validateCitationMarkers("Supported [12], not [999], and repeated [12].", [12, 13])).toEqual({
      answer: "Supported [12], not , and repeated [12].",
      citedIds: [12],
    });
  });

  it("labels legacy conversation citation arrays as unknown and parses persisted modes", () => {
    expect(parseCitationMetadata([4, 7])).toEqual({ citedMemoryIds: [4, 7], modelMode: "unknown" });
    expect(parseCitationMetadata({ memoryIds: [8], mode: "demo" })).toEqual({ citedMemoryIds: [8], modelMode: "demo" });
  });

  it("returns a separate read-only demo dataset with synthetic IDs and only real seeded edges", () => {
    const demo = getDemoMemories();
    const ids = new Set(demo.map((memory) => memory.id));
    expect(demo).toHaveLength(6);
    expect(demo.every((memory) => memory.id < 0 && !("attachmentData" in memory))).toBe(true);
    expect(demo.every((memory) => memory.relatedIds.every((id) => ids.has(id) && id !== memory.id))).toBe(true);
  });
});
