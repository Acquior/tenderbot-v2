# Convex Backend

This directory contains the Convex backend for TenderBot.

## Structure

- `schema.ts` - Database schema definitions
- `documents.ts` - Document CRUD operations
- `storage.ts` - File storage functions
- `opportunities.ts` - Opportunity management
- `jobs.ts` - Background job processing
- `auth.ts` - Authentication and authorization

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

Long-running tasks (OCR, embeddings, analysis) are handled as background jobs using Convex scheduled functions.

See `jobs.ts` for job processing logic.
