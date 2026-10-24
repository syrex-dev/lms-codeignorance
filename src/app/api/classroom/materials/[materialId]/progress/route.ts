import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { markMaterialCompleted, recordMaterialView } from "@/modules/classroom/classroom-service";

export async function POST(req: Request, { params }: { params: Promise<{ materialId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
    }

    const { materialId } = await params;
    const institutionId = session.user.activeInstitutionId || (session.user as any).tenantId;
    if (!institutionId) {
      return NextResponse.json({ error: "Tenant context required." }, { status: 400 });
    }

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
