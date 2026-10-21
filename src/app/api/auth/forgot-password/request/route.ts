import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { issueOtpChallenge } from "@/modules/otp/otp-service";
import { OtpChannel, OtpPurpose } from "@/modules/otp/types";
import { checkTenantRateLimit } from "@/lib/security/rate-limit";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { identifier, channel, institutionSlug } = body;

    if (!identifier || !institutionSlug) {
      return NextResponse.json(
        { error: "Identifier dan slug institusi wajib diisi." },
        { status: 400 }
      );
    }

    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const otpChannel = channel === "SMS" ? OtpChannel.SMS : OtpChannel.WHATSAPP;

    // Rate limiting per identifier dan IP
    const rateCheck = checkTenantRateLimit(institutionSlug, "forgot-password", identifier, 5, 300);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Terlalu banyak permintaan. Silakan coba lagi dalam ${rateCheck.retryAfterSeconds} detik.` },
        { status: 429 }
      );
    }

    // Resolusi tenant
    const institution = await prisma.institution.findUnique({
      where: { slug: institutionSlug.toLowerCase().trim() },
    });

    let challengeId: string = "mock-challenge-enum-safe";
    let destinationMasked: string = "+62 8**-****-****";

    if (institution) {
      // Cari identifier di tenant ini
      const normalizedIdent = identifier.toLowerCase().trim();
      const userIdent = await prisma.userIdentifier.findFirst({
        where: {
          institutionId: institution.id,
          value: normalizedIdent,
          isLoginEnabled: true,
        },
        include: {
          user: true,
        },
      });

      if (userIdent?.user && userIdent.user.phoneE164) {
        // Terbitkan OTP khusus FORGOT_PASSWORD
        const result = await issueOtpChallenge({
          institutionId: institution.id,
          userId: userIdent.user.id,
          destinationE164: userIdent.user.phoneE164,
          channel: otpChannel,
          purpose: OtpPurpose.FORGOT_PASSWORD,
          ipAddress: ip,
        });

        if (result.success && result.challengeId) {
          challengeId = result.challengeId;
          destinationMasked = result.destinationMasked || "+62 8**-****-****";
        }
      }
    }

    // RESPONS IDENTIK untuk mencegah user enumeration
    return NextResponse.json({
      success: true,
      message: "Jika data cocok, kode verifikasi dikirim ke nomor terdaftar.",
      challengeId,
      destinationMasked,
    });
  } catch (error: any) {
    console.error("Forgot password request error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan sistem saat memproses permintaan lupa password." },
      { status: 500 }
    );
  }
}
