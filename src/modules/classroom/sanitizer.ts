/**
 * HTML Sanitizer untuk Rich Text (Tiptap / WYSIWYG)
 * Menggunakan allowlist ketat untuk tag dan atribut.
 * Menghapus tag berbahaya (<script>, <iframe>, <object>, <embed>, <style>),
 * event handlers (on*), dan URI berbahaya (javascript:, vbscript:).
 */

const ALLOWED_TAGS = new Set([
  "p", "br", "hr",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s", "strike", "sub", "sup",
  "ul", "ol", "li",
  "blockquote", "pre", "code",
  "table", "thead", "tbody", "tr", "th", "td",
  "a", "img", "span", "div"
]);

const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "title", "width", "height"]),
  th: new Set(["colspan", "rowspan", "align"]),
  td: new Set(["colspan", "rowspan", "align"]),
  table: new Set(["border", "cellpadding", "cellspacing"]),
  div: new Set(["class"]),
  span: new Set(["class"]),
  code: new Set(["class"]),
};

const DANGEROUS_TAGS_REGEX = /<(script|style|iframe|object|embed|applet|meta|link|base)[^>]*>[\s\S]*?<\/\1>/gi;
const UNCLOSED_DANGEROUS_TAGS = /<(script|style|iframe|object|embed|applet|meta|link|base)[^>]*\/?>/gi;

/**
 * Validasi apakah URL aman (hanya http, https, mailto, atau path relatif)
 */
export function isSafeUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim().replace(/[\x00-\x20]/g, ""); // Hapus control characters & whitespace tersembunyi
  
  // Deteksi scheme berbahaya
  if (/^(javascript|vbscript|data):/i.test(trimmed)) {
    return false;
  }

  // Jika memiliki scheme, wajib http, https, atau mailto
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return /^(https?|mailto):/i.test(trimmed);
  }

  // Path relatif atau anchor aman
  return true;
}

/**
 * Membersihkan HTML dari konten berbahaya (XSS)
 */
export function sanitizeRichText(dirtyHtml: string | null | undefined): string {
  if (!dirtyHtml) return "";

  // 1. Hapus seluruh blok tag berbahaya berserta isinya (<script>...</script>, <style>...</style>, dll)
  let cleaned = dirtyHtml
    .replace(DANGEROUS_TAGS_REGEX, "")
    .replace(UNCLOSED_DANGEROUS_TAGS, "");

  // 2. Parse dan filter setiap HTML tag
  // Pattern regex untuk mencocokkan tag HTML: < /? tagname (attr="val")* /? >
  const tagRegex = /<\/?([a-zA-Z0-9]+)([^>]*)>/g;

  cleaned = cleaned.replace(tagRegex, (match, rawTagName, rawAttrs) => {
    const tagName = rawTagName.toLowerCase();

    // Jika tag tidak ada di allowlist, buang tag tersebut (hanya teks di dalamnya yang bertahan)
    if (!ALLOWED_TAGS.has(tagName)) {
      return "";
    }

    const isClosing = match.startsWith("</");
    if (isClosing) {
      return `</${tagName}>`;
    }

    // Filter atribut
    const allowedAttrsForTag = ALLOWED_ATTRIBUTES[tagName] || new Set();
    const attrRegex = /([a-zA-Z0-9_-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    
    let safeAttrsStr = "";
    let attrMatch: RegExpExecArray | null;

    let hasRel = false;
    let hasTarget = false;

    while ((attrMatch = attrRegex.exec(rawAttrs)) !== null) {
      const attrName = attrMatch[1].toLowerCase();
      const attrVal = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? "";

      // Larang mutlak semua event handler (onclick, onerror, onload, onmouseover, dll)
      if (attrName.startsWith("on")) {
        continue;
      }

      // Periksa apakah atribut diizinkan untuk tag ini
      if (!allowedAttrsForTag.has(attrName)) {
        continue;
      }

      // Validasi URL untuk href dan src
      if (attrName === "href" || attrName === "src") {
        if (!isSafeUrl(attrVal)) {
          continue; // Lewati atribut jika URL tidak aman (cth javascript:)
        }
      }

      if (tagName === "a" && attrName === "rel") hasRel = true;
      if (tagName === "a" && attrName === "target") hasTarget = true;

      // Escape quotes pada value
      const escapedVal = attrVal.replace(/"/g, "&quot;");
      safeAttrsStr += ` ${attrName}="${escapedVal}"`;
    }

    // Untuk tag <a>, pastikan selalu menggunakan rel="noopener noreferrer" jika target="_blank"
    if (tagName === "a") {
      if (!hasRel) {
        safeAttrsStr += ' rel="noopener noreferrer"';
      }
    }

    const isSelfClosing = match.endsWith("/>") || tagName === "br" || tagName === "hr" || tagName === "img";
    return isSelfClosing ? `<${tagName}${safeAttrsStr} />` : `<${tagName}${safeAttrsStr}>`;
  });

  return cleaned.trim();
}
