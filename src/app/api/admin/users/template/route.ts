import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { CsvImportService } from "@/modules/users/csv-import";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
    }

    const institutionId = session.user.activeInstitutionId;
    let institutionType: "SCHOOL" | "UNIVERSITY" = "UNIVERSITY";

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
