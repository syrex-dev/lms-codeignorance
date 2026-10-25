import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { checkInAttendance } from "@/modules/classroom/attendance-service";

export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) return guard.response;
    const { institutionId, user } = guard;
    const { sessionId } = await params;
    const body = await req.json().catch(() => ({}));

    const record = await checkInAttendance({
      institutionId,
      sessionId,
      studentUserId: user.id,
      accessCode: body.accessCode,
    });

    return NextResponse.json({ success: true, message: "Presensi kehadiran berhasil dicatat!", record });
  } catch (error: any) {
    console.error("POST check-in error:", error);
    return NextResponse.json({ error: error.message || "Gagal melakukan presensi." }, { status: 400 });
  }
}
