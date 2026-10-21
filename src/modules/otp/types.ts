import { OtpChannel, OtpPurpose, OtpDeliveryStatus } from "@prisma/client";

export { OtpChannel, OtpPurpose, OtpDeliveryStatus };

export interface SendOtpParams {
  institutionId?: string | null;
  userId?: string | null;
  purpose: OtpPurpose;
  channel: OtpChannel;
  destinationE164: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface SendOtpResult {
  success: boolean;
  challengeId?: string;
  destinationMasked?: string;
  channel?: OtpChannel;
  expiresAt?: Date;
  cooldownSeconds?: number;
  warning?: string;
  error?: string;
}

export interface VerifyOtpParams {
  challengeId: string;
  code: string;
  purpose: OtpPurpose;
  expectedDestinationE164?: string;
  ipAddress?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  verificationToken?: string;
  destinationE164?: string;
  userId?: string | null;
  institutionId?: string | null;
  attemptsRemaining?: number;
  remainingAttempts?: number;
  message?: string;
  error?: string;
}
