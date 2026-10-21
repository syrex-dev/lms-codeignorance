import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, validateNewPassword } from "@/lib/security/hash";

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
    const { newPassword, confirmPassword } = body;

    if (!newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "Password baru dan konfirmasi password wajib diisi." },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "Konfirmasi password tidak cocok dengan password baru." },
        { status: 400 }
      );
    }

    // Validasi kebijakan password
    const validation = validateNewPassword(newPassword, session.user.identifier);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.message },
        { status: 400 }
      );
    }

    // Hash password baru
    const newPasswordHash = await hashPassword(newPassword);

    // Update di database
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
      },
    });

    // Catat ke Audit Log
    await prisma.auditLog.create({
      data: {
        institutionId: session.user.activeInstitutionId,
        userId: session.user.id,
        action: "USER_CHANGE_PASSWORD",
        entityType: "User",
        entityId: session.user.id,
        newValue: { mustChangePassword: false, changedAt: new Date() },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Password berhasil diperbarui.",
    });
  } catch (error: any) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal saat memperbarui password." },
      { status: 500 }
    );
  }
}
