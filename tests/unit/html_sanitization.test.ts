import { describe, it, expect } from "vitest";
import { sanitizeRichText, isSafeUrl } from "@/modules/classroom/sanitizer";

describe("HTML Sanitization Server-Side (XSS Protection)", () => {
  it("Membersihkan tag <script> dan payload JavaScript", () => {
    const dirty = "<p>Halo</p><script>alert('xss')</script><b>Dunia</b>";
    const cleaned = sanitizeRichText(dirty);
    expect(cleaned).not.toContain("<script>");
    expect(cleaned).not.toContain("alert");
    expect(cleaned).toBe("<p>Halo</p><b>Dunia</b>");
  });

  it("Menghapus event handler seperti onerror, onload, onclick", () => {
    const dirty = '<img src="valid.jpg" onerror="alert(1)" /><button onclick="alert(2)">Test</button>';
    const cleaned = sanitizeRichText(dirty);
    expect(cleaned).not.toContain("onerror");
    expect(cleaned).not.toContain("onclick");
    expect(cleaned).not.toContain("alert");
  });

  it("Menolak URI berbahaya javascript: dan vbscript: pada tautan", () => {
    const dirty = '<a href="javascript:alert(1)">Klik Saya</a>';
    const cleaned = sanitizeRichText(dirty);
    expect(cleaned).not.toContain("javascript:");
    expect(cleaned).not.toContain("alert");
  });

  it("Menjaga format teks yang sah dan aman (bold, italic, lists, paragraphs)", () => {
    const safeHtml = "<h3>Judul Materi</h3><p>Penjelasan <strong>tebal</strong> dan <em>miring</em>.</p><ul><li>Item 1</li><li>Item 2</li></ul>";
    const cleaned = sanitizeRichText(safeHtml);
    expect(cleaned).toContain("<h3>Judul Materi</h3>");
    expect(cleaned).toContain("<strong>tebal</strong>");
    expect(cleaned).toContain("<li>Item 1</li>");
  });

  it("Memvalidasi fungsi isSafeUrl dengan ketat", () => {
    expect(isSafeUrl("https://poltekmi.ac.id/materi.pdf")).toBe(true);
    expect(isSafeUrl("http://example.com/slide")).toBe(true);
    expect(isSafeUrl("mailto:dosen@poltekmi.ac.id")).toBe(true);
    expect(isSafeUrl("javascript:evil()")).toBe(false);
    expect(isSafeUrl("vbscript:msgbox()")).toBe(false);
    expect(isSafeUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
  });
});
