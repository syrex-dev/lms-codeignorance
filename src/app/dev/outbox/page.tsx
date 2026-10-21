import { notFound } from "next/navigation";
import { DevOutboxView } from "./dev-outbox-view";

export default function DevOutboxPage() {
  const isProd = process.env.NODE_ENV === "production";
  const isFlagEnabled = process.env.DEV_OTP_OUTBOX !== "false";

  // Kembalikan 404 (Not Found) jika di production atau flag dimatikan
  if (isProd || !isFlagEnabled) {
    notFound();
  }

  return <DevOutboxView />;
}
