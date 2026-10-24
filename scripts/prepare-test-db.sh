#!/usr/bin/env bash
set -e
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 1. Memuat konfigurasi environment pengujian dari .env.test atau .env
if [ -f .env.test ]; then
  export $(grep -v '^#' .env.test | grep -v '^$' | xargs)
elif [ -f .env ]; then
  export $(grep -v '^#' .env | grep -v '^$' | xargs)
fi

: "${TEST_DATABASE_URL:?TEST_DATABASE_URL wajib diset di .env.test atau .env}"
: "${TEST_APP_DATABASE_URL:?TEST_APP_DATABASE_URL wajib diset di .env.test atau .env}"

# 2. Reset database lms_test agar bersih dari sisa migrasi/tipe enum lama
echo "=== 0. RESET SCHEMA PUBLIC PADA LMS_TEST ==="
CLEAN_URL="${TEST_DATABASE_URL%%\?*}"
psql "$CLEAN_URL" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public; GRANT ALL ON SCHEMA public TO lms_app; GRANT ALL ON SCHEMA public TO lms_platform;"

# 3. Migrasi lms_test menggunakan prisma migrate deploy (DIRECT_URL ke lms_test)
# Semua hak akses (GRANT USAGE, SELECT/INSERT/UPDATE/DELETE, ALTER DEFAULT PRIVILEGES, dan REVOKE pada AuditLog)
# diberikan langsung oleh migrasi prisma tanpa langkah GRANT manual.
export DATABASE_URL="$TEST_DATABASE_URL"
export DIRECT_URL="$TEST_DATABASE_URL"

echo "=== 1. MENJALANKAN PRISMA MIGRATE DEPLOY PADA DATABASE LMS_TEST ==="
npx prisma migrate deploy

echo "=== 2. SEEDING DEMO DATA PADA DATABASE LMS_TEST ==="
npx tsx prisma/seed.ts

echo "=== LMS_TEST TELAH SIAP UNTUK PENGUJIAN ==="
