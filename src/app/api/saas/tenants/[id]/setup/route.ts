import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getTenantPrisma } from "@/lib/db/tenant-prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const tenantId = resolvedParams.id;
    const body = await req.json();

    const {
      academicYearName,
      academicYearCode,
      startDate,
      endDate,
      departments = [], // Array prodi/jenjang
      idFormatTemplate,
      initialPasswordMode,
      phoneBindingPolicy,
      themeColor,
    } = body;

    const tenant = await prisma.institution.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant tidak ditemukan." }, { status: 404 });
    }

    const tenantDb = getTenantPrisma(tenant.id);

    // 1. Buat Tahun Ajaran Awal
    if (academicYearName && academicYearCode) {
      await (tenantDb as any).academicTerm.create({
        data: {
          name: academicYearName,
          code: academicYearCode,
          type: "REGULAR_SEMESTER_ODD",
          startDate: startDate ? new Date(startDate) : new Date(),
          endDate: endDate ? new Date(endDate) : new Date(Date.now() + 180 * 24 * 3600 * 1000),
          isActive: true,
        },
      });
    }

    // 2. Buat Program Studi / Jurusan / Tingkat Kelas Awal
    for (const dept of departments) {
      if (dept.name && dept.code) {
        await (tenantDb as any).programDepartment.create({
          data: {
            name: dept.name,
            code: dept.code,
            facultyName: dept.facultyName || null,
            degreeLevel: dept.degreeLevel || (tenant.type === "UNIVERSITY" ? "S1" : "SMA"),
          },
        });
      }
    }

    // 3. Update Konfigurasi Tenant
    await prisma.institution.update({
      where: { id: tenant.id },
      data: {
        idFormatTemplate: idFormatTemplate || tenant.idFormatTemplate,
        initialPasswordMode: initialPasswordMode || tenant.initialPasswordMode,
        phoneBindingPolicy: phoneBindingPolicy || tenant.phoneBindingPolicy,
        themeColor: themeColor || tenant.themeColor,
      },
    });

    // 4. Catat ke AuditLog
    await (tenantDb as any).auditLog.create({
      data: {
        action: "TENANT_SETUP_WIZARD_COMPLETED",
        entityType: "Institution",
        entityId: tenant.id,
        newValue: {
          academicYearName,
          departmentsCount: departments.length,
          idFormatTemplate,
          initialPasswordMode,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Setup awal institusi berhasil disimpan.",
      tenantId: tenant.id,
    });
  } catch (error: any) {
    console.error("Tenant setup error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan sistem saat menyimpan setup institusi." },
      { status: 500 }
    );
  }
}
