import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { storage } from "@/lib/storage";
import { withTenantTransaction } from "@/lib/db/tenant-prisma";
import { UserRole } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const guard = await requireSession(req, {
      requiredRoles: [UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN],
    });
    if (!guard.success) return guard.response;

    const { institutionId, user } = guard;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Berkas logo wajib dilampirkan." }, { status: 400 });
    }

    // Validasi ukuran maks 2MB
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Ukuran berkas logo maksimal 2MB." }, { status: 400 });
    }

    // Validasi tipe berkas (PNG, JPG, SVG)
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Format berkas logo harus berupa PNG, JPG, atau SVG." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload via tenant-scoped storage
    const uploadResult = await storage.uploadFile(
      buffer,
      file.name,
      file.type,
      institutionId,
      "branding"
    );

    // Update logoUrl di basis data
    const updated = await withTenantTransaction(institutionId, async (tenantDb) => {
      const inst = await prisma.institution.update({
        where: { id: institutionId },
        data: { logoUrl: uploadResult.url },
      });

      await tenantDb.auditLog.create({
        data: {
          userId: user.id,
          action: "UPDATE_INSTITUTION_LOGO",
          entityType: "INSTITUTION",
          entityId: institutionId,
          newValue: { logoUrl: uploadResult.url, fileName: file.name, fileSize: file.size },
        },
      });

      return inst;
    });

    return NextResponse.json({
      success: true,
      message: "Logo institusi berhasil diunggah.",
      url: uploadResult.url,
      institution: updated,
    });
  } catch (error: any) {
    console.error("POST /api/admin/settings/logo error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal mengunggah logo institusi." },
      { status: 500 }
    );
  }
}
