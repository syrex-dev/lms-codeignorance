import Link from "next/link";
import { FileQuestion, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F6F7F9] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-[#E3E6EB] rounded-[6px] p-8 text-center shadow-none">
        <div className="w-12 h-12 rounded-full bg-[#F6F7F9] text-[#1F4E8C] flex items-center justify-center mx-auto mb-4 border border-[#E3E6EB]">
          <FileQuestion className="w-6 h-6" strokeWidth={1.5} />
        </div>

        <span className="text-xs font-semibold text-[#1F4E8C] bg-[#EBF2FA] px-2.5 py-0.5 rounded-[4px]">
          Status 404
        </span>

        <h1 className="text-xl font-semibold text-[#111827] mt-3 tracking-tight">
          Halaman tidak ditemukan
        </h1>

        <p className="text-xs text-[#4B5563] mt-2 leading-relaxed">
          Alamat yang Anda tuju tidak tersedia, telah dipindahkan, atau modul terkait masih dalam tahap pengembangan sistem.
        </p>

        <div className="mt-6 pt-5 border-t border-[#E3E6EB] flex justify-center">
          <Link
            href="/poltekmi/dashboard"
            className="inline-flex items-center gap-2 h-9 px-4 bg-[#1F4E8C] hover:bg-[#183E6F] text-white text-xs font-medium rounded-[6px] transition focus:outline-none focus:ring-2 focus:ring-[#1F4E8C]"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            <span>Kembali ke dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
