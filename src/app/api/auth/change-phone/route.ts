import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";
import { normalizePhoneE164, isValidIndonesianPhone } from "@/lib/security/phone";

export async function POST(req: Request) {
  try {
    const guard = await requireSession(req);
    if (!guard.success) {
      return guard.response;
    }
    const session = { user: guard.user };

    const body = await req.json();
    const { password, newPhoneNumber, oldPhoneVerificationToken, newPhoneVerificationToken } = body;

    if (!password || !newPhoneNumber || !newPhoneVerificationToken) {
      return NextResponse.json(
        { error: "Password, nomor HP baru, dan token verifikasi nomor baru wajib diisi." },
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
    if (user.phoneVerifiedAt && user.phoneE164) {
      const diffHours = (Date.now() - new Date(user.phoneVerifiedAt).getTime()) / (1000 * 60 * 60);
      if (diffHours < COOLDOWN_HOURS) {
        const remainingHours = Math.ceil(COOLDOWN_HOURS - diffHours);
        return NextResponse.json(
          { error: `Nomor HP baru saja diubah. Mohon menunggu masa pendinginan (${remainingHours} jam lagi) sebelum dapat mengubah nomor kembali.` },
          { status: 429 }
        );
      }
    }

    // 2. Verifikasi Password Pengguna
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Password yang Anda masukkan salah." },
        { status: 400 }
      );
    }

    // 2. Jika user sudah memiliki nomor HP terverifikasi, wajib verifikasi OTP nomor lama
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

    // 3. Verifikasi OTP Nomor HP Baru
    const normalizedNew = normalizePhoneE164(newPhoneNumber);
    if (!isValidIndonesianPhone(normalizedNew)) {
      return NextResponse.json(
        { error: "Nomor HP baru tidak valid atau di luar kode negara yang diizinkan (+62)." },
        { status: 400 }
      );
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

    // 4. Update Nomor HP
    await prisma.user.update({
      where: { id: user.id },
      data: {
        phoneE164: normalizedNew,
        phoneVerifiedAt: new Date(),
      },
    });

    // 5. Catat Audit Log
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
      message: "Nomor HP berhasil diperbarui dan telah diverifikasi.",
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
