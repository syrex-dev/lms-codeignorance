# LMS Terpadu (Sekolah & Kampus) + Modul Penerimaan (PPDB & PMB)

Learning Management System (LMS) modern berbasis **Modular Monolith** yang dirancang untuk mendukung institusi **Sekolah (SD/SMP/SMA/SMK)** dan **Kampus (Perguruan Tinggi)** dalam satu platform tunggal dengan kamus istilah (*i18n*) terpusat, login berbasis ID resmi institusional, alur wajib ganti password awal, modul jadwal pelajaran/perkuliahan, dan modul admisi terpadu.

---

## 🚀 Panduan Menjalankan Proyek

### Prasyarat
- Sistem Operasi: Linux / WSL 2 (Ubuntu)
- Docker & Docker Compose
- Node.js LTS (v20+ atau v24+) & npm

### Langkah Instalasi & Menjalankan

1. **Clone dan Pindah ke Direktori Proyek**:
   ```bash
   cd ~/projects/lms
   ```

2. **Salin Environment Variables**:
   ```bash
   cp .env.example .env
   ```

3. **Jalankan Database PostgreSQL via Docker Compose**:
   ```bash
   docker compose up -d
   ```
   *(PostgreSQL 16 akan berjalan di `127.0.0.1:5432` khusus untuk akses lokal)*.

4. **Sinkronisasi Skema Database (Prisma)**:
   ```bash
   npx prisma db push
   ```

5. **Jalankan Seed Data Demo**:
   ```bash
   npx prisma db seed
   ```

6. **Jalankan Server Pengembangan (Dev Server)**:
   ```bash
   npm run dev
   ```
   Buka peramban di: [http://localhost:3000](http://localhost:3000)

---

## 👥 Akun Demo Bawaan

Setiap akun pengguna awal menggunakan format login **ID resmi** (atau email `{ID}@{domain}`) dengan **Password Default = ID itu sendiri**. Saat login pertama kali, sistem secara otomatis memaksa pengguna mengganti password baru sebelum mengakses halaman lain.

### 1. Perguruan Tinggi: Politeknik Mitra Indonesia (`/poltekmi/login`)
- **Mahasiswa Terkonversi (Multi-Identitas)**: Cindy Permata
  - *Login via*: Email pribadi `cindy.permata@gmail.com` ATAU NIM `24TI0003` ATAU email institusi `24ti0003@poltekmi.ac.id` ATAU No. Registrasi `PMB-2025-001`
  - *Password*: `PasswordPendaftar123!` (Password pendaftar asli, **tidak dipaksa ganti password**)
- **Mahasiswa Import Manual**: ID `24TI0001` • Password Awal: `24TI0001` (Memiliki Beasiswa 50% UKT & SponsorInvoice)
- **Calon Pendaftar (Fee Waiver KIP)**: Email `doni.kip@gmail.com` • Password: `DoniPass123!` (Invoice berstatus `PENDING_WAIVER`)
- **Staf Keuangan**: ID `KEU001` • Password Awal: `KEU001`
- **Panitia Beasiswa**: ID `BEA001` • Password Awal: `BEA001`
- **Dosen**: ID `DSN001` • Password Awal: `DSN001`
- **Admin Kampus**: ID `ADM001` • Password Awal: `ADM001`
- *Domain Resmi*: `poltekmi.ac.id`

### 2. Sekolah: SMA Negeri 1 Prestasi (`/sman1/login`)
- **Siswa**: ID `24MIPA0001` • Password Awal: `24MIPA0001`
- **Guru**: ID `GRU001` • Password Awal: `GRU001`
- **Admin Tata Usaha**: ID `STF001` • Password Awal: `STF001`
- *Domain Resmi*: `sman1jakarta.sch.id`

### 3. Super Administrator Platform
- **Email**: `admin@platform.lms` • Password: `admin123`

---

## 🏛️ Pemetaan Istilah (i18n Dynamic Terminology)

Sistem secara otomatis menyesuaikan kosakata dan tampilan antarmuka sesuai tipe institusi:

| Kunci | Mode Kampus (`UNIVERSITY`) | Mode Sekolah (`SCHOOL`) |
|---|---|---|
| **Pengajar** | Dosen (`NIDN / NIP`) | Guru (`NIP / NUPTK`) |
| **Peserta Didik** | Mahasiswa (`NIM`) | Siswa (`NIS / NISN`) |
| **Satuan Kelas** | Mata Kuliah / Kelas | Mata Pelajaran / Rombel |
| **Beban Belajar** | Satuan Kredit Semester (SKS) | Jam Pelajaran (JP) |
| **Rencana Studi** | Kartu Rencana Studi (KRS) | Pembagian Kelas |
| **Laporan Nilai** | KHS / Transkrip (`IPS/IPK`) | Nilai Rapor (`Rata-rata Rapor`) |
| **Penerimaan** | PMB (Penerimaan Mahasiswa Baru) | PPDB (Penerimaan Peserta Didik Baru) |

---

## 📁 Struktur Modular Monolith

```
src/
├── app/                  # Next.js App Router (Auth, Dashboard, Admission routes)
├── components/           # Reusable UI components & providers
├── lib/
│   ├── auth/             # Konfigurasi Auth.js Credentials Provider
│   ├── db/               # Prisma Client instance
│   ├── i18n/             # Kamus istilah dinamis Sekolah vs Kampus
│   ├── security/         # Bcrypt hash & password validation rules
│   ├── services/         # Layanan konversi admisi & kalkulasi beasiswa
│   └── storage/          # Abstraksi driver file storage (Local dev & S3 production)
└── modules/              # Domain Modules
    ├── auth/             # Login service & session
    ├── identity/         # ID template generator & credential generator
    ├── master-data/      # Data master akademik
    ├── users/            # Manajemen pengguna & import CSV
    ├── classroom/        # Materi & progres belajar
    ├── assignment/       # Tugas & penilaian
    ├── quiz/             # Bank soal & mesin kuis ujian
    ├── attendance/       # Presensi sesi
    ├── gradebook/        # Buku nilai & IPK/IPS
    ├── schedule/         # Modul jadwal bebas bentrok (Fase 6B)
    ├── communication/    # Pengumuman & forum diskusi
    ├── dashboard/        # Dashboard per peran & kalender terpadu
    └── admission/        # Portal PPDB & PMB online terintegrasi
```

---

## 🧪 Menjalankan Pengujian

Menjalankan pengujian otomatis untuk alur autentikasi dan refaktor identitas / beasiswa:
```bash
# 1. Uji Autentikasi Regresi Fase 1
npx tsx tests/unit/auth_test.ts

# 2. Uji Test Suite Lengkap Fase 1B (Multi-identitas, Konversi Idempoten, Beasiswa Stacking Cap)
npx tsx tests/unit/identity_refactor_test.ts
```
