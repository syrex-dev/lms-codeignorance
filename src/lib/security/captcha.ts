export interface CaptchaVerifyResult {
  success: boolean;
  error?: string;
  challengeTs?: string;
  hostname?: string;
}

export interface CaptchaVerifier {
  verify(token?: string, remoteIp?: string): Promise<CaptchaVerifyResult>;
}

/**
 * MockCaptchaVerifier: Digunakan pada lingkungan testing & development.
 * Menerima token mock atau lolos otomatis saat development.
 */
export class MockCaptchaVerifier implements CaptchaVerifier {
  async verify(token?: string, remoteIp?: string): Promise<CaptchaVerifyResult> {
    if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
      return { success: true };
    }

    if (token === "mock-valid-captcha-token" || token === "pass") {
      return { success: true };
    }

    if (!token) {
      return { success: false, error: "Captcha token is required" };
    }

    return { success: true };
  }
}

/**
 * Cloudflare Turnstile Adapter: Siap pakai untuk lingkungan produksi.
 */
export class CloudflareTurnstileVerifier implements CaptchaVerifier {
  private secretKey: string;

  constructor() {
    this.secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || "";
  }

  async verify(token?: string, remoteIp?: string): Promise<CaptchaVerifyResult> {
    if (!token) {
      return { success: false, error: "Token captcha Turnstile tidak ditemukan." };
    }

    if (!this.secretKey) {
      // Jika secret key belum diset di env, fallback ke MockVerifier dengan peringatan
      console.warn("CLOUDFLARE_TURNSTILE_SECRET_KEY belum diset. Menggunakan MockCaptchaVerifier fallback.");
      return new MockCaptchaVerifier().verify(token, remoteIp);
    }

    try {
      const formData = new URLSearchParams();
      formData.append("secret", this.secretKey);
      formData.append("response", token);
      if (remoteIp) {
        formData.append("remoteip", remoteIp);
      }

      const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        body: formData,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const outcome = await res.json();
      if (!outcome.success) {
        return {
          success: false,
          error: (outcome["error-codes"] || []).join(", ") || "Verifikasi captcha gagal",
        };
      }

      return {
        success: true,
        challengeTs: outcome.challenge_ts,
        hostname: outcome.hostname,
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message || "Gagal menghubungi server verifikasi captcha Cloudflare",
      };
    }
  }
}

export function getCaptchaVerifier(): CaptchaVerifier {
  if (process.env.CAPTCHA_PROVIDER === "turnstile" || process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY) {
    return new CloudflareTurnstileVerifier();
  }
  return new MockCaptchaVerifier();
}

export async function verifyCaptcha(token?: string, remoteIp?: string): Promise<CaptchaVerifyResult> {
  const verifier = getCaptchaVerifier();
  return verifier.verify(token, remoteIp);
}
