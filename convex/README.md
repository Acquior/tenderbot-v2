# Convex Backend

This directory contains the Convex backend for TenderBot.

## Structure

- `schema.ts` - Database schema definitions
- `auth.ts` - Clerk session helpers for Convex
- `documents.ts` - Document CRUD and status management
- `storage.ts` - File storage helpers
- `jobs.ts` - Ingestion pipeline orchestration (Convex jobs + scheduler)
- `opportunities.ts` - Opportunity CRUD scaffolding

## Development

```bash
# Run Convex dev server
npx convex dev

# Deploy to production
npx convex deploy
```

## Authentication

TenderBot uses Clerk for authentication. User sessions are verified in Convex functions using:

```typescript
const identity = await ctx.auth.getUserIdentity();
if (!identity) throw new Error("Not authenticated");
```

## Background Jobs

Long-running tasks (OCR, embeddings, analysis) are coordinated via Convex scheduled functions. See `jobs.ts` for the ingestion pipeline skeleton that updates document status through detection, OCR, chunking, embeddings, and finalization stages.
