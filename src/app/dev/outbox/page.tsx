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

export default function DevOutboxPage() {
  const [messages, setMessages] = useState<DevMessage[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMessages = async () => {
    try {
      const res = await fetch("/api/dev/outbox");
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
    await fetch("/api/dev/outbox", { method: "DELETE" });
    setMessages([]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse"></span>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Simulasi Kotak Masuk OTP (Dev Outbox)
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Hanya aktif saat mode development. Menangkap seluruh kode verifikasi WhatsApp & SMS untuk pengujian lokal.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchMessages}
              className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-200"
            >
              Segarkan
            </button>
            <button
              onClick={handleClear}
              className="text-xs bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 text-red-300 px-3 py-1.5 rounded-lg"
            >
              Hapus Semua
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500 text-sm">Memuat pesan masuk...</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
            <p className="text-sm text-slate-400">Belum ada OTP yang dikirim.</p>
            <p className="text-xs text-slate-500 mt-1">
              Lakukan alur aktivasi, lupa password, atau pendaftaran untuk melihat kode di sini.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-slate-700 transition"
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
