import fs from "fs/promises";
import path from "path";

export interface StorageUploadResult {
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface StorageService {
  uploadFile(
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    subfolder?: string
  ): Promise<StorageUploadResult>;
  deleteFile(fileUrl: string): Promise<boolean>;
}

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
    subfolder: string = "general"
  ): Promise<StorageUploadResult> {
    const targetFolder = path.join(this.uploadDir, subfolder);
    await fs.mkdir(targetFolder, { recursive: true });

    const timestamp = Date.now();
    const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueFileName = `${timestamp}-${safeName}`;
    const destinationPath = path.join(targetFolder, uniqueFileName);

    await fs.writeFile(destinationPath, fileBuffer);

    const relativeUrl = `/uploads/${subfolder}/${uniqueFileName}`;
    return {
      url: relativeUrl,
      fileName: originalName,
      fileSize: fileBuffer.length,
      mimeType,
    };
  }

  async deleteFile(fileUrl: string): Promise<boolean> {
    try {
      if (!fileUrl.startsWith("/uploads/")) {
        return false;
      }
      const relativePath = fileUrl.replace("/uploads/", "");
      const fullPath = path.join(this.uploadDir, relativePath);
      await fs.unlink(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}

class S3StorageService implements StorageService {
  async uploadFile(): Promise<StorageUploadResult> {
    throw new Error(
      "S3 storage adapter is configured for production. Please configure S3 credentials."
    );
  }

  async deleteFile(): Promise<boolean> {
    throw new Error(
      "S3 storage adapter is configured for production. Please configure S3 credentials."
    );
  }
}

export const storage: StorageService =
  process.env.STORAGE_DRIVER === "s3"
    ? new S3StorageService()
    : new LocalStorageService();
