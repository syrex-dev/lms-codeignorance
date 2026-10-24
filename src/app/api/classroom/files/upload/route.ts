import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { UserRole } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) return guard.response;

    const { institutionId, role } = guard;

    if (role === UserRole.STUDENT) {
      return NextResponse.json(
        { error: "Akses ditolak: Siswa tidak diizinkan mengunggah materi berkas." },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Berkas tidak ditemukan." }, { status: 400 });
    }

    // Maksimal 25MB
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Ukuran berkas maksimal 25MB." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadResult = await storage.uploadFile(
      buffer,
      file.name,
      file.type || "application/octet-stream",
      institutionId,
      "materials"
    );

    return NextResponse.json({
      success: true,
      file: {
        storageKey: uploadResult.filePath,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
      },
    });
  } catch (error: any) {
    console.error("POST /api/classroom/files/upload error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal mengunggah berkas materi." },
      { status: 500 }
    );
  }
}
