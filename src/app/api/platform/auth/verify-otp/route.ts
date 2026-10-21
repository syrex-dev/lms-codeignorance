import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyOtpCode } from "@/modules/otp/otp-service";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, challengeId, code } = body;

    if (!email || !challengeId || !code) {
      return NextResponse.json(
        { error: "Email, challengeId, dan kode OTP wajib diisi." },
        { status: 400 }
      );
    }

    const platformUser = await prisma.platformUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!platformUser) {
      return NextResponse.json({ error: "Akun platform tidak ditemukan." }, { status: 404 });
    }

    const verifyResult = await verifyOtpCode({
      challengeId,
      code,
      expectedDestinationE164: platformUser.phoneE164 || undefined,
    });

    if (!verifyResult.success) {
      return NextResponse.json(
        { error: verifyResult.error || "Kode OTP tidak valid." },
        { status: 400 }
      );
    }

    // Catat ke PlatformAuditLog
    await prisma.platformAuditLog.create({
      data: {
        platformUserId: platformUser.id,
        action: "PLATFORM_LOGIN_SUCCESS",
        details: {
          email: platformUser.email,
          role: platformUser.role,
          loggedAt: new Date(),
        },
      },
    });

    // Generate platform session token
    const token = crypto.randomBytes(32).toString("hex");

    return NextResponse.json({
      success: true,
      platformToken: token,
      user: {
        id: platformUser.id,
        email: platformUser.email,
        fullName: platformUser.fullName,
        role: platformUser.role,
      },
    });
  } catch (error: any) {
    console.error("Platform OTP verify error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal saat verifikasi OTP platform." },
      { status: 500 }
    );
  }
}
