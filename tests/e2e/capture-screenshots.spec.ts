import { test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";

const SCREENSHOT_DIR = path.join(process.cwd(), "tests/e2e/screenshots/redesign");

test.describe("C.4 Capture Institutional Redesign Screenshots", () => {
  test.beforeAll(async () => {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
    const dbUrl = process.env.PLATFORM_DATABASE_URL || process.env.TEST_DATABASE_URL;
    const prisma = new PrismaClient(dbUrl ? { datasources: { db: { url: dbUrl } } } : undefined);
    await prisma.user.updateMany({
      where: {
        staffProfiles: {
          some: {
            employeeNumber: { in: ["DSN001", "ADM001"] }
          }
        }
      },
      data: { status: "ACTIVE", mustChangePassword: false }
    });
    await prisma.$disconnect();
  });

  test("Capture all required institutional screenshots at 1440px and 390px", async ({ page }) => {
    test.setTimeout(120000);

    const captureBoth = async (baseName: string) => {
      // 1440px Desktop
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${baseName}-1440.png`),
        fullPage: true,
      });

      // 390px Mobile
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${baseName}-390.png`),
        fullPage: true,
      });

      // Reset back to desktop default
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForTimeout(300);
    };

    // 1. Halaman Login
    console.log("📸 1. Mengambil screenshot Login...");
    await page.goto("http://localhost:3000/poltekmi/login");
    await page.waitForLoadState("networkidle");
    await captureBoth("login");

    // 2. Alur Onboarding (Step 1, Step 2, Step 3)
    console.log("📸 2. Mengambil screenshot Alur Onboarding...");
    await page.fill('#identifier', "2301010011");
    await page.fill('#password', "2301010011");
    await page.click('button[type="submit"]');

    // Proxy langsung mengalihkan ke /poltekmi/onboarding
    await page.waitForURL("**/poltekmi/onboarding", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // Onboarding Step 1
    await captureBoth("onboarding-step1");

    // Request OTP
    console.log("📸 Requesting OTP...");
    await page.click('button:has-text("Kirim Kode Verifikasi OTP")');
    await page.waitForSelector('#otpCode', { timeout: 15000 });

    // Onboarding Step 2
    await captureBoth("onboarding-step2");

    // Ambil OTP dari outbox
    const outboxRes = await page.request.get("http://localhost:3000/api/dev/outbox");
    const outbox = await outboxRes.json();
    const latestOtp = outbox.messages[0]?.message.match(/\d{6}/)?.[0] || "123456";

    // Isi OTP & verifikasi
    await page.fill('#otpCode', latestOtp);
    await page.click('button:has-text("Verifikasi"), button[type="submit"]');
    await page.waitForSelector('#newPassword', { timeout: 15000 });

    // Onboarding Step 3
    await captureBoth("onboarding-step3");

    // 3. Login Mahasiswa (Cindy Permata: 2301010012 / PasswordPendaftar123!)
    console.log("📸 3. Mengambil screenshot Dashboard Mahasiswa...");
    await page.context().clearCookies();
    await page.goto("http://localhost:3000/poltekmi/login");
    await page.waitForLoadState("networkidle");
    await page.fill('#identifier', "2301010012");
    await page.fill('#password', "PasswordPendaftar123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/poltekmi/dashboard", { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await captureBoth("dashboard-mahasiswa");

    // 4. Login Dosen (Dr. Hendra Wijaya: dsn001 / DSN001)
    console.log("📸 4. Mengambil screenshot Dashboard Dosen & Ruang Kelas...");
    await page.context().clearCookies();
    await page.goto("http://localhost:3000/poltekmi/login");
    await page.waitForLoadState("networkidle");
    await page.fill('#identifier', "dsn001");
    await page.fill('#password', "DSN001");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/poltekmi/dashboard", { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await captureBoth("dashboard-dosen");

    // 5. Daftar Kelas
    console.log("📸 5. Mengambil screenshot Daftar Kelas...");
    await page.goto("http://localhost:3000/poltekmi/classes");
    await page.waitForLoadState("networkidle");
    await captureBoth("classes-list");

    // 6. Detail Kelas (Materi & Anggota)
    console.log("📸 6. Mengambil screenshot Detail Kelas (Materi & Anggota)...");
    const classLink = page.locator('a[href*="/classes/"]').first();
    await classLink.click();
    await page.waitForLoadState("networkidle");
    await captureBoth("class-detail-materials");

    const membersTab = page.locator('button:has-text("Anggota"), [role="tab"]:has-text("Anggota")');
    if (await membersTab.isVisible()) {
      await membersTab.click();
      await page.waitForTimeout(500);
      await captureBoth("class-detail-members");
    }

    // 7. Login Admin (Bambang Sudirjo: adm001 / ADM001)
    console.log("📸 7. Mengambil screenshot Dashboard Admin...");
    await page.context().clearCookies();
    await page.goto("http://localhost:3000/poltekmi/login");
    await page.waitForLoadState("networkidle");
    await page.fill('#identifier', "adm001");
    await page.fill('#password', "ADM001");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/poltekmi/dashboard", { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await captureBoth("dashboard-admin");

    // 8. Manajemen Pengguna Admin
    console.log("📸 8. Mengambil screenshot Manajemen Pengguna Admin...");
    await page.goto("http://localhost:3000/poltekmi/admin/users");
    await page.waitForLoadState("networkidle");
    await captureBoth("admin-users");

    console.log("🎉 SEMUA SCREENSHOT BERHASIL DIAMBIL SEMPURNA!");
  });
});
