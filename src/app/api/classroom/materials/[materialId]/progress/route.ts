import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { markMaterialCompleted, recordMaterialView } from "@/modules/classroom/classroom-service";

export async function POST(req: Request, { params }: { params: Promise<{ materialId: string }> }) {
  try {
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) {
      return guard.response;
    }
    const session = { user: guard.user };
    const institutionId = guard.institutionId;
    const role = guard.role;

    const { materialId } = await params;
    

    const body = await req.json().catch(() => ({}));
    const action = body.action || "COMPLETE";

    if (action === "VIEW") {
      const result = await recordMaterialView({
        institutionId,
        materialId,
        studentUserId: session.user.id,
      });
      return NextResponse.json({ success: true, progress: result });
    }

    // Default: Complete
    const progress = await markMaterialCompleted({
      institutionId,
      materialId,
      studentUserId: session.user.id,
    });

    return NextResponse.json({ success: true, progress });
  } catch (error: any) {
    console.error("POST /api/classroom/materials/[materialId]/progress error:", error);
    const status = error.message?.includes("tidak terdaftar") ? 403 : 500;
    return NextResponse.json({ error: error.message || "Gagal memperbarui progres materi." }, { status });
  }
}
