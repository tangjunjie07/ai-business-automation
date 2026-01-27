# AI Business Automation

Automated workflows and a Next.js web app for AI-assisted business operations. This repo includes GitHub Actions automation for issue-driven PR generation and CI, plus a production-ready web app under `apps/web`.

## Highlights
- Issue-driven automation: comment `@copilot` on issues to trigger an agent run.
- Auto PR creation with test reports attached.
- Web app built with Next.js App Router and Prisma.
- E2E testing with Playwright on PRs.

## Repository Structure
```
.
├── apps/
│   └── web/            # Next.js app (App Router, Prisma, Tailwind)
├── .github/
│   ├── workflows/      # GitHub Actions workflows
│   ├── ISSUE_TEMPLATE/ # Issue templates
│   └── instructions/   # Copilot instructions
└── package.json
```

## Quick Start (apps/web)
```bash
cd apps/web
npm install
npm run dev
```
Open `http://localhost:3000`.

### Build
```bash
npm run build
```

### Lint
```bash
npm run lint
```

### E2E (Playwright)
```bash
npm run test:e2e
```

## Automation Workflows

### 1) Copilot Issue Gate
Workflow: `.github/workflows/copilot-issue-gate.yml`
- Trigger: issue comment containing `@copilot`
- Behavior:
  - Checks for required sections in the issue body.
  - If missing, posts a clarification request.
  - If complete, adds `copilot-ready` label.

### 2) Copilot Agent PR
Workflow: `.github/workflows/copilot-agent-pr.yml`
- Trigger: issue comment containing `@copilot`
- Requirements:
  - Issue must be labeled `copilot-ready`.
  - `OPENAI_API_KEY` must be set in GitHub Secrets.
- Behavior:
  - Builds a prompt from issue + repo context.
  - Generates a unified diff patch and applies it.
  - Runs lint/build/E2E tests.
  - Creates a PR with the test report attached.
  - Publishes a test report to `docs/index.html`.

### 3) Web CI
Workflow: `.github/workflows/web-app-ci.yml`
- Runs on PRs for `apps/web/**`.
- Lint, build, and Playwright E2E.

## Environment
- Use `.env.example` as a template for `.env.local` in `apps/web`.
- Do not commit secrets; use GitHub Secrets for CI.

## Documentation
- `apps/web/docs/architecture.md` for structure and flows.
- `apps/web/docs/onboarding.md` for setup and dev tips.

## Contributing
- Use the issue template when reporting bugs.
- For automation, comment `@copilot` on an issue once details are complete.

## License
TBD
