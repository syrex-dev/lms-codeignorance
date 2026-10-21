import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

/**
 * Hash plain password using bcrypt
 */
export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

/**
 * Verify plain password against hashed password
 */
export async function verifyPassword(
  plainText: string,
  hashed: string
): Promise<boolean> {
  return bcrypt.compare(plainText, hashed);
}

/**
 * Validate new password compliance
 * - Minimal 8 karakter
 * - Tidak boleh sama dengan identifier / ID pengguna
 * - Mengandung kombinasi huruf dan angka
 */
export function validateNewPassword(
  password: string,
  identifier: string
): { isValid: boolean; message?: string } {
  if (!password || password.length < 8) {
    return {
      isValid: false,
      message: "Password baru harus memiliki panjang minimal 8 karakter.",
    };
  }

  if (password.toLowerCase() === identifier.toLowerCase()) {
    return {
      isValid: false,
      message: "Password baru tidak boleh sama dengan ID pengguna Anda.",
    };
  }

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasLetter || !hasNumber) {
    return {
      isValid: false,
      message: "Password baru harus mengandung kombinasi huruf dan angka.",
    };
  }

  return { isValid: true };
}
