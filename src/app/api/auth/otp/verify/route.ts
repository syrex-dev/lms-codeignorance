import { NextResponse } from "next/server";
import { verifyOtpCode } from "@/modules/otp/otp-service";
import { OtpPurpose } from "@/modules/otp/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { challengeId, code, purpose = "FIRST_ACTIVATION" } = body;

    if (!challengeId || !code) {
      return NextResponse.json({ error: "Challenge ID dan Kode OTP wajib diisi." }, { status: 400 });
    }

    const result = await verifyOtpCode({
      challengeId,
      code,
      purpose: purpose as OtpPurpose,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, attemptsRemaining: result.attemptsRemaining },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      verificationToken: result.verificationToken,
      destinationE164: result.destinationE164,
    });
  } catch (error: any) {
    console.error("OTP verify error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan saat memverifikasi kode OTP." }, { status: 500 });
  }
}
