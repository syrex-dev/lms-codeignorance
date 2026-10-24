import { UserRole } from "@prisma/client";
import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { CsvImportService } from "@/modules/users/csv-import";

export async function GET(req: Request) {
  try {
    const guard = await requireSession(req, {
      requiredRoles: [UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN],
    });
    if (!guard.success) {
      return guard.response;
    }
    const { institutionId } = guard;
    const session = { user: guard.user };let institutionType: "SCHOOL" | "UNIVERSITY" = "UNIVERSITY";

    if (institutionId) {
      const inst = await prisma.institution.findUnique({
        where: { id: institutionId },
        select: { type: true },
      });
      if (inst?.type === "SCHOOL") {
        institutionType = "SCHOOL";
      }
    }

    const csvContent = CsvImportService.generateTemplateCsv(institutionType);

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="template_import_pengguna.csv"',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal mengunduh template." }, { status: 500 });
  }
}
