import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/security/password-policy";
import crypto from "crypto";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const resolvedParams = await params;
    const targetUserId = resolvedParams.id;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
    }

    const adminRole = session.user.role;
    if (adminRole !== "INSTITUTION_ADMIN" && adminRole !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Akses ditolak: Hanya Admin Institusi yang berhak mereset akses pengguna." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { actionType, reason } = body;

    if (!reason || typeof reason !== "string" || reason.trim().length < 10) {
      return NextResponse.json(
        { error: "Alasan tertulis wajib diisi (minimal 10 karakter) untuk keperluan audit keamanan." },
        { status: 400 }
      );
    }

    if (actionType !== "PASSWORD_ONLY" && actionType !== "PASSWORD_AND_PHONE") {
      return NextResponse.json(
        { error: "Tipe aksi tidak valid. Pilih 'PASSWORD_ONLY' atau 'PASSWORD_AND_PHONE'." },
        { status: 400 }
      );
    }

    // Ambil target user dan pastikan berada pada tenant yang sama (tenant isolation)
    const targetUser = await prisma.user.findFirst({
      where: {
        id: targetUserId,
        institutionId: session.user.activeInstitutionId,
      },
      include: {
        identifiers: true,
        institution: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "Pengguna tidak ditemukan dalam institusi Anda." },
        { status: 404 }
      );
    }

    // Ambil identifier utama (NIM/NIS/NIP)
    const primaryIdent = targetUser.identifiers.find(
      (i) => i.type === "INSTITUTION_ID" || i.type === "APPLICANT_NO"
    ) || targetUser.identifiers[0];

    const userRawId = primaryIdent?.value || targetUser.id.substring(0, 8);

    // Tentukan password awal berdasarkan mode tenant
    const mode = targetUser.institution.initialPasswordMode;
    let initialPasswordPlain: string;

    if (mode === "RANDOM") {
      // 8 karakter acak (huruf besar, huruf kecil, angka)
      const randomPart = crypto.randomBytes(4).toString("hex");
      initialPasswordPlain = `Pwd${randomPart}!1`;
    } else {
      // SAME_AS_ID (default)
      initialPasswordPlain = userRawId;
    }

    const newPasswordHash = await hashPassword(initialPasswordPlain);

    // Reset status akun kembali ke PENDING_ACTIVATION dan increment sessionVersion
    const updateData: any = {
      passwordHash: newPasswordHash,
      status: "PENDING_ACTIVATION",
      mustChangePassword: true,
      sessionVersion: { increment: 1 },
      passwordChangedAt: new Date(),
    };

    if (actionType === "PASSWORD_AND_PHONE") {
      updateData.phoneE164 = null;
      updateData.phoneVerifiedAt = null;
    }

    await prisma.user.update({
      where: { id: targetUser.id },
      data: updateData,
    });

    // Catat ke AuditLog dengan alasan wajib
    await prisma.auditLog.create({
      data: {
        institutionId: targetUser.institutionId,
        userId: session.user.id,
        action: "ADMIN_RESET_USER_ACCESS",
        entityType: "User",
        entityId: targetUser.id,
        oldValue: {
          status: targetUser.status,
          phoneE164: targetUser.phoneE164,
        },
        newValue: {
          actionType,
          reason,
          newStatus: "PENDING_ACTIVATION",
          mustChangePassword: true,
          phoneCleared: actionType === "PASSWORD_AND_PHONE",
          resetByAdminId: session.user.id,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Akses pengguna berhasil direset. Status akun dikembalikan ke PENDING_ACTIVATION. Pengguna wajib melakukan aktivasi pertama ulang saat login.`,
      actionType,
      initialPasswordPlain: mode === "RANDOM" ? initialPasswordPlain : undefined,
    });
  } catch (error: any) {
    console.error("Admin reset user access error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal saat mereset akses pengguna." },
      { status: 500 }
    );
  }
}
