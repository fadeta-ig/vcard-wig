import { describe, expect, it } from "vitest";
import { publicEventSchema } from "@/lib/analytics-event";

describe("public analytics event contract", () => {
  it("accepts only documented client events and requires a social target", () => {
    expect(publicEventSchema.parse({ eventType: "PROFILE_VIEW" })).toEqual({ eventType: "PROFILE_VIEW" });
    expect(publicEventSchema.parse({ eventType: "SOCIAL_CLICK", targetId: "social-target-123" })).toEqual({ eventType: "SOCIAL_CLICK", targetId: "social-target-123" });
    expect(() => publicEventSchema.parse({ eventType: "VCARD_DOWNLOAD" })).toThrow();
    expect(() => publicEventSchema.parse({ eventType: "SOCIAL_CLICK" })).toThrow();
    expect(() => publicEventSchema.parse({ eventType: "PROFILE_VIEW", metadata: "arbitrary" })).toThrow();
  });
});

