import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireUser } from "./auth";

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

    // Count chunks
    const allChunks = await ctx.db.query("chunks").collect();

    // Count jobs
    const allJobs = await ctx.db.query("jobs").collect();

    // Count analyses
    const allAnalyses = await ctx.db.query("analyses").collect();

    // Categorize by status
    const failedDocs = allDocs.filter((d) => d.status === "failed" || d.status === "ocr_failed");
    const oldDocs = allDocs.filter((d) => {
      const ageInDays = (Date.now() - d.createdAt) / (1000 * 60 * 60 * 24);
      return ageInDays > 30;
    });

    const completedJobs = allJobs.filter((j) => j.status === "completed");
    const failedJobs = allJobs.filter((j) => j.status === "failed");
    const oldJobs = allJobs.filter((j) => {
      const ageInDays = (Date.now() - j.createdAt) / (1000 * 60 * 60 * 24);
      return ageInDays > 7;
    });

    // Calculate estimated storage (rough estimates)
    const estimatedChunkStorageMB = (allChunks.length * 6.5) / 1024; // ~6.5KB per chunk with embedding
    const estimatedDocStorageMB = allDocs.reduce((acc, d) => acc + d.size, 0) / (1024 * 1024);

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
    const cutoffTime = Date.now() - cutoffDays * 24 * 60 * 60 * 1000;

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
          ageInDays: Math.floor((Date.now() - d.createdAt) / (1000 * 60 * 60 * 24)),
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
          ageInDays: Math.floor((Date.now() - d.createdAt) / (1000 * 60 * 60 * 24)),
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
          ageInDays: Math.floor((Date.now() - j.createdAt) / (1000 * 60 * 60 * 24)),
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
          ageInDays: Math.floor((Date.now() - j.createdAt) / (1000 * 60 * 60 * 24)),
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

    // Delete all chunks for this document
    const chunks = await ctx.db
      .query("chunks")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id);
    }

    // Delete the file from storage
    try {
      await ctx.storage.delete(document.storageId as any);
    } catch (e) {
      console.warn(`Failed to delete storage file ${document.storageId}:`, e);
    }

    // Delete the document record
    await ctx.db.delete(args.documentId);

    return {
      success: true,
      deletedChunks: chunks.length,
      freedBytes: document.size,
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

    let deletedCount = 0;
    let freedBytes = 0;
    let deletedChunks = 0;

    for (const doc of failedDocs) {
      // Delete chunks
      const chunks = await ctx.db
        .query("chunks")
        .withIndex("by_document", (q) => q.eq("documentId", doc._id))
        .collect();

      for (const chunk of chunks) {
        await ctx.db.delete(chunk._id);
        deletedChunks++;
      }

      // Delete storage file
      try {
        await ctx.storage.delete(doc.storageId as any);
      } catch (e) {
        console.warn(`Failed to delete storage file ${doc.storageId}:`, e);
      }

      // Delete document
      await ctx.db.delete(doc._id);
      deletedCount++;
      freedBytes += doc.size;
    }

    return {
      success: true,
      deletedDocuments: deletedCount,
      deletedChunks,
      freedMB: (freedBytes / (1024 * 1024)).toFixed(2),
    };
  },
});

/**
 * Delete old completed/failed jobs (keeps last N of each type)
 */
export const deleteOldJobs = mutation({
  args: {
    keepRecent: v.optional(v.number()), // How many recent jobs to keep per type
    olderThanDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const keepRecent = args.keepRecent ?? 5;
    const olderThanDays = args.olderThanDays ?? 7;
    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

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

    for (const [, groupJobs] of Object.entries(jobsByTypeAndStatus)) {
      // Sort by creation date (newest first)
      const sorted = groupJobs.sort((a, b) => b.createdAt - a.createdAt);

      // Keep recent ones, delete the rest if they're old enough
      for (let i = keepRecent; i < sorted.length; i++) {
        const job = sorted[i];
        if (job.createdAt < cutoffTime) {
          await ctx.db.delete(job._id);
          deletedCount++;
        }
      }
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

    // Get all document IDs
    const docs = await ctx.db.query("documents").collect();
    const docIds = new Set(docs.map((d) => d._id));

    // Get all chunks
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
      estimatedFreedMB: ((deletedCount * 6.5) / 1024).toFixed(2),
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
    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

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

    for (const [, bundleAnalyses] of Object.entries(analysesByBundle)) {
      // Sort by creation date (newest first)
      const sorted = bundleAnalyses.sort((a, b) => b.createdAt - a.createdAt);

      // Keep recent ones, delete the rest if they're old enough
      for (let i = keepPerBundle; i < sorted.length; i++) {
        const analysis = sorted[i];
        if (analysis.createdAt < cutoffTime) {
          await ctx.db.delete(analysis._id);
          deletedCount++;
        }
      }
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
    confirmPhrase: v.string(), // Must be "DELETE ALL DATA"
  },
  handler: async (ctx, args) => {
    if (args.confirmPhrase !== "DELETE ALL DATA") {
      throw new Error('Confirmation phrase must be exactly "DELETE ALL DATA"');
    }

    await requireUser(ctx);

    let stats = {
      documents: 0,
      chunks: 0,
      jobs: 0,
      analyses: 0,
      bundles: 0,
      opportunities: 0,
      requirements: 0,
    };

    // Delete documents and their storage
    const docs = await ctx.db.query("documents").collect();
    for (const doc of docs) {
      try {
        await ctx.storage.delete(doc.storageId as any);
      } catch (e) {
        // Ignore storage deletion errors
      }
      await ctx.db.delete(doc._id);
      stats.documents++;
    }

    // Delete chunks
    const chunks = await ctx.db.query("chunks").collect();
    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id);
      stats.chunks++;
    }

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
    const estimatedChunkSize = chunks.length * 6500; // ~6.5KB per chunk

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
        documents: (totalDocSize / (1024 * 1024)).toFixed(2),
        chunks: (estimatedChunkSize / (1024 * 1024)).toFixed(2),
        total: ((totalDocSize + estimatedChunkSize) / (1024 * 1024)).toFixed(2),
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

    let deletedCount = 0;
    let freedBytes = 0;
    let deletedChunks = 0;

    for (const doc of failedDocs) {
      // Delete chunks
      const chunks = await ctx.db
        .query("chunks")
        .withIndex("by_document", (q) => q.eq("documentId", doc._id))
        .collect();

      for (const chunk of chunks) {
        await ctx.db.delete(chunk._id);
        deletedChunks++;
      }

      // Delete storage file
      try {
        await ctx.storage.delete(doc.storageId as any);
      } catch (e) {
        console.warn(`Failed to delete storage file ${doc.storageId}:`, e);
      }

      // Delete document
      await ctx.db.delete(doc._id);
      deletedCount++;
      freedBytes += doc.size;
    }

    return {
      success: true,
      deletedDocuments: deletedCount,
      deletedChunks,
      freedMB: (freedBytes / (1024 * 1024)).toFixed(2),
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
    const stuckStatuses = ["chunking", "embedding", "processing", "ocr_in_progress", "uploading"];

    return docs
      .filter((d) => stuckStatuses.includes(d.status))
      .map((d) => ({
        _id: d._id,
        filename: d.filename,
        status: d.status,
        size: d.size,
        ageHours: Math.floor((Date.now() - d.createdAt) / (1000 * 60 * 60)),
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
    const olderThanHours = args.olderThanHours ?? 1; // Default: stuck for more than 1 hour
    const cutoffTime = Date.now() - olderThanHours * 60 * 60 * 1000;

    const docs = await ctx.db.query("documents").collect();
    const stuckStatuses = ["chunking", "embedding", "processing", "ocr_in_progress", "uploading"];

    const stuckDocs = docs.filter(
      (d) => stuckStatuses.includes(d.status) && d.createdAt < cutoffTime
    );

    let deletedCount = 0;
    let freedBytes = 0;
    let deletedChunks = 0;

    for (const doc of stuckDocs) {
      // Delete chunks
      const chunks = await ctx.db
        .query("chunks")
        .withIndex("by_document", (q) => q.eq("documentId", doc._id))
        .collect();

      for (const chunk of chunks) {
        await ctx.db.delete(chunk._id);
        deletedChunks++;
      }

      // Delete storage file
      try {
        await ctx.storage.delete(doc.storageId as any);
      } catch (e) {
        console.warn(`Failed to delete storage file ${doc.storageId}:`, e);
      }

      // Delete document
      await ctx.db.delete(doc._id);
      deletedCount++;
      freedBytes += doc.size;
    }

    return {
      success: true,
      deletedDocuments: deletedCount,
      deletedChunks,
      freedMB: (freedBytes / (1024 * 1024)).toFixed(2),
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
    const cutoffTime = Date.now() - args.olderThanDays * 24 * 60 * 60 * 1000;

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

    for (const [, bundleAnalyses] of Object.entries(analysesByBundle)) {
      // Sort by creation date (newest first)
      const sorted = bundleAnalyses.sort((a, b) => b.createdAt - a.createdAt);

      // Delete all except the most recent N
      for (let i = keepPerBundle; i < sorted.length; i++) {
        await ctx.db.delete(sorted[i]._id);
        deletedCount++;
      }
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
      estimatedFreedMB: ((deletedCount * 6.5) / 1024).toFixed(2),
    };
  },
});
