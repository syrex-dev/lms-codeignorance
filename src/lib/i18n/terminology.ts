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
  studyPlan: string;
  admission: string;
  admissionShort: string;
  gpa: string;
  faculty: string;
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
  studyPlan: "Pembagian Kelas",
  admission: "PPDB (Penerimaan Peserta Didik Baru)",
  admissionShort: "PPDB",
  gpa: "Rata-rata Nilai Rapor",
  faculty: "Peminatan",
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
  credits: "Satuan Kredit Semester (SKS)",
  studyPlan: "Kartu Rencana Studi (KRS)",
  admission: "PMB (Penerimaan Mahasiswa Baru)",
  admissionShort: "PMB",
  gpa: "IPS / IPK",
  faculty: "Fakultas",
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
