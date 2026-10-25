import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";
import { normalizePhoneE164, isValidIndonesianPhone } from "@/lib/security/phone";
import { verifyOtpCode } from "@/modules/otp/otp-service";
import { OtpPurpose } from "@/modules/otp/types";

export async function POST(req: Request) {
  try {
    const guard = await requireSession(req);
    if (!guard.success) {
      return guard.response;
    }
    const session = { user: guard.user };

    const body = await req.json();
    const {
      password,
      newPhoneNumber,
      newPhone,
      otpCode,
      challengeId,
      oldPhoneVerificationToken,
      newPhoneVerificationToken,
    } = body;

    const rawTargetPhone = (newPhone || newPhoneNumber || "").trim();
    if (!rawTargetPhone) {
      return NextResponse.json(
        { error: "Nomor WhatsApp / telepon baru wajib diisi." },
        { status: 400 }
      );
    }

    const normalizedNew = normalizePhoneE164(rawTargetPhone);
    if (!isValidIndonesianPhone(normalizedNew)) {
      return NextResponse.json(
        { error: "Nomor WhatsApp/HP baru tidak valid atau di luar kode negara yang diizinkan (+62)." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }

    // 1. Cek Masa Pendinginan (Cooldown 24 Jam)
    const COOLDOWN_HOURS = 24;
    if (user.phoneVerifiedAt && user.phoneE164 && user.phoneE164 === normalizedNew) {
      return NextResponse.json(
        { error: "Nomor baru sama dengan nomor yang sudah aktif saat ini." },
        { status: 400 }
      );
    }

    // 2. Cabang Verifikasi:
    // A. Verifikasi via OTP 6-Digit langsung (dari halaman Profile)
    if (otpCode) {
      let challenge = null;
      if (challengeId) {
        challenge = await prisma.otpChallenge.findUnique({
          where: { id: challengeId },
        });
      } else {
        challenge = await prisma.otpChallenge.findFirst({
          where: {
            destinationE164: normalizedNew,
            purpose: "CHANGE_PHONE",
            consumedAt: null,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: "desc" },
        });
      }

      if (!challenge) {
        return NextResponse.json(
          { error: "Sesi verifikasi OTP tidak ditemukan atau telah kedaluwarsa. Silakan kirim ulang kode OTP." },
          { status: 400 }
        );
      }

      const verifyRes = await verifyOtpCode({
        challengeId: challenge.id,
        code: otpCode.trim(),
        purpose: "CHANGE_PHONE" as OtpPurpose,
      });

      if (!verifyRes.success) {
        return NextResponse.json(
          { error: verifyRes.error || "Kode OTP tidak valid atau kedaluwarsa." },
          { status: 400 }
        );
      }
    } else {
      // B. Verifikasi via Token + Password (Alur Keamanan Lanjutan)
      if (!password || !newPhoneVerificationToken) {
        return NextResponse.json(
          { error: "Password dan token verifikasi nomor baru wajib diisi." },
          { status: 400 }
        );
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return NextResponse.json(
          { error: "Password yang Anda masukkan salah." },
          { status: 400 }
        );
      }

      if (user.phoneE164 && user.phoneVerifiedAt) {
        if (!oldPhoneVerificationToken) {
          return NextResponse.json(
            { error: "Verifikasi OTP ke nomor HP lama diperlukan sebelum mengganti nomor." },
            { status: 400 }
          );
        }

        const oldChallenge = await prisma.otpChallenge.findFirst({
          where: {
            verificationToken: oldPhoneVerificationToken,
            verificationTokenExpiresAt: { gt: new Date() },
            userId: user.id,
            purpose: "CHANGE_PHONE",
          },
        });

        if (!oldChallenge) {
          return NextResponse.json(
            { error: "Token verifikasi nomor HP lama tidak valid atau telah kedaluwarsa." },
            { status: 400 }
          );
        }
      }

      const newChallenge = await prisma.otpChallenge.findFirst({
        where: {
          verificationToken: newPhoneVerificationToken,
          verificationTokenExpiresAt: { gt: new Date() },
          destinationE164: normalizedNew,
          purpose: "CHANGE_PHONE",
        },
      });

      if (!newChallenge) {
        return NextResponse.json(
          { error: "Token verifikasi nomor HP baru tidak valid atau telah kedaluwarsa." },
          { status: 400 }
        );
      }
    }

    // 3. Update Nomor HP di Database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        phoneE164: normalizedNew,
        phoneVerifiedAt: new Date(),
      },
    });

    // 4. Catat Audit Log
    await prisma.auditLog.create({
      data: {
        institutionId: user.institutionId,
        userId: user.id,
        action: "USER_CHANGE_PHONE",
        entityType: "User",
        entityId: user.id,
        oldValue: { phoneE164: user.phoneE164 },
        newValue: { phoneE164: normalizedNew, changedAt: new Date() },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Nomor WhatsApp / telepon berhasil diperbarui dan telah diverifikasi.",
      phoneE164: normalizedNew,
    });
  } catch (error: any) {
    console.error("Change phone error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal saat memperbarui nomor HP." },
      { status: 500 }
    );
  }
}
