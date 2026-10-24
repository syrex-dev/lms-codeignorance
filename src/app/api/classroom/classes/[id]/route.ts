import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { getClassroomDetail } from "@/modules/classroom/classroom-service";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
    }

    const { id: classCourseId } = await params;
    const institutionId = session.user.activeInstitutionId || (session.user as any).tenantId;
    if (!institutionId) {
      return NextResponse.json({ error: "Tenant context required." }, { status: 400 });
    }

    const role = (session.user as any).activeRole || (session.user as any).role;
    const { searchParams } = new URL(req.url);
    const isPreview = searchParams.get("preview") === "true";

    const detail = await getClassroomDetail({
      institutionId,
      classCourseId,
      userId: session.user.id,
      role,
      isPreviewAsStudent: isPreview,
    });

    if (!detail) {
      // 404 agar penyerang tidak dapat menebak keberadaan ID kelas
      return NextResponse.json(
        { error: "Kelas tidak ditemukan atau Anda tidak memiliki akses ke kelas ini." },
        { status: 404 }
      );
    }

    return NextResponse.json({ classDetail: detail });
  } catch (error: any) {
    console.error("GET /api/classroom/classes/[id] error:", error);
    const status = error.message?.includes("tidak aktif") || error.message?.includes("Fitur") ? 403 : 500;
    return NextResponse.json({ error: error.message || "Gagal memuat detail kelas." }, { status });
  }
}
