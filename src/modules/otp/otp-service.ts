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
import { getOtpSender } from "./sender";

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
        cooldownSeconds: waitSeconds,
        error: `Mohon tunggu ${waitSeconds} detik sebelum meminta kode OTP kembali.`,
      };
    }

    if (recentChallenge.resendCount >= MAX_RESENDS_PER_HOUR) {
      return {
        success: false,
        error: "Batas pengiriman OTP per jam telah tercapai. Silakan coba lagi nanti.",
      };
    }
  }

  // 3. Batalkan OTP aktif sebelumnya untuk tujuan & purpose ini
  await prisma.otpChallenge.updateMany({
    where: {
      destinationHash: destHash,
      purpose: params.purpose,
      consumedAt: null,
      expiresAt: { gt: now },
    },
    data: {
      consumedAt: now, // Invalidate previous active OTP
    },
  });

  // 4. Generate kode 6 digit CSPRNG
  const rawCode = crypto.randomInt(100000, 999999).toString();
  const codeHash = hashOtpCode(rawCode);
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // 5. Simpan tantangan OTP baru ke database
  const resendCount = recentChallenge ? recentChallenge.resendCount + 1 : 0;
  const challenge = await prisma.otpChallenge.create({
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

  // 6. Ambil nama institusi untuk pesan resmi
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

  // 7. Kirim pesan lewat provider (WhatsApp / SMS / Mock)
  const sender = getOtpSender(params.channel);
  const deliveryResult = await sender.send(
    params.channel,
    normalizedPhone,
    messageText,
    rawCode,
    { institutionSlug: tenantSlug, purpose: params.purpose }
  );

  // 8. Catat status pengiriman di OtpDelivery
  await prisma.otpDelivery.create({
    data: {
      challengeId: challenge.id,
      provider: deliveryResult.provider,
      providerMessageId: deliveryResult.providerMessageId || null,
      status: deliveryResult.status,
      errorCode: deliveryResult.errorCode || null,
      costEstimate: deliveryResult.costEstimate || 0,
    },
  });

  // 9. Catat pemakaian OTP ke UsageRecord tenant
  if (params.institutionId) {
    const periodMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
    await prisma.usageRecord.upsert({
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
  }

  return {
    success: true,
    challengeId: challenge.id,
    destinationMasked: maskPhoneNumber(normalizedPhone),
    channel: params.channel,
    expiresAt,
    cooldownSeconds: RESEND_COOLDOWN_SECONDS,
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
    return { success: false, error: "Tantangan verifikasi tidak ditemukan." };
  }

  // Cek purpose cocok
  if (challenge.purpose !== params.purpose) {
    return { success: false, error: "Tujuan verifikasi tidak sesuai." };
  }

  // Cek apakah sudah digunakan
  if (challenge.consumedAt) {
    return { success: false, error: "Kode verifikasi ini sudah pernah digunakan atau kedaluwarsa." };
  }

  const now = new Date();
  if (now > challenge.expiresAt) {
    return { success: false, error: "Kode verifikasi telah kedaluwarsa. Silakan minta kode baru." };
  }

  // Cek batas percobaan salah
  if (challenge.attempts >= challenge.maxAttempts) {
    return {
      success: false,
      error: "Kode verifikasi telah hangus karena melebihi batas percobaan. Silakan minta kode baru.",
    };
  }

  // Constant-time compare
  const providedHash = hashOtpCode(params.code.trim());
  const storedHashBuffer = Buffer.from(challenge.codeHash, "hex");
  const providedHashBuffer = Buffer.from(providedHash, "hex");

  const isMatch =
    storedHashBuffer.length === providedHashBuffer.length &&
    crypto.timingSafeEqual(storedHashBuffer, providedHashBuffer);

  if (!isMatch) {
    const updatedAttempts = challenge.attempts + 1;
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: updatedAttempts },
    });

    const attemptsRemaining = Math.max(0, challenge.maxAttempts - updatedAttempts);
    return {
      success: false,
      attemptsRemaining,
      error: `Kode verifikasi salah. Sisa percobaan: ${attemptsRemaining}.`,
    };
  }

  // Sukses: tandai consumed dan buat single-use verification token (10 menit)
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
    destinationE164: challenge.destinationE164,
    userId: challenge.userId,
    institutionId: challenge.institutionId,
  };
}

/**
 * Validasi dan konsumsi verification token yang dihasilkan setelah OTP valid
 */
export async function consumeVerificationToken(
  token: string,
  expectedPurpose: OtpPurpose
): Promise<{ isValid: boolean; destinationE164?: string; userId?: string | null; institutionId?: string | null }> {
  if (!token) return { isValid: false };

  const challenge = await prisma.otpChallenge.findUnique({
    where: { verificationToken: token },
  });

  if (!challenge) return { isValid: false };

  const now = new Date();
  if (
    challenge.purpose !== expectedPurpose ||
    !challenge.verificationTokenExpiresAt ||
    now > challenge.verificationTokenExpiresAt
  ) {
    return { isValid: false };
  }

  // Invalidate token setelah sekali pakai
  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { verificationToken: null, verificationTokenExpiresAt: null },
  });

  return {
    isValid: true,
    destinationE164: challenge.destinationE164,
    userId: challenge.userId,
    institutionId: challenge.institutionId,
  };
}
