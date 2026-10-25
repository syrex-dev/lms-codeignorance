import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { getStudentOverallGrades } from "@/modules/classroom/gradebook-service";

export async function GET(req: Request) {
  try {
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) return guard.response;
    const { institutionId, user } = guard;

    const data = await getStudentOverallGrades({
      institutionId,
      studentUserId: user.id,
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("GET overall grades error:", error);
    return NextResponse.json({ error: error.message || "Gagal memuat rekap nilai mahasiswa." }, { status: 500 });
  }
}
