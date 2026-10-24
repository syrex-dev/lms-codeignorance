import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { withTenantTransaction } from "@/lib/db/tenant-prisma";
import { sanitizeRichText, isSafeUrl } from "@/modules/classroom/sanitizer";
import {
  detectMimeTypeFromMagicBytes,
  validateMaterialFile,
  sanitizeFileName,
  checkTenantStorageQuota,
  generateSignedFileToken,
  verifySignedFileToken,
} from "@/modules/classroom/file-security";
import { processVideoUrl, isAllowedVideoDomain } from "@/modules/classroom/video-helper";
import {
  getClassroomsForUser,
  getClassroomDetail,
  createTopic,
  updateTopic,
  deleteTopic,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  markMaterialCompleted,
  copyClassroomContent,
  calculateClassProgress,
} from "@/modules/classroom/classroom-service";
import { requireFeature } from "@/modules/saas/entitlement";
import { UserRole, PublishStatus, MaterialType } from "@prisma/client";

describe("FASE 3: RUANG KELAS, TOPIK, MATERI, & PROGRES BELAJAR", () => {
  let poltekmi: any;
  let sman1: any;
  let emptyTenant: any;
  let dosenPoltekmi: any;
  let guruSman1: any;
  let mhsPoltekmi: any;
  let mhsUnenrolled: any;
  let classWeb: any;

  beforeAll(async () => {
    poltekmi = await prisma.institution.findUniqueOrThrow({ where: { slug: "poltekmi" } });
    sman1 = await prisma.institution.findUniqueOrThrow({ where: { slug: "sman1" } });
    emptyTenant = await prisma.institution.findUniqueOrThrow({ where: { slug: "kampus-digital" } });

    dosenPoltekmi = await withTenantTransaction(poltekmi.id, async (tenantDb) => {
      return tenantDb.user.findFirstOrThrow({
        where: { memberships: { some: { role: UserRole.TEACHER } } },
      });
    });

    guruSman1 = await withTenantTransaction(sman1.id, async (tenantDb) => {
      return tenantDb.user.findFirstOrThrow({
        where: { memberships: { some: { role: UserRole.TEACHER } } },
      });
    });

    mhsPoltekmi = await withTenantTransaction(poltekmi.id, async (tenantDb) => {
      return tenantDb.user.findFirstOrThrow({
        where: {
          memberships: { some: { role: UserRole.STUDENT } },
          enrollments: { some: {} },
        },
      });
    });

    mhsUnenrolled = await withTenantTransaction(poltekmi.id, async (tenantDb) => {
      return tenantDb.user.create({
        data: {
          institutionId: poltekmi.id,
          fullName: "Mahasiswa Tanpa Enrollment",
          passwordHash: "hash123",
          status: "ACTIVE",
          memberships: {
            create: {
              institutionId: poltekmi.id,
              role: UserRole.STUDENT,
            },
          },
        },
      });
    });

    classWeb = await withTenantTransaction(poltekmi.id, async (tenantDb) => {
      return tenantDb.classCourse.findFirstOrThrow({
        where: { code: "TI302" },
        include: { topics: { include: { materials: true } } },
      });
    });
  });

  // =========================================================================
  // 1. Guard Test RLS untuk Model-Model Baru Fase 3
  // =========================================================================
  it("3.1 - Guard Test RLS: Topic, Material, MaterialFile, MaterialProgress memiliki RLS enabled, forced, dan policy", async () => {
    const targetTables = ["Topic", "Material", "MaterialFile", "MaterialProgress"];

    const rlsCatalog: any[] = await prisma.$queryRaw`
      SELECT 
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled,
        c.relforcerowsecurity AS rls_forced,
        COUNT(p.polname)::int AS policy_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_policy p ON p.polrelid = c.oid
      WHERE n.nspname = 'public' 
        AND c.relname = ANY(${targetTables})
        AND c.relkind = 'r'
      GROUP BY c.relname, c.relrowsecurity, c.relforcerowsecurity
      ORDER BY c.relname;
    `;

    expect(rlsCatalog.length).toBe(targetTables.length);
    for (const table of rlsCatalog) {
      expect(table.rls_enabled, `Table ${table.table_name} must have RLS enabled`).toBe(true);
      expect(table.rls_forced, `Table ${table.table_name} must have RLS forced`).toBe(true);
      expect(table.policy_count, `Table ${table.table_name} must have at least 1 policy`).toBeGreaterThan(0);
    }
  });

  // =========================================================================
  // 2. Hak Akses & Pembatasan Enrollment Siswa
  // =========================================================================
  it("3.2 - Siswa tidak ter-enroll tidak dapat membaca topik/materi (fail-closed 404)", async () => {
    const detail = await getClassroomDetail({
      institutionId: poltekmi.id,
      classCourseId: classWeb.id,
      userId: mhsUnenrolled.id,
      role: UserRole.STUDENT,
    });

    // Menghasilkan null (404 Not Found) agar objek tidak bocor
    expect(detail).toBeNull();
  });

  // =========================================================================
  // 3. Status Rilis Materi & Topik (DRAFT & SCHEDULED Injeksi Jam)
  // =========================================================================
  it("3.3 - Materi DRAFT dan SCHEDULED tidak terlihat siswa sebelum waktunya; terlihat setelah waktu lewat", async () => {
    const pastTime = new Date("2026-01-01T00:00:00Z");
    const futureTime = new Date("2027-01-01T00:00:00Z");

    // 1. Siswa membaca kelas pada pastTime:
    const detailPast = await getClassroomDetail({
      institutionId: poltekmi.id,
      classCourseId: classWeb.id,
      userId: mhsPoltekmi.id,
      role: UserRole.STUDENT,
      currentTime: pastTime,
    });

    expect(detailPast).not.toBeNull();
    // Topik SCHEDULED (Topik 3) tidak boleh terlihat pada pastTime
    const topicScheduledPast = detailPast?.topics.find((t: any) => t.status === PublishStatus.SCHEDULED);
    expect(topicScheduledPast).toBeUndefined();

    // Materi DRAFT di Topik 2 tidak boleh terlihat siswa
    const top2Past = detailPast?.topics.find((t: any) => t.meetingNumber === 2);
    const draftMatPast = top2Past?.materials.find((m: any) => m.status === PublishStatus.DRAFT);
    expect(draftMatPast).toBeUndefined();

    // 2. Siswa membaca kelas pada futureTime (jam diinjeksi melampaui publishAt):
    const detailFuture = await getClassroomDetail({
      institutionId: poltekmi.id,
      classCourseId: classWeb.id,
      userId: mhsPoltekmi.id,
      role: UserRole.STUDENT,
      currentTime: futureTime,
    });

    const topicScheduledFuture = detailFuture?.topics.find((t: any) => t.meetingNumber === 3);
    expect(topicScheduledFuture).toBeDefined();
    expect(topicScheduledFuture?.status).toBe(PublishStatus.SCHEDULED);
  });

  // =========================================================================
  // 4. Isolasi Wewenang Pengajar & Admin Lintas Tenant
  // =========================================================================
  it("3.4 - Guru A tidak dapat mengubah kelas guru B; Admin tenant lain tidak dapat melihat apa pun", async () => {
    // Guru SMAN 1 mencoba membuat topik di kelas Poltekmi: HARUS DITOLAK
    await expect(
      createTopic({
        institutionId: poltekmi.id,
        classCourseId: classWeb.id,
        userId: guruSman1.id,
        role: UserRole.TEACHER,
        input: { title: "Topik Ilegal Lintas Guru" },
      })
    ).rejects.toThrow(/Akses ditolak/);

    // Admin SMAN 1 mencoba melihat detail kelas Poltekmi: HARUS DITOLAK (null)
    const adminSman1 = await withTenantTransaction(sman1.id, async (tenantDb) => {
      return tenantDb.user.findFirstOrThrow({
        where: { memberships: { some: { role: UserRole.INSTITUTION_ADMIN } } },
      });
    });

    // Query RLS Poltekmi dengan ID admin SMAN 1 menghasilkan null karena isolasi tenant
    const crossAccess = await getClassroomDetail({
      institutionId: poltekmi.id,
      classCourseId: classWeb.id,
      userId: adminSman1.id,
      role: UserRole.INSTITUTION_ADMIN,
    });

    // RLS lms_app memblokir pembacaan data tenant lain
    expect(crossAccess).toBeNull();
  });

  // =========================================================================
  // 5. Entitlement Guard requireFeature('classroom')
  // =========================================================================
  it("3.5 - requireFeature('classroom'): tenant tanpa fitur ditolak", async () => {
    // Matikan fitur classroom pada emptyTenant
    await withTenantTransaction(emptyTenant.id, async (tenantDb) => {
      await tenantDb.tenantFeatureOverride.upsert({
        where: {
          institutionId_featureKey: {
            institutionId: emptyTenant.id,
            featureKey: "classroom",
          },
        },
        update: { isEnabled: false },
        create: {
          institutionId: emptyTenant.id,
          featureKey: "classroom",
          isEnabled: false,
        },
      });
    });

    await expect(
      getClassroomsForUser({
        institutionId: emptyTenant.id,
        userId: dosenPoltekmi.id,
        role: UserRole.INSTITUTION_ADMIN,
      })
    ).rejects.toThrow(/classroom.*tidak aktif/);
  });

  // =========================================================================
  // 6. Sanitasi XSS pada Teks Kaya
  // =========================================================================
  it("3.6 - XSS: teks kaya berisi script, onerror, dan javascript: tersanitasi sempurna", () => {
    const dirtyXss = `
      <p>Halo siswa sekalian!</p>
      <script>alert("XSS Script Execution!");</script>
      <img src="valid.png" onerror="alert('XSS Image OnError!')" />
      <a href="javascript:alert('XSS JS URI!')">Klik Hadiah</a>
      <div style="background:url(javascript:alert(1))" onclick="stealCookies()">Container</div>
      <iframe src="http://evil-tracker.com"></iframe>
    `;

    const cleanHtml = sanitizeRichText(dirtyXss);

    expect(cleanHtml).not.toContain("<script>");
    expect(cleanHtml).not.toContain("alert(");
    expect(cleanHtml).not.toContain("onerror");
    expect(cleanHtml).not.toContain("onclick");
    expect(cleanHtml).not.toContain("javascript:");
    expect(cleanHtml).not.toContain("<iframe>");
    expect(cleanHtml).toContain("<p>Halo siswa sekalian!</p>");
    expect(cleanHtml).toContain('<img src="valid.png" />');
  });

  // =========================================================================
  // 7. Keamanan Berkas: Magic Bytes, Ekstensi Palsu, Sanitasi Nama File
  // =========================================================================
  it("3.7 - Upload: magic bytes tidak cocok ditolak; ekstensi palsu (.exe diubah .pdf) ditolak; nama file berbahaya disanitasi", async () => {
    // 1. Berkas executable yang diganti ekstensi menjadi .pdf
    const fakePdfExeBuffer = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // MZ DOS/Windows header
    const fakeResult = await validateMaterialFile(fakePdfExeBuffer, "tugas_akhir.pdf");
    expect(fakeResult.isValid).toBe(false);
    expect(fakeResult.error).toContain("magic bytes");

    // 2. Berkas PDF asli
    const realPdfBuffer = Buffer.from("%PDF-1.7\n%Valid PDF content...");
    const realResult = await validateMaterialFile(realPdfBuffer, "silabus_resmi.pdf");
    expect(realResult.isValid).toBe(true);
    expect(realResult.detectedMimeType).toBe("application/pdf");

    // 3. Sanitasi nama berkas berbahaya (path traversal & control characters)
    const dangerousName = "../../../etc/passwd\x00.pdf";
    const safeName = sanitizeFileName(dangerousName);
    expect(safeName).not.toContain("..");
    expect(safeName).not.toContain("/");
    expect(safeName).toBe("passwd.pdf");
  });

  // =========================================================================
  // 8. Tautan Video: Host di Luar Allowlist Ditolak, YouTube Dikonversi ke nocookie
  // =========================================================================
  it("3.8 - Tautan video: host di luar allowlist ditolak; YouTube dikonversi ke youtube-nocookie", () => {
    // Host ilegal (misal malware / tracking video)
    const illegalHost = processVideoUrl("https://evil-site.com/video.mp4");
    expect(illegalHost.isValid).toBe(false);
    expect(illegalHost.error).toContain("tidak diizinkan");

    // YouTube watch URL
    const ytWatch = processVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(ytWatch.isValid).toBe(true);
    expect(ytWatch.embedUrl).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0");

    // Google Drive video preview
    const gDrive = processVideoUrl("https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view");
    expect(gDrive.isValid).toBe(true);
    expect(gDrive.embedUrl).toContain("drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/preview");
  });

  // =========================================================================
  // 9. Progres Belajar: Akurasi Persentase & Sifat Idempoten
  // =========================================================================
  it("3.9 - Progres: persentase benar, tidak menghitung draft/opsional; tandai selesai idempoten", async () => {
    // Cari materi wajib di kelas
    const top1 = classWeb.topics.find((t: any) => t.meetingNumber === 1);
    const mat1 = top1.materials.find((m: any) => m.type === "RICH_TEXT");

    // Tandai selesai pertama kali
    const prog1 = await markMaterialCompleted({
      institutionId: poltekmi.id,
      materialId: mat1.id,
      studentUserId: mhsPoltekmi.id,
    });
    expect(prog1.isCompleted).toBe(true);

    // Tandai selesai kedua kali (idempoten, tidak membuat duplikat)
    const prog2 = await markMaterialCompleted({
      institutionId: poltekmi.id,
      materialId: mat1.id,
      studentUserId: mhsPoltekmi.id,
    });
    expect(prog2.id).toBe(prog1.id);

    // Hitung persentase progres
    const progressResult = await withTenantTransaction(poltekmi.id, async (tenantDb) => {
      return calculateClassProgress(tenantDb, poltekmi.id, classWeb.id, mhsPoltekmi.id);
    });

    expect(progressResult.totalCount).toBeGreaterThan(0);
    expect(progressResult.completedCount).toBeGreaterThan(0);
    expect(progressResult.percentage).toBeGreaterThanOrEqual(50);
  });

  // =========================================================================
  // 10. Privasi Anggota: Tidak Membocorkan Nomor HP, DOB, atau Email Kontak
  // =========================================================================
  it("3.10 - Anggota: respons tidak memuat nomor HP, tanggal lahir, atau contactEmail", async () => {
    const detail = await getClassroomDetail({
      institutionId: poltekmi.id,
      classCourseId: classWeb.id,
      userId: mhsPoltekmi.id,
      role: UserRole.STUDENT,
    });

    expect(detail).not.toBeNull();
    const members = (detail as any).members;
    expect(members.length).toBeGreaterThan(0);

    for (const member of members) {
      expect(member).toHaveProperty("fullName");
      expect(member).toHaveProperty("role");
      // Larang kebocoran data sensitif
      expect(member).not.toHaveProperty("phoneE164");
      expect(member).not.toHaveProperty("birthDate");
      expect(member).not.toHaveProperty("contactEmail");
      expect(member).not.toHaveProperty("passwordHash");
    }
  });

  // =========================================================================
  // 11. Salin Konten Antar Kelas: Hasil Berupa DRAFT Tanpa Progres
  // =========================================================================
  it("3.11 - Salin konten: hasil berupa draft di tenant yang sama dan tidak menyalin progres siswa", async () => {
    // Buat kelas target kosong di Poltekmi
    const targetClass = await withTenantTransaction(poltekmi.id, async (tenantDb) => {
      return tenantDb.classCourse.create({
        data: {
          institutionId: poltekmi.id,
          academicTermId: classWeb.academicTermId,
          code: `COPY-${Date.now().toString().slice(-4)}`,
          name: "Pemrograman Web Modern (Kelas Paralel B)",
          credits: 3,
          instructors: {
            create: {
              instructorUserId: dosenPoltekmi.id,
              isPrimary: true,
            },
          },
        },
      });
    });

    const copyResult = await copyClassroomContent({
      institutionId: poltekmi.id,
      sourceClassCourseId: classWeb.id,
      targetClassCourseId: targetClass.id,
      userId: dosenPoltekmi.id,
      role: UserRole.TEACHER,
    });

    expect(copyResult.success).toBe(true);
    expect(copyResult.copiedTopicsCount).toBeGreaterThan(0);

    // Verifikasi semua topik hasil salinan berstatus DRAFT
    const copiedTopics = await withTenantTransaction(poltekmi.id, async (tenantDb) => {
      return tenantDb.topic.findMany({
        where: { classCourseId: targetClass.id },
        include: { materials: true },
      });
    });

    for (const top of copiedTopics) {
      expect(top.status).toBe(PublishStatus.DRAFT);
      expect(top.title).toContain("(Salinan)");

      for (const mat of top.materials) {
        expect(mat.status).toBe(PublishStatus.DRAFT);
      }
    }

    // Pastikan tidak ada riwayat progres di kelas target baru
    const copiedProgressCount = await withTenantTransaction(poltekmi.id, async (tenantDb) => {
      return tenantDb.materialProgress.count({
        where: {
          material: { topic: { classCourseId: targetClass.id } },
        },
      });
    });
    expect(copiedProgressCount).toBe(0);
  });

  // =========================================================================
  // 12. Signed Download URL
  // =========================================================================
  it("3.12 - Signed URL: token valid diverifikasi; token kedaluwarsa atau salah ditolak", () => {
    const payload = {
      fileId: "file-uuid-123",
      materialId: "mat-uuid-456",
      classCourseId: classWeb.id,
      institutionId: poltekmi.id,
      userId: mhsPoltekmi.id,
    };

    // Token valid
    const token = generateSignedFileToken(payload, 300); // 5 menit
    const verified = verifySignedFileToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.fileId).toBe("file-uuid-123");

    // Token kedaluwarsa (TTL negatif)
    const expiredToken = generateSignedFileToken(payload, -10);
    const verifiedExpired = verifySignedFileToken(expiredToken);
    expect(verifiedExpired).toBeNull();

    // Token palsu / tampered
    const tamperedToken = token + "corrupt";
    const verifiedTampered = verifySignedFileToken(tamperedToken);
    expect(verifiedTampered).toBeNull();
  });
});
