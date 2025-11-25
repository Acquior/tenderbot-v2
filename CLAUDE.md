# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TenderBot is an AI-powered tender analysis and opportunity management platform. It processes tender documents, extracts structured data, performs risk analysis, and provides RAG-based knowledge chat.

## Commands

```bash
# Install dependencies
bun install

# Development (all workspaces: Next.js + package watchers)
bun run dev

# Web app only
cd apps/web && bun run dev

# Convex backend dev server (separate terminal)
npx convex dev

# Build all workspaces
bun run build

# Lint & type-check
bun run lint
bun run type-check

# Deploy Convex to production
npx convex deploy
```

## Architecture

### Monorepo Structure (Turbo + Bun)

- **apps/web**: Next.js 15 App Router frontend with Clerk auth, shadcn/ui, Tailwind CSS
- **convex/**: Backend (schema, serverless functions, scheduled jobs, real-time subscriptions)
- **packages/contracts**: Zod schemas and TypeScript types shared across the app
- **packages/llm**: LLM integration (OpenAI, Gemini), structured extraction, prompt templates
- **packages/rag**: RAG utilities (Cohere embeddings, reranking, chunking, retrieval)

### Data Flow

1. **Document Ingestion**: Files uploaded → Convex storage → job pipeline (OCR → chunking → embedding)
2. **Analysis**: Bundle documents → LLM structured extraction → opportunities, requirements, risks
3. **Chat/RAG**: Query → vector search (Cohere embeddings, 1536-dim) → rerank → LLM response with citations

### Key Convex Tables

- `documents`: File metadata, storage IDs, processing status, Gemini file search integration
- `chunks`: Text chunks with embeddings (1536-dim Cohere) and vector index
- `bundles`: Grouped tender documents
- `opportunities`: Extracted tender opportunities with scoring and risks
- `analyses`: Audit trail for LLM analysis runs
- `jobs`: Background task queue (document_ingest, ocr_process, chunk_document, generate_embeddings, analyze_opportunity)

### Authentication

Clerk handles auth. In Convex functions:
```typescript
const identity = await ctx.auth.getUserIdentity();
```

### Routes (apps/web)

- `/sign-in`, `/sign-up`: Clerk auth pages
- `/(app)/app/`: Protected app shell
  - `documents`: Document management
  - `opportunities/[id]`: Opportunity details
  - `chat`: RAG-based knowledge chat
  - `settings`: User settings

## Code Conventions

- TypeScript strict mode throughout
- 2-space indentation, kebab-case filenames
- React components: PascalCase; variables: camelCase; Zod schemas: PascalCase
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`
- Client env vars must be prefixed `NEXT_PUBLIC_*`
- Secrets in `.env.local` (web) and Convex environment (never committed)

## Environment Variables

Required vars documented in `apps/web/.env.example` and `convex/.env.example`:
- Azure OpenAI or OpenAI API credentials
- Cohere API key (embeddings/rerank)
- Clerk keys (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY)
- NEXT_PUBLIC_CONVEX_URL
- Optional: R2 storage, Sentry, Langfuse
