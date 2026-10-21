import { NextResponse } from "next/server";
import { createOtpChallenge, verifyOtpCode } from "@/modules/otp/otp-service";
import { createTenantTrial, validateTenantSlug } from "@/modules/saas/tenant-service";
import { InstitutionType } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      action, // "SEND_OTP" atau "VERIFY_AND_CREATE"
      name,
      slug,
      type,
      adminFullName,
      adminPhone,
      adminPassword,
      challengeId,
      otpCode,
    } = body;

    // Aksi 1: Kirim OTP ke nomor admin calon tenant
    if (action === "SEND_OTP") {
      const slugValidation = validateTenantSlug(slug);
      if (!slugValidation.isValid) {
        return NextResponse.json({ error: slugValidation.error }, { status: 400 });
      }

      if (!adminPhone) {
        return NextResponse.json({ error: "Nomor handphone admin wajib diisi." }, { status: 400 });
      }

      const otpResult = await createOtpChallenge({
        purpose: "TENANT_SIGNUP",
        channel: "WHATSAPP",
        destinationE164: adminPhone,
      });

      if (!otpResult.success) {
        return NextResponse.json({ error: otpResult.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        challengeId: otpResult.challengeId,
        destinationMasked: otpResult.destinationMasked,
      });
    }

    // Aksi 2: Verifikasi OTP dan Buat Tenant Trial
    if (action === "VERIFY_AND_CREATE") {
      if (!challengeId || !otpCode) {
        return NextResponse.json({ error: "Kode OTP wajib diisi." }, { status: 400 });
      }

      const verifyResult = await verifyOtpCode({
        challengeId,
        code: otpCode,
        purpose: "TENANT_SIGNUP",
      });

      if (!verifyResult.success) {
        return NextResponse.json({ error: verifyResult.error }, { status: 400 });
      }

      // Buat tenant trial
      const result = await createTenantTrial({
        name,
        slug,
        type: type as InstitutionType,
        adminFullName,
        adminPhone: verifyResult.destinationE164 || adminPhone,
        adminPassword,
      });

      return NextResponse.json({
        success: true,
        message: "Institusi baru berhasil didaftarkan!",
        tenantSlug: result.institution.slug,
        adminId: result.adminId,
        adminEmail: result.adminEmail,
      });
    }

    return NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (error: any) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: error.message || "Gagal memproses pendaftaran tenant." }, { status: 400 });
  }
}
