import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { CsvImportService } from "@/modules/users/csv-import";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
    }

    const role = (session.user as any).activeRole || (session.user as any).role;
    if (role !== "INSTITUTION_ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Akses ditolak: Hanya Admin Institusi yang dapat mengimpor data pengguna." },
        { status: 403 }
      );
    }

    const institutionId = session.user.activeInstitutionId;
    if (!institutionId) {
      return NextResponse.json({ error: "Institusi aktif tidak ditemukan." }, { status: 400 });
    }

    const body = await req.json();
    const { action, csvText, rows, importOnlyValid } = body;

    if (action === "preview") {
      if (!csvText || typeof csvText !== "string") {
        return NextResponse.json(
          { error: "Konten CSV kosong atau tidak valid." },
          { status: 400 }
        );
      }

      const preview = await CsvImportService.previewCsv(institutionId, csvText);
      return NextResponse.json(preview);
    }

    if (action === "execute") {
      if (!Array.isArray(rows) || rows.length === 0) {
        return NextResponse.json(
          { error: "Daftar baris data untuk diimpor tidak boleh kosong." },
          { status: 400 }
        );
      }

      const result = await CsvImportService.executeImport(
        institutionId,
        session.user.id,
        rows,
        { importOnlyValid: Boolean(importOnlyValid) }
      );

      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "Aksi tidak dikenali. Gunakan action 'preview' atau 'execute'." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("POST /api/admin/users/import error:", error);
    return NextResponse.json(
      { error: error.message || "Terjadi kesalahan saat memproses impor CSV." },
      { status: 400 }
    );
  }
}
