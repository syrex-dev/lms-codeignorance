import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const isAllowed =
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_OTP_OUTBOX === "true";

  if (!isAllowed) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const messages = await prisma.devOutbox.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json({ messages });
}

export async function DELETE() {
  const isAllowed =
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_OTP_OUTBOX === "true";

  if (!isAllowed) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  await prisma.devOutbox.deleteMany();
  return NextResponse.json({ success: true, message: "Dev outbox cleared." });
}
