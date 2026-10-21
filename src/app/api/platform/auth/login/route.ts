import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";
import { issueOtpChallenge } from "@/modules/otp/otp-service";
import { OtpChannel, OtpPurpose } from "@/modules/otp/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, channel = "WHATSAPP" } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email platform dan password wajib diisi." },
        { status: 400 }
      );
    }

    const platformUser = await prisma.platformUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!platformUser) {
      return NextResponse.json(
        { error: "Kredensial login platform tidak valid." },
        { status: 401 }
      );
    }

    const isMatch = await bcrypt.compare(password, platformUser.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Kredensial login platform tidak valid." },
        { status: 401 }
      );
    }

    if (!platformUser.phoneE164) {
      return NextResponse.json(
        { error: "Akun platform belum memiliki nomor HP untuk OTP 2FA. Hubungi super admin." },
        { status: 400 }
      );
    }

    // Terbitkan OTP khusus PLATFORM_LOGIN
    const challengeResult = await issueOtpChallenge({
      destinationE164: platformUser.phoneE164,
      channel: channel === "SMS" ? OtpChannel.SMS : OtpChannel.WHATSAPP,
      purpose: OtpPurpose.PLATFORM_LOGIN,
    });

    if (!challengeResult.success) {
      return NextResponse.json(
        { error: challengeResult.error || "Gagal mengirimkan kode OTP platform." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      requireOtp: true,
      challengeId: challengeResult.challengeId,
      destinationMasked: challengeResult.destinationMasked,
      message: `Kode verifikasi platform telah dikirimkan ke nomor ${challengeResult.destinationMasked}`,
    });
  } catch (error: any) {
    console.error("Platform login error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal saat memproses login platform." },
      { status: 500 }
    );
  }
}
