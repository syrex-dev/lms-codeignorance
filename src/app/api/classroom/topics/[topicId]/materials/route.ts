import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { createMaterial } from "@/modules/classroom/classroom-service";
import { MaterialType } from "@prisma/client";

export async function POST(req: Request, { params }: { params: Promise<{ topicId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
    }

    const { topicId } = await params;
    const institutionId = session.user.activeInstitutionId || (session.user as any).tenantId;
    if (!institutionId) {
      return NextResponse.json({ error: "Tenant context required." }, { status: 400 });
    }

    const role = (session.user as any).activeRole || (session.user as any).role;
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
