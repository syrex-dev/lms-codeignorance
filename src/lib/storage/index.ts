import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export interface StorageUploadResult {
  url: string;
  signedUrl: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  tenantId: string;
}

export interface StorageService {
  uploadFile(
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    tenantId: string,
    subfolder?: string
  ): Promise<StorageUploadResult>;

  deleteFile(fileUrl: string, tenantId: string): Promise<boolean>;

  generateSignedUrl(filePath: string, tenantId: string, expiresInSeconds?: number): string;

  validateSignedUrl(signedUrl: string, expectedTenantId: string): {
    valid: boolean;
    filePath?: string;
    error?: string;
  };
}

const SIGNING_SECRET = process.env.NEXTAUTH_SECRET || "storage-fallback-secret-minimum-32-chars";

class LocalStorageService implements StorageService {
  private uploadDir: string;

  constructor() {
    this.uploadDir =
      process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
  }

  async uploadFile(
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    tenantId: string,
    subfolder: string = "general"
  ): Promise<StorageUploadResult> {
    if (!tenantId || tenantId.trim() === "") {
      throw new Error("Tenant isolation error: upload requires tenantId prefix");
    }

    const cleanTenantId = tenantId.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
    const targetFolder = path.join(this.uploadDir, cleanTenantId, subfolder);
    await fs.mkdir(targetFolder, { recursive: true });

    const timestamp = Date.now();
    const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueFileName = `${timestamp}-${safeName}`;
    const destinationPath = path.join(targetFolder, uniqueFileName);

    await fs.writeFile(destinationPath, fileBuffer);

    const relativeUrl = `/uploads/${cleanTenantId}/${subfolder}/${uniqueFileName}`;
    const signedUrl = this.generateSignedUrl(relativeUrl, cleanTenantId);

    return {
      url: relativeUrl,
      signedUrl,
      filePath: relativeUrl,
      fileName: originalName,
      fileSize: fileBuffer.length,
      mimeType,
      tenantId: cleanTenantId,
    };
  }

  async deleteFile(fileUrl: string, tenantId: string): Promise<boolean> {
    try {
      if (!fileUrl.startsWith("/uploads/")) {
        return false;
      }

      const cleanTenantId = tenantId.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
      const relativePath = fileUrl.replace("/uploads/", "");
      
      // Keamanan: Cegah penghapusan file di luar prefix tenant
      if (!relativePath.startsWith(`${cleanTenantId}/`)) {
        throw new Error("Unauthorized: Tenant cannot delete files outside its tenant prefix");
      }

      const fullPath = path.join(this.uploadDir, relativePath);
      await fs.unlink(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  generateSignedUrl(filePath: string, tenantId: string, expiresInSeconds: number = 3600): string {
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const cleanTenantId = tenantId.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
    
    const payload = `${cleanTenantId}:${filePath}:${expiresAt}`;
    const signature = crypto
      .createHmac("sha256", SIGNING_SECRET)
      .update(payload)
      .digest("hex");

    return `/api/storage/file?path=${encodeURIComponent(filePath)}&tenant=${encodeURIComponent(cleanTenantId)}&expires=${expiresAt}&signature=${signature}`;
  }

  validateSignedUrl(signedUrl: string, expectedTenantId: string): {
    valid: boolean;
    filePath?: string;
    error?: string;
  } {
    try {
      const url = new URL(signedUrl, "http://localhost");
      const filePath = url.searchParams.get("path");
      const tenant = url.searchParams.get("tenant");
      const expires = url.searchParams.get("expires");
      const signature = url.searchParams.get("signature");

      if (!filePath || !tenant || !expires || !signature) {
        return { valid: false, error: "Missing signed URL parameters" };
      }

      // Verifikasi kesesuaian tenant
      if (tenant !== expectedTenantId) {
        return { valid: false, error: "Cross-tenant access denied: signed URL belongs to different tenant" };
      }

      // Verifikasi kedaluwarsa
      const now = Math.floor(Date.now() / 1000);
      if (parseInt(expires, 10) < now) {
        return { valid: false, error: "Signed URL has expired" };
      }

      // Verifikasi HMAC signature
      const expectedPayload = `${tenant}:${filePath}:${expires}`;
      const expectedSignature = crypto
        .createHmac("sha256", SIGNING_SECRET)
        .update(expectedPayload)
        .digest("hex");

      if (signature !== expectedSignature) {
        return { valid: false, error: "Invalid signature" };
      }

      return { valid: true, filePath };
    } catch (e: any) {
      return { valid: false, error: e.message };
    }
  }
}

export const storage: StorageService = new LocalStorageService();
