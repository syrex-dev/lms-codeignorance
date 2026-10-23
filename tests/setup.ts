// Setup environment khusus untuk database pengujian terisolasi (lms_test)
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.TEST_APP_DATABASE_URL || "postgresql://lms_app:app_sec_pwd_9a8b7c6d5e4f3a2b1c@127.0.0.1:5432/lms_test?schema=public";
process.env.DIRECT_URL = process.env.TEST_DATABASE_URL || "postgresql://postgres:postgres123@127.0.0.1:5432/lms_test?schema=public";
process.env.PLATFORM_DATABASE_URL = process.env.PLATFORM_DATABASE_URL || "postgresql://lms_platform:platform_sec_pwd_1a2b3c4d5e6f7a8b9c@127.0.0.1:5432/lms_test?schema=public";
process.env.ALLOW_MOCK_CAPTCHA = "true";
process.env.DEV_MOCK_OUTBOX = "true";
