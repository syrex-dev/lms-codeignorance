import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Lewati static assets, upload files, dan route internal
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/uploads") ||
    pathname.startsWith("/dev") ||
    pathname === "/signup" ||
    pathname.startsWith("/platform") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Dapatkan token session NextAuth
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const segments = pathname.split("/").filter(Boolean);
  const possibleTenant = segments[0];

  const isLoginPage = pathname.endsWith("/login");
  const isOnboardingPage = pathname.endsWith("/onboarding");
  const isForgotPasswordPage = pathname.endsWith("/forgot-password");
  const isPublicAdmission = pathname.includes("/admission");

  // 1. Jika pengguna BELUM login
  if (!token) {
    // Rute publik yang diizinkan tanpa login: Landing page (/), login, onboarding, forgot password, admisi publik
    if (
      !isLoginPage &&
      !isOnboardingPage &&
      !isForgotPasswordPage &&
      !isPublicAdmission &&
      pathname !== "/"
    ) {
      const loginUrl = new URL(
        possibleTenant ? `/${possibleTenant}/login` : "/poltekmi/login",
        req.url
      );
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 2. Jika pengguna SUDAH login
  const tenantSlug = (token.tenantSlug as string) || possibleTenant || "poltekmi";
  const userStatus = token.status as string;
  const mustChangePassword = token.mustChangePassword as boolean;

  // A. Jika status PENDING_ACTIVATION atau mustChangePassword === true (Aktivasi Pertama)
  // Sesi bersifat ONBOARDING: HANYA boleh mengakses /[tenant]/onboarding dan signout
  if (userStatus === "PENDING_ACTIVATION" || mustChangePassword) {
    if (!isOnboardingPage) {
      const onboardingUrl = new URL(`/${tenantSlug}/onboarding`, req.url);
      return NextResponse.redirect(onboardingUrl);
    }
    return NextResponse.next();
  }

  // B. Jika pengguna SUDAH ACTIVE dan mustChangePassword === false tapi mencoba akses login atau onboarding
  if (isLoginPage || isOnboardingPage) {
    const dashboardUrl = new URL(`/${tenantSlug}/dashboard`, req.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
