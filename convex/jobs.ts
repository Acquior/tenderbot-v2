import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  mutation,
} from "./_generated/server";
import { requireUser } from "./auth";

export const enqueueDocumentIngestion = mutation({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    if (document.createdBy !== identity.clerkUserId) {
      throw new Error("Forbidden");
    }

    await ctx.db.patch(args.documentId, {
      status: "processing",
      organizationId: document.organizationId ?? identity.organizationId,
      updatedAt: Date.now(),
    });

    const jobId = await ctx.db.insert("jobs", {
      type: "document_ingest",
      input: { documentId: args.documentId },
      output: undefined,
      status: "pending",
      progress: {
        current: 0,
        total: 5,
        message: "Queued",
      },
      error: undefined,
      attempts: 0,
      maxAttempts: 5,
      resumeToken: undefined,
      createdBy: identity.clerkUserId,
      organizationId: identity.organizationId,
      createdAt: Date.now(),
      startedAt: undefined,
      finishedAt: undefined,
      scheduledFor: undefined,
    });

    await ctx.scheduler.runAfter(0, internal.jobs.processDocumentIngestion, {
      jobId,
      documentId: args.documentId,
    });

    return { jobId };
  },
});

export const processDocumentIngestion = internalAction({
  args: {
    jobId: v.id("jobs"),
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.jobs.markJobStarted, {
      jobId: args.jobId,
    });

    const steps: { message: string; status: (typeof DOCUMENT_STATUSES)[number] }[] = [
      { message: "Detecting document characteristics", status: "processing" },
      { message: "Running OCR & normalization", status: "ocr_in_progress" },
      { message: "Chunking content", status: "chunking" },
      { message: "Generating embeddings", status: "embedding" },
      { message: "Finalizing document", status: "ready" },
    ];

    try {
      for (let index = 0; index < steps.length; index++) {
        const { message, status } = steps[index];

        await ctx.runMutation(internal.jobs.updateDocumentStatusInternal, {
          documentId: args.documentId,
          status,
        });

        await ctx.runMutation(internal.jobs.updateJobProgress, {
          jobId: args.jobId,
          current: index + 1,
          total: steps.length,
          message,
        });

        // TODO: Plug in actual processing for each stage.
      }

      await ctx.runMutation(internal.jobs.markJobCompleted, {
        jobId: args.jobId,
        output: { documentId: args.documentId },
      });
    } catch (error) {
      await ctx.runMutation(internal.jobs.updateDocumentStatusInternal, {
        documentId: args.documentId,
        status: "failed",
      });

      await ctx.runMutation(internal.jobs.markJobFailed, {
        jobId: args.jobId,
        message: error instanceof Error ? error.message : "Unknown error",
      });

      throw error;
    }
  },
});

const DOCUMENT_STATUSES = [
  "processing",
  "ocr_in_progress",
  "chunking",
  "embedding",
  "ready",
  "failed",
] as const;

export const updateDocumentStatusInternal = internalMutation({
  args: {
    documentId: v.id("documents"),
    status: v.union(
      v.literal("processing"),
      v.literal("ocr_in_progress"),
      v.literal("chunking"),
      v.literal("embedding"),
      v.literal("ready"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.documentId, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const markJobStarted = internalMutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      return;
    }

    await ctx.db.patch(args.jobId, {
      status: "running",
      attempts: job.attempts + 1,
      startedAt: job.startedAt ?? Date.now(),
      progress: job.progress ?? { current: 0, total: 1 },
    });
  },
});

export const updateJobProgress = internalMutation({
  args: {
    jobId: v.id("jobs"),
    current: v.number(),
    total: v.number(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "running",
      progress: {
        current: args.current,
        total: args.total,
        message: args.message,
      },
    });
  },
});

export const markJobCompleted = internalMutation({
  args: {
    jobId: v.id("jobs"),
    output: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "completed",
      output: args.output,
      finishedAt: Date.now(),
    });
  },
});

export const markJobFailed = internalMutation({
  args: {
    jobId: v.id("jobs"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "failed",
      error: {
        message: args.message,
        retryable: true,
      },
      finishedAt: Date.now(),
    });
  },
});
