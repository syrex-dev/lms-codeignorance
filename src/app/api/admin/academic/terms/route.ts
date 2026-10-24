import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { withTenantTransaction } from "@/lib/db/tenant-prisma";
import { UserRole } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const guard = await requireSession(req);
    if (!guard.success) {
      return guard.response;
    }

    const { institutionId } = guard;
    const terms = await withTenantTransaction(institutionId, async (tenantDb) => {
      return tenantDb.academicTerm.findMany({
        where: { institutionId, deletedAt: null },
        orderBy: { startDate: "desc" },
        include: {
          _count: {
            select: { classCourses: true },
          },
        },
      });
    });

    return NextResponse.json({ terms });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal memuat tahun akademik." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const guard = await requireSession(req, {
      requiredRoles: [UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN],
    });
    if (!guard.success) {
      return guard.response;
    }

    const { institutionId } = guard;
    const body = await req.json();
    const { name, code, type, startDate, endDate, isActive } = body;

    if (!name || !code || !startDate || !endDate) {
      return NextResponse.json({ error: "Semua kolom wajib diisi." }, { status: 400 });
    }

    // Jika isActive true, nonaktifkan term lain
    if (isActive) {
      await prisma.academicTerm.updateMany({
        where: { institutionId, isActive: true },
        data: { isActive: false },
      });
    }

    const term = await prisma.academicTerm.create({
      data: {
        institutionId,
        name: name.trim(),
        code: code.trim(),
        type: type || "SEMESTER_ODD",
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: Boolean(isActive),
      },
    });

    return NextResponse.json({ success: true, term });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal membuat tahun akademik." }, { status: 500 });
  }
}
