import { InstitutionType } from "@prisma/client";

export interface TerminologyMapping {
  institutionType: InstitutionType;
  institutionLabel: string;
  department: string;
  departmentShort: string;
  classRoom: string;
  class: string;
  course: string;
  teacher: string;
  student: string;
  studentId: string;
  teacherId: string;
  academicTerm: string;
  gradeReport: string;
  credits: string;
  creditsShort: string;
  studyPlan: string;
  admission: string;
  admissionShort: string;
  gpa: string;
  faculty: string;
  meeting: string;
}

const SCHOOL_TERMINOLOGY: TerminologyMapping = {
  institutionType: "SCHOOL",
  institutionLabel: "Sekolah",
  department: "Jurusan / Program Keahlian",
  departmentShort: "Jurusan",
  classRoom: "Kelas / Rombel",
  class: "Rombel / Kelas",
  course: "Mata Pelajaran",
  teacher: "Guru",
  student: "Siswa",
  studentId: "NIS / NISN",
  teacherId: "NIP / NUPTK",
  academicTerm: "Tahun Ajaran & Semester",
  gradeReport: "Nilai Rapor",
  credits: "Jam Pelajaran (JP)",
  creditsShort: "JP",
  studyPlan: "Pembagian Kelas",
  admission: "PPDB (Penerimaan Peserta Didik Baru)",
  admissionShort: "PPDB",
  gpa: "Rata-rata Nilai Rapor",
  faculty: "Peminatan",
  meeting: "Pertemuan",
};

const UNIVERSITY_TERMINOLOGY: TerminologyMapping = {
  institutionType: "UNIVERSITY",
  institutionLabel: "Perguruan Tinggi / Kampus",
  department: "Program Studi",
  departmentShort: "Prodi",
  classRoom: "Kelas Perkuliahan",
  class: "Mata Kuliah / Kelas",
  course: "Mata Kuliah",
  teacher: "Dosen",
  student: "Mahasiswa",
  studentId: "NIM",
  teacherId: "NIDN / NIP",
  academicTerm: "Tahun Akademik & Semester",
  gradeReport: "Kartu Hasil Studi (KHS) / Transkrip",
  credits: "SKS",
  creditsShort: "SKS",
  studyPlan: "Kartu Rencana Studi (KRS)",
  admission: "PMB (Penerimaan Mahasiswa Baru)",
  admissionShort: "PMB",
  gpa: "IPS / IPK",
  faculty: "Fakultas",
  meeting: "Pertemuan / Minggu",
};

/**
 * Mendapatkan kamus istilah berdasarkan tipe institusi
 */
export function getTerminology(
  type: InstitutionType | string = "UNIVERSITY"
): TerminologyMapping {
  if (type === "SCHOOL") {
    return SCHOOL_TERMINOLOGY;
  }
  return UNIVERSITY_TERMINOLOGY;
}

/**
 * Menghasilkan label peran dalam Bahasa Indonesia baku
 */
export function getRoleBadgeLabel(role: string, isSchool: boolean = false): string {
  switch (role) {
    case "STUDENT":
      return isSchool ? "Siswa" : "Mahasiswa";
    case "TEACHER":
    case "INSTRUCTOR":
      return isSchool ? "Guru" : "Dosen";
    case "INSTITUTION_ADMIN":
      return "Admin";
    case "SUPER_ADMIN":
      return "Super Admin";
    default:
      return role;
  }
}
