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

## 👥 Akun Demo Bawaan & Portal Akses

Sistem menggunakan format login **ID resmi** atau **Email Login Virtual** `{ID}@{emailDomain}` dengan **Password Default = ID itu sendiri**.
Akun baru berstatus `PENDING_ACTIVATION` dan secara otomatis dialihkan ke halaman **Aktivasi Pertama (`/[tenant]/onboarding`)** untuk verifikasi OTP via WhatsApp/SMS dan pembuatan password baru.

> [!TIP]
> **Simulasi OTP Lokal**: Buka `http://localhost:3000/dev/outbox` untuk melihat kode OTP WhatsApp & SMS yang terkirim saat pengujian lokal.

### 1. Perguruan Tinggi: Politeknik Mitra Indonesia (`/poltekmi/login`)
- **Mahasiswa Baru (Import - Perlu Aktivasi)**:
  - *Login*: NIM `2301010011` atau Email `2301010011@poltekmi.ac.id`
  - *Password Awal*: `2301010011` (Status: `PENDING_ACTIVATION`, Tanggal Lahir: `2004-05-15`)
  - *Catatan*: Memiliki beasiswa 50% UKT & tagihan piutang SponsorInvoice
- **Mahasiswa Terkonversi**: Cindy Permata
  - *Login*: NIM `2301010012` atau Email `2301010012@poltekmi.ac.id` atau `cindy.permata@gmail.com`
  - *Password*: `PasswordPendaftar123!` (Status: `ACTIVE`, tidak perlu aktivasi ulang)
- **Calon Pendaftar PMB (Fee Waiver KIP)**:
  - *Login*: Email `doni.kip@gmail.com` atau No. Reg `PMB-2025-002` • Password: `DoniPass123!`
- **Staf Keuangan**: ID `KEU001` • Password Awal: `KEU001`
- **Panitia Beasiswa**: ID `BEA001` • Password Awal: `BEA001`
- **Dosen**: ID `DSN001` • Password Awal: `DSN001`
- **Admin Kampus**: ID `ADM001` • Password Awal: `ADM001`

### 2. Sekolah: SMA Negeri 1 Prestasi (`/sman1/login`)
- **Siswa (Perlu Aktivasi)**:
  - *Login*: NIS `2401010001` atau Email `2401010001@sman1jakarta.sch.id`
  - *Password Awal*: `2401010001` (Status: `PENDING_ACTIVATION`, HP Wali: `+6281234567006`)
- **Guru**: ID `GRU001` • Password Awal: `GRU001`
- **Admin Tata Usaha**: ID `STF001` • Password Awal: `STF001`

### 3. Konsol Platform SaaS & Pendaftaran Mandiri
- **Pendaftaran Tenant Mandiri (Trial 14 Hari)**: [http://localhost:3000/signup](http://localhost:3000/signup)
- **Konsol Manajemen Platform**: [http://localhost:3000/platform](http://localhost:3000/platform)
- **Simulasi Dev Outbox (OTP Viewer)**: [http://localhost:3000/dev/outbox](http://localhost:3000/dev/outbox)
- **Platform Super Admin**: Email `superadmin@platform.system` • Password: `PlatformAdminPass123!`

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
├── app/                  # Next.js App Router (Auth, Onboarding, Platform, Signup, Dashboard)
├── components/           # Reusable UI components & providers
├── lib/
│   ├── auth/             # Konfigurasi Auth.js Credentials Provider (Tenant-scoped)
│   ├── db/               # Prisma Client instance
│   ├── i18n/             # Kamus istilah dinamis Sekolah vs Kampus
│   ├── security/         # Bcrypt hash, E.164 phone normalizer, & strict password policy
│   ├── services/         # Layanan konversi admisi & kalkulasi beasiswa
│   └── storage/          # Abstraksi driver file storage (Local dev & S3 production)
└── modules/              # Domain Modules
    ├── otp/              # Mesin OTP WhatsApp/SMS (CSPRNG, HMAC, rate limit, provider adapters)
    ├── saas/             # Tenant provisioning, slug validator, & entitlement/quota checker
    ├── auth/             # Login service & session
    ├── identity/         # ID template generator & virtual email generator
    ├── master-data/      # Data master akademik
    ├── users/            # Manajemen pengguna, Kartu Akun, & import CSV
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

Menjalankan pengujian otomatis untuk alur autentikasi, OTP, aktivasi pertama, dan fondasi SaaS:
```bash
# Uji Test Suite Komprehensif Fase 1C & Fase 1D
npx tsx tests/unit/phase1c_phase1d_test.ts
```
