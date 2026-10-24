import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { copyClassroomContent } from "@/modules/classroom/classroom-service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
    }

    const { id: targetClassCourseId } = await params;
    const institutionId = session.user.activeInstitutionId || (session.user as any).tenantId;
    if (!institutionId) {
      return NextResponse.json({ error: "Tenant context required." }, { status: 400 });
    }

    const role = (session.user as any).activeRole || (session.user as any).role;
    const body = await req.json();

    if (!body.sourceClassCourseId) {
      return NextResponse.json({ error: "ID kelas sumber (sourceClassCourseId) wajib disediakan." }, { status: 400 });
    }

    const result = await copyClassroomContent({
      institutionId,
      sourceClassCourseId: body.sourceClassCourseId,
      targetClassCourseId,
      userId: session.user.id,
      role,
      includeDrafts: body.includeDrafts,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("POST /api/classroom/classes/[id]/copy error:", error);
    const status = error.message?.includes("Akses ditolak") ? 403 : 500;
    return NextResponse.json({ error: error.message || "Gagal menyalin konten kelas." }, { status });
  }
}
