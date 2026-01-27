# Web App Quick Start

## Prerequisites
- Node.js 20
- PostgreSQL (if running full stack locally)

## Install
```bash
cd apps/web
npm install
```

## Configure
- Copy `.env.example` to `.env.local` and fill required values.
- For read-only UI work, minimal env values may be enough.

## Run
```bash
npm run dev
```

## Build
```bash
npm run build
```

## Lint
```bash
npm run lint
```

## E2E (Playwright)
```bash
npm run test:e2e
```

## Tips
- Keep changes small and reviewable.
- If an issue lacks context, ask for missing details before coding.
