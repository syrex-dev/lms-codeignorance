import { sendOtpWithFallback } from "@/modules/otp/sender";
import { OtpChannel } from "@prisma/client";

export interface AccountCardData {
  fullName: string;
  id: string;
  loginEmail: string;
  initialPasswordMode: "SAME_AS_ID" | "RANDOM";
  initialPasswordPlain?: string; // HANYA ada saat pembuatan mode RANDOM
  classNameOrProdi?: string;
  institutionName: string;
  tenantSlug: string;
}

/**
 * Sanitasi string untuk proteksi CSV Injection (Formula Injection)
 * Karakter berbahaya: = + - @ pada awal sel harus di-escape dengan tanda kutip tunggal (')
 */
export function sanitizeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

export class AccountCardService {
  /**
   * Format teks petunjuk aktivasi
   */
  static getActivationInstructions(card: AccountCardData): string {
    const pwdInstruction =
      card.initialPasswordMode === "RANDOM" && card.initialPasswordPlain
        ? `Gunakan password acak sementara Anda: ${card.initialPasswordPlain}`
        : "Gunakan password awal yang sama dengan ID/NIM/NIS Anda.";

    return (
      `PETUNJUK AKTIVASI AKUN LMS:\n` +
      `1. Buka halaman login di: https://${card.tenantSlug}.lms.local/login atau pilih institusi ${card.institutionName}\n` +
      `2. Masukkan ID (${card.id}) atau Email Login (${card.loginEmail})\n` +
      `3. ${pwdInstruction}\n` +
      `4. Anda akan diarahkan ke halaman Aktivasi Pertama untuk memverifikasi nomor handphone via OTP (WhatsApp/SMS).\n` +
      `5. Tetapkan password baru Anda yang aman.`
    );
  }

  /**
   * Ekspor kartu akun ke format CSV dengan proteksi CSV Injection
   */
  static exportToCsv(cards: AccountCardData[]): string {
    const headers = [
      "Nama Lengkap",
      "ID / NIM / NIS",
      "Email Login Virtual",
      "Kelas / Program Studi",
      "Password Awal",
      "Petunjuk Aktivasi",
    ];

    const rows = cards.map((c) => {
      const pwdValue =
        c.initialPasswordMode === "RANDOM" && c.initialPasswordPlain
          ? c.initialPasswordPlain
          : "Sama dengan ID";

      return [
        sanitizeCsvCell(c.fullName),
        sanitizeCsvCell(c.id),
        sanitizeCsvCell(c.loginEmail),
        sanitizeCsvCell(c.classNameOrProdi || "-"),
        sanitizeCsvCell(pwdValue),
        sanitizeCsvCell("Wajib aktivasi pertama saat login awal"),
      ]
        .map((cell) => `"${cell.replace(/"/g, '""')}"`)
        .join(",");
    });

    return [headers.join(","), ...rows].join("\n");
  }

  /**
   * Kirim notifikasi aktivasi ke nomor HP (tanpa membocorkan password)
   */
  static async sendActivationNotice(
    destinationE164: string,
    card: AccountCardData,
    channel: OtpChannel = OtpChannel.WHATSAPP
  ) {
    const message =
      `${card.institutionName}: Halo ${card.fullName}, akun LMS Anda telah dibuat. ` +
      `ID: ${card.id}, Login: ${card.loginEmail}. ` +
      `Silakan login di portal institusi dan selesaikan aktivasi pertama Anda.`;

    return sendOtpWithFallback(channel, destinationE164, message, "NOTICE", {
      institutionSlug: card.tenantSlug,
      purpose: "ACCOUNT_ACTIVATION_NOTICE",
    });
  }
}
