import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { verifySignedFileToken } from "@/modules/classroom/file-security";
import { recordMaterialView } from "@/modules/classroom/classroom-service";
import { prisma } from "@/lib/db/prisma";
import { withTenantTransaction } from "@/lib/db/tenant-prisma";

export async function GET(req: Request, { params }: { params: Promise<{ fileId: string }> }) {
  try {
    const { fileId } = await params;
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token unduhan tidak disediakan." }, { status: 401 });
    }

    const payload = verifySignedFileToken(token);
    if (!payload || payload.fileId !== fileId) {
      return NextResponse.json({ error: "Tautan unduhan tidak valid atau telah kedaluwarsa." }, { status: 403 });
    }

    // Ambil detail berkas dalam konteks tenant
    const file = await withTenantTransaction(payload.institutionId, async (tenantDb) => {
      return tenantDb.materialFile.findFirst({
        where: { id: fileId, institutionId: payload.institutionId },
        include: {
          material: {
            include: { topic: true },
          },
        },
      });
    });

    if (!file) {
      return NextResponse.json({ error: "Berkas tidak ditemukan." }, { status: 404 });
    }

    // Jika pengunduh adalah siswa, catat lastViewedAt di MaterialProgress
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    const session = guard.success ? { user: guard.user } : null;
    if (session?.user?.id) {
      await withTenantTransaction(payload.institutionId, async (tenantDb) => {
        await tenantDb.materialProgress.upsert({
          where: {
            studentUserId_materialId: {
              studentUserId: session.user.id,
              materialId: file.materialId,
            },
          },
          update: { lastViewedAt: new Date() },
          create: {
            institutionId: payload.institutionId,
            studentUserId: session.user.id,
            materialId: file.materialId,
            isCompleted: false,
            lastViewedAt: new Date(),
          },
        });
      }).catch(() => {});
    }

    // Simulasi pengunduhan konten berkas (atau streaming dari storage)
    const content = Buffer.from(`Simulated file content for ${file.fileName}`);

    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(file.fileName)}"`,
        "Content-Length": content.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("GET /api/classroom/files/[fileId]/download error:", error);
    return NextResponse.json({ error: "Gagal mengunduh berkas." }, { status: 500 });
  }
}
