import crypto from "crypto";
import path from "path";
import { checkLimit } from "@/modules/saas/entitlement";
import { prisma } from "@/lib/db/prisma";

export interface FileValidationResult {
  isValid: boolean;
  detectedMimeType?: string;
  sanitizedFileName: string;
  error?: string;
}

export interface IVirusScanner {
  scanBuffer(buffer: Buffer, filename: string): Promise<{ isClean: boolean; threatName?: string }>;
}

export class StubVirusScanner implements IVirusScanner {
  async scanBuffer(_buffer: Buffer, _filename: string): Promise<{ isClean: boolean; threatName?: string }> {
    // Stub virus scanner interface (dapat diintegrasikan ke ClamAV / VirusTotal / Cloud AV di fase produksi)
    return { isClean: true };
  }
}

export const defaultVirusScanner: IVirusScanner = new StubVirusScanner();

/**
 * Deteksi MIME type berbasis Magic Bytes header berkas
 */
export function detectMimeTypeFromMagicBytes(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 4) return null;

  // 1. Executables (DILARANG KERAS)
  if (buffer[0] === 0x4D && buffer[1] === 0x5A) {
    return "application/x-msdownload"; // EXE / DLL
  }
  if (buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) {
    return "application/x-executable"; // ELF Linux
  }

  // 2. PDF (%PDF-)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return "application/pdf";
  }

  // 3. PNG
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
    buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A
  ) {
    return "image/png";
  }

  // 4. JPEG
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return "image/jpeg";
  }

  // 5. GIF
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 &&
    buffer[3] === 0x38 && (buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61
  ) {
    return "image/gif";
  }

  // 6. ZIP / Office OpenXML (DOCX, PPTX, XLSX)
  if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return "application/zip"; // atau DOCX/XLSX/PPTX
  }

  // 7. Legacy Microsoft Office (DOC, PPT, XLS) - OLE Compound File
  if (
    buffer.length >= 8 &&
    buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0 &&
    buffer[4] === 0xA1 && buffer[5] === 0xB1 && buffer[6] === 0x1A && buffer[7] === 0xE1
  ) {
    return "application/x-ole-storage";
  }

  // 8. Plain Text / Markdown / CSV
  let isAsciiOrUtf8 = true;
  const checkLen = Math.min(buffer.length, 512);
  for (let i = 0; i < checkLen; i++) {
    const byte = buffer[i];
    // Karakter kontrol selain tab, CR, LF
    if (byte < 0x09 || (byte > 0x0A && byte < 0x0D) || (byte > 0x0D && byte < 0x20)) {
      isAsciiOrUtf8 = false;
      break;
    }
  }

  if (isAsciiOrUtf8) {
    return "text/plain";
  }

  return null;
}

/**
 * Sanitasi nama file untuk mencegah directory traversal dan karakter berbahaya
 */
export function sanitizeFileName(originalName: string): string {
  if (!originalName) return "file_attachment";

  // Ambil hanya basename (buang path prefix seperti ../, /etc/, C:\)
  const base = path.basename(originalName);

  // Buang null byte dan karakter kontrol
  const clean = base.replace(/[\x00-\x1f\x7f]/g, "");

  // Buang karakter berbahaya untuk sistem berkas OS
  const safe = clean.replace(/[<>:"/\\|?*]/g, "_");

  // Jika nama kosong setelah dibersihkan
  if (!safe || safe === "." || safe === "..") {
    return "file_attachment";
  }

  return safe;
}

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB per file

const ALLOWED_EXTENSIONS_MAP: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".gif": ["image/gif"],
  ".docx": ["application/zip"], // DOCX adalah format ZIP terkompresi
  ".pptx": ["application/zip"], // PPTX adalah format ZIP terkompresi
  ".xlsx": ["application/zip"], // XLSX adalah format ZIP terkompresi
  ".zip": ["application/zip"],
  ".doc": ["application/x-ole-storage"],
  ".ppt": ["application/x-ole-storage"],
  ".xls": ["application/x-ole-storage"],
  ".txt": ["text/plain"],
  ".csv": ["text/plain"],
};

/**
 * Validasi mendalam file materi (ekstensi, ukuran, magic bytes, virus scan)
 */
export async function validateMaterialFile(
  buffer: Buffer,
  fileName: string,
  virusScanner: IVirusScanner = defaultVirusScanner
): Promise<FileValidationResult> {
  const sanitized = sanitizeFileName(fileName);

  // 1. Validasi ukuran berkas
  if (!buffer || buffer.length === 0) {
    return { isValid: false, sanitizedFileName: sanitized, error: "Berkas kosong tidak dapat diunggah." };
  }
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      sanitizedFileName: sanitized,
      error: `Ukuran berkas melebihi batas maksimal ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
    };
  }

  // 2. Ekstensi
  const ext = path.extname(sanitized).toLowerCase();
  if (!ALLOWED_EXTENSIONS_MAP[ext]) {
    return {
      isValid: false,
      sanitizedFileName: sanitized,
      error: `Ekstensi '${ext}' tidak didukung. Format yang diizinkan: PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, gambar, teks, dan ZIP.`,
    };
  }

  // 3. Deteksi Magic Bytes
  const detectedMime = detectMimeTypeFromMagicBytes(buffer);
  if (!detectedMime) {
    return {
      isValid: false,
      sanitizedFileName: sanitized,
      error: "Format berkas tidak dikenali atau rusak (magic bytes mismatch).",
    };
  }

  // Larang keras executable (meskipun ekstensi sengaja diubah menjadi .pdf atau .png)
  if (detectedMime === "application/x-msdownload" || detectedMime === "application/x-executable") {
    return {
      isValid: false,
      sanitizedFileName: sanitized,
      error: "Berkas program/executable terdeteksi berbahaya dan ditolak (magic bytes mismatch).",
    };
  }

  // Pastikan MIME type cocok dengan ekstensi
  const allowedMimesForExt = ALLOWED_EXTENSIONS_MAP[ext];
  if (!allowedMimesForExt.includes(detectedMime)) {
    return {
      isValid: false,
      sanitizedFileName: sanitized,
      error: `Isi berkas tidak cocok dengan ekstensi ${ext} (terdeteksi sebagai ${detectedMime}).`,
    };
  }

  // 4. Virus Scan
  const scanResult = await virusScanner.scanBuffer(buffer, sanitized);
  if (!scanResult.isClean) {
    return {
      isValid: false,
      sanitizedFileName: sanitized,
      error: `Berkas ditolak: Terdeteksi ancaman virus/malware (${scanResult.threatName || "Infected"}).`,
    };
  }

  return {
    isValid: true,
    detectedMimeType: detectedMime,
    sanitizedFileName: sanitized,
  };
}

/**
 * Validasi kuota penyimpanan tenant SaaS (maxStorageMb)
 */
export async function checkTenantStorageQuota(
  institutionId: string,
  additionalBytes: number
): Promise<{ allowed: boolean; usedMb: number; maxMb: number; message?: string }> {
  const additionalMb = Math.ceil(additionalBytes / (1024 * 1024));

  // Hitung total pemakaian storage saat ini dari tabel MaterialFile
  const storageAgg = await prisma.materialFile.aggregate({
    where: { institutionId },
    _sum: { fileSize: true },
  });

  const currentTotalBytes = storageAgg._sum.fileSize || 0;
  const currentUsedMb = Math.ceil(currentTotalBytes / (1024 * 1024));
  const targetUsedMb = currentUsedMb + additionalMb;

  const quotaResult = await checkLimit(institutionId, "maxStorageMb", targetUsedMb);

  if (!quotaResult.allowed) {
    return {
      allowed: false,
      usedMb: currentUsedMb,
      maxMb: quotaResult.maxAllowed || 0,
      message: `Kapasitas penyimpanan tenant Anda telah melebihi batas paket (${quotaResult.current}MB / ${quotaResult.maxAllowed}MB). Harap upgrade paket Anda.`,
    };
  }

  return {
    allowed: true,
    usedMb: currentUsedMb,
    maxMb: quotaResult.maxAllowed || 0,
  };
}

// =========================================================================
// SIGNED URL UNTUK PENGUNDUHAN BERKAS
// =========================================================================

export interface SignedFilePayload {
  fileId: string;
  materialId: string;
  classCourseId: string;
  institutionId: string;
  userId: string;
  expiresAt: number; // Unix timestamp in seconds
}

const SIGN_SECRET = process.env.NEXTAUTH_SECRET || "classroom-signed-url-secret-key-2026";

/**
 * Menghasilkan signed download token berbatas waktu singkat (default 15 menit)
 */
export function generateSignedFileToken(payload: Omit<SignedFilePayload, "expiresAt">, ttlSeconds: number = 900): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const fullPayload: SignedFilePayload = {
    ...payload,
    expiresAt,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SIGN_SECRET)
    .update(payloadBase64)
    .digest("base64url");

  return `${payloadBase64}.${signature}`;
}

/**
 * Memverifikasi integritas signed download token
 */
export function verifySignedFileToken(token: string): SignedFilePayload | null {
  if (!token || !token.includes(".")) return null;

  const [payloadBase64, providedSignature] = token.split(".");
  if (!payloadBase64 || !providedSignature) return null;

  // Verifikasi HMAC signature
  const expectedSignature = crypto
    .createHmac("sha256", SIGN_SECRET)
    .update(payloadBase64)
    .digest("base64url");

  // Constant-time comparison untuk mencegah timing attack
  try {
    const a = Buffer.from(providedSignature);
    const b = Buffer.from(expectedSignature);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }
  } catch {
    return null;
  }

  // Parse payload
  try {
    const jsonStr = Buffer.from(payloadBase64, "base64url").toString("utf-8");
    const payload: SignedFilePayload = JSON.parse(jsonStr);

    const now = Math.floor(Date.now() / 1000);
    if (payload.expiresAt < now) {
      return null; // Token kedaluwarsa
    }

    return payload;
  } catch {
    return null;
  }
}
