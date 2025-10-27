import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireUser } from "./auth";

/**
 * Auto-detect and create/link bundle for a document
 * Uses heuristics: same user + organization + within time window + filename patterns
 */
export const detectBundle = internalMutation({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    // Skip if already assigned to a bundle
    if (document.bundleId) {
      return { bundleId: document.bundleId, created: false };
    }

    // Extract potential reference number from filename
    const referenceNumber = extractReferenceNumber(document.filename);

    // Time window: 5 minutes
    const timeWindow = 5 * 60 * 1000;
    const uploadTimeMin = document.createdAt - timeWindow;
    const uploadTimeMax = document.createdAt + timeWindow;

    // Find recent documents from same user/org
    const recentDocs = await ctx.db
      .query("documents")
      .withIndex("by_created_by", (q) => q.eq("createdBy", document.createdBy))
      .filter((q) =>
        q.and(
          q.gte(q.field("createdAt"), uploadTimeMin),
          q.lte(q.field("createdAt"), uploadTimeMax)
        )
      )
      .collect();

    // Filter by organization if present
    const candidates = recentDocs.filter((doc) => {
      if (document.organizationId && doc.organizationId !== document.organizationId) {
        return false;
      }
      return true;
    });

    // Check if any candidates have bundles
    let existingBundle = null;
    for (const candidate of candidates) {
      if (candidate.bundleId) {
        const bundle = await ctx.db.get(candidate.bundleId);
        if (bundle) {
          // Check if bundle matches criteria
          if (
            (!referenceNumber || bundle.referenceNumber === referenceNumber) &&
            bundle.createdBy === document.createdBy &&
            bundle.organizationId === document.organizationId
          ) {
            existingBundle = bundle;
            break;
          }
        }
      }
    }

    if (existingBundle) {
      // Link to existing bundle
      await ctx.db.patch(args.documentId, {
        bundleId: existingBundle._id,
        updatedAt: Date.now(),
      });

      // Update bundle metadata
      await updateBundleMetadata(ctx, existingBundle._id);

      return { bundleId: existingBundle._id, created: false };
    }

    // Create new bundle if we have multiple candidates or a reference number
    if (candidates.length >= 2 || referenceNumber) {
      const bundleName = referenceNumber
        ? `Tender ${referenceNumber}`
        : `Bundle ${new Date(document.createdAt).toLocaleDateString()}`;

      const bundleId = await ctx.db.insert("bundles", {
        name: bundleName,
        referenceNumber: referenceNumber || undefined,
        status: "processing",
        createdBy: document.createdBy,
        organizationId: document.organizationId,
        createdAt: Date.now(),
        metadata: {
          detectedAt: Date.now(),
          confidence: referenceNumber ? 0.9 : 0.6,
        },
      });

      // Link current document
      await ctx.db.patch(args.documentId, {
        bundleId,
        updatedAt: Date.now(),
      });

      // Link other candidates with matching reference
      if (referenceNumber) {
        for (const candidate of candidates) {
          if (candidate._id !== args.documentId && !candidate.bundleId) {
            const candidateRef = extractReferenceNumber(candidate.filename);
            if (candidateRef === referenceNumber) {
              await ctx.db.patch(candidate._id, {
                bundleId,
                updatedAt: Date.now(),
              });
            }
          }
        }
      }

      // Update bundle metadata
      await updateBundleMetadata(ctx, bundleId);

      return { bundleId, created: true };
    }

    // Fallback: create a single-document bundle so downstream analysis can run
    const baseName = document.filename.replace(/\.[^/.]+$/, "");
    const fallbackName = baseName ? `Tender ${baseName}` : `Tender ${new Date(document.createdAt).toLocaleDateString()}`;

    const fallbackBundleId = await ctx.db.insert("bundles", {
      name: fallbackName,
      referenceNumber: referenceNumber || undefined,
      status: "processing",
      createdBy: document.createdBy,
      organizationId: document.organizationId,
      createdAt: Date.now(),
      metadata: {
        detectedAt: Date.now(),
        confidence: referenceNumber ? 0.6 : 0.3,
        bundleType: "single",
      },
    });

    await ctx.db.patch(args.documentId, {
      bundleId: fallbackBundleId,
      updatedAt: Date.now(),
    });

    await updateBundleMetadata(ctx, fallbackBundleId);

    return { bundleId: fallbackBundleId, created: true };
  },
});

/**
 * Create a bundle manually
 */
export const create = mutation({
  args: {
    name: v.string(),
    issuer: v.optional(v.string()),
    referenceNumber: v.optional(v.string()),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);

    const bundleId = await ctx.db.insert("bundles", {
      name: args.name,
      issuer: args.issuer,
      referenceNumber: args.referenceNumber,
      dueDate: args.dueDate,
      status: "draft",
      createdBy: identity.clerkUserId,
      organizationId: identity.organizationId,
      createdAt: Date.now(),
    });

    return bundleId;
  },
});

/**
 * Add a document to a bundle
 */
export const addDocument = mutation({
  args: {
    bundleId: v.id("bundles"),
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);

    const bundle = await ctx.db.get(args.bundleId);
    if (!bundle) {
      throw new Error("Bundle not found");
    }

    if (bundle.createdBy !== identity.clerkUserId) {
      throw new Error("Forbidden");
    }

    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    if (document.createdBy !== identity.clerkUserId) {
      throw new Error("Forbidden");
    }

    await ctx.db.patch(args.documentId, {
      bundleId: args.bundleId,
      updatedAt: Date.now(),
    });

    await updateBundleMetadata(ctx, args.bundleId);

    return true;
  },
});

/**
 * Update bundle completeness and metadata
 */
export const updateCompleteness = internalMutation({
  args: {
    bundleId: v.id("bundles"),
  },
  handler: async (ctx, args) => {
    await updateBundleMetadata(ctx, args.bundleId);
  },
});

/**
 * List all bundles for the user
 */
export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);

    const bundlesQuery = identity.organizationId
      ? ctx.db
          .query("bundles")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", identity.organizationId as string)
          )
      : ctx.db
          .query("bundles")
          .withIndex("by_created_by", (q) => q.eq("createdBy", identity.clerkUserId));

    const bundles = await bundlesQuery
      .order("desc")
      .take(args.limit ?? 50);

    return bundles;
  },
});

/**
 * Get a single bundle
 */
export const get = query({
  args: { id: v.id("bundles") },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);
    const bundle = await ctx.db.get(args.id);

    if (!bundle) {
      return null;
    }

    const authorized =
      bundle.createdBy === identity.clerkUserId ||
      (identity.organizationId && bundle.organizationId === identity.organizationId);

    if (!authorized) {
      throw new Error("Forbidden");
    }

    return bundle;
  },
});

/**
 * Get documents in a bundle
 */
export const getDocuments = query({
  args: {
    bundleId: v.id("bundles"),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);

    const bundle = await ctx.db.get(args.bundleId);
    if (!bundle) {
      return [];
    }

    const authorized =
      bundle.createdBy === identity.clerkUserId ||
      (identity.organizationId && bundle.organizationId === identity.organizationId);

    if (!authorized) {
      throw new Error("Forbidden");
    }

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_bundle", (q) => q.eq("bundleId", args.bundleId))
      .collect();

    return documents;
  },
});

/**
 * Helper: Update bundle metadata (total pages, size, status, completeness)
 */
async function updateBundleMetadata(
  ctx: any,
  bundleId: any
): Promise<void> {
  const documents = await ctx.db
    .query("documents")
    .withIndex("by_bundle", (q: any) => q.eq("bundleId", bundleId))
    .collect();

  if (documents.length === 0) {
    return;
  }

  // Calculate aggregates
  const totalPages = documents.reduce(
    (sum: number, doc: any) => sum + (doc.metadata?.pageCount || 0),
    0
  );
  const totalSize = documents.reduce((sum: number, doc: any) => sum + doc.size, 0);

  // Determine bundle status
  const allReady = documents.every((doc: any) => doc.status === "ready");
  const anyFailed = documents.some((doc: any) => doc.status === "failed");
  const anyProcessing = documents.some((doc: any) =>
    ["processing", "ocr_in_progress", "chunking", "embedding"].includes(doc.status)
  );

  let status: "draft" | "processing" | "ready" | "incomplete" | "complete";
  if (anyFailed) {
    status = "incomplete";
  } else if (anyProcessing) {
    status = "processing";
  } else if (allReady) {
    status = "ready";
  } else {
    status = "draft";
  }

  // Simple completeness score: percentage of documents ready
  const readyCount = documents.filter((doc: any) => doc.status === "ready").length;
  const completenessScore = documents.length > 0 ? readyCount / documents.length : 0;

  await ctx.db.patch(bundleId, {
    status,
    completeness: {
      score: completenessScore,
    },
    metadata: {
      totalPages,
      totalSize,
      detectedAt: Date.now(),
    },
    updatedAt: Date.now(),
  });
}

/**
 * Internal query to get a bundle (for actions)
 */
export const getInternal = internalQuery({
  args: { id: v.id("bundles") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Internal query to get documents in a bundle (for actions)
 */
export const getDocumentsInternal = internalQuery({
  args: {
    bundleId: v.id("bundles"),
  },
  handler: async (ctx, args) => {
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_bundle", (q) => q.eq("bundleId", args.bundleId))
      .collect();

    return documents;
  },
});

/**
 * Helper: Extract reference number from filename
 * Looks for patterns like: RFP-2024-123, TENDER-123, etc.
 */
function extractReferenceNumber(filename: string): string | null {
  const patterns = [
    /RFP[- ]?(\d{4}[- ]\d+)/i,
    /RFQ[- ]?(\d{4}[- ]\d+)/i,
    /TENDER[- ]?(\d{4}[- ]\d+)/i,
    /REF[- ]?(\d{4}[- ]\d+)/i,
    /BID[- ]?(\d{4}[- ]\d+)/i,
    /(\d{4}[- ]\d{3,})/,  // Generic year-number pattern
  ];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) {
      return match[0].toUpperCase();
    }
  }

  return null;
}
