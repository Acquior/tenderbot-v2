/**
 * Cleanup utility functions for Convex storage management
 * Centralizes document deletion logic used across multiple mutations
 */

import { Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

// Storage size estimates
export const ESTIMATED_CHUNK_SIZE_KB = 6.5; // ~6.5KB per chunk with embedding

/**
 * Estimate storage size for chunks in MB
 */
export function estimateChunkStorageMB(count: number): number {
  return (count * ESTIMATED_CHUNK_SIZE_KB) / 1024;
}

/**
 * Format bytes to MB string
 */
export function bytesToMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(2);
}

/**
 * Result of deleting a document and its related data
 */
export interface DocumentDeletionResult {
  chunksDeleted: number;
  storageFreed: boolean;
  bytesFreed: number;
}

/**
 * Delete a document and all its associated data (chunks and storage file)
 * This is the core deletion function used by all document deletion operations
 */
export async function deleteDocumentWithRelatedData(
  ctx: MutationCtx,
  documentId: Id<"documents">
): Promise<DocumentDeletionResult> {
  const document = await ctx.db.get(documentId);

  if (!document) {
    return { chunksDeleted: 0, storageFreed: false, bytesFreed: 0 };
  }

  // Delete all chunks for this document
  const chunks = await ctx.db
    .query("chunks")
    .withIndex("by_document", (q) => q.eq("documentId", documentId))
    .collect();

  for (const chunk of chunks) {
    await ctx.db.delete(chunk._id);
  }

  // Delete the file from storage
  let storageFreed = false;
  try {
    await ctx.storage.delete(document.storageId as any);
    storageFreed = true;
  } catch (e) {
    console.warn(`Failed to delete storage file ${document.storageId}:`, e);
  }

  // Delete the document record
  await ctx.db.delete(documentId);

  return {
    chunksDeleted: chunks.length,
    storageFreed,
    bytesFreed: document.size ?? 0,
  };
}

/**
 * Batch deletion statistics
 */
export interface BatchDeletionStats {
  deletedDocuments: number;
  deletedChunks: number;
  freedBytes: number;
}

/**
 * Delete multiple documents and their related data
 * Returns aggregated statistics
 */
export async function deleteDocumentsBatch(
  ctx: MutationCtx,
  documentIds: Id<"documents">[]
): Promise<BatchDeletionStats> {
  const stats: BatchDeletionStats = {
    deletedDocuments: 0,
    deletedChunks: 0,
    freedBytes: 0,
  };

  for (const docId of documentIds) {
    const result = await deleteDocumentWithRelatedData(ctx, docId);
    stats.deletedDocuments++;
    stats.deletedChunks += result.chunksDeleted;
    stats.freedBytes += result.bytesFreed;
  }

  return stats;
}

/**
 * Delete items from a table that match a filter, keeping the most recent N
 * Useful for cleaning up old jobs, analyses, etc.
 */
export async function deleteOldItemsKeepingRecent<T extends { _id: any; createdAt: number }>(
  ctx: MutationCtx,
  items: T[],
  keepRecent: number,
  cutoffTime?: number
): Promise<number> {
  // Sort by creation date (newest first)
  const sorted = [...items].sort((a, b) => b.createdAt - a.createdAt);

  let deletedCount = 0;

  for (let i = keepRecent; i < sorted.length; i++) {
    const item = sorted[i];
    // If cutoff time is provided, only delete if older than cutoff
    if (cutoffTime === undefined || item.createdAt < cutoffTime) {
      await ctx.db.delete(item._id);
      deletedCount++;
    }
  }

  return deletedCount;
}
