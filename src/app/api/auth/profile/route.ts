import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { withTenantTransaction } from "@/lib/db/tenant-prisma";

export async function GET(req: Request) {
  try {
    const guard = await requireSession(req);
    if (!guard.success) {
      return guard.response;
    }

    const userId = guard.user.id;
    const institutionId = guard.institutionId;

    // Ambil data lengkap pengguna dalam konteks tenant
    const user = await withTenantTransaction(institutionId, async (tenantDb) =>
      tenantDb.user.findUnique({
        where: { id: userId },
        include: {
          institution: {
            select: { id: true, name: true, slug: true, logoUrl: true, themeColor: true },
          },
          identifiers: {
            where: { deactivatedAt: null },
            orderBy: { createdAt: "asc" },
          },
          studentProfiles: {
            include: {
              programDepartment: {
                select: { id: true, name: true, code: true },
              },
            },
          },
          staffProfiles: {
            select: { id: true, employeeNumber: true, title: true, department: true },
          },
          memberships: {
            select: { role: true, status: true },
          },
        },
      })
    ).catch(async () => {
      // Fallback bila direct prisma diperlukan
      return prisma.user.findUnique({
        where: { id: userId },
        include: {
          institution: {
            select: { id: true, name: true, slug: true, logoUrl: true, themeColor: true },
          },
          identifiers: {
            where: { deactivatedAt: null },
            orderBy: { createdAt: "asc" },
          },
          studentProfiles: {
            include: {
              programDepartment: {
                select: { id: true, name: true, code: true },
              },
            },
          },
          staffProfiles: {
            select: { id: true, employeeNumber: true, title: true, department: true },
          },
          memberships: {
            select: { role: true, status: true },
          },
        },
      });
    });

    if (!user) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }

    const institutionEmailId = user.identifiers.find((i: any) => i.type === "INSTITUTION_EMAIL");
    const personalEmailId = user.identifiers.find((i: any) => i.type === "PERSONAL_EMAIL");
    const primaryIdObj =
      user.identifiers.find((i: any) => i.isPrimary) ||
      user.identifiers.find((i: any) => i.type === "INSTITUTION_ID");

    const studentProfile = user.studentProfiles?.[0];
    const staffProfile = user.staffProfiles?.[0];

    const departmentName =
      studentProfile?.programDepartment?.name ||
      staffProfile?.department ||
      staffProfile?.title ||
      "";

    const primaryIdentifier =
      studentProfile?.studentIdNumber ||
      staffProfile?.employeeNumber ||
      primaryIdObj?.value ||
      guard.user.identifier ||
      "";

    const loginEmail = institutionEmailId?.value || "";
    const contactEmail = user.contactEmail || personalEmailId?.value || "";

    const profileData = {
      id: user.id,
      fullName: user.fullName,
      loginEmail,
      contactEmail,
      phone: user.phoneE164 || "",
      phoneVerifiedAt: user.phoneVerifiedAt,
      status: user.status,
      createdAt: user.createdAt,
      identifiers: user.identifiers.map((i: any) => ({
        type: i.type,
        value: i.value,
        isPrimary: i.isPrimary,
        isLoginEnabled: i.isLoginEnabled,
      })),
      primaryIdentifier,
      institutionName: user.institution?.name || "",
      institutionSlug: user.institution?.slug || guard.tenantSlug,
      departmentName,
      role: guard.role || user.memberships?.[0]?.role || "STUDENT",
    };

    return NextResponse.json({
      success: true,
      ...profileData,
      profile: profileData,
    });
  } catch (error: any) {
    console.error("Profile fetch error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memuat profil pengguna." },
      { status: 500 }
    );
  }
}
