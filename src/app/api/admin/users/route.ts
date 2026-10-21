import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { UserService } from "@/modules/users/user-service";
import { UserRole, UserStatus } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
    }

    const role = (session.user as any).activeRole || (session.user as any).role;
    if (role !== "INSTITUTION_ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Akses ditolak: Hanya Admin Institusi yang dapat mengakses manajemen pengguna." },
        { status: 403 }
      );
    }

    const institutionId = session.user.activeInstitutionId;
    if (!institutionId) {
      return NextResponse.json({ error: "Institusi aktif tidak ditemukan." }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || undefined;
    const roleParam = searchParams.get("role") as UserRole | undefined;
    const statusParam = searchParams.get("status") as UserStatus | undefined;
    const isPendingActivationParam = searchParams.get("isPendingActivation");
    const isPendingActivation =
      isPendingActivationParam !== null ? isPendingActivationParam === "true" : undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const result = await UserService.searchUsers(institutionId, {
      search,
      role: roleParam,
      status: statusParam,
      isPendingActivation,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("GET /api/admin/users error:", error);
    return NextResponse.json({ error: error.message || "Terjadi kesalahan server." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
    }

    const role = (session.user as any).activeRole || (session.user as any).role;
    if (role !== "INSTITUTION_ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Akses ditolak: Hanya Admin Institusi yang dapat menambah pengguna baru." },
        { status: 403 }
      );
    }

    const institutionId = session.user.activeInstitutionId;
    if (!institutionId) {
      return NextResponse.json({ error: "Institusi aktif tidak ditemukan." }, { status: 400 });
    }

    const body = await req.json();
    const {
      fullName,
      role: targetRole,
      id,
      birthDate,
      phoneE164,
      phoneOwner,
      contactEmail,
      programDepartmentId,
      classCourseId,
    } = body;

    if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2) {
      return NextResponse.json(
        { error: "Nama lengkap wajib diisi (minimal 2 karakter)." },
        { status: 400 }
      );
    }

    if (!targetRole) {
      return NextResponse.json({ error: "Peran pengguna wajib ditentukan." }, { status: 400 });
    }

    const result = await UserService.createUser(
      {
        institutionId,
        fullName,
        role: targetRole,
        id,
        birthDate,
        phoneE164,
        phoneOwner,
        contactEmail,
        programDepartmentId,
        classCourseId,
      },
      session.user.id
    );

    return NextResponse.json({ success: true, user: result });
  } catch (error: any) {
    console.error("POST /api/admin/users error:", error);
    return NextResponse.json({ error: error.message || "Gagal membuat pengguna." }, { status: 400 });
  }
}
