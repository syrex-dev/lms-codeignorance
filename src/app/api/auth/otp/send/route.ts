import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { createOtpChallenge } from "@/modules/otp/otp-service";
import { OtpChannel, OtpPurpose } from "@/modules/otp/types";
import { prisma } from "@/lib/db/prisma";
import { withTenantTransaction } from "@/lib/db/tenant-prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();

    const {
      channel = "WHATSAPP",
      purpose = "FIRST_ACTIVATION",
      destinationPhone,
      birthDate, // Faktor kedua saat aktivasi mandiri (SELF_WITH_DOB)
      tenantSlug,
    } = body;

    let targetPhone = destinationPhone;
    let targetUserId = session?.user?.id || null;
    let targetInstitutionId = session?.user?.activeInstitutionId || null;

    if (!targetInstitutionId && tenantSlug) {
      const inst = await prisma.institution.findUnique({
        where: { slug: tenantSlug },
        select: { id: true, phoneBindingPolicy: true },
      });
      targetInstitutionId = inst?.id || null;
    }

    // Jika ini adalah FIRST_ACTIVATION:
    if (purpose === "FIRST_ACTIVATION") {
      if (!session?.user) {
        return NextResponse.json({ error: "Sesi login diperlukan untuk aktivasi akun." }, { status: 401 });
      }

      const tenantId = targetInstitutionId || (session.user as any).activeInstitutionId;
      const dbUser = await withTenantTransaction(tenantId, async (tenantDb) =>
        tenantDb.user.findUnique({
          where: { id: session.user.id },
          include: { institution: true },
        })
      );

      if (!dbUser) {
        return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
      }

      // Cek apakah akun sedang terkunci karena kegagalan sebelumnya
      if (dbUser.lockedUntil && dbUser.lockedUntil > new Date()) {
        return NextResponse.json(
          { error: "Akun Anda sedang terkunci sementara karena 5 kali kegagalan verifikasi. Hubungi administrator institusi." },
          { status: 423 }
        );
      }

      // Aturan identitas:
      // A. Jika admin sudah mengisi nomor HP: nomor terkunci ke nomor itu
      if (dbUser.phoneE164) {
        targetPhone = dbUser.phoneE164;
      } else {
        // B. Jika admin belum mengisi nomor HP: pengguna mengisi sendiri & WAJIB cocok faktor kedua (tanggal lahir)
        if (!destinationPhone) {
          return NextResponse.json({ error: "Nomor handphone wajib diisi." }, { status: 400 });
        }
        if (!birthDate) {
          return NextResponse.json(
            { error: "Tanggal lahir wajib diisi sebagai verifikasi identitas kedua." },
            { status: 400 }
          );
        }

        // Cek kecocokan tanggal lahir dengan data akun
        if (dbUser.birthDate) {
          const inputDob = new Date(birthDate).toISOString().slice(0, 10);
          const actualDob = dbUser.birthDate.toISOString().slice(0, 10);
          if (inputDob !== actualDob) {
            // Catat kegagalan & update failed attempts
            const newFailed = dbUser.failedLoginAttempts + 1;
            const lockedUntil = newFailed >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
            await withTenantTransaction(tenantId, async (tenantDb) =>
              tenantDb.user.update({
                where: { id: dbUser.id },
                data: { failedLoginAttempts: newFailed, lockedUntil },
              })
            );

            return NextResponse.json(
              { error: "Tanggal lahir tidak cocok dengan data registrasi. Hubungi administrator." },
              { status: 400 }
            );
          }
        }
        targetPhone = destinationPhone;
      }
    }

    // Jalankan service pengiriman OTP
    const result = await createOtpChallenge({
      institutionId: targetInstitutionId,
      userId: targetUserId,
      purpose: purpose as OtpPurpose,
      channel: channel as OtpChannel,
      destinationE164: targetPhone,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error, cooldownSeconds: result.cooldownSeconds }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      challengeId: result.challengeId,
      destinationMasked: result.destinationMasked,
      channel: result.channel,
      expiresAt: result.expiresAt,
      cooldownSeconds: result.cooldownSeconds,
    });
  } catch (error: any) {
    console.error("OTP send error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan internal saat mengirim kode OTP." }, { status: 500 });
  }
}
