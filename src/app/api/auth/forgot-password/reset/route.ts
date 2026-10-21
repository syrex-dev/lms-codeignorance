import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, validateNewPassword } from "@/lib/security/password-policy";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { verificationToken, newPassword, confirmPassword } = body;

    if (!verificationToken || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "Token verifikasi, password baru, dan konfirmasi password wajib diisi." },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "Konfirmasi password tidak cocok dengan password baru." },
        { status: 400 }
      );
    }

    // Cari tantangan OTP yang telah diverifikasi dan memiliki token valid
    const challenge = await prisma.otpChallenge.findFirst({
      where: {
        verificationToken,
        verificationTokenExpiresAt: { gt: new Date() },
        purpose: "FORGOT_PASSWORD",
      },
      include: {
        user: {
          include: {
            passwordHistories: {
              orderBy: { createdAt: "desc" },
              take: 3,
            },
          },
        },
      },
    });

    if (!challenge || !challenge.user) {
      return NextResponse.json(
        { error: "Token verifikasi tidak valid atau telah kedaluwarsa. Silakan ulangi proses lupa password." },
        { status: 400 }
      );
    }

    const user = challenge.user;

    // Validasi kebijakan password ketat
    const passwordCheck = await validateNewPassword(newPassword, {
      userId: user.id,
      fullName: user.fullName,
      birthDate: user.birthDate,
      phone: user.phoneE164 || undefined,
    });

    if (!passwordCheck.isValid) {
      return NextResponse.json(
        { error: passwordCheck.message },
        { status: 400 }
      );
    }

    const newHash = await hashPassword(newPassword);

    // Update password, naikkan sessionVersion untuk membatalkan semua sesi lain
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
        sessionVersion: { increment: 1 },
        passwordChangedAt: new Date(),
        passwordHistories: {
          create: {
            passwordHash: newHash,
          },
        },
      },
    });

    // Hanguskan verification token agar tidak bisa dipakai ulang
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: {
        verificationToken: null,
        verificationTokenExpiresAt: null,
      },
    });

    // Catat ke AuditLog
    await prisma.auditLog.create({
      data: {
        institutionId: user.institutionId,
        userId: user.id,
        action: "USER_FORGOT_PASSWORD_RESET",
        entityType: "User",
        entityId: user.id,
        newValue: {
          sessionVersionIncremented: true,
          resetAt: new Date(),
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Password Anda berhasil diperbarui. Seluruh sesi sebelumnya telah dikeluarkan. Silakan login kembali.",
    });
  } catch (error: any) {
    console.error("Forgot password reset error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal saat mereset password." },
      { status: 500 }
    );
  }
}
