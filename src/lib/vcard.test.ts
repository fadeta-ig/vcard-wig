import { describe, expect, it } from "vitest";
import { escapeVCardText, foldVCardLine, generateVCard } from "@/lib/vcard";

describe("vCard 3.0 generator", () => {
  it("generates the complete compatibility mapping with CRLF", () => {
    const result = generateVCard({
      firstName: "Breenda",
      lastName: "Subekti",
      displayName: "Breenda Subekti",
      honorificPrefix: "Ms.",
      companyName: "SGS Indonesia",
      jobTitle: "Sales Executive",
      department: "Food & CPCH",
      workPhone: "+6231503520",
      mobilePhone: "+6281181412407",
      whatsappNumber: "+6281181412407",
      email: "breenda.subekti@example.com",
      address: {
        line1: "Jalan Biliton No. 35",
        city: "Surabaya",
        province: "Jawa Timur",
        postalCode: "60281",
        country: "Indonesia",
      },
      website: "https://example.com",
      socialLinks: [{ label: "LinkedIn", url: "https://linkedin.com/in/breenda" }],
      shortBio: "Corporate contact",
    });
    expect(result).toBe([
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:Subekti;Breenda;;Ms.;",
      "FN:Breenda Subekti",
      "ORG:SGS Indonesia",
      "TITLE:Sales Executive",
      "ROLE:Food & CPCH",
      "TEL;TYPE=WORK,VOICE:+6231503520",
      "TEL;TYPE=CELL:+6281181412407",
      "EMAIL;TYPE=INTERNET,WORK:breenda.subekti@example.com",
      "ADR;TYPE=WORK:;;Jalan Biliton No. 35;Surabaya;Jawa Timur;60281;Indonesia",
      "URL:https://example.com",
      "item1.URL:https://linkedin.com/in/breenda",
      "item1.X-ABLabel:LinkedIn",
      "NOTE:Corporate contact",
      "END:VCARD",
      "",
    ].join("\r\n"));
  });

  it("escapes backslash, punctuation, and all newline styles exactly once", () => {
    expect(escapeVCardText("A\\B; C, D\r\nE\rF\nG")).toBe(
      "A\\\\B\\; C\\, D\\nE\\nF\\nG",
    );
    const card = generateVCard({
      firstName: "Jane",
      displayName: "Jane",
      companyName: "Example",
      jobTitle: "Lead",
      address: { line1: "Floor 1", line2: "Room 2" },
    });
    expect(card).toContain("ADR;TYPE=WORK:;;Floor 1\\nRoom 2;;;;");
    expect(card).not.toContain("Floor 1\\\\nRoom 2");
  });

  it("supports a one-word and Unicode name", () => {
    const card = generateVCard({
      firstName: "Sukarno",
      displayName: "Sukarno 日本語",
      companyName: "Wijaya Inovasi",
      jobTitle: "Direktur",
    });
    expect(card).toContain("N:;Sukarno;;;");
    expect(card).toContain("FN:Sukarno 日本語");
  });

  it("deduplicates identical mobile and WhatsApp numbers", () => {
    const card = generateVCard({
      firstName: "Jane",
      displayName: "Jane",
      companyName: "Example",
      jobTitle: "Lead",
      mobilePhone: "+628123456789",
      whatsappNumber: "+628123456789",
    });
    expect(card.match(/TEL;TYPE=CELL/g)).toHaveLength(1);
  });

  it("folds every physical line at 75 UTF-8 octets without splitting Unicode", () => {
    const folded = foldVCardLine(`NOTE:${"Keterangan 日本語 ".repeat(12)}`);
    const physicalLines = folded.split("\r\n");
    expect(physicalLines.length).toBeGreaterThan(1);
    expect(physicalLines.slice(1).every((line) => line.startsWith(" "))).toBe(true);
    expect(physicalLines.every((line) => Buffer.byteLength(line, "utf8") <= 75)).toBe(true);
    expect(folded.replace(/\r\n /g, "")).toBe(`NOTE:${"Keterangan 日本語 ".repeat(12)}`);
  });

  it("omits optional empty fields instead of emitting blank properties", () => {
    const card = generateVCard({
      firstName: "Jane",
      displayName: "Jane",
      companyName: "Example",
      jobTitle: "Lead",
    });
    expect(card).not.toContain("EMAIL");
    expect(card).not.toContain("TEL;");
    expect(card).not.toContain("ADR;");
    expect(card).not.toContain("URL:");
    expect(card).not.toContain("PHOTO;");
  });
});
