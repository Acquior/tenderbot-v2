# TenderBot v2 - Greenfield Rebuild

AI-powered tender analysis and opportunity management platform. Built with Convex, Next.js 14, OpenAI, and shadcn/ui.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Convex (real-time DB, auth, serverless functions, jobs)
- **Auth**: Clerk
- **AI/LLM**: OpenAI GPT-4.1/GPT-5 (Responses API), Cohere embeddings, Cohere Rerank
- **Storage**: Convex File Storage (primary), Cloudflare R2 (large files)
- **Vector DB**: Supabase Postgres + pgvector
- **Infra**: Vercel (frontend), GitHub Actions (CI/CD)

## Repository Structure

```
.
├── apps/
│   └── web/                 # Next.js application
├── packages/
│   ├── contracts/           # Zod schemas & types
│   ├── llm/                 # LLM integration & routing
│   └── rag/                 # RAG & retrieval logic
├── convex/                  # Convex backend (DB schema, functions)
├── infra/                   # Infrastructure as Code (optional)
└── package.json             # Monorepo root config
```

## Getting Started

### Prerequisites

- Node.js >= 18.17
- npm or yarn
- Convex account (free tier available)
- Clerk account (auth)
- OpenAI API key
- Cohere API key

### Installation

```bash
# Clone and install
git clone <repo>
cd tenderbot-v2
npm install

# Set up environment variables
cp apps/web/.env.example apps/web/.env.local
# Edit .env.local with your API keys and secrets
```

### Development

```bash
# Start dev servers (Next.js + Convex)
npm run dev

# Type checking across monorepo
npm run type-check

# Linting
npm run lint

# Building
npm run build
```

## Features

### Core Functionality (M1-M2)
- Multi-file tender bundle ingestion
- Document hygiene & duplicate detection
- OCR with selective fallback

### Extraction & Analysis (M3-M4)
- Structured extraction with confidence scores
- Requirement matrix with status tracking
- Risk scoring & gap analysis
- Knowledge chat with RAG + citations

### Collaboration (M5)
- Anchored comments & @mentions
- Review workflows (Draft → Reviewed → Approved)
- Metrics dashboards

## Development Workflow

1. **Branch naming**: `feature/xyz`, `fix/xyz`, `docs/xyz`
2. **Commits**: Use conventional commits (`feat:`, `fix:`, `docs:`, etc.)
3. **PRs**: Link to issues, include test coverage
4. **Deployments**: Vercel auto-deploys from main

## Environment Variables

See `apps/web/.env.example` and `convex/.env.example` for required variables.

```env
# Core APIs
OPENAI_API_KEY=sk-...
COHERE_API_KEY=...

# Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...

# Storage
CF_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=...

# Database
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# Observability
SENTRY_DSN=...
LANGFUSE_PUBLIC_KEY=...
LANGFUSE_SECRET_KEY=...
```

## Documentation

- [Architecture & Design](./docs/ARCHITECTURE.md)
- [API Reference](./docs/API.md)
- [Contributing Guidelines](./CONTRIBUTING.md)

## License

Proprietary - All rights reserved.

## Contact

For questions or support, reach out to the TenderBot team.
