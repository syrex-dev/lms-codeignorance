import { UserRole } from "@prisma/client";
import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: Request) {
  try {
    const guard = await requireSession(req, {
      requiredRoles: [UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN],
    });
    if (!guard.success) {
      return guard.response;
    }
    const { institutionId } = guard;
    const session = { user: guard.user };const logs = await prisma.auditLog.findMany({
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
