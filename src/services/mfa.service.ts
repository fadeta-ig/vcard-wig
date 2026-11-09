import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/api";
import { hashToken } from "@/lib/security/crypto";
import { verifyPassword } from "@/lib/security/password";
import { consumeBucket } from "@/lib/security/public-request";
import {
  base32Encode,
  decryptMfaSecret,
  encryptMfaSecret,
  matchingTotpCounter,
} from "@/lib/security/totp";
import type { AuthenticatedSession } from "@/services/auth.service";

function recoveryHash(code: string) {
  return hashToken(`mfa-recovery:${code.replace(/[-\s]/g, "").toUpperCase()}`);
}
function createRecoveryCodes() {
  return Array.from({ length: 10 }, () =>
    randomBytes(10)
      .toString("hex")
      .toUpperCase()
      .match(/.{1,4}/g)!
      .join("-"),
  );
}

async function verifyCurrentPassword(userId: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, isActive: true },
  });
  if (!user?.isActive || !(await verifyPassword(user.passwordHash, password)))
    throw new AppError(
      400,
      "CURRENT_PASSWORD_INVALID",
      "Password saat ini tidak sesuai.",
    );
}

export async function verifyUserMfa(
  userId: string,
  encrypted: string,
  code: string,
): Promise<boolean> {
  if (/^\d{6}$/.test(code)) {
    const counter = matchingTotpCounter(decryptMfaSecret(encrypted), code);
    if (counter === null) return false;
    const result = await prisma.user.updateMany({
      where: {
        id: userId,
        mfaSecretEncrypted: encrypted,
        OR: [{ mfaLastCounter: null }, { mfaLastCounter: { lt: counter } }],
      },
      data: { mfaLastCounter: counter },
    });
    return result.count === 1;
  }
  const removed = await prisma.mfaRecoveryCode.deleteMany({
    where: {
      userId,
      codeHash: recoveryHash(code),
      user: { mfaSecretEncrypted: encrypted },
    },
  });
  return removed.count === 1;
}

export async function beginMfaEnrollment(
  session: AuthenticatedSession,
  password: string,
) {
  await consumeBucket(`mfa:settings:${session.user.id}`, 5, 60);
  await verifyCurrentPassword(session.user.id, password);
  const secret = base32Encode(randomBytes(20));
  const encrypted = encryptMfaSecret(secret);
  const changed = await prisma.user.updateMany({
    where: { id: session.user.id, mfaSecretEncrypted: null },
    data: {
      mfaPendingSecret: encrypted,
      mfaPendingSession: session.id,
      mfaPendingExpires: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  if (changed.count !== 1)
    throw new AppError(
      409,
      "MFA_ALREADY_ENABLED",
      "MFA sudah aktif. Muat ulang pengaturan keamanan.",
    );
  const uri = `otpauth://totp/${encodeURIComponent(`Corporate vCard:${session.user.username}`)}?secret=${secret}&issuer=Corporate%20vCard&algorithm=SHA1&digits=6&period=30`;
  return {
    secret,
    qrDataUrl: await QRCode.toDataURL(uri, {
      width: 240,
      margin: 4,
      errorCorrectionLevel: "M",
    }),
  };
}

export async function confirmMfaEnrollment(
  session: AuthenticatedSession,
  code: string,
) {
  await consumeBucket(`mfa:settings:${session.user.id}`, 5, 60);
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      mfaPendingSecret: true,
      mfaPendingSession: true,
      mfaPendingExpires: true,
    },
  });
  if (
    !user?.mfaPendingSecret ||
    user.mfaPendingSession !== session.id ||
    !user.mfaPendingExpires ||
    user.mfaPendingExpires <= new Date()
  )
    throw new AppError(
      409,
      "MFA_ENROLLMENT_EXPIRED",
      "Pengaturan MFA kedaluwarsa. Mulai kembali.",
    );
  const counter = matchingTotpCounter(
    decryptMfaSecret(user.mfaPendingSecret),
    code,
  );
  if (counter === null)
    throw new AppError(422, "MFA_INVALID", "Kode authenticator tidak valid.");
  const recoveryCodes = createRecoveryCodes();
  await prisma.$transaction(async (tx) => {
    const result = await tx.user.updateMany({
      where: {
        id: session.user.id,
        mfaSecretEncrypted: null,
        mfaPendingSecret: user.mfaPendingSecret,
        mfaPendingSession: session.id,
        mfaPendingExpires: { gt: new Date() },
      },
      data: {
        mfaSecretEncrypted: user.mfaPendingSecret,
        mfaLastCounter: counter,
        mfaPendingSecret: null,
        mfaPendingSession: null,
        mfaPendingExpires: null,
      },
    });
    if (result.count !== 1)
      throw new AppError(
        409,
        "MFA_ENROLLMENT_EXPIRED",
        "Pengaturan MFA sudah berubah. Mulai kembali.",
      );
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: session.user.id } });
    await tx.mfaRecoveryCode.createMany({
      data: recoveryCodes.map((value) => ({
        userId: session.user.id,
        codeHash: recoveryHash(value),
      })),
    });
    await tx.session.updateMany({
      where: {
        userId: session.user.id,
        id: { not: session.id },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: "MFA_ENABLED",
        entityType: "User",
        entityId: session.user.id,
        newValues: { enabled: true },
      },
    });
  });
  return { recoveryCodes };
}

export async function changeMfa(
  session: AuthenticatedSession,
  password: string,
  code: string,
  action: "disable" | "recovery",
) {
  await consumeBucket(`mfa:settings:${session.user.id}`, 5, 60);
  await verifyCurrentPassword(session.user.id, password);
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mfaSecretEncrypted: true },
  });
  if (
    !user?.mfaSecretEncrypted ||
    !(await verifyUserMfa(session.user.id, user.mfaSecretEncrypted, code))
  )
    throw new AppError(
      422,
      "MFA_INVALID",
      "Kode authenticator atau pemulihan tidak valid atau sudah digunakan.",
    );
  const recoveryCodes = action === "recovery" ? createRecoveryCodes() : [];
  await prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: {
        id: session.user.id,
        mfaSecretEncrypted: user.mfaSecretEncrypted,
      },
      data:
        action === "disable"
          ? {
              mfaSecretEncrypted: null,
              mfaLastCounter: null,
              mfaPendingSecret: null,
              mfaPendingSession: null,
              mfaPendingExpires: null,
            }
          : { updatedAt: new Date() },
    });
    if (updated.count !== 1)
      throw new AppError(
        409,
        "MFA_CHANGED",
        "Pengaturan MFA telah berubah. Muat ulang halaman.",
      );
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: session.user.id } });
    if (recoveryCodes.length)
      await tx.mfaRecoveryCode.createMany({
        data: recoveryCodes.map((value) => ({
          userId: session.user.id,
          codeHash: recoveryHash(value),
        })),
      });
    await tx.session.updateMany({
      where: {
        userId: session.user.id,
        id: { not: session.id },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: action === "disable" ? "MFA_DISABLED" : "MFA_RECOVERY_ROTATED",
        entityType: "User",
        entityId: session.user.id,
        newValues: { enabled: action !== "disable" },
      },
    });
  });
  return { recoveryCodes };
}
