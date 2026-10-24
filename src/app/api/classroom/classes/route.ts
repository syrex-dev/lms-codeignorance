import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { getClassroomsForUser } from "@/modules/classroom/classroom-service";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
    }

    const institutionId = session.user.activeInstitutionId || (session.user as any).tenantId;
    if (!institutionId) {
      return NextResponse.json({ error: "Tenant context required." }, { status: 400 });
    }

    const role = (session.user as any).activeRole || (session.user as any).role;
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
