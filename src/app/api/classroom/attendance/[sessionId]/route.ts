import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { updateAttendanceSession } from "@/modules/classroom/attendance-service";

export async function PUT(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) return guard.response;
    const { institutionId, role } = guard;
    const { sessionId } = await params;
    const body = await req.json();

    const session = await updateAttendanceSession({
      institutionId,
      sessionId,
      role,
      input: {
        status: body.status,
        records: body.records,
      },
    });

    return NextResponse.json({ success: true, session });
  } catch (error: any) {
    console.error("PUT attendance session error:", error);
    const status = error.message?.includes("Akses ditolak") ? 403 : 500;
    return NextResponse.json({ error: error.message || "Gagal memperbarui presensi." }, { status });
  }
}
