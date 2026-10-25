import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PrismaClient } from "@prisma/client";

test.describe("C.3 Otomasi Aksesibilitas (Axe WCAG 2.1 AA) & Integritas Desain Seluruh Halaman Utama", () => {
  test.setTimeout(180000);

  test.beforeAll(async () => {
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
    // Pastikan institusi poltekmi kembali ke nama dan warna tema resmi
    await prisma.institution.updateMany({
      where: { slug: "poltekmi" },
      data: { name: "Politeknik Mitra Indonesia", themeColor: "#1E40AF" },
    });
    await prisma.$disconnect();
  });

  async function resetBudiForOnboarding() {
    const bcrypt = await import("bcryptjs");
    const dbUrl = process.env.PLATFORM_DATABASE_URL || process.env.TEST_DATABASE_URL;
    const prisma = new PrismaClient(dbUrl ? { datasources: { db: { url: dbUrl } } } : undefined);
    const mhs1Pass = await bcrypt.hash("2301010011", 10);
    await prisma.user.updateMany({
      where: { identifiers: { some: { value: "2301010011" } } },
      data: {
        status: "PENDING_ACTIVATION",
        mustChangePassword: true,
        passwordHash: mhs1Pass,
        phoneE164: "+6281234567005",
        birthDate: new Date("2004-05-15"),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await prisma.otpChallenge.deleteMany();
    await prisma.$disconnect();
  }

  const emojiRegex =
    /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

  const runA11yScan = async (page: any, pageName: string) => {
    // Pastikan dokumen memiliki title sebelum scan (hindari race condition hidrasi metadata Next.js di mobile)
    await page.waitForFunction(() => !!document.title && document.title.trim().length > 0, { timeout: 5000 }).catch(() => {});

    // 1. Axe WCAG 2.1 AA Scan
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["color-contrast"])
      .analyze();

    const criticalViolations = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(
      criticalViolations,
      `Pelanggaran aksesibilitas kritis pada ${pageName}: ${JSON.stringify(criticalViolations)}`
    ).toEqual([]);

    // 2. Deteksi Emoji di UI
    const bodyText = await page.locator("body").innerText();
    const hasEmoji = emojiRegex.test(bodyText);
    expect(hasEmoji, `Ditemukan emoji di ${pageName}: ${bodyText.match(emojiRegex)?.[0]}`).toBeFalsy();

    // 3. Deteksi larangan uppercase tracking-widest
    const spacedUppercaseCount = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll("main *"));
      return elements.filter((el) => {
        const style = window.getComputedStyle(el);
        const hasLetterSpacing = parseFloat(style.letterSpacing) > 1.5;
        const isUpper = style.textTransform === "uppercase";
        return hasLetterSpacing && isUpper && (el.textContent?.trim().length || 0) > 3;
      }).length;
    });
    expect(spacedUppercaseCount, `Ditemukan kapital lebar di ${pageName}`).toBe(0);

    // 4. Verifikasi Tanpa Horizontal Overflow (320px, 390px, 1440px)
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 700 });
      await page.waitForTimeout(100);
      const isOverflowing = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(
        isOverflowing,
        `Horizontal overflow terdeteksi pada ${pageName} di viewport ${width}px`
      ).toBeFalsy();
    }
    await page.setViewportSize({ width: 1440, height: 900 });

    // 5. Pemeriksaan Nyata Rasio Kontras (>= 4.5:1) via document.elementsFromPoint
    const contrastViolations = await page.evaluate(() => {
      function parseRgb(colorStr: string): [number, number, number] | null {
        const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!match) return null;
        return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
      }

      function getLuminance(r: number, g: number, b: number): number {
        const [rs, gs, bs] = [r, g, b].map((c) => {
          c = c / 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
      }

      function getContrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
        const lum1 = getLuminance(rgb1[0], rgb1[1], rgb1[2]);
        const lum2 = getLuminance(rgb2[0], rgb2[1], rgb2[2]);
        const brightest = Math.max(lum1, lum2);
        const darkest = Math.min(lum1, lum2);
        return (brightest + 0.05) / (darkest + 0.05);
      }

      const headings = Array.from(document.querySelectorAll("h1, h2"));
      const violations: any[] = [];

      for (const el of headings) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0 || rect.top < 0 || rect.left < 0) continue;
        const text = el.textContent?.trim() || "";
        if (!text) continue;

        const fgStyle = window.getComputedStyle(el);
        const fgRgb = parseRgb(fgStyle.color);
        if (!fgRgb) continue;

        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const elementsBehind = document.elementsFromPoint(cx, cy);

        let bgRgb: [number, number, number] | null = null;
        for (const candidate of elementsBehind) {
          if (candidate === el) continue;
          const bgStyle = window.getComputedStyle(candidate);
          const bgCandidate = bgStyle.backgroundColor;
          if (bgCandidate && bgCandidate !== "rgba(0, 0, 0, 0)" && bgCandidate !== "transparent") {
            bgRgb = parseRgb(bgCandidate);
            if (bgRgb) break;
          }
          const bgImage = bgStyle.backgroundImage;
          if (bgImage && bgImage.includes("gradient")) {
            const gradMatch = bgImage.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (gradMatch) {
              bgRgb = [parseInt(gradMatch[1], 10), parseInt(gradMatch[2], 10), parseInt(gradMatch[3], 10)];
              break;
            }
          }
        }

        if (!bgRgb) {
          bgRgb = [255, 255, 255];
        }

        const ratio = getContrastRatio(fgRgb, bgRgb);
        if (ratio < 4.5) {
          violations.push({
            text: text.slice(0, 30),
            ratio: Math.round(ratio * 10) / 10,
            fg: fgStyle.color,
            bg: `rgb(${bgRgb.join(",")})`,
          });
        }
      }

      return violations;
    });

    expect(
      contrastViolations,
      `Ditemukan elemen judul dengan rasio kontras < 4.5:1 di ${pageName}: ${JSON.stringify(contrastViolations)}`
    ).toEqual([]);
  };

  test("1. Aksesibilitas Halaman Publik: Login & Lupa Sandi", async ({ page }) => {
    await page.goto("http://localhost:3000/poltekmi/login");
    await page.waitForLoadState("networkidle");
    await runA11yScan(page, "Login");

    await page.goto("http://localhost:3000/poltekmi/forgot-password");
    await page.waitForLoadState("networkidle");
    await runA11yScan(page, "Lupa Sandi");
  });

  test("2. Aksesibilitas Alur Onboarding", async ({ page }) => {
    await resetBudiForOnboarding();
    await page.goto("http://localhost:3000/poltekmi/login");
    await page.waitForLoadState("networkidle");
    await page.fill("#identifier", "2301010011");
    await page.fill("#password", "2301010011");
    await page.click('button[type="submit"]');

    await page.waitForURL("**/poltekmi/onboarding", { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await runA11yScan(page, "Onboarding");
  });

  test("3. Aksesibilitas Mahasiswa: Dashboard, Kelas, Jadwal, Tugas, Nilai & Profil", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("http://localhost:3000/poltekmi/login");
    await page.waitForLoadState("networkidle");
    await page.fill("#identifier", "2301010012");
    await page.fill("#password", "PasswordPendaftar123!");
    await page.click('button[type="submit"]');

    await page.waitForURL("**/poltekmi/dashboard", { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await runA11yScan(page, "Dashboard Mahasiswa");

    await page.goto("http://localhost:3000/poltekmi/classes");
    await page.waitForLoadState("networkidle");
    await runA11yScan(page, "Daftar Kelas Mahasiswa");

    await page.goto("http://localhost:3000/poltekmi/schedule");
    await page.waitForLoadState("networkidle");
    await runA11yScan(page, "Jadwal Mahasiswa");

    await page.goto("http://localhost:3000/poltekmi/assignments");
    await page.waitForLoadState("networkidle");
    await runA11yScan(page, "Tugas Mahasiswa");

    await page.goto("http://localhost:3000/poltekmi/grades");
    await page.waitForLoadState("networkidle");
    await runA11yScan(page, "Buku Nilai Mahasiswa");

    // Navigasi melalui dropdown navbar kanan atas ke Profil & Akun Saya
    await page.locator('[data-testid="user-profile-menu-button"]').click();
    await page.locator('[role="menuitem"]:has-text("Profil & Akun Saya")').click();
    await page.waitForURL("**/poltekmi/profile", { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await runA11yScan(page, "Profil Mahasiswa");

    // Navigasi melalui dropdown navbar kanan atas ke Ganti Kata Sandi
    await page.locator('[data-testid="user-profile-menu-button"]').click();
    await page.locator('[role="menuitem"]:has-text("Ganti Kata Sandi")').click();
    await page.waitForURL("**/poltekmi/change-password", { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await runA11yScan(page, "Ganti Kata Sandi");

    // Verifikasi tepat satu tombol toggle mata pada masing-masing 3 input password
    await expect(page.locator('#currentPassword')).toBeVisible();
    await expect(page.locator('#newPassword')).toBeVisible();
    await expect(page.locator('#confirmPassword')).toBeVisible();

    await expect(page.locator('div.relative:has(#currentPassword) button')).toHaveCount(1);
    await expect(page.locator('div.relative:has(#newPassword) button')).toHaveCount(1);
    await expect(page.locator('div.relative:has(#confirmPassword) button')).toHaveCount(1);
  });

  test("4. Aksesibilitas Dosen: Dashboard, Split-Pane Kelas (Materi, Anggota, Tugas, Presensi, Nilai)", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("http://localhost:3000/poltekmi/login");
    await page.waitForLoadState("networkidle");
    await page.fill("#identifier", "dsn001");
    await page.fill("#password", "DSN001");
    await page.click('button[type="submit"]');

    await page.waitForURL("**/poltekmi/dashboard", { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await runA11yScan(page, "Dashboard Dosen");

    await page.goto("http://localhost:3000/poltekmi/classes");
    await page.waitForLoadState("networkidle");
    const classLink = page.locator('a[href*="/classes/"]').first();
    await classLink.click();
    await page.waitForLoadState("networkidle");
    await runA11yScan(page, "Detail Kelas Materi");

    const membersTab = page.locator('button:has-text("Anggota"), [role="tab"]:has-text("Anggota")');
    if (await membersTab.isVisible()) {
      await membersTab.click();
      await page.waitForTimeout(400);
      await runA11yScan(page, "Detail Kelas Anggota");
    }

    const assignmentsTab = page.locator('button:has-text("Tugas & Evaluasi"), [role="tab"]:has-text("Tugas & Evaluasi")');
    if (await assignmentsTab.isVisible()) {
      await assignmentsTab.click();
      await page.waitForTimeout(400);
      await runA11yScan(page, "Detail Kelas Tugas & Evaluasi");
    }

    const attendanceTab = page.locator('button:has-text("Presensi"), [role="tab"]:has-text("Presensi")');
    if (await attendanceTab.isVisible()) {
      await attendanceTab.click();
      await page.waitForTimeout(400);
      await runA11yScan(page, "Detail Kelas Presensi");
    }

    const gradebookTab = page.locator('button:has-text("Buku Nilai"), [role="tab"]:has-text("Buku Nilai")');
    if (await gradebookTab.isVisible()) {
      await gradebookTab.click();
      await page.waitForTimeout(400);
      await runA11yScan(page, "Detail Kelas Buku Nilai");
    }

    await page.goto("http://localhost:3000/poltekmi/schedule");
    await page.waitForLoadState("networkidle");
    await runA11yScan(page, "Jadwal Dosen");

    await page.goto("http://localhost:3000/poltekmi/assignments");
    await page.waitForLoadState("networkidle");
    await runA11yScan(page, "Tugas Dosen");
  });

  test("5. Aksesibilitas Admin: Dashboard, Pengguna, Akademik, Jadwal, Tugas & Pengaturan (Semua Tab)", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto("http://localhost:3000/poltekmi/login");
    await page.waitForLoadState("networkidle");
    await page.fill("#identifier", "adm001");
    await page.fill("#password", "ADM001");
    await page.click('button[type="submit"]');

    await page.waitForURL("**/poltekmi/dashboard", { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await runA11yScan(page, "Dashboard Admin");

    await page.goto("http://localhost:3000/poltekmi/admin/users");
    await page.waitForLoadState("networkidle");
    await runA11yScan(page, "Admin Pengguna");

    await page.goto("http://localhost:3000/poltekmi/admin/academic");
    await page.waitForLoadState("networkidle");
    await runA11yScan(page, "Admin Akademik");

    await page.goto("http://localhost:3000/poltekmi/schedule");
    await page.waitForLoadState("networkidle");
    await runA11yScan(page, "Jadwal Admin");

    await page.goto("http://localhost:3000/poltekmi/assignments");
    await page.waitForLoadState("networkidle");
    await runA11yScan(page, "Tugas Admin");

    // Pengaturan Tab 1: Identitas & Branding
    await page.goto("http://localhost:3000/poltekmi/admin/settings");
    await page.waitForLoadState("networkidle");
    await runA11yScan(page, "Pengaturan Institusi - Branding");

    // Pengaturan Tab 2: Format Nomor Induk (ID)
    const idgenTab = page.locator('button:has-text("Format Nomor Induk"), [role="tab"]:has-text("Format Nomor Induk")');
    if (await idgenTab.isVisible()) {
      await idgenTab.click();
      await page.waitForTimeout(400);
      await runA11yScan(page, "Pengaturan Institusi - Format ID");
    }

    // Pengaturan Tab 3: Log Audit Keamanan
    const auditTab = page.locator('button:has-text("Log Audit Keamanan"), [role="tab"]:has-text("Log Audit Keamanan")');
    if (await auditTab.isVisible()) {
      await auditTab.click();
      await page.waitForTimeout(400);
      await runA11yScan(page, "Pengaturan Institusi - Log Audit");
    }
  });
});
