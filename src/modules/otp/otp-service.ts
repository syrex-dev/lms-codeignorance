import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";
import { normalizePhoneE164, maskPhoneNumber, isValidIndonesianPhone } from "@/lib/security/phone";
import {
  OtpChannel,
  OtpPurpose,
  SendOtpParams,
  SendOtpResult,
  VerifyOtpParams,
  VerifyOtpResult,
} from "./types";
import { getOtpSender, sendOtpWithFallback } from "./sender";

const OTP_PEPPER = process.env.OTP_PEPPER_SECRET || "lms_secure_otp_pepper_secret_dev_2026";
const OTP_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;
const MAX_RESENDS_PER_HOUR = 5;

/**
 * Menghasilkan hash HMAC untuk kode OTP agar kode mentah tidak pernah disimpan di database
 */
export function hashOtpCode(code: string): string {
  return crypto.createHmac("sha256", OTP_PEPPER).update(code).digest("hex");
}

export function hashDestination(phoneE164: string): string {
  return crypto.createHash("sha256").update(phoneE164).digest("hex");
}

/**
 * Buat dan kirim tantangan OTP (WhatsApp / SMS)
 */
export const issueOtpChallenge = (params: SendOtpParams) => createOtpChallenge(params);

export async function createOtpChallenge(params: SendOtpParams): Promise<SendOtpResult> {
  const normalizedPhone = normalizePhoneE164(params.destinationE164);

  // 1. Validasi kode negara (Hanya nomor Indonesia +62 diizinkan secara default)
  if (!isValidIndonesianPhone(normalizedPhone)) {
    return {
      success: false,
      error: "Hanya nomor handphone Indonesia (+62) yang diizinkan untuk verifikasi OTP.",
    };
  }

  const destHash = hashDestination(normalizedPhone);
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  // 2. Cek Cooldown (60 detik) dan Rate Limit (maks 5 per jam)
  const recentChallenge = await prisma.otpChallenge.findFirst({
    where: {
      destinationHash: destHash,
      purpose: params.purpose,
      createdAt: { gte: oneHourAgo },
    },
    orderBy: { createdAt: "desc" },
  });

  if (recentChallenge) {
    const timeSinceLastSent = (now.getTime() - recentChallenge.lastSentAt.getTime()) / 1000;
    if (timeSinceLastSent < RESEND_COOLDOWN_SECONDS) {
      const waitSeconds = Math.ceil(RESEND_COOLDOWN_SECONDS - timeSinceLastSent);
      return {
        success: false,
        error: `Silakan tunggu ${waitSeconds} detik sebelum meminta kode baru.`,
        cooldownSeconds: waitSeconds,
      };
    }

    if (recentChallenge.resendCount >= MAX_RESENDS_PER_HOUR) {
      return {
        success: false,
        error: "Batas maksimal pengiriman OTP per jam telah tercapai. Silakan coba 1 jam lagi.",
        cooldownSeconds: 3600,
      };
    }
  }

  // 3. Batalkan/hanguskan OTP aktif sebelumnya untuk tujuan dan tujuan nomor yang sama
  await prisma.otpChallenge.updateMany({
    where: {
      destinationHash: destHash,
      purpose: params.purpose,
      consumedAt: null,
      expiresAt: { gt: now },
    },
    data: {
      consumedAt: now,
    },
  });

  // 4. Generate kode 6 digit CSPRNG
  const rawCode = crypto.randomInt(100000, 999999).toString();
  const codeHash = hashOtpCode(rawCode);
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);
  const resendCount = recentChallenge ? recentChallenge.resendCount + 1 : 0;

  // 5. Ambil nama institusi untuk pesan resmi
  let tenantName = "LMS Platform";
  let tenantSlug = "system";
  if (params.institutionId) {
    const inst = await prisma.institution.findUnique({
      where: { id: params.institutionId },
      select: { name: true, slug: true },
    });
    if (inst) {
      tenantName = inst.name;
      tenantSlug = inst.slug;
    }
  }

  const messageText = `${tenantName}: kode verifikasi Anda ${rawCode}. Berlaku ${OTP_EXPIRY_MINUTES} menit. Jangan bagikan kode ini kepada siapa pun, termasuk pihak yang mengaku dari ${tenantName}.`;

  // 6. Kirim pesan lewat provider dengan fallback otomatis WhatsApp -> SMS
  const deliveryResult = await sendOtpWithFallback(
    params.channel,
    normalizedPhone,
    messageText,
    rawCode,
    { institutionSlug: tenantSlug, purpose: params.purpose }
  );

  // 7. Simpan tantangan OTP baru & catat pemakaian dalam transaksi dengan RLS context
  const { challenge, warning } = await prisma.$transaction(async (tx) => {
    if (params.institutionId) {
      const safeId = params.institutionId.replace(/'/g, "''");
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant = '${safeId}';`);
    }

    const createdChallenge = await tx.otpChallenge.create({
      data: {
        institutionId: params.institutionId || null,
        userId: params.userId || null,
        purpose: params.purpose,
        channel: params.channel,
        destinationE164: normalizedPhone,
        destinationHash: destHash,
        codeHash,
        expiresAt,
        resendCount,
        lastSentAt: now,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      },
    });

    await tx.otpDelivery.create({
      data: {
        challengeId: createdChallenge.id,
        provider: deliveryResult.provider,
        providerMessageId: deliveryResult.providerMessageId || null,
        status: deliveryResult.status,
        errorCode: deliveryResult.errorCode || null,
        costEstimate: deliveryResult.costEstimate || 0,
      },
    });

    let warnMsg: string | undefined;
    if (params.institutionId) {
      const periodMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
      const usage = await tx.usageRecord.upsert({
        where: {
          institutionId_periodMonth: {
            institutionId: params.institutionId,
            periodMonth,
          },
        },
        update: {
          otpSent: { increment: 1 },
          otpCostEstimate: { increment: deliveryResult.costEstimate || 0 },
        },
        create: {
          institutionId: params.institutionId,
          periodMonth,
          otpSent: 1,
          otpCostEstimate: deliveryResult.costEstimate || 0,
        },
      });

      const MAX_OTP_THRESHOLD = 500;
      if (usage.otpSent >= MAX_OTP_THRESHOLD * 0.8) {
        warnMsg = `Peringatan: Penggunaan OTP institusi Anda telah mencapai ${usage.otpSent} pengiriman (${Math.round((usage.otpSent / MAX_OTP_THRESHOLD) * 100)}% dari kuota bulanan).`;
      }
    }

    return { challenge: createdChallenge, warning: warnMsg };
  });

  return {
    success: true,
    challengeId: challenge.id,
    destinationMasked: maskPhoneNumber(normalizedPhone),
    channel: deliveryResult.channel,
    expiresAt,
    cooldownSeconds: RESEND_COOLDOWN_SECONDS,
    warning,
  };
}

/**
 * Verifikasi kode OTP dengan constant-time comparison
 */
export async function verifyOtpCode(params: VerifyOtpParams): Promise<VerifyOtpResult> {
  const challenge = await prisma.otpChallenge.findUnique({
    where: { id: params.challengeId },
  });

  if (!challenge) {
    return {
      success: false,
      error: "Sesi verifikasi OTP tidak ditemukan atau telah kedaluwarsa.",
    };
  }

  // 1. Cek apakah sudah hangus / pernah dipakai
  if (challenge.consumedAt) {
    return {
      success: false,
      error: "Kode verifikasi telah digunakan sebelumnya.",
    };
  }

  // 2. Cek apakah kedaluwarsa
  const now = new Date();
  if (challenge.expiresAt < now) {
    return {
      success: false,
      error: "Kode verifikasi telah kedaluwarsa. Silakan minta kode baru.",
    };
  }

  // 3. Cek batas kegagalan percobaan
  if (challenge.attempts >= MAX_ATTEMPTS) {
    return {
      success: false,
      error: "Kode OTP telah hangus karena 5 kali salah input. Silakan minta kode baru.",
    };
  }

  // 4. Verifikasi kecocokan nomor tujuan jika disyaratkan
  if (params.expectedDestinationE164) {
    const expectedHash = hashDestination(normalizePhoneE164(params.expectedDestinationE164));
    if (challenge.destinationHash !== expectedHash) {
      return {
        success: false,
        error: "Kode OTP tidak valid untuk nomor handphone ini.",
      };
    }
  }

  // 5. Bandingkan hash kode OTP secara constant-time
  const inputHash = hashOtpCode(params.code.trim());
  const isMatch = crypto.timingSafeEqual(
    Buffer.from(inputHash, "utf-8"),
    Buffer.from(challenge.codeHash, "utf-8")
  );

  if (!isMatch) {
    const updated = await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });

    const remaining = MAX_ATTEMPTS - updated.attempts;
    return {
      success: false,
      error: remaining > 0
        ? `Kode verifikasi salah. Sisa kesempatan: ${remaining} kali.`
        : "Kode verifikasi telah hangus karena 5 kali salah.",
      remainingAttempts: remaining,
    };
  }

  // 6. OTP Valid: Terbitkan token verifikasi sekali pakai berumur 10 menit
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const tokenExpiresAt = new Date(now.getTime() + 10 * 60 * 1000);

  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: {
      consumedAt: now,
      verificationToken,
      verificationTokenExpiresAt: tokenExpiresAt,
    },
  });

  return {
    success: true,
    verificationToken,
    message: "Verifikasi berhasil.",
  };
}

/**
 * Konsumsi dan validasi token verifikasi sekali pakai
 */
export async function consumeVerificationToken(
  token: string,
  purpose: OtpPurpose | string
): Promise<{
  isValid: boolean;
  destinationE164?: string;
  userId?: string | null;
  institutionId?: string | null;
}> {
  const challenge = await prisma.otpChallenge.findFirst({
    where: {
      verificationToken: token,
      purpose: purpose as OtpPurpose,
      verificationTokenExpiresAt: { gt: new Date() },
    },
  });

  if (!challenge) {
    return { isValid: false };
  }

  // Invalidate token after consumption (one-time use)
  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: {
      verificationToken: null,
      verificationTokenExpiresAt: null,
    },
  });

  return {
    isValid: true,
    destinationE164: challenge.destinationE164,
    userId: challenge.userId,
    institutionId: challenge.institutionId,
  };
}

