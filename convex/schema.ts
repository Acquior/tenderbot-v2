import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Convex database schema for TenderBot
 */
export default defineSchema({
  /**
   * Users table (synced from Clerk)
   */
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    organizationId: v.optional(v.string()),
    role: v.optional(v.union(v.literal("admin"), v.literal("user"), v.literal("viewer"))),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_organization", ["organizationId"]),

  /**
   * Documents table
   */
  documents: defineTable({
    filename: v.string(),
    mimeType: v.string(),
    size: v.number(),
    storageId: v.string(), // Convex storage ID
    r2Key: v.optional(v.string()), // R2 key if replicated
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
    checksums: v.object({
      md5: v.optional(v.string()),
      sha256: v.optional(v.string()),
    }),
    metadata: v.optional(
      v.object({
        pageCount: v.optional(v.number()),
        language: v.optional(v.string()),
        extractedAt: v.optional(v.string()),
        ocrMethod: v.optional(v.string()),
      })
    ),
    bundleId: v.optional(v.id("bundles")),
    createdBy: v.string(), // Clerk user ID
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_created_at", ["createdAt"])
    .index("by_created_by", ["createdBy"])
    .index("by_status", ["status"])
    .index("by_bundle", ["bundleId"]),

  /**
   * Chunks table
   */
  chunks: defineTable({
    documentId: v.id("documents"),
    sequence: v.number(),
    text: v.string(),
    tokens: v.number(),
    metadata: v.object({
      page: v.optional(v.number()),
      section: v.optional(v.string()),
      heading: v.optional(v.string()),
      startOffset: v.optional(v.number()),
      endOffset: v.optional(v.number()),
    }),
    embeddingId: v.optional(v.string()), // Reference to vector DB
    createdAt: v.number(),
  })
    .index("by_document", ["documentId"])
    .index("by_document_sequence", ["documentId", "sequence"]),

  /**
   * Bundles table (tender document groups)
   */
  bundles: defineTable({
    name: v.string(),
    issuer: v.optional(v.string()),
    referenceNumber: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    status: v.union(
      v.literal("draft"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("incomplete"),
      v.literal("complete")
    ),
    completeness: v.optional(
      v.object({
        score: v.optional(v.number()),
      })
    ),
    metadata: v.optional(
      v.object({
        totalPages: v.optional(v.number()),
        totalSize: v.optional(v.number()),
        detectedAt: v.optional(v.number()),
        confidence: v.optional(v.number()),
      })
    ),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_created_at", ["createdAt"])
    .index("by_created_by", ["createdBy"])
    .index("by_status", ["status"])
    .index("by_issuer", ["issuer"])
    .index("by_due_date", ["dueDate"]),

  /**
   * Opportunities table
   */
  opportunities: defineTable({
    title: v.string(),
    issuer: v.string(),
    issuerCategory: v.optional(v.string()),
    referenceNumber: v.optional(v.string()),
    dueDate: v.number(),
    publishedDate: v.optional(v.number()),
    estimatedValue: v.optional(v.number()),
    currency: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("analyzing"),
      v.literal("analysis_complete"),
      v.literal("in_review"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("submitted"),
      v.literal("closed")
    ),
    bundleId: v.optional(v.id("bundles")),
    score: v.optional(
      v.object({
        overall: v.optional(v.number()),
        eligibility: v.optional(v.number()),
        competitiveness: v.optional(v.number()),
        strategicFit: v.optional(v.number()),
      })
    ),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_created_at", ["createdAt"])
    .index("by_created_by", ["createdBy"])
    .index("by_status", ["status"])
    .index("by_due_date", ["dueDate"])
    .index("by_issuer", ["issuer"]),

  /**
   * Requirements table
   */
  requirements: defineTable({
    opportunityId: v.id("opportunities"),
    type: v.union(
      v.literal("compliance"),
      v.literal("technical"),
      v.literal("commercial"),
      v.literal("legal"),
      v.literal("bee"),
      v.literal("eligibility"),
      v.literal("other")
    ),
    description: v.string(),
    mandatory: v.boolean(),
    status: v.union(
      v.literal("met"),
      v.literal("partial"),
      v.literal("unknown"),
      v.literal("not_met")
    ),
    confidence: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_opportunity", ["opportunityId"])
    .index("by_type", ["type"])
    .index("by_status", ["status"]),

  /**
   * Analyses table
   */
  analyses: defineTable({
    type: v.union(
      v.literal("document"),
      v.literal("opportunity"),
      v.literal("bundle"),
      v.literal("gap")
    ),
    targetId: v.string(), // documentId, opportunityId, or bundleId
    summary: v.string(),
    metadata: v.optional(
      v.object({
        model: v.optional(v.string()),
        tokensUsed: v.optional(v.number()),
        cost: v.optional(v.number()),
        latencyMs: v.optional(v.number()),
        groundedness: v.optional(v.number()),
      })
    ),
    version: v.string(),
    createdBy: v.string(),
    createdAt: v.number(),
  })
    .index("by_target", ["targetId"])
    .index("by_type", ["type"])
    .index("by_created_at", ["createdAt"]),

  /**
   * Jobs table (background tasks)
   */
  jobs: defineTable({
    type: v.union(
      v.literal("document_ingest"),
      v.literal("ocr_process"),
      v.literal("chunk_document"),
      v.literal("generate_embeddings"),
      v.literal("analyze_opportunity"),
      v.literal("bundle_detect"),
      v.literal("gap_analysis"),
      v.literal("export_data"),
      v.literal("notification_digest")
    ),
    input: v.any(), // Type-specific input
    output: v.optional(v.any()), // Type-specific output
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled"),
      v.literal("retrying")
    ),
    progress: v.optional(
      v.object({
        current: v.number(),
        total: v.number(),
        message: v.optional(v.string()),
      })
    ),
    error: v.optional(
      v.object({
        message: v.string(),
        code: v.optional(v.string()),
        stack: v.optional(v.string()),
        retryable: v.boolean(),
      })
    ),
    attempts: v.number(),
    maxAttempts: v.number(),
    resumeToken: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    scheduledFor: v.optional(v.number()),
  })
    .index("by_type", ["type"])
    .index("by_status", ["status"])
    .index("by_created_at", ["createdAt"])
    .index("by_scheduled_for", ["scheduledFor"]),

  /**
   * Notifications table
   */
  notifications: defineTable({
    userId: v.string(), // Clerk user ID
    type: v.union(
      v.literal("document_ready"),
      v.literal("analysis_complete"),
      v.literal("job_failed"),
      v.literal("deadline_warning"),
      v.literal("mention"),
      v.literal("digest")
    ),
    title: v.string(),
    message: v.string(),
    read: v.boolean(),
    actionUrl: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_read", ["userId", "read"])
    .index("by_created_at", ["createdAt"]),

  /**
   * Comments table
   */
  comments: defineTable({
    targetType: v.union(
      v.literal("document"),
      v.literal("opportunity"),
      v.literal("requirement"),
      v.literal("analysis")
    ),
    targetId: v.string(),
    authorId: v.string(), // Clerk user ID
    content: v.string(),
    mentions: v.array(v.string()), // Clerk user IDs
    resolved: v.boolean(),
    metadata: v.optional(
      v.object({
        page: v.optional(v.number()),
        selection: v.optional(v.string()),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_target", ["targetType", "targetId"])
    .index("by_author", ["authorId"])
    .index("by_created_at", ["createdAt"]),
});
