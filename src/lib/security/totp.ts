import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { AppError } from "@/lib/api";
import { getEnvironment } from "@/lib/env";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0,
    value = 0,
    result = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) result += alphabet[(value << (5 - bits)) & 31];
  return result;
}
function base32Decode(text: string): Buffer {
  let bits = 0,
    value = 0;
  const bytes: number[] = [];
  for (const char of text.toUpperCase().replace(/=+$/, "")) {
    const digit = alphabet.indexOf(char);
    if (digit < 0) throw new Error("Invalid MFA secret");
    value = (value << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
export function totpAt(
  secret: string,
  timeMs = Date.now(),
  digits = 6,
): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(timeMs / 30000)));
  const digest = createHmac("sha1", base32Decode(secret))
    .update(counter)
    .digest();
  const offset = digest[digest.length - 1] & 15;
  return String(
    (digest.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits,
  ).padStart(digits, "0");
}
export function matchingTotpCounter(
  secret: string,
  code: string,
  now = Date.now(),
): bigint | null {
  if (!/^\d{6}$/.test(code)) return null;
  for (const delta of [-1, 0, 1]) {
    const time = now + delta * 30000;
    if (time < 0) continue;
    if (timingSafeEqual(Buffer.from(totpAt(secret, time)), Buffer.from(code)))
      return BigInt(Math.floor(time / 30000));
  }
  return null;
}
export function mfaConfigured(): boolean {
  return Boolean(getEnvironment().MFA_ENCRYPTION_KEY);
}
function key(): Buffer {
  const value = getEnvironment().MFA_ENCRYPTION_KEY;
  if (!value)
    throw new AppError(
      503,
      "MFA_NOT_CONFIGURED",
      "Konfigurasi keamanan MFA belum tersedia. Hubungi administrator server.",
    );
  return Buffer.from(value, "hex");
}
export function encryptMfaSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `v1.${iv.toString("hex")}.${cipher.getAuthTag().toString("hex")}.${body.toString("hex")}`;
}
export function decryptMfaSecret(encrypted: string): string {
  try {
    const [version, iv, tag, body] = encrypted.split(".");
    if (version !== "v1" || !iv || !tag || !body)
      throw new Error("Invalid ciphertext");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      Buffer.from(iv, "hex"),
    );
    decipher.setAuthTag(Buffer.from(tag, "hex"));
    return Buffer.concat([
      decipher.update(Buffer.from(body, "hex")),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      503,
      "MFA_UNAVAILABLE",
      "Verifikasi MFA tidak tersedia. Hubungi administrator server.",
    );
  }
}
