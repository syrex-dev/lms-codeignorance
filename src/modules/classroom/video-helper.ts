/**
 * Helper untuk validasi dan konversi tautan video (YouTube, Google Drive, Vimeo)
 * Memastikan host dibatasi ke allowlist dan dikonversi ke embed yang aman (youtube-nocookie).
 */

export interface VideoProcessResult {
  isValid: boolean;
  provider?: "YOUTUBE" | "GOOGLE_DRIVE" | "VIMEO";
  originalUrl: string;
  embedUrl?: string;
  videoId?: string;
  error?: string;
}

const ALLOWED_VIDEO_DOMAINS = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "drive.google.com",
  "vimeo.com",
  "player.vimeo.com",
];

export function isAllowedVideoDomain(hostname: string): boolean {
  if (!hostname) return false;
  const lower = hostname.toLowerCase();
  return ALLOWED_VIDEO_DOMAINS.some(
    (allowed) => lower === allowed || lower.endsWith("." + allowed)
  );
}

export function processVideoUrl(rawUrl: string): VideoProcessResult {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { isValid: false, originalUrl: rawUrl, error: "URL video tidak boleh kosong." };
  }

  const trimmed = rawUrl.trim();
  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    return { isValid: false, originalUrl: trimmed, error: "Format URL tidak valid." };
  }

  // Wajib protokol http atau https
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { isValid: false, originalUrl: trimmed, error: "Protokol URL harus HTTP atau HTTPS." };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Validasi allowlist domain
  if (!isAllowedVideoDomain(hostname)) {
    return {
      isValid: false,
      originalUrl: trimmed,
      error: `Host '${hostname}' tidak diizinkan. Hanya YouTube, Google Drive, dan Vimeo yang didukung.`,
    };
  }

  // 1. YouTube
  if (hostname.includes("youtube.com") || hostname.includes("youtu.be") || hostname.includes("youtube-nocookie.com")) {
    let videoId: string | null = null;

    if (hostname === "youtu.be") {
      videoId = parsed.pathname.slice(1).split("/")[0] || null;
    } else if (parsed.pathname.startsWith("/watch")) {
      videoId = parsed.searchParams.get("v");
    } else if (parsed.pathname.startsWith("/embed/")) {
      videoId = parsed.pathname.replace("/embed/", "").split("/")[0] || null;
    } else if (parsed.pathname.startsWith("/shorts/")) {
      videoId = parsed.pathname.replace("/shorts/", "").split("/")[0] || null;
    }

    if (!videoId || !/^[a-zA-Z0-9_-]{6,15}$/.test(videoId)) {
      return {
        isValid: false,
        originalUrl: trimmed,
        error: "ID video YouTube tidak valid atau tidak ditemukan.",
      };
    }

    // Selalu konversi ke domain youtube-nocookie untuk privasi dan keamanan
    const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;

    return {
      isValid: true,
      provider: "YOUTUBE",
      originalUrl: trimmed,
      embedUrl,
      videoId,
    };
  }

  // 2. Google Drive
  if (hostname.includes("drive.google.com")) {
    // Format: /file/d/{id}/view atau /open?id={id}
    let fileId: string | null = null;

    const fileMatch = parsed.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch) {
      fileId = fileMatch[1];
    } else if (parsed.searchParams.get("id")) {
      fileId = parsed.searchParams.get("id");
    }

    if (!fileId) {
      return {
        isValid: false,
        originalUrl: trimmed,
        error: "ID berkas Google Drive tidak valid atau tidak ditemukan.",
      };
    }

    const embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;

    return {
      isValid: true,
      provider: "GOOGLE_DRIVE",
      originalUrl: trimmed,
      embedUrl,
      videoId: fileId,
    };
  }

  // 3. Vimeo
  if (hostname.includes("vimeo.com")) {
    let vimeoId: string | null = null;

    if (hostname === "player.vimeo.com") {
      const match = parsed.pathname.match(/\/video\/(\d+)/);
      if (match) vimeoId = match[1];
    } else {
      const match = parsed.pathname.match(/\/(\d+)/);
      if (match) vimeoId = match[1];
    }

    if (!vimeoId) {
      return {
        isValid: false,
        originalUrl: trimmed,
        error: "ID video Vimeo tidak valid atau tidak ditemukan.",
      };
    }

    const embedUrl = `https://player.vimeo.com/video/${vimeoId}`;

    return {
      isValid: true,
      provider: "VIMEO",
      originalUrl: trimmed,
      embedUrl,
      videoId: vimeoId,
    };
  }

  return {
    isValid: false,
    originalUrl: trimmed,
    error: "Provider video tidak didukung.",
  };
}
