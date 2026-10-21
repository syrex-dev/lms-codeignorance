import { getTenantPrisma, withTenantTransaction } from "@/lib/db/tenant-prisma";
import { InstitutionType } from "@prisma/client";

export interface AcademicTermInput {
  name: string;
  code: string;
  type: any;
  startDate: string | Date;
  endDate: string | Date;
  isActive?: boolean;
}

export interface ProgramDepartmentInput {
  code: string;
  name: string;
  facultyName?: string;
  degreeLevel?: string;
}

export interface ClassCourseInput {
  academicTermId: string;
  programDepartmentId?: string;
  code: string;
  name: string;
  credits?: number;
  roomName?: string;
  homeroomTeacherId?: string;
}

export class AcademicService {
  /**
   * Muat preset akademik awal sesuai tipe tenant (Sekolah atau Kampus)
   */
  static async loadPresets(institutionId: string, type: InstitutionType) {
    return withTenantTransaction(institutionId, async (tenantDb) => {
      const existingTerms = await (tenantDb as any).academicTerm.count();
      if (existingTerms > 0) return { alreadyLoaded: true };

      const now = new Date();
      const nextYear = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

      if (type === "SCHOOL") {
        // Preset Sekolah
        const term = await (tenantDb as any).academicTerm.create({
          data: {
            name: `${now.getFullYear()}/${now.getFullYear() + 1} Ganjil`,
            code: `${now.getFullYear()}1`,
            type: "SEMESTER_ODD",
            startDate: now,
            endDate: nextYear,
            isActive: true,
          },
        });

        const deptIPA = await (tenantDb as any).programDepartment.create({
          data: {
            code: "MIPA",
            name: "Matematika dan Ilmu Pengetahuan Alam",
            facultyName: "Peminatan Sains",
            degreeLevel: "SMA",
          },
        });

        const deptIPS = await (tenantDb as any).programDepartment.create({
          data: {
            code: "IPS",
            name: "Ilmu Pengetahuan Sosial",
            facultyName: "Peminatan Sosial",
            degreeLevel: "SMA",
          },
        });

        await (tenantDb as any).classCourse.createMany({
          data: [
            {
              academicTermId: term.id,
              programDepartmentId: deptIPA.id,
              code: "KLS-X-MIPA-1",
              name: "Kelas X MIPA 1",
              credits: 4,
            },
            {
              academicTermId: term.id,
              programDepartmentId: deptIPS.id,
              code: "KLS-X-IPS-1",
              name: "Kelas X IPS 1",
              credits: 4,
            },
          ],
        });
      } else {
        // Preset Perguruan Tinggi / Universitas
        const term = await (tenantDb as any).academicTerm.create({
          data: {
            name: `Tahun Akademik ${now.getFullYear()}/${now.getFullYear() + 1} Ganjil`,
            code: `${now.getFullYear()}1`,
            type: "SEMESTER_ODD",
            startDate: now,
            endDate: nextYear,
            isActive: true,
          },
        });

        const prodiTI = await (tenantDb as any).programDepartment.create({
          data: {
            code: "TI",
            name: "Teknik Informatika",
            facultyName: "Fakultas Ilmu Komputer",
            degreeLevel: "S1",
          },
        });

        const prodiSI = await (tenantDb as any).programDepartment.create({
          data: {
            code: "SI",
            name: "Sistem Informasi",
            facultyName: "Fakultas Ilmu Komputer",
            degreeLevel: "S1",
          },
        });

        await (tenantDb as any).classCourse.createMany({
          data: [
            {
              academicTermId: term.id,
              programDepartmentId: prodiTI.id,
              code: "TI-101",
              name: "Pemrograman Web Lanjut",
              credits: 3,
            },
            {
              academicTermId: term.id,
              programDepartmentId: prodiSI.id,
              code: "SI-201",
              name: "Rekayasa Sistem Enterprise",
              credits: 3,
            },
          ],
        });
      }

      return { success: true };
    });
  }

  /**
   * Hapus Program Studi / Jurusan dengan validasi ketergantungan (safe delete)
   */
  static async safeDeleteDepartment(institutionId: string, departmentId: string) {
    return withTenantTransaction(institutionId, async (tenantDb) => {
      // Periksa apakah prodi masih memiliki mahasiswa aktif
      const studentCount = await (tenantDb as any).studentProfile.count({
        where: { programDepartmentId: departmentId },
      });

      if (studentCount > 0) {
        throw new Error(
          `Program studi/jurusan tidak dapat dihapus karena masih menampung ${studentCount} siswa/mahasiswa aktif.`
        );
      }

      // Periksa apakah masih dipakai oleh kelas aktif
      const classCount = await (tenantDb as any).classCourse.count({
        where: { programDepartmentId: departmentId, deletedAt: null },
      });

      if (classCount > 0) {
        throw new Error(
          `Program studi/jurusan tidak dapat dihapus karena masih digunakan oleh ${classCount} mata pelajaran/mata kuliah.`
        );
      }

      // Soft delete
      return (tenantDb as any).programDepartment.update({
        where: { id: departmentId },
        data: { deletedAt: new Date() },
      });
    });
  }

  /**
   * Hapus Tahun Ajaran dengan validasi ketergantungan (safe delete)
   */
  static async safeDeleteTerm(institutionId: string, termId: string) {
    return withTenantTransaction(institutionId, async (tenantDb) => {
      const classCount = await (tenantDb as any).classCourse.count({
        where: { academicTermId: termId, deletedAt: null },
      });

      if (classCount > 0) {
        throw new Error(
          `Tahun akademik tidak dapat dihapus karena masih digunakan oleh ${classCount} kelas aktif.`
        );
      }

      return (tenantDb as any).academicTerm.update({
        where: { id: termId },
        data: { deletedAt: new Date(), isActive: false },
      });
    });
  }
}
