import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { withTenantTransaction } from "@/lib/db/tenant-prisma";
import { UserRole } from "@prisma/client";

// Fungsi kalkulasi rasio kontras warna hex terhadap teks putih (#FFFFFF)
export function getContrastRatioAgainstWhite(hexColor: string): number {
  const cleanHex = hexColor.replace("#", "").trim();
  if (cleanHex.length !== 6) return 1;

  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

  // Kontras terhadap putih (L1 = 1.0)
  return (1.0 + 0.05) / (L + 0.05);
}

export async function GET(req: Request) {
  try {
    const guard = await requireSession(req);
    if (!guard.success) return guard.response;

    const { institutionId } = guard;

    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
      select: {
        id: true,
        slug: true,
        name: true,
        type: true,
        emailDomain: true,
        logoUrl: true,
        themeColor: true,
        contactPhone: true,
        address: true,
      },
    });

    if (!institution) {
      return NextResponse.json({ error: "Institusi tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ settings: institution });
  } catch (error: any) {
    console.error("GET /api/admin/settings error:", error);
    return NextResponse.json({ error: error.message || "Gagal memuat pengaturan." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const guard = await requireSession(req);
    if (!guard.success) return guard.response;

    const { institutionId, role, user } = guard;
    if (role !== UserRole.INSTITUTION_ADMIN && role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: "Hanya Admin Institusi yang berwenang mengubah pengaturan." }, { status: 403 });
    }

    const body = await req.json();
    const { name, contactPhone, address, themeColor, logoUrl } = body;

    if (!name || name.trim().length < 3) {
      return NextResponse.json({ error: "Nama institusi minimal 3 karakter." }, { status: 400 });
    }

    // Validasi kontras warna aksen terhadap putih (min 4.5:1 WCAG AA)
    if (themeColor) {
      const ratio = getContrastRatioAgainstWhite(themeColor);
      if (ratio < 4.5) {
        return NextResponse.json({
          error: `Warna aksen ${themeColor} tidak memenuhi standar WCAG AA (rasio kontras ${ratio.toFixed(2)}:1 < 4.5:1 terhadap teks putih). Silakan pilih warna yang lebih gelap.`,
        }, { status: 400 });
      }
    }

    return await withTenantTransaction(institutionId, async (tenantDb) => {
      const updated = await prisma.institution.update({
        where: { id: institutionId },
        data: {
          name: name.trim(),
          contactPhone: contactPhone ? contactPhone.trim() : null,
          address: address ? address.trim() : null,
          themeColor: themeColor ? themeColor.trim() : "#1E40AF",
          logoUrl: logoUrl ? logoUrl.trim() : null,
        },
      });

      // Audit Log
      await tenantDb.auditLog.create({
        data: {
          userId: user.id,
          action: "UPDATE_INSTITUTION_SETTINGS",
          entityType: "INSTITUTION",
          entityId: institutionId,
          newValue: { name, contactPhone, address, themeColor, logoUrl },
        },
      });

      return NextResponse.json({
        message: "Pengaturan institusi berhasil diperbarui.",
        settings: updated,
      });
    });
  } catch (error: any) {
    console.error("PUT /api/admin/settings error:", error);
    return NextResponse.json({ error: error.message || "Gagal menyimpan pengaturan." }, { status: 500 });
  }
}
