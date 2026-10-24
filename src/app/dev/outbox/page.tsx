import { notFound } from "next/navigation";
import { DevOutboxView } from "./dev-outbox-view";

export const dynamic = "force-dynamic";

export default function DevOutboxPage() {
  const isAllowed =
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_OTP_OUTBOX === "true";

  // Kembalikan 404 (Not Found) jika di production atau flag bukan "true"
  if (!isAllowed) {
    notFound();
  }

  return <DevOutboxView />;
}
