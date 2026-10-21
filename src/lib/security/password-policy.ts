import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";

const COMMON_PASSWORDS = new Set([
  "password", "password123", "admin123", "12345678", "123456789", "qwerty123",
  "indonesia", "rahasia", "rahasia123", "merdeka123", "poltekmi123", "sman1jakarta"
]);

export interface PasswordValidationContext {
  identifier?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  birthDate?: Date | null;
  initialPassword?: string;
  userId?: string;
}

export interface PasswordValidationResult {
  isValid: boolean;
  message?: string;
}

/**
 * Validasi ketat kebijakan password sesuai spesifikasi:
 * - Minimal 8 karakter
 * - Kombinasi huruf dan angka
 * - Tidak boleh sama dengan ID, email, nama, tanggal lahir, nomor HP, password awal
 * - Tidak boleh termasuk password umum
 * - Tidak boleh sama dengan N password terakhir (default 3)
 */
export async function validatePasswordPolicy(
  newPassword: string,
  context: PasswordValidationContext = {}
): Promise<PasswordValidationResult> {
  if (!newPassword || newPassword.length < 8) {
    return {
      isValid: false,
      message: "Password baru harus memiliki minimal 8 karakter.",
    };
  }

  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasDigit = /\d/.test(newPassword);

  if (!hasLetter || !hasDigit) {
    return {
      isValid: false,
      message: "Password baru harus berupa kombinasi huruf dan angka.",
    };
  }

  const lowerNew = newPassword.toLowerCase();

  // Cek terhadap daftar password umum
  if (COMMON_PASSWORDS.has(lowerNew)) {
    return {
      isValid: false,
      message: "Password terlalu umum dan mudah ditebak. Gunakan kombinasi yang lebih unik.",
    };
  }

  // Cek terhadap ID pengguna
  if (context.identifier && lowerNew === context.identifier.toLowerCase()) {
    return {
      isValid: false,
      message: "Password baru tidak boleh sama dengan ID pengguna Anda.",
    };
  }

  // Cek terhadap email
  if (context.email && lowerNew === context.email.toLowerCase()) {
    return {
      isValid: false,
      message: "Password baru tidak boleh sama dengan alamat email Anda.",
    };
  }

  // Cek terhadap nama
  if (context.fullName) {
    const nameParts = context.fullName.toLowerCase().split(/\s+/).filter((p) => p.length > 2);
    for (const part of nameParts) {
      if (lowerNew.includes(part)) {
        return {
          isValid: false,
          message: "Password baru tidak boleh memuat nama lengkap atau nama panggilan Anda.",
        };
      }
    }
  }

  // Cek terhadap nomor HP
  if (context.phone) {
    const rawPhoneDigits = context.phone.replace(/\D/g, "");
    if (rawPhoneDigits.length >= 6 && lowerNew.includes(rawPhoneDigits.slice(-6))) {
      return {
        isValid: false,
        message: "Password baru tidak boleh memuat nomor handphone Anda.",
      };
    }
  }

  // Cek terhadap tanggal lahir (misal YYYYMMDD atau DDMMYYYY)
  if (context.birthDate) {
    const d = context.birthDate;
    const yyyy = d.getFullYear().toString();
    const mm = (d.getMonth() + 1).toString().padStart(2, "0");
    const dd = d.getDate().toString().padStart(2, "0");

    const formats = [
      `${yyyy}${mm}${dd}`,
      `${dd}${mm}${yyyy}`,
      `${yyyy}-${mm}-${dd}`,
      `${dd}-${mm}-${yyyy}`,
    ];

    for (const fmt of formats) {
      if (lowerNew.includes(fmt)) {
        return {
          isValid: false,
          message: "Password baru tidak boleh memuat tanggal lahir Anda.",
        };
      }
    }
  }

  // Cek terhadap password awal
  if (context.initialPassword && lowerNew === context.initialPassword.toLowerCase()) {
    return {
      isValid: false,
      message: "Password baru tidak boleh sama dengan password awal Anda.",
    };
  }

  // Cek terhadap N riwayat password terakhir (default 3) jika userId disertakan
  if (context.userId) {
    const recentHistories = await prisma.passwordHistory.findMany({
      where: { userId: context.userId },
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    for (const hist of recentHistories) {
      const match = await bcrypt.compare(newPassword, hist.passwordHash);
      if (match) {
        return {
          isValid: false,
          message: "Password baru tidak boleh sama dengan 3 password terakhir yang pernah digunakan.",
        };
      }
    }
  }

  return { isValid: true };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export const validateNewPassword = validatePasswordPolicy;
