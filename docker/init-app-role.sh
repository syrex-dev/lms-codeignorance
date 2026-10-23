#!/usr/bin/env bash
set -e

# Membaca password dari environment variable (tanpa hardcode di repo)
APP_PASSWORD="${LMS_APP_DB_PASSWORD:-app_sec_pwd_9a8b7c6d5e4f3a2b1c}"
PLATFORM_PASSWORD="${LMS_PLATFORM_DB_PASSWORD:-platform_sec_pwd_1a2b3c4d5e6f7a8b9c}"
TARGET_DB="${POSTGRES_DB:-lms_db}"

echo "Inisialisasi role lms_app dan lms_platform pada database $TARGET_DB..."

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$TARGET_DB" <<-EOSQL
  -- 1. Role lms_app (Aplikasi Runtime Tenant: Non-Superuser, NOBYPASSRLS)
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'lms_app') THEN
      CREATE ROLE lms_app WITH LOGIN PASSWORD '$APP_PASSWORD' NOSUPERUSER NOBYPASSRLS;
    ELSE
      ALTER ROLE lms_app WITH PASSWORD '$APP_PASSWORD' NOSUPERUSER NOBYPASSRLS;
    END IF;
  END
  \$\$;

  -- 2. Role lms_platform (Khusus Operasional Platform / Super Admin: BYPASSRLS)
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'lms_platform') THEN
      CREATE ROLE lms_platform WITH LOGIN PASSWORD '$PLATFORM_PASSWORD' NOSUPERUSER BYPASSRLS;
    ELSE
      ALTER ROLE lms_platform WITH PASSWORD '$PLATFORM_PASSWORD' NOSUPERUSER BYPASSRLS;
    END IF;
  END
  \$\$;

  -- 3. Hak Akses Database & Skema
  GRANT CONNECT ON DATABASE $TARGET_DB TO lms_app;
  GRANT CONNECT ON DATABASE $TARGET_DB TO lms_platform;

  GRANT USAGE ON SCHEMA public TO lms_app;
  GRANT USAGE ON SCHEMA public TO lms_platform;

  -- lms_platform memiliki akses penuh
  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO lms_platform;
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO lms_platform;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO lms_platform;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO lms_platform;

  -- lms_app memiliki akses data standar
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO lms_app;
  GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO lms_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lms_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO lms_app;

  -- 4. Append-Only Proteksi: Cabut UPDATE & DELETE pada tabel AuditLog dan PlatformAuditLog dari lms_app
  DO \$\$
  BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'AuditLog') THEN
      REVOKE UPDATE, DELETE, TRUNCATE ON "AuditLog" FROM lms_app;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'PlatformAuditLog') THEN
      REVOKE UPDATE, DELETE, TRUNCATE ON "PlatformAuditLog" FROM lms_app;
    END IF;
  END
  \$\$;

EOSQL

echo "Inisialisasi role lms_app & lms_platform selesai dengan sukses."
