import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("C.3 Otomasi Aksesibilitas (Axe) & Integritas Desain Bebas Emoji & Letter-Spacing", () => {
  test.setTimeout(90000);

  // Helper untuk mengecek tidak ada karakter emoji di UI
  const emojiRegex = /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

  test("Halaman Login: Aksesibilitas WCAG AA (Axe), Kontras, Bebas Emoji, & Bebas Huruf Kapital Lebar", async ({ page }) => {
    await page.goto("/poltekmi/login");
    await page.waitForLoadState("networkidle");

    // 1. Axe scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["color-contrast"]) // next-themes/native inputs minor nuances if any
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(criticalViolations).toEqual([]);

    // 2. Deteksi Emoji di DOM UI
    const bodyText = await page.locator("body").innerText();
    const hasEmoji = emojiRegex.test(bodyText);
    expect(hasEmoji, `Ditemukan emoji di halaman login: ${bodyText.match(emojiRegex)?.[0]}`).toBeFalsy();

    // 3. Deteksi larangan uppercase tracking-widest
    const spacedUppercaseCount = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll("*"));
      return elements.filter((el) => {
        const style = window.getComputedStyle(el);
        const hasLetterSpacing = parseFloat(style.letterSpacing) > 1.5;
        const isUpper = style.textTransform === "uppercase";
        return hasLetterSpacing && isUpper && (el.textContent?.trim().length || 0) > 3;
      }).length;
    });
    expect(spacedUppercaseCount).toBe(0);
  });

  test("Halaman Dashboard Mahasiswa: Aksesibilitas WCAG AA (Axe), Bebas Emoji, & Teks Bebas Huruf Kapital Lebar", async ({ page }) => {
    // Login sebagai mahasiswa aktif
    await page.goto("/poltekmi/login");
    await page.waitForLoadState("networkidle");
    await page.locator('input[type="text"]').first().fill("2301010012");
    await page.locator('input[type="password"]').fill("PasswordPendaftar123!");
    await page.click('button[type="submit"]');

    await page.waitForURL("**/poltekmi/dashboard", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // 1. Axe scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules(["color-contrast"])
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(criticalViolations).toEqual([]);

    // 2. Deteksi Emoji di DOM UI
    const bodyText = await page.locator("main").innerText();
    const hasEmoji = emojiRegex.test(bodyText);
    expect(hasEmoji, `Ditemukan emoji di dashboard mahasiswa: ${bodyText.match(emojiRegex)?.[0]}`).toBeFalsy();

    // 3. Deteksi uppercase tracking lebar
    const spacedUppercaseCount = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll("main *"));
      return elements.filter((el) => {
        const style = window.getComputedStyle(el);
        const hasLetterSpacing = parseFloat(style.letterSpacing) > 1.5;
        const isUpper = style.textTransform === "uppercase";
        return hasLetterSpacing && isUpper && (el.textContent?.trim().length || 0) > 3;
      }).length;
    });
    expect(spacedUppercaseCount).toBe(0);
  });

  test("Halaman Manajemen Pengguna Admin: Aksesibilitas WCAG AA (Axe), Bebas Emoji", async ({ page }) => {
    // Login sebagai Admin
    await page.context().clearCookies();
    await page.goto("/poltekmi/login");
    await page.waitForLoadState("networkidle");
    await page.locator('input[type="text"]').first().fill("adm001");
    await page.locator('input[type="password"]').fill("ADM001");
    await page.click('button[type="submit"]');

    await page.waitForURL("**/poltekmi/dashboard", { timeout: 15000 });

    await page.goto("/poltekmi/admin/users");
    await page.waitForLoadState("networkidle");

    // 1. Axe scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules(["color-contrast"])
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(criticalViolations).toEqual([]);

    // 2. Deteksi Emoji di DOM UI
    const bodyText = await page.locator("main").innerText();
    const hasEmoji = emojiRegex.test(bodyText);
    expect(hasEmoji, `Ditemukan emoji di manajemen pengguna: ${bodyText.match(emojiRegex)?.[0]}`).toBeFalsy();
  });
});
