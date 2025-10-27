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
 */
export const listByDocument = query({
  args: {
    documentId: v.id("documents"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);

    // Verify access to document
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    const hasAccess =
      document.createdBy === identity.clerkUserId ||
      (identity.organizationId && document.organizationId === identity.organizationId);

    if (!hasAccess) {
      throw new Error("Forbidden");
    }

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
 */
export const search = query({
  args: {
    queryEmbedding: v.array(v.number()),
    limit: v.optional(v.number()),
    documentId: v.optional(v.id("documents")),
    organizationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await getOptionalUser(ctx);

    const shouldFilterByDocument = Boolean(args.documentId);
    const organizationId = identity?.organizationId ?? args.organizationId;

    const searchOptions: {
      vector: number[];
      limit: number;
      filter?: (q: any) => any;
    } = {
      vector: args.queryEmbedding,
      limit: args.limit ?? 10,
    };

    if (shouldFilterByDocument || organizationId) {
      searchOptions.filter = (q) => {
        const predicates = [];

        if (shouldFilterByDocument && args.documentId) {
          predicates.push(q.eq("documentId", args.documentId));
        }

        if (organizationId) {
          predicates.push(q.eq("organizationId", organizationId));
        }

        return predicates.length === 1 ? predicates[0] : q.and(...predicates);
      };
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
 * Delete all chunks for a document
 * Internal mutation - called during document deletion or re-processing
 */
export const deleteByDocument = internalMutation({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const chunks = await ctx.db
      .query("chunks")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    let deletedCount = 0;
    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id);
      deletedCount++;
    }

    return { deletedCount };
  },
});

/**
 * Get chunk count for a document
 */
export const countByDocument = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);

    // Verify access
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      return 0;
    }

    const hasAccess =
      document.createdBy === identity.clerkUserId ||
      (identity.organizationId && document.organizationId === identity.organizationId);

    if (!hasAccess) {
      throw new Error("Forbidden");
    }

    const chunks = await ctx.db
      .query("chunks")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    return chunks.length;
  },
});

/**
 * Get a single chunk by ID
 */
export const get = query({
  args: {
    id: v.id("chunks"),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);
    const chunk = await ctx.db.get(args.id);

    if (!chunk) {
      return null;
    }

    // Verify access via document
    const document = await ctx.db.get(chunk.documentId);
    if (!document) {
      return null;
    }

    const hasAccess =
      document.createdBy === identity.clerkUserId ||
      (identity.organizationId && document.organizationId === identity.organizationId);

    if (!hasAccess) {
      throw new Error("Forbidden");
    }

    return chunk;
  },
});
