import { test, expect } from "@playwright/test";

test.describe("E2E Playwright: Admin Login -> Tambah Pengguna -> Onboarding -> Dashboard", () => {
  test.beforeEach(async () => {
    const { PrismaClient } = await import("@prisma/client");
    const dbUrl = process.env.PLATFORM_DATABASE_URL || process.env.TEST_DATABASE_URL;
    const prisma = new PrismaClient(dbUrl ? { datasources: { db: { url: dbUrl } } } : undefined);
    await prisma.user.updateMany({
      where: { identifiers: { some: { value: "2301010011" } } },
      data: { status: "PENDING_ACTIVATION", mustChangePassword: true },
    });
    await prisma.$disconnect();
  });
  test.setTimeout(90000);

  test("Alur onboarding pengguna baru dengan verifikasi OTP dan ganti password", async ({ page }) => {
    // ------------------------------------------------------------------------
    // 1. ADMIN LOGIN
    // ------------------------------------------------------------------------
    console.log("1. Navigasi ke halaman login admin...");
    await page.goto("/poltekmi/login");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "tests/e2e/screenshots/01-admin-login-page.png", fullPage: true });

    // Isi ID dan Password Admin
    await page.locator('input[type="text"]').first().fill("adm001");
    await page.locator('input[type="password"]').fill("ADM001");
    await page.click('button[type="submit"]');

    // Pastikan masuk ke dashboard admin
    await page.waitForURL("**/poltekmi/dashboard", { timeout: 15000 });
    console.log("Admin berhasil login ke dashboard!");
    await page.screenshot({ path: "tests/e2e/screenshots/02-admin-dashboard.png", fullPage: true });

    // ------------------------------------------------------------------------
    // 2. TAMBAH PENGGUNA BARU
    // ------------------------------------------------------------------------
    console.log("2. Navigasi ke manajemen pengguna...");
    await page.goto("/poltekmi/admin/users");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "tests/e2e/screenshots/03-admin-users-table.png", fullPage: true });

    // Buka modal Tambah Pengguna Baru
    await page.click('button:has-text("Tambah Pengguna")');
    await page.waitForSelector("text=Tambah Pengguna Baru", { timeout: 5000 });

    const uniqueSeq = Date.now().toString().slice(-4);
    const testCustomId = `230101${uniqueSeq}`;
    const testUserName = `Siswa Baru E2E ${uniqueSeq}`;

    await page.fill('input[placeholder="Contoh: Muhammad Budiarto"]', testUserName);
    await page.fill('input[placeholder="Kosongkan untuk auto-generate"]', testCustomId);
    const testPhone = `+62812${uniqueSeq}${Math.floor(Math.random() * 900 + 100)}`;
    await page.fill('input[placeholder="Contoh: +628123456789"]', testPhone);

    // Simpan Pengguna
    await page.click('button:has-text("Simpan Pengguna")');

    // Verifikasi pesan sukses
    await expect(page.locator("text=Akun Berhasil Dibuat!")).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: "tests/e2e/screenshots/04-user-created-success.png" });
    console.log(`Pengguna baru ${testCustomId} berhasil dibuat!`);

    // ------------------------------------------------------------------------
    // 3. LOGOUT ADMIN & LOGIN PENGGUNA BARU
    // ------------------------------------------------------------------------
    console.log("3. Pengguna baru login dengan ID dan password awal...");
    await page.context().clearCookies();

    await page.goto("/poltekmi/login");
    await page.waitForLoadState("networkidle");
    await page.locator('input[type="text"]').first().fill(testCustomId);
    // Mode SAME_AS_ID: password awal = testCustomId
    await page.locator('input[type="password"]').fill(testCustomId);
    await page.click('button[type="submit"]');

    // ------------------------------------------------------------------------
    // 4. DIPAKSA ONBOARDING
    // ------------------------------------------------------------------------
    console.log("4. Pengguna baru dipaksa masuk ke alur onboarding...");
    await page.waitForURL("**/poltekmi/onboarding", { timeout: 15000 });
    await page.screenshot({ path: "tests/e2e/screenshots/05-forced-onboarding.png", fullPage: true });

    // Klik tombol Kirim Kode Verifikasi OTP
    await page.click('button:has-text("Kirim Kode Verifikasi OTP")');

    // ------------------------------------------------------------------------
    // 5. AMBIL OTP DARI /dev/outbox & VERIFIKASI
    // ------------------------------------------------------------------------
    console.log("5. Mengambil kode OTP simulasi dari /api/dev/outbox...");
    // Tunggu input OTP muncul
    await page.waitForSelector('input[placeholder="123456"]', { timeout: 10000 });

    // Request outbox API
    const outboxRes = await page.request.get("/api/dev/outbox");
    expect(outboxRes.ok()).toBeTruthy();
    const outboxData = await outboxRes.json();
    const latestMsg = outboxData.messages?.[0];
    expect(latestMsg).toBeDefined();

    const otpCode = latestMsg.code || (latestMsg.message && latestMsg.message.match(/\b\d{6}\b/)?.[0]);
    expect(otpCode).toBeTruthy();
    console.log(`Kode OTP simulasi didapatkan dari outbox: ${otpCode}`);

    // Masukkan OTP
    await page.fill('input[placeholder="123456"]', otpCode);
    await page.click('button:has-text("Verifikasi Kode")');

    // ------------------------------------------------------------------------
    // 6. BUAT PASSWORD BARU
    // ------------------------------------------------------------------------
    console.log("6. Mengisi password baru yang kuat...");
    await page.waitForSelector('input[placeholder*="Minimal 8 karakter"]', { timeout: 10000 });
    await page.screenshot({ path: "tests/e2e/screenshots/06-otp-verified-step-password.png" });

    const newPassword = "SuperAman2026!#";
    await page.fill('input[placeholder*="Minimal 8 karakter"]', newPassword);
    await page.fill('input[placeholder="Konfirmasi password baru"]', newPassword);

    await page.click('button:has-text("Aktifkan Akun & Masuk ke Portal")');

    // ------------------------------------------------------------------------
    // 7. MASUK DASHBOARD & ASSERTION TEKS NYATA
    // ------------------------------------------------------------------------
    console.log("7. Memastikan pengguna berhasil masuk ke dashboard nyata...");
    await page.waitForURL("**/poltekmi/dashboard", { timeout: 20000 });
    await page.waitForLoadState("networkidle");

    // Assertion URL tidak berada di /onboarding
    expect(page.url()).not.toContain("/onboarding");
    expect(page.url()).toContain("/poltekmi/dashboard");

    // Assertion teks dashboard nyata: H1 Dashboard, nama pengguna, dan daftar kelas nyata
    await expect(page.locator("h1:has-text('Dashboard')")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("main").locator(`text=${testUserName}`).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Daftar kelas").first()).toBeVisible({ timeout: 10000 });

    // Tangkap screenshot nyata dashboard penuh
    await page.screenshot({ path: "tests/e2e/screenshots/07-user-dashboard-completed.png", fullPage: true });
    console.log("🎉 Alur E2E Berhasil Sempurna dan Dashboard Terverifikasi!");
  });

  test("E2E Negatif: Pengguna PENDING_ACTIVATION dialihkan dari dashboard ke onboarding dan diblokir dari /api/admin/users (403)", async ({ page }) => {
    // 1. Login dengan akun PENDING_ACTIVATION (Budi Santoso: 2301010011)
    await page.context().clearCookies();
    await page.goto("/poltekmi/login");
    await page.waitForLoadState("networkidle");

    await page.locator('input[type="text"]').first().fill("2301010011");
    await page.locator('input[type="password"]').fill("2301010011");
    await page.click('button[type="submit"]');

    // 2. Sistem otomatis mengalihkan ke /onboarding
    await page.waitForURL("**/poltekmi/onboarding", { timeout: 15000 });
    expect(page.url()).toContain("/poltekmi/onboarding");

    // 3. Coba paksa navigasi manual langsung ke /[tenant]/dashboard -> Wajib ditendang kembali ke /onboarding
    await page.goto("/poltekmi/dashboard");
    await page.waitForURL("**/poltekmi/onboarding", { timeout: 15000 });
    expect(page.url()).toContain("/poltekmi/onboarding");
    expect(page.url()).not.toContain("/poltekmi/dashboard");

    // 4. Panggil API non-onboarding (/api/admin/users) -> Wajib ditolak HTTP 403 ONBOARDING_REQUIRED
    const apiRes = await page.request.get("/api/admin/users");
    expect(apiRes.status()).toBe(403);
    const apiBody = await apiRes.json();
    expect(apiBody.error).toBe("ONBOARDING_REQUIRED");
    console.log("✅ E2E Negatif Lulus: Sesi PENDING_ACTIVATION dicegat dari dashboard dan API non-onboarding!");
  });
});
