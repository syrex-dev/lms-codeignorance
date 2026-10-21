import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  if (process.env.NODE_ENV === "production" && process.env.DEV_OTP_OUTBOX !== "true") {
    return NextResponse.json({ error: "Dev outbox disabled in production." }, { status: 403 });
  }

  const messages = await prisma.devOutbox.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json({ messages });
}

export async function DELETE() {
  if (process.env.NODE_ENV === "production" && process.env.DEV_OTP_OUTBOX !== "true") {
    return NextResponse.json({ error: "Dev outbox disabled in production." }, { status: 403 });
  }

  await prisma.devOutbox.deleteMany();
  return NextResponse.json({ success: true, message: "Dev outbox cleared." });
}
