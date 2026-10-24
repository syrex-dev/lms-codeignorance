import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Lewati static assets dan file uploads HANYA jika BUKAN di bawah /api
  if (!pathname.startsWith("/api/")) {
    const isStaticAsset =
      pathname.startsWith("/_next/") ||
      pathname.startsWith("/uploads/") ||
      pathname === "/favicon.ico" ||
      /\.(png|jpe?g|gif|svg|ico|webp|avif|woff2?|ttf|eot|css|js|map)$/i.test(pathname);

    if (isStaticAsset) {
      return NextResponse.next();
    }
  }

  // 2. Proteksi khusus /dev/outbox (halaman) dan /api/dev/outbox (API):
  // HANYA bila NODE_ENV !== "production" DAN DEV_OTP_OUTBOX === "true", selain itu 404
  if (
    pathname === "/dev/outbox" ||
    pathname.startsWith("/dev/outbox/") ||
    pathname === "/api/dev/outbox" ||
    pathname.startsWith("/api/dev/outbox/")
  ) {
    const isAllowed =
      process.env.NODE_ENV !== "production" &&
      process.env.DEV_OTP_OUTBOX === "true";

    if (!isAllowed) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }
    return NextResponse.next();
  }

  // 3. Rute API publik spesifik yang diizinkan tanpa autentikasi awal
  const isPublicApi =
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/saas/signup" ||
    (pathname.startsWith("/api/saas/tenants/") && pathname.endsWith("/setup")) ||
    pathname.startsWith("/api/platform/auth/");

  // 4. Rute halaman publik tanpa autentikasi
  const segments = pathname.split("/").filter(Boolean);
  const possibleTenant = segments[0];

  const isLoginPage = pathname.endsWith("/login");
  const isOnboardingPage = pathname.endsWith("/onboarding");
  const isForgotPasswordPage = pathname.endsWith("/forgot-password");
  const isPublicAdmission = pathname.includes("/admission");
  const isPlatformPage = pathname.startsWith("/platform");
  const isLandingPage = pathname === "/" || pathname === "/signup";

  // Dapatkan token JWT NextAuth
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // A. PENGGUNA BELUM LOGIN
  if (!token) {
    // Jika rute API non-publik dipanggil tanpa token -> 401 Unauthorized
    if (pathname.startsWith("/api/")) {
      if (!isPublicApi) {
        return NextResponse.json(
          { error: "UNAUTHORIZED", message: "Autentikasi diperlukan." },
          { status: 401 }
        );
      }
      return NextResponse.next();
    }

    // Jika halaman butuh login -> redirect ke halaman login
    if (
      !isLoginPage &&
      !isOnboardingPage &&
      !isForgotPasswordPage &&
      !isPublicAdmission &&
      !isPlatformPage &&
      !isLandingPage
    ) {
      const loginUrl = new URL(
        possibleTenant ? `/${possibleTenant}/login` : "/poltekmi/login",
        req.url
      );
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  // B. PENGGUNA SUDAH LOGIN
  const userTenantSlug = token.tenantSlug as string | undefined;
  const userStatus = token.status as string;
  const mustChangePassword = token.mustChangePassword as boolean;
  const tenantStatus = token.tenantStatus as string | undefined;

  // Isolasi tenant di URL:
  // User tenant poltekmi membuka /sman1/... (halaman dan API) harus ditolak (redirect atau 404)
  const nonTenantRoots = ["api", "platform", "dev", "signup", "_next", "uploads", "favicon.ico"];
  if (possibleTenant && !nonTenantRoots.includes(possibleTenant)) {
    if (userTenantSlug && possibleTenant !== userTenantSlug) {
      if (pathname.startsWith("/api/") || pathname.includes("/api/")) {
        return NextResponse.json(
          { error: "TENANT_MISMATCH", message: "Akses lintas tenant ditolak." },
          { status: 404 }
        );
      }
      const tenantDashboardUrl = new URL(`/${userTenantSlug}/dashboard`, req.url);
      return NextResponse.redirect(tenantDashboardUrl);
    }
  }

  const tenantSlug = userTenantSlug || possibleTenant || "poltekmi";

  // Gerbang Tenant SUSPENDED / CANCELED
  if (tenantStatus === "SUSPENDED" || tenantStatus === "CANCELED") {
    // Untuk API: tolak semua metode tulis (POST, PUT, PATCH, DELETE)
    if (pathname.startsWith("/api/")) {
      const writeMethods = ["POST", "PUT", "PATCH", "DELETE"];
      if (writeMethods.includes(req.method.toUpperCase())) {
        return NextResponse.json(
          {
            error: "TENANT_SUSPENDED",
            message: "Tenant sedang dalam penangguhan. Operasi tulis ditolak.",
          },
          { status: 403 }
        );
      }
      return NextResponse.next();
    }

    // Untuk halaman web: alihkan ke status page jika bukan halaman status/logout
    if (!pathname.endsWith("/status") && !pathname.endsWith("/logout")) {
      const statusUrl = new URL(`/${tenantSlug}/status`, req.url);
      return NextResponse.redirect(statusUrl);
    }
  }

  // Gerbang Onboarding: Akun PENDING_ACTIVATION atau mustChangePassword === true
  if (userStatus === "PENDING_ACTIVATION" || mustChangePassword) {
    // Jika memanggil API selain API otentikasi/onboarding -> 403 Forbidden
    if (pathname.startsWith("/api/")) {
      const allowedOnboardingApis = [
        "/api/auth/",
        "/api/dev/outbox",
      ];
      const isAllowed = allowedOnboardingApis.some((p) => pathname.startsWith(p));
      if (!isAllowed) {
        return NextResponse.json(
          {
            error: "ONBOARDING_REQUIRED",
            message: "Akun harus menyelesaikan aktivasi dan onboarding terlebih dahulu.",
          },
          { status: 403 }
        );
      }
      return NextResponse.next();
    }

    // Jika membuka halaman selain onboarding -> paksa redirect ke /onboarding
    if (!isOnboardingPage) {
      const onboardingUrl = new URL(`/${tenantSlug}/onboarding`, req.url);
      return NextResponse.redirect(onboardingUrl);
    }
    return NextResponse.next();
  }

  // Pengguna ACTIVE yang sudah selesai onboarding mencoba buka login atau onboarding -> redirect dashboard
  if (isLoginPage || isOnboardingPage) {
    const dashboardUrl = new URL(`/${tenantSlug}/dashboard`, req.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
