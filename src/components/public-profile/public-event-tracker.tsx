"use client";

import { useEffect, type ComponentProps } from "react";
import type { ClientAnalyticsEvent } from "@/lib/analytics-event";

type ClickEvent = Exclude<ClientAnalyticsEvent, "PROFILE_VIEW">;

export function trackPublicEvent(
  slug: string,
  eventType: ClientAnalyticsEvent,
  targetId?: string,
): void {
  void fetch(`/api/public/contacts/${encodeURIComponent(slug)}/events`, {
    method: "POST",
    credentials: "same-origin",
    keepalive: true,
    headers: {
      "content-type": "application/json",
      "x-vcard-request": "1",
    },
    body: JSON.stringify({ eventType, ...(targetId ? { targetId } : {}) }),
  }).catch(() => undefined);
}

export function PublicProfileViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `vcard-profile-view:${slug}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Private browsing can deny storage; server-side deduplication remains active.
    }
    trackPublicEvent(slug, "PROFILE_VIEW");
  }, [slug]);

  return null;
}

type TrackedLinkProps = Omit<ComponentProps<"a">, "onClick"> & {
  slug: string;
  eventType?: ClickEvent;
  targetId?: string;
};

export function TrackedLink({ slug, eventType, targetId, ...props }: TrackedLinkProps) {
  return (
    <a
      {...props}
      onClick={() => {
        if (eventType) trackPublicEvent(slug, eventType, targetId);
      }}
    />
  );
}

