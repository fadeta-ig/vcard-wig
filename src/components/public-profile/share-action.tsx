"use client";

import { Check, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { trackPublicEvent } from "@/components/public-profile/public-event-tracker";

type ShareCopy = {
  label: string;
  title: string;
  text: string;
  copied: string;
  failed: string;
};

async function copyLink(url: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      // Continue to the selection-based fallback for browsers that deny clipboard access.
    }
  }

  const input = document.createElement("textarea");
  input.value = url;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = typeof document.execCommand === "function" && document.execCommand("copy");
  input.remove();
  return copied;
}

export function ShareAction({ url, slug, copy }: { url: string; slug: string; copy: ShareCopy }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function showStatus(nextStatus: "copied" | "failed") {
    window.clearTimeout(timer.current);
    setStatus(nextStatus);
    timer.current = window.setTimeout(() => setStatus("idle"), 4000);
  }

  async function share() {
    trackPublicEvent(slug, "SHARE_CLICK");
    if (navigator.share) {
      try {
        await navigator.share({ title: copy.title, text: copy.text, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    showStatus((await copyLink(url)) ? "copied" : "failed");
  }

  return (
    <>
      <button className="public-action-button" type="button" onClick={share}>
        {status === "copied" ? <Check size={19} aria-hidden="true" /> : <Share2 size={19} aria-hidden="true" />}
        <span>{copy.label}</span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {status === "copied" ? copy.copied : status === "failed" ? copy.failed : ""}
      </span>
    </>
  );
}
