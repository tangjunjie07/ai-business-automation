# Web App Architecture

This document summarizes the current structure and key flows for `apps/web`.

## High-Level Layout
- `app/`: Next.js App Router routes, layouts, and UI.
- `app/api/`: Server actions and API routes.
- `app/components/`: Shared UI components.
- `app/lib/` and `config/`: Shared utilities and configuration.
- `prisma/`: Database schema and migrations.
- `public/`: Static assets.
- `scripts/`: Local tooling scripts.

## Key Runtime Paths
- UI routes live under `app/*`.
- API endpoints live under `app/api/*`.
- Auth is wired via `next-auth` and Prisma adapter.

## Data & Persistence
- Prisma schema is in `prisma/schema.prisma`.
- Prisma client is generated during build: `npx prisma generate`.

## Styling
- Tailwind CSS is used.
- Global styles live in `app/globals.css`.

## Testing
- E2E tests: Playwright in `tests/e2e/`.
- CI runs lint, build, and Playwright on PRs.

## Environment
- Reference values in `.env.example` and `.env.*` files.
- CI should avoid relying on local-only secrets.
