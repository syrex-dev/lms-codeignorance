import { prisma } from "@/lib/db/prisma";
import { OtpChannel, OtpDeliveryStatus } from "./types";

export interface DeliveryResult {
  success: boolean;
  provider: string;
  channel: OtpChannel;
  providerMessageId?: string;
  status: OtpDeliveryStatus;
  errorCode?: string;
  costEstimate?: number;
  fallbackUsed?: boolean;
}

export interface OtpSender {
  send(
    channel: OtpChannel,
    destinationE164: string,
    message: string,
    code: string,
    metadata?: { institutionSlug?: string; purpose?: string }
  ): Promise<DeliveryResult>;
}

/**
 * MockOtpSender: Digunakan saat development / testing.
 * Menulis pesan ke tabel DevOutbox sehingga dapat dilihat langsung di /dev/outbox.
 * Mendukung simulasi kegagalan untuk menguji alur fallback WhatsApp ke SMS.
 */
export class MockOtpSender implements OtpSender {
  public static simulateWhatsAppFailure: boolean = false;

  async send(
    channel: OtpChannel,
    destinationE164: string,
    message: string,
    code: string,
    metadata?: { institutionSlug?: string; purpose?: string }
  ): Promise<DeliveryResult> {
    // Simulasi kegagalan pengiriman WhatsApp untuk testing fallback
    if (channel === OtpChannel.WHATSAPP && MockOtpSender.simulateWhatsAppFailure) {
      return {
        success: false,
        channel,
        provider: "MOCK_WHATSAPP_SIMULATOR",
        status: OtpDeliveryStatus.FAILED,
        errorCode: "SIMULATED_WA_DELIVERY_FAILURE",
      };
    }

    try {
      await prisma.devOutbox.create({
        data: {
          channel,
          recipient: destinationE164,
          message,
          code,
          purpose: metadata?.purpose || "GENERAL",
          institutionSlug: metadata?.institutionSlug || null,
        },
      });

      return {
        success: true,
        channel,
        provider: "MOCK_DEV_OUTBOX",
        providerMessageId: `mock_${Date.now()}`,
        status: OtpDeliveryStatus.DELIVERED,
        costEstimate: 0,
      };
    } catch (e: any) {
      console.error("MockOtpSender error:", e);
      return {
        success: false,
        channel,
        provider: "MOCK_DEV_OUTBOX",
        status: OtpDeliveryStatus.FAILED,
        errorCode: e.message,
      };
    }
  }
}

/**
 * WhatsApp Cloud API Sender (Siap produksi)
 */
export class WhatsAppOtpSender implements OtpSender {
  private fallbackMock = new MockOtpSender();

  async send(
    channel: OtpChannel,
    destinationE164: string,
    message: string,
    code: string,
    metadata?: { institutionSlug?: string; purpose?: string }
  ): Promise<DeliveryResult> {
    const waToken = process.env.WHATSAPP_API_TOKEN;
    const waPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    // Jika credential env belum diset, gunakan MockOtpSender
    if (!waToken || !waPhoneId) {
      return this.fallbackMock.send(channel, destinationE164, message, code, metadata);
    }

    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/${waPhoneId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${waToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: destinationE164.replace("+", ""),
          type: "text",
          text: { body: message },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Gagal mengirim pesan WhatsApp Cloud API");
      }

      return {
        success: true,
        channel: OtpChannel.WHATSAPP,
        provider: "WHATSAPP_CLOUD",
        providerMessageId: data.messages?.[0]?.id,
        status: OtpDeliveryStatus.SENT,
        costEstimate: 0.03, // Estimasi biaya WhatsApp Authentication conversation
      };
    } catch (e: any) {
      return {
        success: false,
        channel: OtpChannel.WHATSAPP,
        provider: "WHATSAPP_CLOUD",
        status: OtpDeliveryStatus.FAILED,
        errorCode: e.message,
      };
    }
  }
}

/**
 * SMS Gateway / Twilio Sender (Siap produksi)
 */
export class SmsOtpSender implements OtpSender {
  private fallbackMock = new MockOtpSender();

  async send(
    channel: OtpChannel,
    destinationE164: string,
    message: string,
    code: string,
    metadata?: { institutionSlug?: string; purpose?: string }
  ): Promise<DeliveryResult> {
    const smsApiKey = process.env.SMS_GATEWAY_API_KEY;
    const smsEndpoint = process.env.SMS_GATEWAY_ENDPOINT;

    // Jika credential env belum diset, gunakan MockOtpSender
    if (!smsApiKey || !smsEndpoint) {
      return this.fallbackMock.send(channel, destinationE164, message, code, metadata);
    }

    try {
      const res = await fetch(smsEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${smsApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          destination: destinationE164,
          text: message,
        }),
      });

      const data = await res.json();
      return {
        success: res.ok,
        channel: OtpChannel.SMS,
        provider: "SMS_GATEWAY",
        providerMessageId: data.messageId,
        status: res.ok ? OtpDeliveryStatus.SENT : OtpDeliveryStatus.FAILED,
        costEstimate: 0.02,
      };
    } catch (e: any) {
      return {
        success: false,
        channel: OtpChannel.SMS,
        provider: "SMS_GATEWAY",
        status: OtpDeliveryStatus.FAILED,
        errorCode: e.message,
      };
    }
  }
}

/**
 * Pengirim OTP dengan dukungan fallback otomatis WhatsApp -> SMS
 */
export async function sendOtpWithFallback(
  preferredChannel: OtpChannel,
  destinationE164: string,
  message: string,
  code: string,
  metadata?: { institutionSlug?: string; purpose?: string }
): Promise<DeliveryResult> {
  const primarySender = preferredChannel === OtpChannel.WHATSAPP ? new WhatsAppOtpSender() : new SmsOtpSender();
  const primaryResult = await primarySender.send(preferredChannel, destinationE164, message, code, metadata);

  // Jika pengiriman utama berhasil, kembalikan hasil
  if (primaryResult.success) {
    return primaryResult;
  }

  // Jika preferred channel adalah WHATSAPP dan gagal, lakukan fallback otomatis ke SMS
  if (preferredChannel === OtpChannel.WHATSAPP) {
    console.warn(`[OTP] WhatsApp delivery failed (${primaryResult.errorCode}), attempting SMS fallback...`);
    const fallbackSender = new SmsOtpSender();
    const fallbackResult = await fallbackSender.send(OtpChannel.SMS, destinationE164, message, code, metadata);
    return {
      ...fallbackResult,
      fallbackUsed: true,
    };
  }

  return primaryResult;
}

export function getOtpSender(channel: OtpChannel): OtpSender {
  if (channel === OtpChannel.WHATSAPP) {
    return new WhatsAppOtpSender();
  }
  return new SmsOtpSender();
}
