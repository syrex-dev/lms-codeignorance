// Setup environment khusus untuk database pengujian terisolasi (lms_test)
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

(process.env as any).NODE_ENV = "test";

const testAppDbUrl = process.env.TEST_APP_DATABASE_URL;
const testDirectUrl = process.env.TEST_DATABASE_URL;
const platformDbUrl = process.env.PLATFORM_DATABASE_URL;

if (!testAppDbUrl || !testDirectUrl) {
  throw new Error(
    "FATAL: TEST_APP_DATABASE_URL dan TEST_DATABASE_URL wajib diset di .env.test atau .env tanpa fallback hardcode."
  );
}

process.env.DATABASE_URL = testAppDbUrl;
process.env.DIRECT_URL = testDirectUrl;
process.env.PLATFORM_DATABASE_URL = platformDbUrl || testAppDbUrl;
process.env.ALLOW_MOCK_CAPTCHA = "true";
process.env.DEV_MOCK_OUTBOX = "true";
process.env.DEV_OTP_OUTBOX = "true";
