"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Heading2,
  Heading3,
  Bold,
  Italic,
  List,
  ListOrdered,
  Code,
  Link as LinkIcon,
  Check,
} from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (val: string) => void;
  draftKey?: string;
  placeholder?: string;
}

export function RichTextEditor({
  value,
  onChange,
  draftKey,
  placeholder = "Tuliskan materi pembelajaran di sini...",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Restore draft if empty and draft exists
  useEffect(() => {
    if (draftKey && !value) {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        onChange(saved);
        if (editorRef.current) {
          editorRef.current.innerHTML = saved;
        }
        setLastSaved("Draf dipulihkan");
      }
    }
  }, [draftKey]);

  // Set initial content
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, []);

  function handleInput() {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    onChange(html);

    if (draftKey) {
      localStorage.setItem(draftKey, html);
      const now = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
      setLastSaved(`Draf tersimpan otomatis (${now})`);
    }
  }

  function exec(command: string, arg: string | undefined = undefined) {
    document.execCommand(command, false, arg);
    handleInput();
    editorRef.current?.focus();
  }

  function insertLink() {
    const url = prompt("Masukkan URL tautan:");
    if (url) {
      exec("createLink", url);
    }
  }

  function insertBlock(tag: "h2" | "h3" | "pre") {
    exec("formatBlock", tag);
  }

  return (
    <div className="border border-[var(--border-strong)] rounded-[8px] bg-[var(--bg-surface)] overflow-hidden focus-within:ring-2 focus-within:ring-[var(--tenant-accent,#1E40AF)] transition shadow-xs">
      {/* Accessible Toolbar */}
      <div
        role="toolbar"
        aria-label="Format Teks Materi"
        className="flex flex-wrap items-center gap-1 p-2 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] text-xs text-[var(--text-muted)]"
      >
        <button
          type="button"
          onClick={() => insertBlock("h2")}
          aria-label="Judul Bagian H2"
          className="p-1.5 hover:bg-[var(--bg-surface)] rounded text-[var(--text-main)] hover:text-[var(--tenant-accent,#1E40AF)] transition"
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" strokeWidth={1.75} />
        </button>

        <button
          type="button"
          onClick={() => insertBlock("h3")}
          aria-label="Subjudul Bagian H3"
          className="p-1.5 hover:bg-[var(--bg-surface)] rounded text-[var(--text-main)] hover:text-[var(--tenant-accent,#1E40AF)] transition"
          title="Heading 3"
        >
          <Heading3 className="w-4 h-4" strokeWidth={1.75} />
        </button>

        <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />

        <button
          type="button"
          onClick={() => exec("bold")}
          aria-label="Teks Tebal"
          className="p-1.5 hover:bg-[var(--bg-surface)] rounded text-[var(--text-main)] hover:text-[var(--tenant-accent,#1E40AF)] transition"
          title="Tebal (Ctrl+B)"
        >
          <Bold className="w-4 h-4" strokeWidth={2} />
        </button>

        <button
          type="button"
          onClick={() => exec("italic")}
          aria-label="Teks Miring"
          className="p-1.5 hover:bg-[var(--bg-surface)] rounded text-[var(--text-main)] hover:text-[var(--tenant-accent,#1E40AF)] transition"
          title="Miring (Ctrl+I)"
        >
          <Italic className="w-4 h-4" strokeWidth={2} />
        </button>

        <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />

        <button
          type="button"
          onClick={() => exec("insertUnorderedList")}
          aria-label="Daftar Butir (Bullet)"
          className="p-1.5 hover:bg-[var(--bg-surface)] rounded text-[var(--text-main)] hover:text-[var(--tenant-accent,#1E40AF)] transition"
          title="Bullet List"
        >
          <List className="w-4 h-4" strokeWidth={1.75} />
        </button>

        <button
          type="button"
          onClick={() => exec("insertOrderedList")}
          aria-label="Daftar Bernomor"
          className="p-1.5 hover:bg-[var(--bg-surface)] rounded text-[var(--text-main)] hover:text-[var(--tenant-accent,#1E40AF)] transition"
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" strokeWidth={1.75} />
        </button>

        <button
          type="button"
          onClick={() => insertBlock("pre")}
          aria-label="Blok Kode"
          className="p-1.5 hover:bg-[var(--bg-surface)] rounded text-[var(--text-main)] hover:text-[var(--tenant-accent,#1E40AF)] transition"
          title="Code Block"
        >
          <Code className="w-4 h-4" strokeWidth={1.75} />
        </button>

        <button
          type="button"
          onClick={insertLink}
          aria-label="Sisipkan Tautan"
          className="p-1.5 hover:bg-[var(--bg-surface)] rounded text-[var(--text-main)] hover:text-[var(--tenant-accent,#1E40AF)] transition"
          title="Tautan (Link)"
        >
          <LinkIcon className="w-4 h-4" strokeWidth={1.75} />
        </button>

        {lastSaved && (
          <div className="ml-auto flex items-center gap-1 text-[11px] text-[var(--status-success)] font-medium">
            <Check className="w-3.5 h-3.5" />
            <span>{lastSaved}</span>
          </div>
        )}
      </div>

      {/* Editable Canvas Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        aria-label="Isi Konten Materi"
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        className="p-4 min-h-[180px] max-h-[360px] overflow-y-auto text-xs sm:text-sm text-[var(--text-main)] leading-relaxed focus:outline-none prose prose-slate max-w-none empty:before:content-[attr(data-placeholder)] empty:before:text-[var(--text-disabled)]"
      />
    </div>
  );
}
