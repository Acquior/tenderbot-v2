import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getOptionalUser, requireUser } from "./auth";
import type { Id } from "./_generated/dataModel";

/**
 * Chunk data structure for insertion
 */
export interface ChunkInsert {
  documentId: string;
  sequence: number;
  text: string;
  tokens: number;
  embedding: number[];
  metadata: {
    page?: number;
    section?: string;
    heading?: string;
    startOffset?: number;
    endOffset?: number;
  };
}

/**
 * Insert chunks for a document (batch operation)
 * Internal mutation - only called from actions during ingestion
 */
export const insertBatch = internalMutation({
  args: {
    chunks: v.array(
      v.object({
        documentId: v.id("documents"),
        sequence: v.number(),
        text: v.string(),
        tokens: v.number(),
        embedding: v.array(v.number()),
        metadata: v.object({
          page: v.optional(v.number()),
          section: v.optional(v.string()),
          heading: v.optional(v.string()),
          startOffset: v.optional(v.number()),
          endOffset: v.optional(v.number()),
        }),
        organizationId: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const insertedIds = [];

    for (const chunk of args.chunks) {
      const id = await ctx.db.insert("chunks", {
        ...chunk,
        createdAt: Date.now(),
      });
      insertedIds.push(id);
    }

    return { count: insertedIds.length, ids: insertedIds };
  },
});

/**
 * List all chunks for a document
 * Note: Internal tool - all authenticated users can access any document's chunks
 */
export const listByDocument = query({
  args: {
    documentId: v.id("documents"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    // Get chunks ordered by sequence
    const chunks = await ctx.db
      .query("chunks")
      .withIndex("by_document_sequence", (q) => q.eq("documentId", args.documentId))
      .take(args.limit ?? 1000);

    return chunks;
  },
});

/**
 * Vector similarity search across all chunks
 * Note: Internal tool - no organization filtering needed
 */
export const search = query({
  args: {
    queryEmbedding: v.array(v.number()),
    limit: v.optional(v.number()),
    documentId: v.optional(v.id("documents")),
  },
  handler: async (ctx, args) => {
    await getOptionalUser(ctx);

    const searchOptions: {
      vector: number[];
      limit: number;
      filter?: (q: any) => any;
    } = {
      vector: args.queryEmbedding,
      limit: args.limit ?? 10,
    };

    if (args.documentId) {
      searchOptions.filter = (q) => q.eq("documentId", args.documentId);
    }

    const results = (await (ctx as any).vectorSearch("chunks", "by_embedding", searchOptions)) as Array<{
      _id: Id<"chunks">;
      documentId: Id<"documents">;
      text: string;
      metadata: ChunkInsert["metadata"];
      sequence: number;
      _score: number;
    }>;

    return results.map((result) => ({
      _id: result._id,
      documentId: result.documentId,
      text: result.text,
      score: result._score,
      metadata: result.metadata,
      sequence: result.sequence,
    }));
  },
});

/**
 * Internal query to list chunks by document (for actions)
 */
export const listByDocumentInternal = internalQuery({
  args: {
    documentId: v.id("documents"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get chunks ordered by sequence
    const chunks = await ctx.db
      .query("chunks")
      .withIndex("by_document_sequence", (q) => q.eq("documentId", args.documentId))
      .take(args.limit ?? 1000);

    return chunks;
  },
});

/**
 * LIGHTWEIGHT: List chunks without embedding field (bandwidth efficient)
 * Use this when you only need text/metadata, not the vector embedding
 * Note: Internal tool - all authenticated users can access any document's chunks
 */
export const listByDocumentLightweight = query({
  args: {
    documentId: v.id("documents"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const chunks = await ctx.db
      .query("chunks")
      .withIndex("by_document_sequence", (q) => q.eq("documentId", args.documentId))
      .take(args.limit ?? 1000);

    // Project only needed fields, EXCLUDE embedding (~12KB per chunk saved)
    return chunks.map((chunk) => ({
      _id: chunk._id,
      documentId: chunk.documentId,
      sequence: chunk.sequence,
      text: chunk.text,
      tokens: chunk.tokens,
      metadata: chunk.metadata,
      createdAt: chunk.createdAt,
    }));
  },
});

/**
 * LIGHTWEIGHT: Internal query without embeddings (for jobs/analyses)
 * Saves ~12KB bandwidth per chunk
 */
export const listByDocumentInternalLightweight = internalQuery({
  args: {
    documentId: v.id("documents"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const chunks = await ctx.db
      .query("chunks")
      .withIndex("by_document_sequence", (q) => q.eq("documentId", args.documentId))
      .take(args.limit ?? 1000);

    // Project only needed fields, EXCLUDE embedding
    return chunks.map((chunk) => ({
      _id: chunk._id,
      documentId: chunk.documentId,
      sequence: chunk.sequence,
      text: chunk.text,
      tokens: chunk.tokens,
      metadata: chunk.metadata,
      createdAt: chunk.createdAt,
    }));
  },
});

/**
 * Delete all chunks for a document
 * Internal mutation - called during document deletion or re-processing
 * OPTIMIZED: Uses pagination to avoid loading all embedding data at once
 */
export const deleteByDocument = internalMutation({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    let deletedCount = 0;

    // Paginate deletion to avoid loading all chunks (with embeddings) into memory
    // Each iteration only loads 100 chunks at a time
    while (true) {
      const chunks = await ctx.db
        .query("chunks")
        .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
        .take(100);

      if (chunks.length === 0) break;

      for (const chunk of chunks) {
        await ctx.db.delete(chunk._id);
        deletedCount++;
      }
    }

    return { deletedCount };
  },
});

/**
 * Get chunk count for a document
 * OPTIMIZED: Uses pagination to count without loading all embedding data
 * Note: Internal tool - all authenticated users can access any document's chunk count
 */
export const countByDocument = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    // Count using pagination to avoid loading all embedding data
    let count = 0;
    let isDone = false;
    let cursor: string | null = null;

    while (!isDone) {
      const result = await ctx.db
        .query("chunks")
        .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
        .paginate({ numItems: 100, cursor });

      count += result.page.length;
      isDone = result.isDone;
      cursor = result.continueCursor;
    }

    return count;
  },
});

/**
 * Get a single chunk by ID
 * Note: Internal tool - all authenticated users can access any chunk
 */
export const get = query({
  args: {
    id: v.id("chunks"),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const chunk = await ctx.db.get(args.id);
    return chunk;
  },
});
