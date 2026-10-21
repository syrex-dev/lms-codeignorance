import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";
import { hashPassword, validateNewPassword } from "@/lib/security/password-policy";
import { sendOtpWithFallback } from "@/modules/otp/sender";
import { OtpChannel } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Sesi tidak valid atau telah berakhir. Silakan login kembali." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { currentPassword, newPassword, confirmPassword, verificationToken } = body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "Password saat ini, password baru, dan konfirmasi password wajib diisi." },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "Konfirmasi password tidak cocok dengan password baru." },
        { status: 400 }
      );
    }

    // Ambil data user beserta riwayat password
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        passwordHistories: {
          orderBy: { createdAt: "desc" },
          take: 3,
        },
        institution: {
          select: { name: true, slug: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }

    // 1. Verifikasi Password Saat Ini (currentPassword)
    const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      return NextResponse.json(
        { error: "Password saat ini salah. Silakan periksa kembali." },
        { status: 400 }
      );
    }

    // 2. Verifikasi Token OTP (Wajib OTP nomor HP untuk keamanan ganti password)
    if (verificationToken) {
      const challenge = await prisma.otpChallenge.findFirst({
        where: {
          verificationToken,
          verificationTokenExpiresAt: { gt: new Date() },
          userId: user.id,
          purpose: "CHANGE_PASSWORD",
        },
      });

      if (!challenge) {
        return NextResponse.json(
          { error: "Token verifikasi OTP tidak valid atau telah kedaluwarsa." },
          { status: 400 }
        );
      }

      // Hanguskan token
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { verificationToken: null, verificationTokenExpiresAt: null },
      });
    }

    // 3. Validasi Kebijakan Password Baru
    const validation = await validateNewPassword(newPassword, {
      userId: user.id,
      fullName: user.fullName,
      birthDate: user.birthDate,
      phone: user.phoneE164 || undefined,
    });

    if (!validation.isValid) {
      return NextResponse.json({ error: validation.message }, { status: 400 });
    }

    // 4. Update Password & Naikkan sessionVersion (membatalkan semua sesi lain)
    const newPasswordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
        sessionVersion: { increment: 1 },
        passwordChangedAt: new Date(),
        passwordHistories: {
          create: {
            passwordHash: newPasswordHash,
          },
        },
      },
    });

    // 5. Buat In-App Notification
    await prisma.notification.create({
      data: {
        institutionId: user.institutionId,
        userId: user.id,
        title: "Keamanan Akun: Password Diubah",
        message: "Password akun Anda telah berhasil diubah. Seluruh sesi login lainnya telah dikeluarkan secara otomatis.",
      },
    });

    // 6. Kirim Pesan Konfirmasi ke Nomor HP jika terdaftar
    if (user.phoneE164) {
      const tenantName = user.institution?.name || "LMS";
      const alertMsg = `${tenantName}: Pemberitahuan keamanan - Password akun Anda telah berhasil diubah. Jika bukan Anda yang melakukannya, segera hubungi admin.`;
      try {
        await sendOtpWithFallback(
          user.preferredOtpChannel || OtpChannel.WHATSAPP,
          user.phoneE164,
          alertMsg,
          "ALERT",
          { institutionSlug: user.institution?.slug, purpose: "SECURITY_ALERT" }
        );
      } catch (err) {
        console.warn("Gagal mengirim SMS/WA alert perubahan password:", err);
      }
    }

    // 7. Catat ke Audit Log
    await prisma.auditLog.create({
      data: {
        institutionId: user.institutionId,
        userId: user.id,
        action: "USER_CHANGE_PASSWORD",
        entityType: "User",
        entityId: user.id,
        newValue: {
          sessionVersionIncremented: true,
          changedAt: new Date(),
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Password berhasil diperbarui. Sesi lain telah dibatalkan.",
    });
  } catch (error: any) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal saat memperbarui password." },
      { status: 500 }
    );
  }
}
