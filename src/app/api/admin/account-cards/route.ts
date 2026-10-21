import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { AccountCardService, AccountCardData } from "@/modules/users/account-cards";
import { IdentifierType, UserRole } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
    }

    const role = (session.user as any).activeRole || (session.user as any).role;
    if (role !== "INSTITUTION_ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Akses ditolak: Hanya Admin Institusi yang berhak mencetak kartu akun." },
        { status: 403 }
      );
    }

    const institutionId = session.user.activeInstitutionId;
    if (!institutionId) {
      return NextResponse.json({ error: "Institusi aktif tidak ditemukan." }, { status: 400 });
    }

    const body = await req.json();
    const { userIds, exportCsv, sendNotice } = body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: "Daftar ID pengguna tidak boleh kosong." }, { status: 400 });
    }

    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
      select: { name: true, slug: true, initialPasswordMode: true },
    });

    if (!institution) {
      return NextResponse.json({ error: "Institusi tidak ditemukan." }, { status: 404 });
    }

    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        institutionId,
        deletedAt: null,
      },
      include: {
        identifiers: {
          where: { institutionId },
        },
        studentProfiles: {
          where: { institutionId },
          include: { programDepartment: true },
        },
        staffProfiles: {
          where: { institutionId },
        },
      },
    });

    const cards: AccountCardData[] = users.map((u) => {
      const idIdent = u.identifiers.find((i) => i.type === IdentifierType.INSTITUTION_ID);
      const emailIdent = u.identifiers.find((i) => i.type === IdentifierType.INSTITUTION_EMAIL);
      const studentProfile = u.studentProfiles?.[0];
      const staffProfile = u.staffProfiles?.[0];
      const cleanId = idIdent?.value || studentProfile?.studentIdNumber || staffProfile?.employeeNumber || "-";
      const loginEmail = emailIdent?.value || `${cleanId}@${institution.slug}.lms.local`;
      const prodiOrClass = studentProfile?.programDepartment?.name || staffProfile?.department || undefined;

      return {
        fullName: u.fullName,
        id: cleanId,
        loginEmail,
        initialPasswordMode: institution.initialPasswordMode as "SAME_AS_ID" | "RANDOM",
        // Catatan keamanan: Password mode RANDOM HANYA tersedia saat pertama kali dibuat di memori.
        // Di sini nilainya undefined agar tidak pernah dibaca ulang dari DB
        initialPasswordPlain: undefined,
        classNameOrProdi: prodiOrClass,
        institutionName: institution.name,
        tenantSlug: institution.slug,
      };
    });

    // Jika diminta ekspor CSV
    if (exportCsv) {
      const csv = AccountCardService.exportToCsv(cards);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="kartu_akun.csv"',
        },
      });
    }

    // Jika diminta kirim notifikasi aktivasi via SMS/WhatsApp
    if (sendNotice) {
      for (const u of users) {
        if (u.phoneE164) {
          const card = cards.find((c) => c.fullName === u.fullName);
          if (card) {
            await AccountCardService.sendActivationNotice(u.phoneE164, card);
          }
        }
      }
    }

    return NextResponse.json({ cards });
  } catch (error: any) {
    console.error("POST /api/admin/account-cards error:", error);
    return NextResponse.json({ error: error.message || "Gagal menghasilkan kartu akun." }, { status: 500 });
  }
}
