import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
    }

    const institutionId = session.user.activeInstitutionId;
    if (!institutionId) {
      return NextResponse.json({ error: "Institusi aktif tidak ditemukan." }, { status: 400 });
    }

    const logs = await prisma.auditLog.findMany({
      where: {
        institutionId,
        action: {
          in: [
            "PLATFORM_SUPPORT_READONLY_ACCESS",
            "USER_CHANGE_PASSWORD",
            "USER_CHANGE_PHONE",
            "USER_RESET_ACCESS",
            "SETTINGS_UPDATED",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal memuat log audit keamanan." }, { status: 500 });
  }
}
