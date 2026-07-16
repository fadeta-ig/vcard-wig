import { describe, expect, it } from "vitest";
import { qrExportQuerySchema } from "@/lib/validation";

describe("QR export validation", () => {
  it("applies safe defaults and a four-module quiet zone", () => {
    expect(qrExportQuerySchema.parse({})).toEqual({
      type: "dynamic",
      format: "png",
      size: 512,
      margin: 4,
      errorCorrection: "M",
      foreground: "#111827",
      background: "#FFFFFF",
      logo: false,
    });
  });

  it("forces H error correction whenever a logo is enabled", () => {
    expect(qrExportQuerySchema.parse({ logo: "true", errorCorrection: "L" }).errorCorrection).toBe("H");
  });

  it("rejects insufficient contrast, undersized output, and a short quiet zone", () => {
    expect(() => qrExportQuerySchema.parse({ foreground: "#777777", background: "#888888" })).toThrow();
    expect(() => qrExportQuerySchema.parse({ size: "128" })).toThrow();
    expect(() => qrExportQuerySchema.parse({ margin: "3" })).toThrow();
  });

  it("rejects unknown options and invalid formats", () => {
    expect(() => qrExportQuerySchema.parse({ format: "pdf" })).toThrow();
    expect(() => qrExportQuerySchema.parse({ unexpected: "value" })).toThrow();
  });
});
