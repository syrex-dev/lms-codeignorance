import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Allowlist rute API publik / non-tenant yang dikecualikan secara eksplisit dari requireSession.
 * Setiap rute baru di luar daftar ini WAJIB memanggil requireSession.
 */
const PUBLIC_API_ALLOWLIST = new Set([
  "src/app/api/auth/[...nextauth]/route.ts",
  "src/app/api/auth/otp/send/route.ts",
  "src/app/api/auth/otp/verify/route.ts",
  "src/app/api/auth/forgot-password/request/route.ts",
  "src/app/api/auth/forgot-password/reset/route.ts",
  "src/app/api/saas/signup/route.ts",
  "src/app/api/saas/tenants/[id]/setup/route.ts",
  "src/app/api/dev/outbox/route.ts",
  "src/app/api/platform/auth/login/route.ts",
  "src/app/api/platform/auth/verify-otp/route.ts",
  "src/app/api/platform/tenants/route.ts",
  "src/app/api/platform/tenants/[id]/impersonate/route.ts",
]);

function getAllRouteFiles(dir: string, baseDir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);

  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      results = results.concat(getAllRouteFiles(fullPath, baseDir));
    } else if (file === "route.ts" || file === "route.js") {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
      results.push(relPath);
    }
  }

  return results;
}

describe("Automated API Security Guard: requireSession Enforcement", () => {
  const projectRoot = path.resolve(__dirname, "../..");
  const apiDir = path.join(projectRoot, "src/app/api");
  const allRoutes = getAllRouteFiles(apiDir, projectRoot);

  it("Menemukan semua rute API yang terdaftar", () => {
    expect(allRoutes.length).toBeGreaterThanOrEqual(35);
  });

  it("Semua rute API non-publik WAJIB mengimpor dan memanggil requireSession", () => {
    const unguardedRoutes: string[] = [];

    for (const relPath of allRoutes) {
      if (PUBLIC_API_ALLOWLIST.has(relPath)) {
        continue;
      }

      const fullPath = path.join(projectRoot, relPath);
      const content = fs.readFileSync(fullPath, "utf-8");

      const hasRequireSessionCall =
        content.includes("requireSession(") &&
        (content.includes('from "@/lib/auth/guard"') || content.includes("from '@/lib/auth/guard'"));

      if (!hasRequireSessionCall) {
        unguardedRoutes.push(relPath);
      }
    }

    expect(
      unguardedRoutes,
      `Ditemukan rute API non-publik tanpa requireSession:\n${unguardedRoutes.join("\n")}`
    ).toEqual([]);
  });

  it("Semua rute dalam allowlist publik memang benar-benar ada di filesystem", () => {
    for (const allowedRoute of PUBLIC_API_ALLOWLIST) {
      const fullPath = path.join(projectRoot, allowedRoute);
      expect(fs.existsSync(fullPath), `Rute allowlist ${allowedRoute} harus ada di disk`).toBe(true);
    }
  });
});
