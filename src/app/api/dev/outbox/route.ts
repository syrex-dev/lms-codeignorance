import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  // Hanya aktif jika bukan produksi DAN flag DEV_OTP_OUTBOX tidak dimatikan
  const isProd = process.env.NODE_ENV === "production";
  const isFlagEnabled = process.env.DEV_OTP_OUTBOX !== "false";

  if (isProd || !isFlagEnabled) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const messages = await prisma.devOutbox.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json({ messages });
}

export async function DELETE() {
  const isProd = process.env.NODE_ENV === "production";
  const isFlagEnabled = process.env.DEV_OTP_OUTBOX !== "false";

  if (isProd || !isFlagEnabled) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  await prisma.devOutbox.deleteMany();
  return NextResponse.json({ success: true, message: "Dev outbox cleared." });
}
