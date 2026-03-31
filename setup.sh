#!/bin/bash

# Orbit Project Setup Script
# This script prepares the local development environment by setting up all necessary .env files

REQUIRED_NPM=11

# ── Colours ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

# ── Header ─────────────────────────────────────────────────────────────────────
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${BLUE}                              Orbit Setup                              ${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Setting up your development environment...${NC}\n"

export LC_ALL=C
export LC_CTYPE=C

success=true

# ── Helpers ────────────────────────────────────────────────────────────────────
copy_env_file() {
    local source=$1
    local destination=$2

    if [ ! -f "$source" ]; then
        echo -e "${RED}✗${NC} Source file $source does not exist."
        return 1
    fi

    if [ -f "$destination" ]; then
        echo -e "${YELLOW}⚠${NC}  $destination already exists — skipping."
        return 0
    fi

    cp "$source" "$destination"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} Created $destination"
    else
        echo -e "${RED}✗${NC} Failed to copy $destination"
        return 1
    fi
}

# ── Copy .env files ────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}Setting up environment files...${NC}"

services=("" "web" "api")

for service in "${services[@]}"; do
    if [ "$service" == "" ]; then
        prefix="./"
    else
        prefix="./apps/$service/"
    fi
    copy_env_file "${prefix}.env.example" "${prefix}.env" || success=false
done

# ── Generate BETTER_AUTH_SECRET ────────────────────────────────────────────────
if [ -f "./apps/api/.env" ]; then
    if grep -q "BETTER_AUTH_SECRET" ./apps/api/.env; then
        echo -e "${YELLOW}⚠${NC}  BETTER_AUTH_SECRET already set — skipping."
    else
        echo -e "\n${YELLOW}Generating BETTER_AUTH_SECRET...${NC}"
        SECRET=$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c64)
        if [ -z "$SECRET" ]; then
            echo -e "${RED}✗${NC} Failed to generate BETTER_AUTH_SECRET."
            success=false
        else
            echo -e "\nBETTER_AUTH_SECRET=\"$SECRET\"" >> ./apps/api/.env
            echo -e "${GREEN}✓${NC} Added BETTER_AUTH_SECRET to apps/api/.env"
        fi
    fi
else
    echo -e "${RED}✗${NC} apps/api/.env not found. BETTER_AUTH_SECRET not added."
    success=false
fi

# ── Install dependencies ───────────────────────────────────────────────────────
echo -e "\n${YELLOW}Installing dependencies...${NC}"
npm install || success=false

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
if [ "$success" = true ]; then
    echo -e "${GREEN}✓${NC} Environment setup completed successfully!\n"
    echo -e "${BOLD}Next steps:${NC}"
    echo -e "1. Review the .env files in each folder if needed"
    echo -e "2. Start infrastructure:  ${BOLD}docker compose -f docker-compose-local.yml up -d${NC}"
    echo -e "3. Start dev server:      ${BOLD}npm run dev${NC}"
    echo -e "\n${GREEN}Happy coding! 🚀${NC}"
else
    echo -e "${RED}✗${NC} Some issues occurred during setup. Please check the errors above."
    exit 1
fi
