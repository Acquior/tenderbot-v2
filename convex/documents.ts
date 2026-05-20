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
    kind: v.optional(
      v.union(
        v.literal("tender_source"),
        v.literal("company_reference"),
        v.literal("workspace_artifact"),
        v.literal("generated_export"),
        v.literal("form_template")
      )
    ),
    profileId: v.optional(v.id("companyProfiles")),
    workspaceId: v.optional(v.id("tenderWorkspaces")),
  },
  handler: async (ctx, args) => {
    const identity = await getOptionalUser(ctx);

    if (!identity) {
      return [];
    }

    const documentsQuery = args.bundleId
      ? ctx.db.query("documents").withIndex("by_bundle", (q) => q.eq("bundleId", args.bundleId))
      : args.profileId
        ? ctx.db.query("documents").withIndex("by_profile", (q) => q.eq("profileId", args.profileId))
        : args.workspaceId
          ? ctx.db.query("documents").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
          : args.kind
            ? ctx.db.query("documents").withIndex("by_kind", (q) => q.eq("kind", args.kind))
            : ctx.db.query("documents").withIndex("by_created_at");

    const documents = await documentsQuery.order("desc").take(args.limit ?? 50);

    const effectiveKind = args.kind ?? "tender_source";

    return documents.filter((document) => (document.kind ?? "tender_source") === effectiveKind);
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
    kind: v.optional(
      v.union(
        v.literal("tender_source"),
        v.literal("company_reference"),
        v.literal("workspace_artifact"),
        v.literal("generated_export"),
        v.literal("form_template")
      )
    ),
    profileId: v.optional(v.id("companyProfiles")),
    workspaceId: v.optional(v.id("tenderWorkspaces")),
    documentCategory: v.optional(v.string()),
    approvalStatus: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("approved"),
        v.literal("expired"),
        v.literal("rejected")
      )
    ),
    expiresAt: v.optional(v.number()),
    sourceDocumentId: v.optional(v.id("documents")),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);

    const documentId = await ctx.db.insert("documents", {
      filename: args.filename,
      mimeType: args.mimeType,
      size: args.size,
      storageId: args.storageId,
      status: "uploaded",
      kind: args.kind ?? "tender_source",
      checksums: {},
      bundleId: args.bundleId,
      profileId: args.profileId,
      workspaceId: args.workspaceId,
      documentCategory: args.documentCategory,
      approvalStatus: args.approvalStatus,
      expiresAt: args.expiresAt,
      sourceDocumentId: args.sourceDocumentId,
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
      kind: document.kind ?? "tender_source",
      updatedAt: Date.now(),
    });
  },
});

export const updateDetailsInternal = internalMutation({
  args: {
    documentId: v.id("documents"),
    kind: v.optional(
      v.union(
        v.literal("tender_source"),
        v.literal("company_reference"),
        v.literal("workspace_artifact"),
        v.literal("generated_export"),
        v.literal("form_template")
      )
    ),
    profileId: v.optional(v.id("companyProfiles")),
    workspaceId: v.optional(v.id("tenderWorkspaces")),
    documentCategory: v.optional(v.string()),
    approvalStatus: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("approved"),
        v.literal("expired"),
        v.literal("rejected")
      )
    ),
    expiresAt: v.optional(v.number()),
    sourceDocumentId: v.optional(v.id("documents")),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    await ctx.db.patch(args.documentId, {
      kind: args.kind ?? document.kind ?? "tender_source",
      profileId: typeof args.profileId === "undefined" ? document.profileId : args.profileId,
      workspaceId: typeof args.workspaceId === "undefined" ? document.workspaceId : args.workspaceId,
      documentCategory:
        typeof args.documentCategory === "undefined" ? document.documentCategory : args.documentCategory,
      approvalStatus:
        typeof args.approvalStatus === "undefined" ? document.approvalStatus : args.approvalStatus,
      expiresAt: typeof args.expiresAt === "undefined" ? document.expiresAt : args.expiresAt,
      sourceDocumentId:
        typeof args.sourceDocumentId === "undefined" ? document.sourceDocumentId : args.sourceDocumentId,
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
      documents
        .filter((doc) => (doc.kind ?? "tender_source") === "tender_source")
        .map(async (doc) => {
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

export const createGeneratedInternal = internalMutation({
  args: {
    filename: v.string(),
    mimeType: v.string(),
    size: v.number(),
    storageId: v.string(),
    kind: v.union(
      v.literal("company_reference"),
      v.literal("workspace_artifact"),
      v.literal("generated_export"),
      v.literal("form_template"),
      v.literal("tender_source")
    ),
    createdBy: v.string(),
    bundleId: v.optional(v.id("bundles")),
    profileId: v.optional(v.id("companyProfiles")),
    workspaceId: v.optional(v.id("tenderWorkspaces")),
    documentCategory: v.optional(v.string()),
    approvalStatus: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("approved"),
        v.literal("expired"),
        v.literal("rejected")
      )
    ),
    expiresAt: v.optional(v.number()),
    sourceDocumentId: v.optional(v.id("documents")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("documents", {
      filename: args.filename,
      mimeType: args.mimeType,
      size: args.size,
      storageId: args.storageId,
      status: "ready",
      kind: args.kind,
      checksums: {},
      bundleId: args.bundleId,
      profileId: args.profileId,
      workspaceId: args.workspaceId,
      documentCategory: args.documentCategory,
      approvalStatus: args.approvalStatus,
      expiresAt: args.expiresAt,
      sourceDocumentId: args.sourceDocumentId,
      createdBy: args.createdBy,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Internal query to list documents by bundle (for actions)
 */
export const listByBundle = internalQuery({
  args: { bundleId: v.id("bundles") },
  handler: async (ctx, args) => {
    // OPTIMIZED: Added limit to prevent unbounded data transfer
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_bundle", (q) => q.eq("bundleId", args.bundleId))
      .take(100);
    return documents.filter((document) => (document.kind ?? "tender_source") === "tender_source");
  },
});

export const listByProfileWithUrls = query({
  args: {
    profileId: v.id("companyProfiles"),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_profile", (q) => q.eq("profileId", args.profileId))
      .order("desc")
      .take(100);

    return Promise.all(
      documents.map(async (document) => ({
        ...document,
        url: await ctx.storage.getUrl(document.storageId),
      }))
    );
  },
});

export const listByWorkspaceWithUrls = query({
  args: {
    workspaceId: v.id("tenderWorkspaces"),
    kind: v.optional(
      v.union(
        v.literal("tender_source"),
        v.literal("company_reference"),
        v.literal("workspace_artifact"),
        v.literal("generated_export"),
        v.literal("form_template")
      )
    ),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(100);

    const filtered = args.kind
      ? documents.filter((document) => (document.kind ?? "tender_source") === args.kind)
      : documents;

    return await Promise.all(
      filtered.map(async (document) => ({
        ...document,
        url: await ctx.storage.getUrl(document.storageId),
      }))
    );
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
