# LMS Terpadu (Sekolah & Kampus) + Modul Penerimaan (PPDB & PMB)

Learning Management System (LMS) modern berbasis **Modular Monolith** yang dirancang untuk mendukung institusi **Sekolah (SD/SMP/SMA/SMK)** dan **Kampus (Perguruan Tinggi)** dalam satu platform tunggal dengan kamus istilah (*i18n*) terpusat, login berbasis ID resmi institusional, alur wajib ganti password awal, modul jadwal pelajaran/perkuliahan, dan modul admisi terpadu.

---

## 🔒 Catatan Keamanan: Rotasi Kredensial & Penghapusan Hardcoded Secrets

> [!WARNING]
> **PEMBERITAHUAN KEAMANAN (COMPROMISED CREDENTIALS NOTICE):**
> Seluruh password default yang pernah ter-commit dalam riwayat repositori git sebelumnya (termasuk `postgres123`, `app_secure_password_123`, `app_sec_pwd_9a8b7c6d5e4f3a2b1c`, dan `platform_sec_pwd_1a2b3c4d5e6f7a8b9c`) **dianggap telah bocor (compromised)** dan **TIDAK BOLEH** digunakan dalam lingkungan produksi atau staging.
> 
> Seluruh fallback hardcode (seperti `${VAR:-default}` atau `|| "fallback"`) telah **dihapus tuntas** dari seluruh file kode sumber, `docker-compose.yml`, skrip migrasi, skrip database, dan test setup. Repositori kini hanya memuat template placeholder (`.env.example` dan `.env.test.example`). File rahasia sebenarnya disimpan di `.env` dan `.env.test` yang dikecualikan oleh git (`.gitignore`).

---

## 💻 Panduan Setup Lingkungan WSL (Windows Subsystem for Linux)

Untuk memastikan kelancaran eksekusi otomasi, Docker daemon, DNS resolusi internet, dan shell non-interaktif di WSL 2 (Ubuntu), ikuti panduan konfigurasi berikut:

### 1. Autostart Docker Service (Systemd)
Pastikan systemd aktif di WSL (`/etc/wsl.conf` memuat `[boot]\nsystemd=true`). Aktifkan autostart docker service:
```bash
sudo systemctl enable docker
sudo systemctl start docker
```

### 2. DNS Resolusi Tetap (Static DNS)
Secara default, WSL secara dinamis menimpa `/etc/resolv.conf` dengan alamat IP gateway host Windows yang dapat berubah saat beralih jaringan. Untuk membuat DNS tetap dengan DNS publik cadangan:
1. Tambahkan ke `/etc/wsl.conf`:
   ```ini
   [network]
   generateResolvConf = false
   ```
2. Buat file `/etc/resolv.conf` manual:
   ```text
   nameserver 1.1.1.1
   nameserver 8.8.8.8
   ```

### 3. PATH Node.js untuk Shell Non-Interaktif
Sub-agen, skrip otomatisasi CI, dan perintah remote mengeksekusi bash dalam mode non-interaktif (`bash -c "..."`). Secara default, `~/.bashrc` memiliki baris penghenti `[ -z "$PS1" ] && return` yang mencegah NVM termuat.
Tambahkan path binary Node.js di baris paling atas `~/.bashrc` (sebelum baris `[ -z "$PS1" ] && return`):
```bash
export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$PATH"
```

### 4. Skrip Verifikasi Lingkungan
Jalankan skrip diagnostik terintegrasi untuk memeriksa kesiapan Docker, PostgreSQL, Node.js, dan konfigurasi `.env`:
```bash
./scripts/dev-env.sh
```

---

## 🚀 Panduan Menjalankan Proyek

### Prasyarat
- Sistem Operasi: Linux / WSL 2 (Ubuntu)
- Docker & Docker Compose
- Node.js LTS (v20+ atau v24+) & npm

### Langkah Instalasi & Menjalankan

1. **Pindah ke Direktori Proyek**:
   ```bash
   cd ~/projects/lms
   ```

2. **Salin File Konfigurasi Environment**:
   ```bash
   cp .env.example .env
   cp .env.test.example .env.test
   ```
   *(Sesuaikan password database yang kuat pada `.env` dan `.env.test`)*.

3. **Jalankan Database PostgreSQL via Docker Compose**:
   ```bash
   docker compose up -d
   ```
   *(PostgreSQL 16 akan berjalan di `127.0.0.1:5432` khusus untuk akses lokal)*.

4. **Siapkan Database & Jalankan Migrasi**:
   ```bash
   npx prisma migrate deploy
   ```

5. **Jalankan Seed Data Demo**:
   ```bash
   npm run seed
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
> **Simulasi OTP Lokal**: Buka `http://localhost:3000/dev/outbox` untuk melihat kode OTP WhatsApp & SMS yang terkirim saat pengujian lokal (hanya aktif jika `NODE_ENV != production` dan `DEV_OTP_OUTBOX=true`).

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

## 🧪 Menjalankan Pengujian

Seluruh pengujian dijalankan pada database terisolasi `lms_test` (direset, dimigrasi, dan di-seed secara otomatis sebelum pengujian):

```bash
# 1. Menjalankan Unit & Integration Test Suite (Vitest)
npm test

# Mode Rinci (Verbose) per Kasus Uji
npx vitest run --reporter=verbose

# 2. Menjalankan End-to-End Test Suite (Playwright - Desktop Chrome & Mobile Chrome)
npm run test:e2e
```
