import { UserRole } from "@prisma/client";
import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { previewIdFormat } from "@/modules/id-generator/generator";

export async function POST(req: Request) {
  try {
    const guard = await requireSession(req, {
      requiredRoles: [UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN],
    });
    if (!guard.success) {
      return guard.response;
    }
    const { institutionId } = guard;
    const session = { user: guard.user };const role = (session.user as any).activeRole || (session.user as any).role;
    if (role !== "INSTITUTION_ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Akses ditolak: Hanya Admin Institusi yang dapat mengonfigurasi generator ID." },
        { status: 403 }
      );
    }

        if (!institutionId) {
      return NextResponse.json({ error: "Institusi aktif tidak ditemukan." }, { status: 400 });
    }

    const body = await req.json();
    const { action, template, sampleData } = body;

    if (action === "preview") {
      if (!template || typeof template !== "string") {
        return NextResponse.json({ error: "Template format ID wajib diisi." }, { status: 400 });
      }

      const preview = previewIdFormat(template, sampleData || {});
      return NextResponse.json({ success: true, preview });
    }

    if (action === "save_template") {
      if (!template || typeof template !== "string") {
        return NextResponse.json({ error: "Template format ID wajib diisi." }, { status: 400 });
      }

      await prisma.institution.update({
        where: { id: institutionId },
        data: { idFormatTemplate: template.trim() },
      });

      return NextResponse.json({ success: true, message: "Template ID berhasil diperbarui." });
    }

    return NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal memproses template ID." }, { status: 500 });
  }
}
