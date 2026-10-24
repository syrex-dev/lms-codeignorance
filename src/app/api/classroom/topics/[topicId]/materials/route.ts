import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { createMaterial, reorderMaterials } from "@/modules/classroom/classroom-service";
import { MaterialType } from "@prisma/client";

export async function POST(req: Request, { params }: { params: Promise<{ topicId: string }> }) {
  try {
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) {
      return guard.response;
    }
    const session = { user: guard.user };
    const institutionId = guard.institutionId;
    const role = guard.role;

    const { topicId } = await params;
    

    
    const body = await req.json();

    if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ error: "Judul materi wajib diisi." }, { status: 400 });
    }

    const validTypes = Object.values(MaterialType);
    if (!body.type || !validTypes.includes(body.type)) {
      return NextResponse.json({ error: `Tipe materi harus salah satu dari: ${validTypes.join(", ")}` }, { status: 400 });
    }

    const material = await createMaterial({
      institutionId,
      topicId,
      userId: session.user.id,
      role,
      input: {
        type: body.type,
        title: body.title,
        content: body.content,
        url: body.url,
        videoUrl: body.videoUrl,
        status: body.status,
        publishAt: body.publishAt,
        isRequired: body.isRequired,
        files: body.files,
      },
    });

    return NextResponse.json({ success: true, material });
  } catch (error: any) {
    console.error("POST /api/classroom/topics/[topicId]/materials error:", error);
    const status = error.message?.includes("Akses ditolak") ? 403 : 500;
    return NextResponse.json({ error: error.message || "Gagal membuat materi." }, { status });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ topicId: string }> }) {
  try {
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) return guard.response;
    const { institutionId, role, user } = guard;
    const { topicId } = await params;
    const body = await req.json();

    if (body.materialIds && Array.isArray(body.materialIds)) {
      await reorderMaterials({
        institutionId,
        topicId,
        materialIds: body.materialIds,
        userId: user.id,
        role,
      });
      return NextResponse.json({ success: true, message: "Urutan materi berhasil diperbarui." });
    }

    return NextResponse.json({ error: "materialIds array wajib disediakan." }, { status: 400 });
  } catch (error: any) {
    const status = error.message?.includes("Akses ditolak") ? 403 : 500;
    return NextResponse.json({ error: error.message || "Gagal mengubah urutan materi." }, { status });
  }
}
