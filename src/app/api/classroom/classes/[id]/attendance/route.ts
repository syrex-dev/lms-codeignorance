import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { getAttendanceForClass, createAttendanceSession } from "@/modules/classroom/attendance-service";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) return guard.response;
    const { institutionId, role, user } = guard;
    const { id: classCourseId } = await params;

    const data = await getAttendanceForClass({
      institutionId,
      classCourseId,
      userId: user.id,
      role,
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("GET attendance error:", error);
    return NextResponse.json({ error: error.message || "Gagal memuat presensi kelas." }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) return guard.response;
    const { institutionId, role } = guard;
    const { id: classCourseId } = await params;
    const body = await req.json();

    const session = await createAttendanceSession({
      institutionId,
      classCourseId,
      role,
      input: {
        title: body.title,
        meetingNumber: body.meetingNumber ? parseInt(body.meetingNumber) : undefined,
        date: body.date,
        accessCode: body.accessCode,
      },
    });

    return NextResponse.json({ success: true, session });
  } catch (error: any) {
    console.error("POST attendance session error:", error);
    const status = error.message?.includes("Akses ditolak") ? 403 : 400;
    return NextResponse.json({ error: error.message || "Gagal membuat sesi presensi." }, { status });
  }
}
