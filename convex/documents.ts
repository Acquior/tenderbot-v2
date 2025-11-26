import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getOptionalUser, requireUser } from "./auth";

/**
 * List documents for the authenticated user
 * Note: Internal tool - all authenticated users can see all documents
 */
export const list = query({
  args: {
    limit: v.optional(v.number()),
    bundleId: v.optional(v.id("bundles")),
  },
  handler: async (ctx, args) => {
    const identity = await getOptionalUser(ctx);

    if (!identity) {
      return [];
    }

    const documentsQuery = args.bundleId
      ? ctx.db
          .query("documents")
          .withIndex("by_bundle", (q) => q.eq("bundleId", args.bundleId))
      : ctx.db
          .query("documents")
          .withIndex("by_created_at");

    const documents = await documentsQuery
      .order("desc")
      .take(args.limit ?? 50);

    return documents;
  },
});

/**
 * Get a single document by ID
 * Note: Internal tool - all authenticated users can access any document
 */
export const get = query({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const document = await ctx.db.get(args.id);
    return document;
  },
});

/**
 * Create a new document record
 */
export const create = mutation({
  args: {
    filename: v.string(),
    mimeType: v.string(),
    size: v.number(),
    storageId: v.string(),
    bundleId: v.optional(v.id("bundles")),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);

    const documentId = await ctx.db.insert("documents", {
      filename: args.filename,
      mimeType: args.mimeType,
      size: args.size,
      storageId: args.storageId,
      status: "uploaded",
      checksums: {},
      bundleId: args.bundleId,
      createdBy: identity.clerkUserId,
      createdAt: Date.now(),
    });

    return documentId;
  },
});

/**
 * Internal helper to update document status.
 * Only callable from Convex actions/mutations via `internal`.
 */
export const updateStatusInternal = internalMutation({
  args: {
    documentId: v.id("documents"),
    status: v.union(
      v.literal("uploading"),
      v.literal("uploaded"),
      v.literal("processing"),
      v.literal("ocr_in_progress"),
      v.literal("ocr_failed"),
      v.literal("chunking"),
      v.literal("embedding"),
      v.literal("ready"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    await ctx.db.patch(args.documentId, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Internal helper to update document metadata.
 */
export const updateMetadataInternal = internalMutation({
  args: {
    documentId: v.id("documents"),
    metadata: v.object({
      pageCount: v.optional(v.number()),
      language: v.optional(v.string()),
      ocrMethod: v.optional(v.union(v.literal("native"), v.literal("tesseract"), v.literal("azure"), v.literal("azure-read"), v.literal("google"))),
      extractedAt: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    await ctx.db.patch(args.documentId, {
      metadata: {
        ...document.metadata,
        ...args.metadata,
      },
      updatedAt: Date.now(),
    });
  },
});

/**
 * List documents by bundle with their download URLs
 * Use this to display source tender documents on the opportunity detail page
 */
export const listByBundleWithUrls = query({
  args: { bundleId: v.id("bundles") },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_bundle", (q) => q.eq("bundleId", args.bundleId))
      .order("desc")
      .take(50);

    // Get URLs for each document
    const documentsWithUrls = await Promise.all(
      documents.map(async (doc) => {
        const url = await ctx.storage.getUrl(doc.storageId);
        return {
          ...doc,
          url,
        };
      })
    );

    return documentsWithUrls;
  },
});

/**
 * Internal query to get document by ID (for actions)
 */
export const getInternal = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.documentId);
  },
});

/**
 * Internal query to list documents by bundle (for actions)
 */
export const listByBundle = internalQuery({
  args: { bundleId: v.id("bundles") },
  handler: async (ctx, args) => {
    // OPTIMIZED: Added limit to prevent unbounded data transfer
    return await ctx.db
      .query("documents")
      .withIndex("by_bundle", (q) => q.eq("bundleId", args.bundleId))
      .take(100);
  },
});

/**
 * Internal mutation to update Gemini metadata
 */
export const updateGeminiMetadata = internalMutation({
  args: {
    documentId: v.id("documents"),
    geminiFileResourceName: v.optional(v.string()),
    geminiStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("indexing"),
        v.literal("ready"),
        v.literal("error")
      )
    ),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    const patch: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (typeof args.geminiFileResourceName !== "undefined") {
      patch.geminiFileResourceName = args.geminiFileResourceName;
    }

    if (args.geminiStatus) {
      patch.geminiStatus = args.geminiStatus;
    }

    await ctx.db.patch(args.documentId, patch);
  },
});

/**
 * Delete a document
 * Note: Internal tool - all authenticated users can delete any document
 */
export const remove = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const document = await ctx.db.get(args.id);
    if (!document) {
      throw new Error("Document not found");
    }

    // TODO: Also delete the file from storage
    // await ctx.storage.delete(document.storageId);

    await ctx.db.delete(args.id);
  },
});
