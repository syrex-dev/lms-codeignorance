import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Lint Unit Test: Konsistensi Desain Token & Aksesibilitas Komponen UI", () => {
  const uiDir = path.resolve(__dirname, "../../src/components/ui");
  const uiFiles = fs.readdirSync(uiDir).filter((f) => f.endsWith(".tsx"));

  it("Komponen UI tidak boleh memuat emoji unicode mentah", () => {
    // Range emoji umum
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    const filesWithEmoji: string[] = [];

    for (const file of uiFiles) {
      const content = fs.readFileSync(path.join(uiDir, file), "utf-8");
      if (emojiRegex.test(content)) {
        filesWithEmoji.push(file);
      }
    }

    expect(filesWithEmoji, `Komponen UI tidak boleh memiliki emoji mentah: ${filesWithEmoji.join(", ")}`).toEqual([]);
  });

  it("Komponen UI tidak boleh menggunakan tracking-widest huruf kapital berlebihan", () => {
    const filesWithExcessiveTracking: string[] = [];

    for (const file of uiFiles) {
      const content = fs.readFileSync(path.join(uiDir, file), "utf-8");
      if (content.includes("tracking-widest uppercase") || content.includes("tracking-[0.2em]")) {
        filesWithExcessiveTracking.push(file);
      }
    }

    expect(filesWithExcessiveTracking, `Komponen UI tidak boleh memiliki tracking-widest berlebihan: ${filesWithExcessiveTracking.join(", ")}`).toEqual([]);
  });

  it("Komponen UI inti menggunakan variabel token desain CSS", () => {
    const coreComponents = ["button.tsx", "badge.tsx", "input.tsx", "select.tsx", "table.tsx", "tabs.tsx", "empty-state.tsx", "page-header.tsx"];
    
    for (const comp of coreComponents) {
      const content = fs.readFileSync(path.join(uiDir, comp), "utf-8");
      const hasTokens = content.includes("var(--") || content.includes("surface-card");
      expect(hasTokens, `Komponen ${comp} harus mengacu pada token CSS (var(--...))`).toBe(true);
    }
  });
});
