import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { getClassroomsForUser } from "@/modules/classroom/classroom-service";

export async function GET(req: Request) {
  try {
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) {
      return guard.response;
    }
    const { institutionId, role, user } = guard;
    const session = { user };
    const { searchParams } = new URL(req.url);
    const termId = searchParams.get("academicTermId") || undefined;
    const search = searchParams.get("search") || undefined;

    const classes = await getClassroomsForUser({
      institutionId,
      userId: session.user.id,
      role,
      termId,
      search,
    });

    return NextResponse.json({ classes });
  } catch (error: any) {
    console.error("GET /api/classroom/classes error:", error);
    const status = error.message?.includes("tidak aktif") || error.message?.includes("Fitur") ? 403 : 500;
    return NextResponse.json({ error: error.message || "Gagal memuat daftar kelas." }, { status });
  }
}
