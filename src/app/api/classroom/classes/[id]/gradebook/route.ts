import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { getClassGradebook } from "@/modules/classroom/gradebook-service";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) return guard.response;
    const { institutionId, role, user } = guard;
    const { id: classCourseId } = await params;

    const gradebook = await getClassGradebook({
      institutionId,
      classCourseId,
      userId: user.id,
      role,
    });

    return NextResponse.json(gradebook);
  } catch (error: any) {
    console.error("GET gradebook error:", error);
    return NextResponse.json({ error: error.message || "Gagal memuat buku nilai kelas." }, { status: 500 });
  }
}
