import { test, expect } from "@playwright/test";

test.describe("E2E Playwright Fase 3: Ruang Kelas, Kurikulum, Materi, & Progres Belajar", () => {
  test.setTimeout(90000);

  test("Alur Pengajar (Buat Topik & Materi) -> Siswa (Akses Materi & Tandai Selesai)", async ({ page }) => {
    // ------------------------------------------------------------------------
    // 1. PENGAJAR (DOSEN) LOGIN & MASUK RUANG KELAS
    // ------------------------------------------------------------------------
    console.log("1. Pengajar login ke portal...");
    await page.goto("/poltekmi/login");
    await page.waitForLoadState("networkidle");

    await page.locator('input[type="text"]').first().fill("dsn001");
    await page.locator('input[type="password"]').fill("DSN001");
    await page.click('button[type="submit"]');

    await page.waitForURL("**/poltekmi/dashboard", { timeout: 15000 });
    console.log("Pengajar berhasil masuk ke dashboard!");

    // Navigasi ke Ruang Kelas
    console.log("2. Navigasi ke daftar kelas pengajar...");
    await page.goto("/poltekmi/classes");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "tests/e2e/screenshots/08-teacher-classes-list.png", fullPage: true });

    // Masuk ke kelas Pemrograman Web Modern
    await page.click('a:has-text("Masuk ke Kelas")');
    await page.waitForURL("**/poltekmi/classes/**", { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    console.log("Pengajar masuk ke ruang kelas!");

    // ------------------------------------------------------------------------
    // 2. PENGAJAR MEMBUAT TOPIK DAN MATERI BARU
    // ------------------------------------------------------------------------
    console.log("3. Buka tab materi pembelajaran...");
    await page.click('button:has-text("Materi Pembelajaran")');
    await page.screenshot({ path: "tests/e2e/screenshots/09-teacher-classroom-materials.png", fullPage: true });

    // Tambah Topik Baru
    console.log("4. Menambahkan topik baru...");
    await page.click('button:has-text("Tambah Topik")');
    await page.waitForSelector("text=Tambah Topik Pembelajaran Baru", { timeout: 5000 });

    const uniqueId = Date.now().toString().slice(-4);
    const newTopicTitle = `Topik E2E ${uniqueId}: Arsitektur Modular`;
    await page.fill('input[placeholder="Contoh: Pengenalan Dasar & Silabus"]', newTopicTitle);
    await page.click('button:has-text("Simpan Topik")');

    // Pastikan topik baru muncul
    await expect(page.locator(`text=${newTopicTitle}`)).toBeVisible({ timeout: 10000 });
    console.log(`Topik "${newTopicTitle}" berhasil dibuat!`);

    // Tambah Materi Baru di Topik tersebut
    console.log("5. Menambahkan materi baru...");
    await page.click('button:has-text("➕ Materi")');
    await page.waitForSelector("text=Tambah Materi Pembelajaran", { timeout: 5000 });

    const newMaterialTitle = `Materi E2E ${uniqueId}: Panduan Praktikum`;
    await page.fill('input[placeholder="Contoh: Modul 1 - Teori Dasar"]', newMaterialTitle);
    await page.fill('textarea[placeholder="Tuliskan materi pelajaran di sini..."]', "<p>Langkah praktikum Next.js 16 modular dengan TypeScript.</p>");
    await page.click('button:has-text("Simpan Materi")');

    // Pastikan materi baru muncul
    await expect(page.locator(`text=${newMaterialTitle}`)).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: "tests/e2e/screenshots/10-teacher-material-created.png", fullPage: true });
    console.log(`Materi "${newMaterialTitle}" berhasil diterbitkan!`);

    // ------------------------------------------------------------------------
    // 3. SISWA LOGIN & AKSES MATERI
    // ------------------------------------------------------------------------
    console.log("6. Logout pengajar dan login sebagai siswa...");
    await page.context().clearCookies();

    await page.goto("/poltekmi/login");
    await page.waitForLoadState("networkidle");

    // Login sebagai Cindy Permata (Siswa)
    await page.locator('input[type="text"]').first().fill("2301010012");
    await page.locator('input[type="password"]').fill("PasswordPendaftar123!");
    await page.click('button[type="submit"]');

    await page.waitForURL("**/poltekmi/dashboard", { timeout: 15000 });
    console.log("Siswa berhasil login!");

    // Buka Ruang Kelas
    await page.goto("/poltekmi/classes");
    await page.waitForLoadState("networkidle");
    await page.click('a:has-text("Masuk ke Kelas")');
    await page.waitForURL("**/poltekmi/classes/**", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // Buka Tab Materi
    await page.click('button:has-text("Materi Pembelajaran")');
    await expect(page.locator(`text=${newTopicTitle}`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${newMaterialTitle}`)).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: "tests/e2e/screenshots/11-student-view-new-material.png", fullPage: true });
    console.log("Siswa dapat melihat topik dan materi baru yang diterbitkan pengajar!");

    // ------------------------------------------------------------------------
    // 4. SISWA MENANDAI SELESAI & PROGRES NAIK
    // ------------------------------------------------------------------------
    console.log("7. Siswa menandai materi selesai...");
    // Klik tombol Tandai Selesai pertama yang tersedia
    const markDoneBtn = page.locator('button:has-text("Tandai Selesai")').first();
    await markDoneBtn.click();

    // Verifikasi tombol berubah menjadi ✓ Selesai
    await expect(page.locator('button:has-text("✓ Selesai")').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: "tests/e2e/screenshots/12-student-progress-updated.png", fullPage: true });

    console.log("🎉 Alur E2E Fase 3 Berhasil Sempurna!");
  });
});
