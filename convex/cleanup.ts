import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireUser } from "./auth";
import {
  ageInDays,
  ageInHours,
  daysAgo,
  hoursAgo,
  MS_PER_DAY,
} from "./lib/timeUtils";
import {
  deleteDocumentWithRelatedData,
  deleteDocumentsBatch,
  deleteOldItemsKeepingRecent,
  estimateChunkStorageMB,
  bytesToMB,
} from "./lib/cleanupUtils";

/**
 * ============================================================================
 * STORAGE CLEANUP UTILITIES
 * ============================================================================
 * Functions to help manage Convex storage and stay within free tier limits.
 * Note: Internal tool - all authenticated users can perform cleanup operations.
 *
 * Main storage consumers:
 * 1. File storage (documents.storageId)
 * 2. Chunks table (embeddings are 1536-dim floats = ~6KB per chunk)
 * 3. Jobs table (stores input/output/resumeData)
 * 4. Analyses table (stores large result objects)
 */

// ============================================================================
// QUERIES - View what can be cleaned up
// ============================================================================

/**
 * Get storage usage overview
 */
export const getStorageOverview = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);

    // Count documents
    const allDocs = await ctx.db.query("documents").collect();
    const allChunks = await ctx.db.query("chunks").collect();
    const allJobs = await ctx.db.query("jobs").collect();
    const allAnalyses = await ctx.db.query("analyses").collect();

    // Categorize by status
    const failedDocs = allDocs.filter(
      (d) => d.status === "failed" || d.status === "ocr_failed"
    );
    const oldDocs = allDocs.filter((d) => ageInDays(d.createdAt) > 30);

    const completedJobs = allJobs.filter((j) => j.status === "completed");
    const failedJobs = allJobs.filter((j) => j.status === "failed");
    const oldJobs = allJobs.filter((j) => ageInDays(j.createdAt) > 7);

    // Calculate estimated storage
    const estimatedChunkStorageMB = estimateChunkStorageMB(allChunks.length);
    const estimatedDocStorageMB =
      allDocs.reduce((acc, d) => acc + d.size, 0) / (1024 * 1024);

    return {
      documents: {
        total: allDocs.length,
        failed: failedDocs.length,
        olderThan30Days: oldDocs.length,
        estimatedStorageMB: estimatedDocStorageMB.toFixed(2),
      },
      chunks: {
        total: allChunks.length,
        estimatedStorageMB: estimatedChunkStorageMB.toFixed(2),
      },
      jobs: {
        total: allJobs.length,
        completed: completedJobs.length,
        failed: failedJobs.length,
        olderThan7Days: oldJobs.length,
      },
      analyses: {
        total: allAnalyses.length,
      },
      recommendations: [
        failedDocs.length > 0
          ? `Delete ${failedDocs.length} failed documents to free storage`
          : null,
        completedJobs.length > 10
          ? `Delete ${completedJobs.length} completed jobs (keeping recent ones)`
          : null,
        failedJobs.length > 0
          ? `Delete ${failedJobs.length} failed jobs`
          : null,
        oldDocs.length > 0
          ? `Review ${oldDocs.length} documents older than 30 days`
          : null,
      ].filter(Boolean),
    };
  },
});

/**
 * List documents that can be cleaned up
 */
export const listCleanupCandidates = query({
  args: {
    type: v.union(
      v.literal("failed_documents"),
      v.literal("old_documents"),
      v.literal("completed_jobs"),
      v.literal("failed_jobs"),
      v.literal("old_jobs")
    ),
    daysOld: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const cutoffDays = args.daysOld ?? 30;
    const cutoffTime = daysAgo(cutoffDays);

    if (args.type === "failed_documents") {
      const docs = await ctx.db.query("documents").collect();
      return docs
        .filter((d) => d.status === "failed" || d.status === "ocr_failed")
        .map((d) => ({
          _id: d._id,
          filename: d.filename,
          size: d.size,
          status: d.status,
          createdAt: d.createdAt,
          ageInDays: ageInDays(d.createdAt),
        }));
    }

    if (args.type === "old_documents") {
      const docs = await ctx.db.query("documents").collect();
      return docs
        .filter((d) => d.createdAt < cutoffTime)
        .map((d) => ({
          _id: d._id,
          filename: d.filename,
          size: d.size,
          status: d.status,
          createdAt: d.createdAt,
          ageInDays: ageInDays(d.createdAt),
        }));
    }

    if (args.type === "completed_jobs" || args.type === "failed_jobs") {
      const targetStatus = args.type === "completed_jobs" ? "completed" : "failed";
      const jobs = await ctx.db.query("jobs").collect();
      return jobs
        .filter((j) => j.status === targetStatus)
        .map((j) => ({
          _id: j._id,
          type: j.type,
          status: j.status,
          createdAt: j.createdAt,
          ageInDays: ageInDays(j.createdAt),
        }));
    }

    if (args.type === "old_jobs") {
      const jobs = await ctx.db.query("jobs").collect();
      return jobs
        .filter((j) => j.createdAt < cutoffTime)
        .map((j) => ({
          _id: j._id,
          type: j.type,
          status: j.status,
          createdAt: j.createdAt,
          ageInDays: ageInDays(j.createdAt),
        }));
    }

    return [];
  },
});

// ============================================================================
// MUTATIONS - Delete data to free storage
// ============================================================================

/**
 * Delete a document and all its associated data (chunks, file storage)
 */
export const deleteDocumentWithData = mutation({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const document = await ctx.db.get(args.documentId);

    if (!document) {
      throw new Error("Document not found");
    }

    const result = await deleteDocumentWithRelatedData(ctx, args.documentId);

    return {
      success: true,
      deletedChunks: result.chunksDeleted,
      freedBytes: result.bytesFreed,
    };
  },
});

/**
 * Batch delete failed documents
 */
export const deleteFailedDocuments = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);

    const docs = await ctx.db.query("documents").collect();
    const failedDocs = docs.filter(
      (d) => d.status === "failed" || d.status === "ocr_failed"
    );

    const stats = await deleteDocumentsBatch(
      ctx,
      failedDocs.map((d) => d._id)
    );

    return {
      success: true,
      deletedDocuments: stats.deletedDocuments,
      deletedChunks: stats.deletedChunks,
      freedMB: bytesToMB(stats.freedBytes),
    };
  },
});

/**
 * Delete old completed/failed jobs (keeps last N of each type)
 */
export const deleteOldJobs = mutation({
  args: {
    keepRecent: v.optional(v.number()),
    olderThanDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const keepRecent = args.keepRecent ?? 5;
    const olderThanDays = args.olderThanDays ?? 7;
    const cutoffTime = daysAgo(olderThanDays);

    const jobs = await ctx.db.query("jobs").collect();

    // Group by type and status
    const jobsByTypeAndStatus: Record<string, typeof jobs> = {};
    for (const job of jobs) {
      const key = `${job.type}:${job.status}`;
      if (!jobsByTypeAndStatus[key]) {
        jobsByTypeAndStatus[key] = [];
      }
      jobsByTypeAndStatus[key].push(job);
    }

    let deletedCount = 0;

    for (const groupJobs of Object.values(jobsByTypeAndStatus)) {
      deletedCount += await deleteOldItemsKeepingRecent(
        ctx,
        groupJobs,
        keepRecent,
        cutoffTime
      );
    }

    return {
      success: true,
      deletedJobs: deletedCount,
    };
  },
});

/**
 * Delete orphaned chunks (chunks whose document no longer exists)
 */
export const deleteOrphanedChunks = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);

    const docs = await ctx.db.query("documents").collect();
    const docIds = new Set(docs.map((d) => d._id));

    const chunks = await ctx.db.query("chunks").collect();

    let deletedCount = 0;
    for (const chunk of chunks) {
      if (!docIds.has(chunk.documentId)) {
        await ctx.db.delete(chunk._id);
        deletedCount++;
      }
    }

    return {
      success: true,
      deletedChunks: deletedCount,
      estimatedFreedMB: estimateChunkStorageMB(deletedCount).toFixed(2),
    };
  },
});

/**
 * Delete old analyses (keeps latest per bundle)
 */
export const deleteOldAnalyses = mutation({
  args: {
    keepPerBundle: v.optional(v.number()),
    olderThanDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const keepPerBundle = args.keepPerBundle ?? 1;
    const olderThanDays = args.olderThanDays ?? 30;
    const cutoffTime = daysAgo(olderThanDays);

    const analyses = await ctx.db.query("analyses").collect();

    // Group by bundle
    const analysesByBundle: Record<string, typeof analyses> = {};
    for (const analysis of analyses) {
      const key = analysis.bundleId ?? "no-bundle";
      if (!analysesByBundle[key]) {
        analysesByBundle[key] = [];
      }
      analysesByBundle[key].push(analysis);
    }

    let deletedCount = 0;

    for (const bundleAnalyses of Object.values(analysesByBundle)) {
      deletedCount += await deleteOldItemsKeepingRecent(
        ctx,
        bundleAnalyses,
        keepPerBundle,
        cutoffTime
      );
    }

    return {
      success: true,
      deletedAnalyses: deletedCount,
    };
  },
});

/**
 * Nuclear option: Delete ALL data (use with caution!)
 */
export const deleteAllData = mutation({
  args: {
    confirmPhrase: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.confirmPhrase !== "DELETE ALL DATA") {
      throw new Error('Confirmation phrase must be exactly "DELETE ALL DATA"');
    }

    await requireUser(ctx);

    const stats = {
      documents: 0,
      chunks: 0,
      jobs: 0,
      analyses: 0,
      bundles: 0,
      opportunities: 0,
      requirements: 0,
    };

    // Delete documents and their storage using helper
    const docs = await ctx.db.query("documents").collect();
    const docStats = await deleteDocumentsBatch(
      ctx,
      docs.map((d) => d._id)
    );
    stats.documents = docStats.deletedDocuments;
    stats.chunks = docStats.deletedChunks;

    // Delete jobs
    const jobs = await ctx.db.query("jobs").collect();
    for (const job of jobs) {
      await ctx.db.delete(job._id);
      stats.jobs++;
    }

    // Delete analyses
    const analyses = await ctx.db.query("analyses").collect();
    for (const analysis of analyses) {
      await ctx.db.delete(analysis._id);
      stats.analyses++;
    }

    // Delete bundles
    const bundles = await ctx.db.query("bundles").collect();
    for (const bundle of bundles) {
      await ctx.db.delete(bundle._id);
      stats.bundles++;
    }

    // Delete opportunities
    const opportunities = await ctx.db.query("opportunities").collect();
    for (const opp of opportunities) {
      await ctx.db.delete(opp._id);
      stats.opportunities++;
    }

    // Delete requirements
    const requirements = await ctx.db.query("requirements").collect();
    for (const req of requirements) {
      await ctx.db.delete(req._id);
      stats.requirements++;
    }

    return {
      success: true,
      deleted: stats,
    };
  },
});

// ============================================================================
// INTERNAL - For admin/system use
// ============================================================================

/**
 * Get global storage stats (internal/admin only)
 */
export const getGlobalStats = internalQuery({
  args: {},
  handler: async (ctx) => {
    const documents = await ctx.db.query("documents").collect();
    const chunks = await ctx.db.query("chunks").collect();
    const jobs = await ctx.db.query("jobs").collect();
    const analyses = await ctx.db.query("analyses").collect();
    const bundles = await ctx.db.query("bundles").collect();

    const totalDocSize = documents.reduce((acc, d) => acc + d.size, 0);
    const estimatedChunkSize = chunks.length * 6500;

    return {
      counts: {
        documents: documents.length,
        chunks: chunks.length,
        jobs: jobs.length,
        analyses: analyses.length,
        bundles: bundles.length,
      },
      documentStatuses: documents.reduce(
        (acc, d) => {
          acc[d.status] = (acc[d.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
      jobStatuses: jobs.reduce(
        (acc, j) => {
          acc[j.status] = (acc[j.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
      estimatedStorageMB: {
        documents: bytesToMB(totalDocSize),
        chunks: bytesToMB(estimatedChunkSize),
        total: bytesToMB(totalDocSize + estimatedChunkSize),
      },
    };
  },
});

/**
 * Admin: Delete all failed documents globally
 */
export const adminDeleteAllFailedDocuments = internalMutation({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("documents").collect();
    const failedDocs = docs.filter(
      (d) => d.status === "failed" || d.status === "ocr_failed"
    );

    const stats = await deleteDocumentsBatch(
      ctx,
      failedDocs.map((d) => d._id)
    );

    return {
      success: true,
      deletedDocuments: stats.deletedDocuments,
      deletedChunks: stats.deletedChunks,
      freedMB: bytesToMB(stats.freedBytes),
    };
  },
});

/**
 * Admin: List stuck documents (in processing states for too long)
 */
export const adminListStuckDocuments = internalQuery({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("documents").collect();
    const stuckStatuses = [
      "chunking",
      "embedding",
      "processing",
      "ocr_in_progress",
      "uploading",
    ];

    return docs
      .filter((d) => stuckStatuses.includes(d.status))
      .map((d) => ({
        _id: d._id,
        filename: d.filename,
        status: d.status,
        size: d.size,
        ageHours: ageInHours(d.createdAt),
        createdAt: new Date(d.createdAt).toISOString(),
      }));
  },
});

/**
 * Admin: Delete stuck documents (documents stuck in processing states)
 */
export const adminDeleteStuckDocuments = internalMutation({
  args: {
    olderThanHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const olderThanHours = args.olderThanHours ?? 1;
    const cutoffTime = hoursAgo(olderThanHours);

    const docs = await ctx.db.query("documents").collect();
    const stuckStatuses = [
      "chunking",
      "embedding",
      "processing",
      "ocr_in_progress",
      "uploading",
    ];

    const stuckDocs = docs.filter(
      (d) => stuckStatuses.includes(d.status) && d.createdAt < cutoffTime
    );

    const stats = await deleteDocumentsBatch(
      ctx,
      stuckDocs.map((d) => d._id)
    );

    return {
      success: true,
      deletedDocuments: stats.deletedDocuments,
      deletedChunks: stats.deletedChunks,
      freedMB: bytesToMB(stats.freedBytes),
    };
  },
});

/**
 * Admin: Purge all completed jobs older than N days
 */
export const adminPurgeOldJobs = internalMutation({
  args: {
    olderThanDays: v.number(),
  },
  handler: async (ctx, args) => {
    const cutoffTime = daysAgo(args.olderThanDays);

    const jobs = await ctx.db.query("jobs").collect();
    const oldJobs = jobs.filter(
      (j) =>
        j.createdAt < cutoffTime &&
        (j.status === "completed" || j.status === "failed" || j.status === "cancelled")
    );

    let deletedCount = 0;
    for (const job of oldJobs) {
      await ctx.db.delete(job._id);
      deletedCount++;
    }

    return {
      success: true,
      deletedJobs: deletedCount,
    };
  },
});

/**
 * Admin: Delete old analyses (keeping latest N per bundle)
 */
export const adminDeleteOldAnalyses = internalMutation({
  args: {
    keepPerBundle: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const keepPerBundle = args.keepPerBundle ?? 1;

    const analyses = await ctx.db.query("analyses").collect();

    // Group by bundle
    const analysesByBundle: Record<string, typeof analyses> = {};
    for (const analysis of analyses) {
      const key = analysis.bundleId ?? "no-bundle";
      if (!analysesByBundle[key]) {
        analysesByBundle[key] = [];
      }
      analysesByBundle[key].push(analysis);
    }

    let deletedCount = 0;

    for (const bundleAnalyses of Object.values(analysesByBundle)) {
      deletedCount += await deleteOldItemsKeepingRecent(
        ctx,
        bundleAnalyses,
        keepPerBundle
      );
    }

    return {
      success: true,
      deletedAnalyses: deletedCount,
    };
  },
});

/**
 * Admin: Delete orphaned chunks (chunks without a parent document)
 */
export const adminDeleteOrphanedChunks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("documents").collect();
    const docIds = new Set(docs.map((d) => d._id));

    const chunks = await ctx.db.query("chunks").collect();

    let deletedCount = 0;
    for (const chunk of chunks) {
      if (!docIds.has(chunk.documentId)) {
        await ctx.db.delete(chunk._id);
        deletedCount++;
      }
    }

    return {
      success: true,
      deletedChunks: deletedCount,
      estimatedFreedMB: estimateChunkStorageMB(deletedCount).toFixed(2),
    };
  },
});
