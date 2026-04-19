# Orbit

Turborepo monorepo with a React frontend, NestJS backend API, and shared UI library.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 24
- [pnpm](https://pnpm.io/) >= 10
- [Docker](https://www.docker.com/) & Docker Compose

## Getting Started

### 1. Clone the repo

```bash
git clone <repo-url> && cd orbit
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up environment variables

Copy the example env files and adjust values as needed:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

### 4. Start infrastructure services

Spin up PostgreSQL, Redis, RabbitMQ, and RustFS via Docker Compose:

```bash
docker compose -f docker-compose-local.yml up -d
```

| Service    | Port  | UI                          |
|------------|-------|-----------------------------|
| PostgreSQL | 5433  |                             |
| Redis      | 6379  |                             |
| RabbitMQ   | 5672  | http://localhost:15672      |
| RustFS (S3)| 9000  | http://localhost:9001       |

After RustFS is up, create the `orbit` bucket via the console at http://localhost:9001 (login: `rustfsadmin` / `rustfsadmin`).

### 5. Run database migrations

```bash
cd apps/api && npx drizzle-kit migrate
```

### 6. Start development

From the repo root:

```bash
pnpm dev
```

This starts all apps in watch mode via Turbo:

| App          | URL                    |
|--------------|------------------------|
| Web (Vite)   | http://localhost:3000   |
| API (NestJS) | http://localhost:8000   |

## Scripts

| Command             | Description                          |
|---------------------|--------------------------------------|
| `pnpm dev`          | Start all apps in watch mode         |
| `pnpm build`        | Build all apps and packages          |
| `pnpm check`        | Biome check (lint + format)          |
| `pnpm lint`         | Biome lint only                      |
| `pnpm format`       | Biome format only                    |
