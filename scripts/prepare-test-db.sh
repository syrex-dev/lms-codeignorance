#!/usr/bin/env bash
set -e
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "=== 1. CLONING FRESH SCHEMA TO LMS_TEST ==="
docker exec -i lms-postgres psql -U postgres -c "DROP DATABASE IF EXISTS lms_test;"
docker exec -i lms-postgres psql -U postgres -c "CREATE DATABASE lms_test;"
docker exec -i lms-postgres pg_dump -U postgres -d lms_db --schema-only | docker exec -i lms-postgres psql -U postgres -d lms_test -q

echo "=== 2. CONFIGURING ROLES & PERMISSIONS ON LMS_TEST ==="
docker exec -i lms-postgres psql -U postgres -d lms_test << 'SQL'
GRANT CONNECT ON DATABASE lms_test TO lms_app;
GRANT CONNECT ON DATABASE lms_test TO lms_platform;

GRANT USAGE ON SCHEMA public TO lms_app;
GRANT USAGE ON SCHEMA public TO lms_platform;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO lms_platform;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO lms_platform;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO lms_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO lms_app;

-- Append-Only: Cabut UPDATE & DELETE pada tabel AuditLog dan PlatformAuditLog dari lms_app
REVOKE UPDATE, DELETE, TRUNCATE ON "AuditLog" FROM lms_app;
REVOKE UPDATE, DELETE, TRUNCATE ON "PlatformAuditLog" FROM lms_app;
SQL

echo "=== 3. SEEDING DEMO DATA TO LMS_TEST ==="
export DATABASE_URL="postgresql://postgres:postgres123@127.0.0.1:5432/lms_test?schema=public"
export DIRECT_URL="postgresql://postgres:postgres123@127.0.0.1:5432/lms_test?schema=public"

npx tsx prisma/seed.ts

echo "=== LMS_TEST IS READY FOR TESTS ==="
