import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { withTenantTransaction } from "@/lib/db/tenant-prisma";
import { consumeVerificationToken } from "@/modules/otp/otp-service";
import { validatePasswordPolicy } from "@/lib/security/password-policy";
import { hashPassword } from "@/lib/security/hash";
import { UserStatus } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Sesi login tidak valid." }, { status: 401 });
    }

    const body = await req.json();
    const { verificationToken, newPassword } = body;

    if (!verificationToken || !newPassword) {
      return NextResponse.json({ error: "Token verifikasi dan password baru wajib diisi." }, { status: 400 });
    }

    // 1. Konsumsi Verification Token (Hanya berlaku untuk purpose FIRST_ACTIVATION)
    const tokenValidation = await consumeVerificationToken(verificationToken, "FIRST_ACTIVATION");
    if (!tokenValidation.isValid) {
      return NextResponse.json(
        { error: "Token verifikasi OTP tidak valid atau telah kedaluwarsa. Silakan lakukan verifikasi ulang." },
        { status: 400 }
      );
    }

    // 2. Ambil data user dari database
    const tenantId = (session.user as any).activeInstitutionId;
    const user = await withTenantTransaction(tenantId, async (tenantDb) =>
      tenantDb.user.findUnique({
        where: { id: session.user.id },
        include: { identifiers: true, institution: true },
      })
    );

    if (!user) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }

    // 3. Validasi Kebijakan Password Baru
    const passwordValidation = await validatePasswordPolicy(newPassword, {
      identifier: session.user.identifier,
      fullName: user.fullName,
      email: user.contactEmail || undefined,
      phone: tokenValidation.destinationE164 || user.phoneE164 || undefined,
      birthDate: user.birthDate,
      userId: user.id,
    });

    if (!passwordValidation.isValid) {
      return NextResponse.json({ error: passwordValidation.message }, { status: 400 });
    }

    // 4. Hash password baru
    const passwordHash = await hashPassword(newPassword);
    const now = new Date();

    // 5. Update data User secara atomik
    await withTenantTransaction(tenantId, async (tx) => {
      // Simpan riwayat password lama
      await tx.passwordHistory.create({
        data: {
          userId: user.id,
          passwordHash: user.passwordHash,
        },
      });

      // Update akun menjadi ACTIVE & nonaktifkan mustChangePassword
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          status: UserStatus.ACTIVE,
          mustChangePassword: false,
          phoneE164: tokenValidation.destinationE164 || user.phoneE164,
          phoneVerifiedAt: now,
          passwordChangedAt: now,
          sessionVersion: user.sessionVersion + 1, // Naikkan session version agar sesi lama invalid
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      // Catat ke Audit Log
      await tx.auditLog.create({
        data: {
          institutionId: user.institutionId,
          userId: user.id,
          action: "FIRST_ACTIVATION_COMPLETED",
          entityType: "User",
          entityId: user.id,
          newValue: {
            status: UserStatus.ACTIVE,
            phoneE164: tokenValidation.destinationE164 || user.phoneE164,
            activatedAt: now,
          },
        },
      });

      // Kirim notifikasi in-app
      await tx.notification.create({
        data: {
          institutionId: user.institutionId,
          userId: user.id,
          title: "Aktivasi Akun Berhasil",
          message: "Selamat! Akun Anda telah berhasil diaktifkan dan nomor handphone telah diverifikasi.",
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Akun Anda berhasil diaktifkan. Mengalihkan ke dashboard...",
    });
  } catch (error: any) {
    console.error("Onboarding complete error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan internal saat menyelesaikan aktivasi." }, { status: 500 });
  }
}
