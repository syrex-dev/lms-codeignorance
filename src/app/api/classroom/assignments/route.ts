import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { getAggregatedAssignments } from "@/modules/classroom/assignment-service";

export async function GET(req: Request) {
  try {
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) return guard.response;
    const { institutionId, role, user } = guard;

    const assignments = await getAggregatedAssignments({
      institutionId,
      userId: user.id,
      role,
    });

    return NextResponse.json({ assignments });
  } catch (error: any) {
    console.error("GET aggregated assignments error:", error);
    return NextResponse.json({ error: error.message || "Gagal memuat rekap tugas." }, { status: 500 });
  }
}
