#!/usr/bin/env bash
set -e

# ==============================================================================
# Script Pemeriksaan Kesiapan Lingkungan Pengembangan (Development Environment)
# Memeriksa: Node.js, Docker, PostgreSQL (lms-postgres), dan file konfigurasi .env
# ==============================================================================

BOLD="\033[1m"
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[0;33m"
BLUE="\033[0;34m"
RESET="\033[0m"

echo -e "${BOLD}${BLUE}======================================================${RESET}"
echo -e "${BOLD}${BLUE}🔍 PEMERIKSAAN KESIAPAN ENVIRONMENT PENGEMBANGAN (WSL)${RESET}"
echo -e "${BOLD}${BLUE}======================================================${RESET}"

ERRORS=0

# 1. Periksa Node.js & npm
echo -ne "\n${BOLD}[1/4] Memeriksa Node.js & npm...${RESET} "
if command -v node >/dev/null 2>&1; then
  NODE_VER=$(node -v)
  echo -e "${GREEN}✓ Terpasang (${NODE_VER})${RESET}"
else
  # Coba periksa jika ada di direktori NVM
  if [ -f "$HOME/.nvm/versions/node/v24.22.0/bin/node" ]; then
    echo -e "${YELLOW}⚠ Ditemukan di NVM tapi belum ada di PATH shell non-interaktif!${RESET}"
    echo -e "   ${YELLOW}Petunjuk:${RESET} Tambahkan baris berikut di paling atas ~/.bashrc sebelum 'return':"
    echo -e "   export PATH=\"\$HOME/.nvm/versions/node/v24.22.0/bin:\$PATH\""
  else
    echo -e "${RED}✗ Tidak ditemukan!${RESET}"
    echo -e "   ${RED}Petunjuk:${RESET} Pasang Node.js LTS (v20+ atau v24+) via nvm: nvm install 24"
  fi
  ERRORS=$((ERRORS + 1))
fi

# 2. Periksa Docker Service
echo -ne "${BOLD}[2/4] Memeriksa Docker Daemon...${RESET} "
if docker info >/dev/null 2>&1; then
  echo -e "${GREEN}✓ Docker Daemon Aktif & Siap${RESET}"
else
  echo -e "${RED}✗ Docker Daemon tidak berjalan!${RESET}"
  echo -e "   ${YELLOW}Petunjuk:${RESET} Aktifkan Docker service dengan perintah:"
  echo -e "   sudo systemctl start docker"
  echo -e "   Untuk autostart permanen di WSL:"
  echo -e "   sudo systemctl enable docker"
  ERRORS=$((ERRORS + 1))
fi

# 3. Periksa Kontainer PostgreSQL (lms-postgres)
echo -ne "${BOLD}[3/4] Memeriksa Kontainer PostgreSQL (127.0.0.1:5432)...${RESET} "
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^lms-postgres$"; then
  echo -e "${GREEN}✓ Kontainer lms-postgres Berjalan${RESET}"
else
  echo -e "${RED}✗ Kontainer lms-postgres belum berjalan!${RESET}"
  echo -e "   ${YELLOW}Petunjuk:${RESET} Jalankan kontainer database dengan perintah:"
  echo -e "   docker compose up -d"
  ERRORS=$((ERRORS + 1))
fi

# 4. Periksa File Konfigurasi .env & .env.test
echo -ne "${BOLD}[4/4] Memeriksa File Konfigurasi .env & .env.test...${RESET} "
ENV_OK=true
if [ ! -f .env ]; then
  echo -e "\n   ${RED}✗ File .env belum ada! Buat dari template: cp .env.example .env${RESET}"
  ENV_OK=false
  ERRORS=$((ERRORS + 1))
fi
if [ ! -f .env.test ]; then
  echo -e "\n   ${RED}✗ File .env.test belum ada! Buat dari template: cp .env.test.example .env.test${RESET}"
  ENV_OK=false
  ERRORS=$((ERRORS + 1))
fi

if [ "$ENV_OK" = true ]; then
  echo -e "${GREEN}✓ File .env dan .env.test Tersedia${RESET}"
fi

# Ringkasan Hasil
echo -e "\n${BOLD}${BLUE}======================================================${RESET}"
if [ $ERRORS -eq 0 ]; then
  echo -e "${BOLD}${GREEN}🎉 SEMUA SISTEM SIAP! Anda siap menjalankan aplikasi.${RESET}"
  echo -e "${BLUE}Perintah dev:${RESET} npm run dev"
  echo -e "${BLUE}Perintah test:${RESET} npm test"
  echo -e "${BOLD}${BLUE}======================================================${RESET}"
  exit 0
else
  echo -e "${BOLD}${RED}⚠️  DITEMUKAN $ERRORS KENDALA PADA LINGKUNGAN PENGEMBANGAN.${RESET}"
  echo -e "${YELLOW}Ikuti petunjuk di atas untuk menyelesaikan dependensi.${RESET}"
  echo -e "${BOLD}${BLUE}======================================================${RESET}"
  exit 1
fi
