import sanitizeHtml from "sanitize-html";

/**
 * Validasi apakah URL aman (hanya http, https, mailto, atau path relatif)
 */
export function isSafeUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim().replace(/[\x00-\x20]/g, "");
  
  if (/^(javascript|vbscript|data):/i.test(trimmed)) {
    return false;
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return /^(https?|mailto):/i.test(trimmed);
  }

  return true;
}

/**
 * HTML Sanitizer untuk Rich Text (Tiptap / WYSIWYG) menggunakan sanitize-html
 * Menghapus tag berbahaya (<script>, <iframe>, <object>, <embed>, <style>),
 * event handlers (on*), dan URI berbahaya (javascript:, vbscript:).
 */
export function sanitizeRichText(dirtyHtml: string | null | undefined): string {
  if (!dirtyHtml) return "";

  return sanitizeHtml(dirtyHtml, {
    allowedTags: [
      "p", "br", "hr",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "strong", "b", "em", "i", "u", "s", "strike", "sub", "sup",
      "ul", "ol", "li",
      "blockquote", "pre", "code",
      "table", "thead", "tbody", "tr", "th", "td",
      "a", "img", "span", "div",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      th: ["colspan", "rowspan", "align"],
      td: ["colspan", "rowspan", "align"],
      table: ["border", "cellpadding", "cellspacing"],
      div: ["class"],
      span: ["class"],
      code: ["class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: (tagName, attribs) => {
        const nextAttribs = { ...attribs };
        if (nextAttribs.target === "_blank" || !nextAttribs.rel) {
          nextAttribs.rel = "noopener noreferrer";
        }
        return {
          tagName: "a",
          attribs: nextAttribs,
        };
      },
    },
  }).trim();
}
