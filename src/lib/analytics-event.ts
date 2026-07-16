import { z } from "zod";

export const PUBLIC_EVENT_TYPES = [
  "PROFILE_VIEW",
  "PHONE_CLICK",
  "WHATSAPP_CLICK",
  "EMAIL_CLICK",
  "SOCIAL_CLICK",
  "SHARE_CLICK",
] as const;

const eventWithoutTarget = z
  .object({
    eventType: z.enum([
      "PROFILE_VIEW",
      "PHONE_CLICK",
      "WHATSAPP_CLICK",
      "EMAIL_CLICK",
      "SHARE_CLICK",
    ]),
  })
  .strict();

const socialEvent = z
  .object({
    eventType: z.literal("SOCIAL_CLICK"),
    targetId: z.string().trim().min(10).max(191),
  })
  .strict();

export const publicEventSchema = z.union([eventWithoutTarget, socialEvent]);
export type PublicEventInput = z.infer<typeof publicEventSchema>;
export type ClientAnalyticsEvent = (typeof PUBLIC_EVENT_TYPES)[number];

