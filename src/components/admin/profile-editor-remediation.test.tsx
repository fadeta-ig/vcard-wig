// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { ProfileView, CompanyProfileContext } from "@/lib/profile-types";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock("next/image", () => ({
  default: ({ unoptimized, priority, ...props }: Record<string, unknown>) => {
    void unoptimized;
    void priority;
    return React.createElement("img", props);
  },
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement("a", props, children),
}));
vi.mock("@/lib/api-client", () => ({
  apiRequest: mocks.request,
  ApiClientError: class ApiClientError extends Error {},
}));
import { ProfileEditor } from "@/components/admin/profile-editor";

const company: CompanyProfileContext = {
  id: "company-a",
  name: "Company A",
  companyLogo: null,
  primaryColor: "#1E3A5F",
  secondaryColor: null,
  qrLogoEnabled: false,
  defaultQrForeground: "#111827",
  defaultQrBackground: "#FFFFFF",
};
const profile: ProfileView = {
  id: "profile-a",
  version: 1,
  companyId: company.id,
  company,
  slug: "audit-profile",
  firstName: "Audit",
  lastName: null,
  displayName: "Audit Profile",
  honorificPrefix: null,
  honorificSuffix: null,
  jobTitle: "Old title",
  department: null,
  companyName: company.name,
  email: "audit@example.invalid",
  workPhone: null,
  mobilePhone: null,
  whatsappNumber: null,
  website: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  province: null,
  postalCode: null,
  country: "Indonesia",
  shortBio: null,
  profilePhoto: null,
  profileThumbnail: null,
  status: "DRAFT",
  showPhoto: true,
  showEmail: true,
  showPhone: true,
  showWorkPhone: true,
  showMobilePhone: true,
  showWhatsapp: true,
  showAddress: true,
  showSocialLinks: true,
  allowIndexing: false,
  sectionOrder: ["CONTACT", "SOCIAL", "ADDRESS", "BIO"],
  viewCount: 0,
  vcardDownloadCount: 0,
  publishedAt: null,
  firstPublishedAt: null,
  createdAt: "2026-11-09T00:00:00.000Z",
  updatedAt: "2026-11-09T00:00:00.000Z",
  createdBy: { id: "user", name: "Audit", username: "audit" },
  socialLinks: [],
};
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("focused editor remediation", () => {
  it("remounts a new-profile form when the company owner changes", () => {
    const result = render(
      <ProfileEditor
        key={company.id}
        company={company}
        locale="id"
        initialProfile={null}
      />,
    );
    fireEvent.change(result.container.querySelector("#profile-first-name")!, {
      target: { value: "From A" },
    });
    const next = { ...company, id: "company-b", name: "Company B" };
    result.rerender(
      <ProfileEditor
        key={next.id}
        company={next}
        locale="id"
        initialProfile={null}
      />,
    );
    expect(
      (
        result.container.querySelector(
          "#profile-first-name",
        ) as HTMLInputElement
      ).value,
    ).toBe("");
    expect(
      (
        result.container.querySelector(
          "#profile-company-name",
        ) as HTMLInputElement
      ).value,
    ).toBe("Company B");
  });
  it("saves changed fields before publication and forwards the returned version", async () => {
    mocks.request
      .mockResolvedValueOnce({ ...profile, version: 2, jobTitle: "New title" })
      .mockResolvedValueOnce({
        ...profile,
        version: 3,
        status: "ACTIVE",
        jobTitle: "New title",
      });
    const result = render(
      <ProfileEditor company={company} locale="id" initialProfile={profile} />,
    );
    fireEvent.change(result.container.querySelector("#profile-job-title")!, {
      target: { value: "New title" },
    });
    fireEvent.click(
      result.getByRole("button", { name: "Simpan & publikasikan" }),
    );
    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(2));
    expect(mocks.request.mock.calls[0][1]).toMatchObject({
      method: "PATCH",
      body: { jobTitle: "New title" },
      profileContext: { companyId: company.id, version: 1 },
    });
    expect(mocks.request.mock.calls[1]).toEqual([
      "/api/admin/profiles/profile-a/publish",
      {
        method: "POST",
        body: {},
        profileContext: { companyId: company.id, version: 2 },
      },
    ]);
  });
  it("does not publish after a failed save", async () => {
    mocks.request.mockRejectedValueOnce(new Error("Save failed"));
    const result = render(
      <ProfileEditor company={company} locale="id" initialProfile={profile} />,
    );
    fireEvent.click(
      result.getByRole("button", { name: "Simpan & publikasikan" }),
    );
    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(1));
    expect(mocks.request.mock.calls[0][0]).not.toContain("/publish");
  });
  it("only offers permanent deletion for archived profiles", () => {
    const result = render(
      <ProfileEditor company={company} locale="id" initialProfile={profile} />,
    );
    expect(result.queryByRole("button", { name: "Hapus permanen" })).toBeNull();
    result.unmount();
    const archived = render(
      <ProfileEditor
        company={company}
        locale="id"
        initialProfile={{ ...profile, status: "ARCHIVED" }}
      />,
    );
    expect(
      archived.getByRole("button", { name: "Hapus permanen" }),
    ).toBeDefined();
  });
});
