import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";

const SCREENSHOT_DIR = path.join(process.cwd(), "tests/e2e/screenshots/redesign");

test.describe("C.4 Capture Institutional Multi-Viewport Screenshots & 320px Overflow Verification", () => {
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
            employeeNumber: { in: ["DSN001", "ADM001"] },
          },
        },
      },
      data: { status: "ACTIVE", mustChangePassword: false },
    });
    // Reset akun Budi Santoso (2301010011) ke PENDING_ACTIVATION dengan password awal
    const { hashPassword } = await import("@/lib/security/hash");
    const mhs1Pass = await hashPassword("2301010011");
    await prisma.user.updateMany({
      where: { identifiers: { some: { value: "2301010011" } } },
      data: {
        status: "PENDING_ACTIVATION",
        mustChangePassword: true,
        passwordHash: mhs1Pass,
        phoneE164: "+6281234567005",
        birthDate: new Date("2004-05-15"),
      },
    });
    // Bersihkan rate limit OTP untuk pengujian yang konsisten
    await prisma.otpChallenge.deleteMany();
    await prisma.$disconnect();
  });

  test("Capture all required institutional screenshots at 1440px and 390px, with 320px overflow check", async ({
    page,
  }) => {
    test.setTimeout(180000);

    const captureBoth = async (baseName: string) => {
      // 1. 1440px Desktop
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${baseName}-1440.png`),
        fullPage: true,
      });

      // 2. 390px Mobile
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${baseName}-390.png`),
        fullPage: true,
      });

      // 3. 320px Ultra-Compact No-Overflow Verification
      await page.setViewportSize({ width: 320, height: 600 });
      await page.waitForTimeout(200);
      const overflowInfo = await page.evaluate(() => {
        const isOver = document.documentElement.scrollWidth > document.documentElement.clientWidth;
        if (!isOver) return null;
        const overEls = Array.from(document.querySelectorAll("*"))
          .filter((el) => {
            const rect = el.getBoundingClientRect();
            return rect.right > document.documentElement.clientWidth + 2;
          })
          .map((el) => ({
            tag: el.tagName,
            id: el.id,
            className: el.className ? String(el.className).slice(0, 50) : "",
            text: el.textContent ? el.textContent.trim().slice(0, 40) : "",
            right: el.getBoundingClientRect().right,
          }));
        return { isOver, overEls: overEls.slice(0, 5) };
      });

      if (overflowInfo?.isOver) {
        console.error(`OVERFLOW DETAILS pada ${baseName}:`, JSON.stringify(overflowInfo.overEls));
      }
      expect(
        overflowInfo?.isOver,
        `Terjadi horizontal overflow pada viewport 320px di halaman ${baseName}!`
      ).toBeFalsy();

      // Reset back to desktop
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForTimeout(200);
    };

    // 1. Halaman Login Split-Screen
    console.log("📸 1. Mengambil screenshot Login Split-Screen...");
    await page.goto("http://localhost:3000/poltekmi/login");
    await page.waitForLoadState("networkidle");
    await captureBoth("login");

    // 2. Alur Onboarding (Step 1, Step 2, Step 3)
    console.log("📸 2. Mengambil screenshot Alur Onboarding...");
    await page.fill("#identifier", "2301010011");
    await page.fill("#password", "2301010011");
    await page.click('button[type="submit"]');

    await page.waitForURL("**/poltekmi/onboarding", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // Onboarding Step 1
    await captureBoth("onboarding-step1");

    // Request OTP
    console.log("📸 Requesting OTP...");
    const phoneInput = page.locator("#phoneNumber");
    if (await phoneInput.isVisible()) {
      await phoneInput.fill("081234567005");
      await page.fill("#birthDate", "2004-05-15");
    }
    await page.click('button:has-text("Kirim Kode Verifikasi OTP")');
    await page.waitForSelector("#otpCode", { timeout: 15000 });

    // Onboarding Step 2
    await captureBoth("onboarding-step2");

    // Ambil OTP dari outbox
    const outboxRes = await page.request.get("http://localhost:3000/api/dev/outbox");
    const outbox = await outboxRes.json();
    const latestOtp = outbox.messages?.[0]?.message.match(/\d{6}/)?.[0] || "123456";

    // Isi OTP & verifikasi
    await page.fill("#otpCode", latestOtp);
    await page.click('button:has-text("Verifikasi Kode"), button[type="submit"]');
    await page.waitForSelector("#newPassword", { timeout: 15000 });

    // Onboarding Step 3
    await captureBoth("onboarding-step3");

    // 3. Login Mahasiswa (Cindy Permata: 2301010012 / PasswordPendaftar123!)
    console.log("📸 3. Mengambil screenshot Dashboard Mahasiswa (Cindy Permata)...");
    await page.context().clearCookies();
    await page.goto("http://localhost:3000/poltekmi/login");
    await page.waitForLoadState("networkidle");
    await page.fill("#identifier", "2301010012");
    await page.fill("#password", "PasswordPendaftar123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/poltekmi/dashboard", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // Assertion Cindy has non-zero dashboard
    await expect(page.locator("text=Belum ada kelas terdaftar")).not.toBeVisible();
    await expect(page.locator("text=Lanjutkan Belajar")).toBeVisible();
    await captureBoth("dashboard-mahasiswa");

    // Profil Mahasiswa
    console.log("📸 Profil Mahasiswa...");
    await page.goto("http://localhost:3000/poltekmi/profile");
    await page.waitForLoadState("networkidle");
    await captureBoth("profile-account");

    // 4. Login Dosen (Dr. Hendra Wijaya: dsn001 / DSN001)
    console.log("📸 4. Mengambil screenshot Dashboard Dosen...");
    await page.context().clearCookies();
    await page.goto("http://localhost:3000/poltekmi/login");
    await page.waitForLoadState("networkidle");
    await page.fill("#identifier", "dsn001");
    await page.fill("#password", "DSN001");
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
    console.log("📸 6. Mengambil screenshot Detail Kelas (Split-Pane Materi & Anggota)...");
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
    await page.fill("#identifier", "adm001");
    await page.fill("#password", "ADM001");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/poltekmi/dashboard", { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await captureBoth("dashboard-admin");

    // 8. Manajemen Pengguna Admin
    console.log("📸 8. Mengambil screenshot Manajemen Pengguna Admin...");
    await page.goto("http://localhost:3000/poltekmi/admin/users");
    await page.waitForLoadState("networkidle");
    await captureBoth("admin-users");

    // 9. Manajemen Akademik Admin
    console.log("📸 9. Mengambil screenshot Manajemen Akademik Admin...");
    await page.goto("http://localhost:3000/poltekmi/admin/academic");
    await page.waitForLoadState("networkidle");
    await captureBoth("admin-academic");

    // 10. Pengaturan & Branding Institusi Admin
    console.log("📸 10. Mengambil screenshot Pengaturan Institusi Admin...");
    await page.goto("http://localhost:3000/poltekmi/admin/settings");
    await page.waitForLoadState("networkidle");
    await captureBoth("admin-settings");

    console.log("🎉 SEMUA SCREENSHOT MULTI-VIEWPORT BERHASIL DIAMBIL SEMPURNA!");
  });
});
