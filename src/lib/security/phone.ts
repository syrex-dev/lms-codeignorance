/**
 * Utilitas normalisasi dan masking nomor HP format E.164
 */

export function normalizePhoneE164(phone: string, defaultCountryCode: string = "+62"): string {
  if (!phone) return "";

  // Hapus semua karakter non-digit dan non-plus
  let cleaned = phone.trim().replace(/[^\d+]/g, "");

  if (cleaned.startsWith("+")) {
    return cleaned;
  }

  if (cleaned.startsWith("62")) {
    return `+${cleaned}`;
  }

  if (cleaned.startsWith("0")) {
    return `+62${cleaned.slice(1)}`;
  }

  if (cleaned.startsWith("8")) {
    return `+62${cleaned}`;
  }

  return `${defaultCountryCode}${cleaned}`;
}

export function isValidIndonesianPhone(phoneE164: string): boolean {
  // Format standar Indonesia: +628 diikuti 8-12 digit
  const idRegex = /^\+628\d{8,12}$/;
  return idRegex.test(phoneE164);
}

export function maskPhoneNumber(phoneE164: string): string {
  if (!phoneE164) return "";

  const normalized = normalizePhoneE164(phoneE164);
  if (normalized.length <= 6) return normalized;

  // Contoh: +6281234567890 -> +62 812-****-7890
  const prefix = normalized.slice(0, 6);
  const suffix = normalized.slice(-4);
  return `${prefix}-****-${suffix}`;
}
