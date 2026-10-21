"use client";

import { useEffect, useState } from "react";

interface DevMessage {
  id: string;
  channel: string;
  recipient: string;
  message: string;
  code: string;
  purpose: string;
  institutionSlug?: string;
  createdAt: string;
}

export function DevOutboxView() {
  const [messages, setMessages] = useState<DevMessage[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMessages = async () => {
    try {
      const res = await fetch("/api/dev/outbox");
      if (res.status === 404) {
        setMessages([]);
        return;
      }
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (e) {
      console.error("Failed to fetch dev outbox:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = async () => {
    if (confirm("Hapus semua riwayat OTP di Dev Outbox?")) {
      await fetch("/api/dev/outbox", { method: "DELETE" });
      setMessages([]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                DEVELOPMENT MODE ONLY
              </span>
              <span className="text-xs text-slate-500">Auto-refresh (3s)</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
              Dev Outbox (Simulator WhatsApp & SMS)
            </h1>
            <p className="text-sm text-slate-400">
              Pesan dan kode OTP pengujian ditangkap di sini secara real-time. Tidak ada OTP yang dikirim ke nomor fisik atau bocor ke log produksi.
            </p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              className="text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-3 py-2 rounded-lg font-medium transition self-start"
            >
              Bersihkan Outbox
            </button>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Memuat outbox simulator...</div>
        ) : messages.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
            <p className="text-slate-400 text-sm">Belum ada OTP yang dikirimkan.</p>
            <p className="text-xs text-slate-600 mt-1">
              Jalankan aktivasi pertama, login platform, atau ubah password untuk melihat pesan di sini.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-700 transition"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        m.channel === "WHATSAPP"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                          : "bg-blue-950 text-blue-400 border border-blue-800"
                      }`}
                    >
                      {m.channel}
                    </span>
                    <span className="text-xs font-mono font-medium text-slate-200">
                      {m.recipient}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      • {new Date(m.createdAt).toLocaleTimeString("id-ID")}
                    </span>
                    {m.institutionSlug && (
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                        /{m.institutionSlug}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{m.message}</p>
                </div>

                <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 self-stretch sm:self-auto justify-between sm:justify-end">
                  <span className="font-mono text-base font-bold text-amber-400 tracking-wider">
                    {m.code}
                  </span>
                  <button
                    onClick={() => handleCopy(m.code, m.id)}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded transition"
                  >
                    {copiedId === m.id ? "Tersalin!" : "Salin"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
