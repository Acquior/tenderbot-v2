import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getOptionalUser, requireUser } from "./auth";

/**
 * List documents for the authenticated user
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
      : identity.organizationId
          ? ctx.db
              .query("documents")
              .withIndex("by_organization", (q) =>
                q.eq("organizationId", identity.organizationId as string)
              )
          : ctx.db
              .query("documents")
              .withIndex("by_created_by", (q) => q.eq("createdBy", identity.clerkUserId));

    const documents = await documentsQuery
      .order("desc")
      .take(args.limit ?? 50);

    return documents.filter((doc) => {
      if (doc.createdBy === identity.clerkUserId) {
        return true;
      }

      if (identity.organizationId && doc.organizationId === identity.organizationId) {
        return true;
      }

      return false;
    });
  },
});

/**
 * Get a single document by ID
 */
export const get = query({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
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
      organizationId: identity.organizationId,
      createdAt: Date.now(),
    });

    return documentId;
  },
});

/**
 * Update document status
 */
export const updateStatus = mutation({
  args: {
    id: v.id("documents"),
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
    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Delete a document
 */
export const remove = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);
    const document = await ctx.db.get(args.id);
    if (!document) {
      throw new Error("Document not found");
    }

    if (
      document.createdBy !== identity.clerkUserId &&
      document.organizationId !== identity.organizationId
    ) {
      throw new Error("Forbidden");
    }

    // TODO: Also delete the file from storage
    // await ctx.storage.delete(document.storageId);

    await ctx.db.delete(args.id);
  },
});
