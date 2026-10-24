"use client";

import { useState, useEffect } from "react";
import { Copy, Check, RefreshCw, KeyRound, Smartphone } from "lucide-react";

interface OutboxMessage {
  id: string;
  recipient?: string;
  to?: string;
  channel: string;
  purpose?: string;
  code?: string;
  message?: string;
  body?: string;
  createdAt: string;
}

interface DevOtpInboxProps {
  activePhone?: string;
  onSelectCode?: (code: string) => void;
}

export function DevOtpInbox({ activePhone, onSelectCode }: DevOtpInboxProps) {
  // Komponen dihilangkan sepenuhnya pada production
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const [messages, setMessages] = useState<OutboxMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchOutbox = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/dev/outbox");
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch {
      // Abaikan error pada polling latar belakang
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutbox();
    const interval = setInterval(fetchOutbox, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    if (onSelectCode) {
      onSelectCode(code);
    }
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  // Filter pesan yang relevan dengan nomor HP yang sedang diproses
  const cleanActive = (activePhone || "").replace(/\D/g, "");
  const relevantMessages = messages.filter((m) => {
    if (!cleanActive) return true;
    const dest = (m.recipient || m.to || "").replace(/\D/g, "");
    return dest.includes(cleanActive) || cleanActive.includes(dest);
  });

  const displayList = relevantMessages.length > 0 ? relevantMessages : messages.slice(0, 3);

  return (
    <div
      data-testid="dev-otp-inbox"
      className="mt-6 border border-[#E3E6EB] bg-white rounded-[6px] p-4 text-[#111827] text-xs shadow-none"
    >
      <div className="flex items-center justify-between border-b border-[#E3E6EB] pb-2 mb-3">
        <div className="flex items-center gap-1.5 font-semibold text-[#111827]">
          <KeyRound className="w-4 h-4 text-[#1F4E8C]" strokeWidth={1.75} />
          <span>Kotak masuk OTP (demo)</span>
          <span className="text-[10px] bg-[#F6F7F9] text-[#6B7280] px-1.5 py-0.5 rounded font-normal border border-[#E3E6EB]">
            Khusus Pengembangan
          </span>
        </div>
        <div className="flex items-center gap-2 text-[#6B7280]">
          <span className="text-[11px]">Pembaruan otomatis 3 detik</span>
          <button
            type="button"
            onClick={fetchOutbox}
            aria-label="Segarkan kotak masuk OTP"
            className="p-1 hover:text-[#111827]"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#1F4E8C]" : ""}`}
              strokeWidth={1.75}
            />
          </button>
        </div>
      </div>

      {displayList.length === 0 ? (
        <div className="text-center py-4 text-[#6B7280]">
          Belum ada kode OTP terkirim. Klik tombol kirim OTP di atas.
        </div>
      ) : (
        <div className="space-y-2">
          {displayList.slice(0, 4).map((msg) => {
            const dest = msg.recipient || msg.to || "";
            const cleanDest = dest.replace(/\D/g, "");
            const isMatch = cleanActive && cleanDest.includes(cleanActive);
            const msgBody = msg.message || msg.body || "";
            const code =
              msg.code ||
              msgBody.match(/\b\d{6}\b/)?.[0] ||
              "";

            return (
              <div
                key={msg.id}
                className={`p-2.5 rounded-[6px] border flex items-center justify-between transition-colors ${
                  isMatch
                    ? "bg-[#EBF2FA] border-[#BFDBFE] text-[#111827]"
                    : "bg-[#F6F7F9] border-[#E3E6EB] text-[#374151]"
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="flex items-center gap-1">
                      <Smartphone className="w-3.5 h-3.5 text-[#6B7280]" strokeWidth={1.75} />
                      <span className="font-mono text-xs">{dest}</span>
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-white border border-[#E3E6EB] rounded text-[#4B5563]">
                      {msg.channel}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#6B7280] truncate mt-0.5 max-w-xs">
                    {msgBody}
                  </div>
                </div>

                {code && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-bold text-sm bg-white px-2 py-0.5 rounded border border-[#E3E6EB] text-[#111827]">
                      {code}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(code, msg.id)}
                      className="px-2 py-1 text-xs font-medium rounded border border-[#E3E6EB] bg-white hover:bg-[#F6F7F9] text-[#111827] flex items-center gap-1 transition"
                      title="Salin kode"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#15803D]" strokeWidth={1.75} />
                          <span className="text-[#15803D]">Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#6B7280]" strokeWidth={1.75} />
                          <span>Salin</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
