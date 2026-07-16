export type VCardSource = {
  firstName: string;
  lastName?: string;
  displayName: string;
  honorificPrefix?: string;
  honorificSuffix?: string;
  companyName: string;
  jobTitle: string;
  department?: string;
  workPhone?: string;
  mobilePhone?: string;
  whatsappNumber?: string;
  email?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: string;
  };
  website?: string;
  socialLinks?: { label: string; url: string }[];
  shortBio?: string;
  photoJpegBase64?: string;
};

export function escapeVCardText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

export function foldVCardLine(line: string, limit = 75): string {
  if (Buffer.byteLength(line, "utf8") <= limit) return line;
  const segments: string[] = [];
  let segment = "";
  let bytes = 0;
  let segmentLimit = limit;

  for (const character of line) {
    const characterBytes = Buffer.byteLength(character, "utf8");
    if (segment && bytes + characterBytes > segmentLimit) {
      segments.push(segment);
      segment = character;
      bytes = characterBytes;
      segmentLimit = limit - 1;
    } else {
      segment += character;
      bytes += characterBytes;
    }
  }
  if (segment) segments.push(segment);
  return segments.join("\r\n ");
}

function add(lines: string[], property: string, value: string | undefined) {
  if (value) lines.push(`${property}:${escapeVCardText(value)}`);
}

export function generateVCard(source: VCardSource): string {
  const lines = ["BEGIN:VCARD", "VERSION:3.0"];
  const structuredName = [
    source.lastName,
    source.firstName,
    "",
    source.honorificPrefix,
    source.honorificSuffix,
  ]
    .map((value) => escapeVCardText(value ?? ""))
    .join(";");
  lines.push(`N:${structuredName}`);
  add(lines, "FN", source.displayName);
  add(lines, "ORG", source.companyName);
  add(lines, "TITLE", source.jobTitle);
  add(lines, "ROLE", source.department);

  const phones = new Set<string>();
  if (source.workPhone) {
    lines.push(`TEL;TYPE=WORK,VOICE:${source.workPhone}`);
    phones.add(source.workPhone);
  }
  if (source.mobilePhone && !phones.has(source.mobilePhone)) {
    lines.push(`TEL;TYPE=CELL:${source.mobilePhone}`);
    phones.add(source.mobilePhone);
  }
  if (source.whatsappNumber && !phones.has(source.whatsappNumber)) {
    lines.push(`TEL;TYPE=CELL:${source.whatsappNumber}`);
    phones.add(source.whatsappNumber);
  }

  if (source.email) lines.push(`EMAIL;TYPE=INTERNET,WORK:${escapeVCardText(source.email)}`);
  if (source.address) {
    const street = [source.address.line1, source.address.line2].filter(Boolean).join("\n");
    const addressValues = [
      "",
      "",
      street,
      source.address.city,
      source.address.province,
      source.address.postalCode,
      source.address.country,
    ];
    if (addressValues.some(Boolean)) {
      lines.push(`ADR;TYPE=WORK:${addressValues.map((value) => escapeVCardText(value ?? "")).join(";")}`);
    }
  }
  if (source.website) lines.push(`URL:${escapeVCardText(source.website)}`);
  source.socialLinks?.forEach((link, index) => {
    const group = `item${index + 1}`;
    lines.push(`${group}.URL:${escapeVCardText(link.url)}`);
    lines.push(`${group}.X-ABLabel:${escapeVCardText(link.label)}`);
  });
  add(lines, "NOTE", source.shortBio);
  if (source.photoJpegBase64) {
    lines.push(`PHOTO;ENCODING=b;TYPE=JPEG:${source.photoJpegBase64}`);
  }
  lines.push("END:VCARD");
  return `${lines.map((line) => foldVCardLine(line)).join("\r\n")}\r\n`;
}
