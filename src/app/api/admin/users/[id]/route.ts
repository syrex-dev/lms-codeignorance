import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { UserService } from "@/modules/users/user-service";
import { updateUserId } from "@/modules/id-generator/generator";
import { UserRole, UserStatus } from "@prisma/client";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
    }

    const role = (session.user as any).activeRole || (session.user as any).role;
    if (role !== "INSTITUTION_ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Akses ditolak: Hanya Admin Institusi yang berhak mengelola pengguna." },
        { status: 403 }
      );
    }

    const institutionId = session.user.activeInstitutionId;
    if (!institutionId) {
      return NextResponse.json({ error: "Institusi aktif tidak ditemukan." }, { status: 400 });
    }

    const resolvedParams = await params;
    const targetUserId = resolvedParams.id;
    const body = await req.json();
    const { action, status, newRole, newId, reason } = body;

    if (action === "TOGGLE_STATUS") {
      if (!status || !Object.values(UserStatus).includes(status)) {
        return NextResponse.json({ error: "Status target tidak valid." }, { status: 400 });
      }
      const updated = await UserService.toggleUserStatus(
        institutionId,
        targetUserId,
        status,
        session.user.id,
        reason
      );
      return NextResponse.json({ success: true, user: updated });
    }

    if (action === "CHANGE_ROLE") {
      if (!newRole || !Object.values(UserRole).includes(newRole)) {
        return NextResponse.json({ error: "Peran baru tidak valid." }, { status: 400 });
      }
      const updated = await UserService.changeUserRole(
        institutionId,
        targetUserId,
        newRole,
        session.user.id,
        reason
      );
      return NextResponse.json({ success: true, membership: updated });
    }

    if (action === "UPDATE_ID") {
      if (!newId || typeof newId !== "string") {
        return NextResponse.json({ error: "ID baru wajib diisi." }, { status: 400 });
      }
      const updated = await updateUserId(
        institutionId,
        targetUserId,
        newId,
        session.user.id,
        reason
      );
      return NextResponse.json({ success: true, ...updated });
    }

    return NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (error: any) {
    console.error("PATCH /api/admin/users/[id] error:", error);
    return NextResponse.json({ error: error.message || "Gagal memperbarui pengguna." }, { status: 400 });
  }
}
