import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { getAssignmentsForClass, createAssignment } from "@/modules/classroom/assignment-service";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) return guard.response;
    const { institutionId, role, user } = guard;
    const { id: classCourseId } = await params;

    const assignments = await getAssignmentsForClass({
      institutionId,
      classCourseId,
      userId: user.id,
      role,
    });

    return NextResponse.json({ assignments });
  } catch (error: any) {
    console.error("GET class assignments error:", error);
    return NextResponse.json({ error: error.message || "Gagal memuat daftar tugas." }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) return guard.response;
    const { institutionId, role, user } = guard;
    const { id: classCourseId } = await params;
    const body = await req.json();

    if (!body.title || !body.dueDate) {
      return NextResponse.json({ error: "Judul tugas dan batas waktu (dueDate) wajib diisi." }, { status: 400 });
    }

    const assignment = await createAssignment({
      institutionId,
      classCourseId,
      userId: user.id,
      role,
      input: {
        title: body.title,
        instructions: body.instructions || "",
        dueDate: body.dueDate,
        maxScore: body.maxScore ? parseFloat(body.maxScore) : 100,
        allowLateSubmission: body.allowLateSubmission ?? false,
        status: body.status,
        topicId: body.topicId,
      },
    });

    return NextResponse.json({ success: true, assignment });
  } catch (error: any) {
    console.error("POST class assignment error:", error);
    const status = error.message?.includes("Akses ditolak") ? 403 : 500;
    return NextResponse.json({ error: error.message || "Gagal membuat tugas baru." }, { status });
  }
}
