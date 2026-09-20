#!/usr/bin/env bash
# ==============================================================================
# XorvilaBox 1-Click Automated VPS Setup Script
# Works on Ubuntu 20.04/22.04/24.04 and Debian 11/12
# ==============================================================================

set -e

# Visual colors
RED='\033[0;31m'
GREEN='\033[0;32m'
ORANGE='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

clear
echo -e "${ORANGE}"
cat << "EOF"
  __  __                  _ _       ____             
  \ \/ /___  _ ____   __(_) | __ _| __ )  _____  __  
   \  // _ \| '__\ \ / /| | |/ _` |  _ \ / _ \ \/ /  
   /  \ (_) | |   \ V / | | | (_| | |_) | (_) >  <   
  /_/\_\___/|_|    \_/  |_|_|\__,_|____/ \___/_/\_\  
                                                     
    🚀 1-Click VPS Automated Deployment Script
EOF
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[ERROR] Please run this script with sudo or as root:${NC}"
  echo -e "  sudo bash $0\n"
  exit 1
fi

# ------------------------------------------------------------------------------
# 1. Interactive Inputs (Repo URL & Cloudflare Tunnel URL)
# ------------------------------------------------------------------------------
echo -e "${CYAN}====================================================${NC}"
echo -e "${CYAN}  1. CONFIGURATION SETUP                            ${NC}"
echo -e "${CYAN}====================================================${NC}"

# GitHub Repo URL
if [ -n "$1" ]; then
  REPO_URL="$1"
else
  read -rp "$(echo -e "${ORANGE}➤ Enter your GitHub Repo URL${NC} (e.g. https://github.com/username/xorvilabox.git): ")" REPO_URL
fi

while [ -z "$REPO_URL" ]; do
  echo -e "${RED}GitHub Repo URL cannot be empty.${NC}"
  read -rp "$(echo -e "${ORANGE}➤ Enter your GitHub Repo URL: ${NC}")" REPO_URL
done

# Cloudflare Tunnel URL
if [ -n "$2" ]; then
  TUNNEL_URL="$2"
else
  read -rp "$(echo -e "${ORANGE}➤ Enter your Cloudflare Tunnel URL${NC} (e.g. https://box.mydomain.com or https://random.trycloudflare.com): ")" TUNNEL_URL
fi

while [ -z "$TUNNEL_URL" ]; do
  echo -e "${RED}Cloudflare Tunnel URL cannot be empty.${NC}"
  read -rp "$(echo -e "${ORANGE}➤ Enter your Cloudflare Tunnel URL: ${NC}")" TUNNEL_URL
done

# Ensure URL has protocol
if [[ ! "$TUNNEL_URL" =~ ^https?:// ]]; then
  TUNNEL_URL="https://${TUNNEL_URL}"
fi
# Strip trailing slash
TUNNEL_URL="${TUNNEL_URL%/}"

# Admin password prompt (optional default)
read -rp "$(echo -e "${ORANGE}➤ Set Admin Password${NC} [Press Enter for default 'admin123']: ")" ADMIN_PASS
ADMIN_PASS=${ADMIN_PASS:-admin123}

echo -e "\n${GREEN}Summary:${NC}"
echo -e "  GitHub Repo:        ${CYAN}$REPO_URL${NC}"
echo -e "  Cloudflare URL:     ${CYAN}$TUNNEL_URL${NC}"
echo -e "  Admin Default Pass: ${CYAN}$ADMIN_PASS${NC}"
echo -e "  Install Directory:  ${CYAN}/var/www/xorvilabox${NC}"
echo -e "  Storage Directory:  ${CYAN}/var/lib/xorvilabox/storage${NC}"
echo ""
read -rp "Ready to install everything automatically? [Y/n]: " CONFIRM
if [[ "$CONFIRM" =~ ^[Nn] ]]; then
  echo -e "${RED}Installation aborted.${NC}"
  exit 0
fi

# ------------------------------------------------------------------------------
# 2. System Packages & Node.js 20 Installation
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}➤ [1/6] Updating system and installing essential tools...${NC}"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq curl git build-essential ufw openssl

# Check / Install Node.js 20
NEED_NODE=true
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR=$(node -v | cut -d'.' -f1 | tr -d 'v')
  if [ "$NODE_MAJOR" -ge 18 ]; then
    echo -e "${GREEN}✓ Node.js $(node -v) is already installed.${NC}"
    NEED_NODE=false
  fi
fi

if [ "$NEED_NODE" = true ]; then
  echo -e "${BLUE}➤ Installing Node.js 20 LTS...${NC}"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs
  echo -e "${GREEN}✓ Node.js $(node -v) installed.${NC}"
fi

# Install PM2 globally if not installed
if ! command -v pm2 >/dev/null 2>&1; then
  echo -e "${BLUE}➤ Installing PM2 process manager...${NC}"
  npm install -g pm2 --silent
  echo -e "${GREEN}✓ PM2 installed.${NC}"
fi

# ------------------------------------------------------------------------------
# 3. Create Storage Directories
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}➤ [2/6] Preparing storage and data folders...${NC}"
mkdir -p /var/lib/xorvilabox/storage
mkdir -p /var/lib/xorvilabox/tmp
mkdir -p /var/www/xorvilabox/data

# ------------------------------------------------------------------------------
# 4. Clone or Pull Repo
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}➤ [3/6] Fetching project code from GitHub...${NC}"
if [ -d "/var/www/xorvilabox/.git" ]; then
  echo -e "Existing repository found in /var/www/xorvilabox. Updating to latest..."
  cd /var/www/xorvilabox
  git remote set-url origin "$REPO_URL"
  git fetch origin || true
  git reset --hard origin/HEAD 2>/dev/null || git pull || true
else
  rm -rf /var/www/xorvilabox/*
  mkdir -p /var/www/xorvilabox
  git clone "$REPO_URL" /var/www/xorvilabox
  cd /var/www/xorvilabox
fi

# ------------------------------------------------------------------------------
# 5. Create .env Configuration
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}➤ [4/6] Creating production .env file...${NC}"
SESSION_KEY=$(openssl rand -hex 32)

cat > /var/www/xorvilabox/.env << EOF
NODE_ENV=production
PORT=3000
STORAGE_PATH=/var/lib/xorvilabox/storage
DATABASE_URL=file:/var/www/xorvilabox/data/xorvilabox.db
PUBLIC_BASE_URL=${TUNNEL_URL}
SESSION_SECRET=${SESSION_KEY}
ADMIN_DEFAULT_PASSWORD=${ADMIN_PASS}
MAX_UPLOAD_SIZE=21474836480
MAX_IMPORT_SIZE=21474836480
MAX_ZIP_SIZE=21474836480
EOF

echo -e "${GREEN}✓ .env configured with Cloudflare Tunnel URL: ${TUNNEL_URL}${NC}"

# ------------------------------------------------------------------------------
# 6. Install Dependencies & Build
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}➤ [5/6] Installing npm dependencies and building frontend + backend...${NC}"
cd /var/www/xorvilabox
npm install --legacy-peer-deps --no-audit --no-fund
npm run build

echo -e "${GREEN}✓ Build succeeded.${NC}"

# ------------------------------------------------------------------------------
# 7. Start / Restart with PM2
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}➤ [6/6] Starting XorvilaBox with PM2 (Auto-boot enabled)...${NC}"
pm2 delete xorvilabox 2>/dev/null || true
NODE_ENV=production pm2 start dist/server.cjs --name "xorvilabox" --update-env
pm2 save

# Setup PM2 startup script automatically
env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

# ------------------------------------------------------------------------------
# 8. Finished!
# ------------------------------------------------------------------------------
echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN}  🎉 XORVILABOX IS NOW LIVE AND RUNNING!              ${NC}"
echo -e "${GREEN}======================================================${NC}"
echo -e "  🌐 Web App URL:      ${CYAN}${TUNNEL_URL}${NC}"
echo -e "  👤 Admin Username:   ${CYAN}admin${NC}"
echo -e "  🔑 Admin Password:   ${CYAN}${ADMIN_PASS}${NC}"
echo -e "  📂 Video Storage:    ${CYAN}/var/lib/xorvilabox/storage${NC}"
echo -e "  🗄️ Database:         ${CYAN}/var/www/xorvilabox/data/xorvilabox.db${NC}"
echo -e ""
echo -e "${ORANGE}Cloudflare Tunnel Configuration Reminder:${NC}"
echo -e "  In your Cloudflare Zero Trust Dashboard, configure your Public Hostname:"
echo -e "  • Service: ${CYAN}HTTP${NC}"
echo -e "  • URL:     ${CYAN}localhost:3000${NC} (or 127.0.0.1:3000)"
echo -e ""
echo -e "${PURPLE}Useful Management Commands:${NC}"
echo -e "  • View live server logs:  ${CYAN}pm2 logs xorvilabox${NC}"
echo -e "  • Restart application:    ${CYAN}pm2 restart xorvilabox${NC}"
echo -e "  • Check running status:   ${CYAN}pm2 status${NC}"
echo -e "======================================================\n"
