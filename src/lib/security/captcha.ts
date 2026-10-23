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
 * MockCaptchaVerifier: Hanya aktif jika NODE_ENV !== "production" DAN flag eksplisit ALLOW_MOCK_CAPTCHA="true"
 */
export class MockCaptchaVerifier implements CaptchaVerifier {
  async verify(token?: string, remoteIp?: string): Promise<CaptchaVerifyResult> {
    // 2.b: Di lingkungan produksi, mock SELALU ditolak keras (fail-closed)
    if (process.env.NODE_ENV === "production") {
      return {
        success: false,
        error: "Mock captcha ditolak keras di lingkungan produksi (fail closed).",
      };
    }

    // Hanya aktif bila flag eksplisit ALLOW_MOCK_CAPTCHA diset true
    if (process.env.ALLOW_MOCK_CAPTCHA !== "true") {
      return {
        success: false,
        error: "Mock captcha dinonaktifkan. Diperlukan konfigurasi eksplisit ALLOW_MOCK_CAPTCHA=true.",
      };
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
 * Cloudflare Turnstile Adapter: Verifier produksi sesungguhnya.
 */
export class CloudflareTurnstileVerifier implements CaptchaVerifier {
  private secretKey: string;

  constructor(secretKey?: string) {
    this.secretKey = secretKey ?? (process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || "");
  }

  async verify(token?: string, remoteIp?: string): Promise<CaptchaVerifyResult> {
    // 2.b: Tanpa secret Turnstile di produksi, verifikasi HARUS gagal tertutup (fail closed)
    if (!this.secretKey) {
      if (process.env.NODE_ENV === "production") {
        return {
          success: false,
          error: "CLOUDFLARE_TURNSTILE_SECRET_KEY tidak terkonfigurasi di produksi (gagal tertutup / fail-closed).",
        };
      }
      return new MockCaptchaVerifier().verify(token, remoteIp);
    }

    if (!token) {
      return { success: false, error: "Token captcha Turnstile tidak ditemukan." };
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
  if (process.env.NODE_ENV === "production" || process.env.CAPTCHA_PROVIDER === "turnstile" || process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY) {
    return new CloudflareTurnstileVerifier();
  }
  return new MockCaptchaVerifier();
}

export async function verifyCaptcha(token?: string, remoteIp?: string): Promise<CaptchaVerifyResult> {
  const verifier = getCaptchaVerifier();
  return verifier.verify(token, remoteIp);
}
