// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShareAction } from "@/components/public-profile/share-action";

const copy = {
  label: "Share",
  title: "Share contact",
  text: "Digital contact card",
  copied: "Link copied.",
  failed: "Unable to share.",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ShareAction", () => {
  it("uses the native Web Share API when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    render(<ShareAction slug="jane" url="https://vcard.example.com/c/jane" copy={copy} />);

    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(share).toHaveBeenCalledWith({
      title: "Share contact",
      text: "Digital contact card",
      url: "https://vcard.example.com/c/jane",
    }));
  });

  it("copies the canonical URL when native sharing is unavailable", async () => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<ShareAction slug="jane" url="https://vcard.example.com/c/jane" copy={copy} />);

    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://vcard.example.com/c/jane"));
    expect(await screen.findByText("Link copied.")).toBeInTheDocument();
  });
});
