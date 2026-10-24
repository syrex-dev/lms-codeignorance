import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { submitAssignment } from "@/modules/classroom/assignment-service";

export async function POST(req: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) return guard.response;
    const { institutionId, user } = guard;
    const { assignmentId } = await params;
    const body = await req.json();

    const submission = await submitAssignment({
      institutionId,
      assignmentId,
      studentUserId: user.id,
      input: {
        textContent: body.textContent,
        fileUrl: body.fileUrl,
        fileName: body.fileName,
        fileSize: body.fileSize,
      },
    });

    return NextResponse.json({ success: true, submission });
  } catch (error: any) {
    console.error("POST submit assignment error:", error);
    const status = error.message?.includes("tidak terdaftar") || error.message?.includes("Batas waktu") ? 403 : 500;
    return NextResponse.json({ error: error.message || "Gagal mengumpulkan tugas." }, { status });
  }
}
