import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

test.describe("B.6 & C Navigasi & Integritas Peran Demo Bebas 404 & Bebas Error Konsol", () => {
  test.setTimeout(90000);

  test.beforeAll(async () => {
    // Pastikan dosen aktif untuk skenario demo test
    const dbUrl = process.env.PLATFORM_DATABASE_URL || process.env.TEST_DATABASE_URL;
    const prisma = new PrismaClient(dbUrl ? { datasources: { db: { url: dbUrl } } } : undefined);
    await prisma.user.updateMany({
      where: { staffProfiles: { some: { employeeNumber: "DSN001" } } },
      data: { status: "ACTIVE", mustChangePassword: false },
    });
    await prisma.$disconnect();
  });

  const demoRoles = [
    {
      roleName: "Admin Institusi",
      identifier: "adm001",
      password: "ADM001",
      expectedName: "Bambang Sudirjo",
    },
    {
      roleName: "Dosen",
      identifier: "dsn001",
      password: "DSN001",
      expectedName: "Dr. Hendra Wijaya",
    },
    {
      roleName: "Mahasiswa",
      identifier: "2301010012",
      password: "PasswordPendaftar123!",
      expectedName: "Cindy Permata",
    },
  ];

  for (const demo of demoRoles) {
    test(`Navigasi Peran ${demo.roleName} (${demo.identifier}): Semua tautan sidebar & header valid tanpa 404 atau error konsol`, async ({
      page,
    }) => {
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          const text = msg.text();
          // Abaikan pesan dev server React Hydration yang tidak kritis jika ada
          if (!text.includes("favicon.ico") && !text.includes("Download the React DevTools")) {
            consoleErrors.push(text);
          }
        }
      });
      page.on("pageerror", (err) => {
        consoleErrors.push(err.message);
      });

      // 1. Login
      await page.context().clearCookies();
      await page.goto("/poltekmi/login");
      await page.waitForLoadState("networkidle");

      await page.locator('input[type="text"]').first().fill(demo.identifier);
      await page.locator('input[type="password"]').fill(demo.password);
      await page.click('button[type="submit"]');

      // 2. Dashboard
      await page.waitForURL("**/poltekmi/dashboard", { timeout: 15000 });
      await page.waitForLoadState("networkidle");

      // Verifikasi dashboard
      await expect(page.locator("h1:has-text('Dashboard')")).toBeVisible();
      await expect(page.locator("main").locator(`text=${demo.expectedName}`).first()).toBeVisible();

      // 3. Kunjungi semua link di sidebar
      const sidebarLinks = await page.locator("aside nav a").all();
      expect(sidebarLinks.length).toBeGreaterThan(0);

      const hrefs: string[] = [];
      for (const link of sidebarLinks) {
        const href = await link.getAttribute("href");
        if (href && !hrefs.includes(href)) {
          hrefs.push(href);
        }
      }

      console.log(`Peran ${demo.roleName} memiliki tautan sidebar:`, hrefs);

      for (const href of hrefs) {
        const res = await page.goto(href);
        await page.waitForLoadState("networkidle");

        // Tidak boleh 404
        expect(res?.status()).toBeLessThan(400);
        await expect(page.locator("text=Halaman Tidak Ditemukan")).not.toBeVisible();
        await expect(page.locator("h1:has-text('404')")).not.toBeVisible();

        // Uji breadcrumb kembali ke beranda jika bukan dashboard
        if (!href.endsWith("/dashboard")) {
          const breadcrumbHome = page.locator("header nav a:has-text('Dashboard'), header nav a:has-text('Beranda')").first();
          if (await breadcrumbHome.isVisible()) {
            await breadcrumbHome.click();
            await page.waitForURL("**/poltekmi/dashboard");
            await expect(page.locator("h1:has-text('Dashboard')")).toBeVisible();
          }
        }
      }

      // 4. Pastikan tidak ada error konsol
      expect(consoleErrors).toEqual([]);
    });
  }
});
