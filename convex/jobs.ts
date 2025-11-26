import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireUser } from "./auth";
import {
  isRetryableError,
  normalizeRequirements,
  normalizeRisks,
  safeString,
  normalizeTimestamp,
} from "./lib/jobUtils";

type StageId = "detect" | "ocr" | "chunk" | "embedding" | "gemini_upload" | "finalize";

interface ResumeChunk {
  sequence: number;
  text: string;
  tokens: number;
  metadata: {
    page?: number;
    section?: string;
    heading?: string;
    startOffset?: number;
    endOffset?: number;
  };
}

interface ResumeData {
  completedStages: StageId[];
  pageCount?: number;
  ocrMethod?: "native" | "azure-read";
  normalizedText?: string;
  partialChunks?: ResumeChunk[];
  chunkCount?: number;
}

const SHOULD_DETECT_CHARACTERISTICS = false;
const USE_GEMINI_FILE_SEARCH = process.env.USE_GEMINI_FILE_SEARCH !== "false"; // Default to true
const USE_GEMINI_FILE_SEARCH_ANALYSIS =
  process.env.USE_GEMINI_FILE_SEARCH_ANALYSIS !== "false";

// Claude Sonnet 4.5 is the primary analysis engine (replaces legacy GPT-4.1)
// Set USE_CLAUDE_FOR_ANALYSIS=false to fall back to legacy OpenAI analysis
const USE_CLAUDE_FOR_ANALYSIS =
  process.env.USE_CLAUDE_FOR_ANALYSIS !== "false";
const TOTAL_STAGES = SHOULD_DETECT_CHARACTERISTICS
  ? USE_GEMINI_FILE_SEARCH
    ? 6
    : 5
  : USE_GEMINI_FILE_SEARCH
    ? 5
    : 4;

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
      updatedAt: Date.now(),
    });

    const jobId = await ctx.db.insert("jobs", {
      type: "document_ingest",
      input: { documentId: args.documentId },
      output: undefined,
      status: "pending",
      progress: {
        current: 0,
        total: TOTAL_STAGES,
        message: "Queued",
      },
      error: undefined,
      attempts: 0,
      maxAttempts: 5,
      resumeToken: undefined,
      resumeData: {
        completedStages: [],
      },
      createdBy: identity.clerkUserId,
      createdAt: Date.now(),
      startedAt: undefined,
      finishedAt: undefined,
      scheduledFor: undefined,
      // OPTIMIZATION: Top-level field for indexed lookups
      documentId: args.documentId,
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

    const job = await ctx.runQuery(internal.jobs.getInternal, {
      jobId: args.jobId,
    });

    if (!job) {
      throw new Error("Job not found");
    }

    // Get document to access storageId
    const document = await ctx.runQuery(internal.documents.getInternal, {
      documentId: args.documentId,
    });

    if (!document) {
      throw new Error("Document not found");
    }

    let resumeData: ResumeData = {
      completedStages: [],
    };

    if (job.resumeData && typeof job.resumeData === "object") {
      const data = job.resumeData as Partial<ResumeData>;
      resumeData = {
        completedStages: Array.isArray(data.completedStages) ? (data.completedStages as StageId[]) : [],
        pageCount: data.pageCount,
        ocrMethod: data.ocrMethod,
        normalizedText: data.normalizedText,
        partialChunks: data.partialChunks,
        chunkCount: data.chunkCount,
      };
    }

    const completedStages = new Set<StageId>(resumeData.completedStages ?? []);
    let pageCount = resumeData.pageCount ?? 0;
    let ocrMethod: "native" | "azure-read" = resumeData.ocrMethod ?? "native";
    let normalizedText = resumeData.normalizedText ?? "";
    let partialChunks = resumeData.partialChunks;
    let chunkCount = resumeData.chunkCount ?? (partialChunks?.length ?? 0);

    try {
      const saveResumeData = async (updates: Partial<ResumeData>) => {
        resumeData = {
          ...resumeData,
          ...updates,
          completedStages: Array.from(completedStages),
        };

        await ctx.runMutation(internal.jobs.updateResumeData, {
          jobId: args.jobId,
          resumeData,
        });
      };

      const updateProgress = async (stageNumber: number, message: string) => {
        await ctx.runMutation(internal.jobs.updateJobProgress, {
          jobId: args.jobId,
          current: stageNumber,
          total: TOTAL_STAGES,
          message,
        });
      };

      // ==================== STAGE 1: DETECT ====================
      if (SHOULD_DETECT_CHARACTERISTICS) {
        if (!completedStages.has("detect")) {
          await ctx.runMutation(internal.documents.updateStatusInternal, {
            documentId: args.documentId,
            status: "processing",
          });
          await updateProgress(1, "Detecting document characteristics");

          const characteristics = await ctx.runAction(internal.ingest.detectDocumentCharacteristics, {
            storageId: document.storageId,
          });

          pageCount = characteristics.pageCount;

          await ctx.runMutation(internal.documents.updateMetadataInternal, {
            documentId: args.documentId,
            metadata: {
              pageCount: characteristics.pageCount,
              language: characteristics.language,
            },
          });

          completedStages.add("detect");
          await saveResumeData({ pageCount });
        } else {
          pageCount = resumeData.pageCount ?? pageCount;
        }
      } else {
        await ctx.runMutation(internal.documents.updateStatusInternal, {
          documentId: args.documentId,
          status: "processing",
        });
        await updateProgress(1, "Preparing document for OCR");
        completedStages.add("detect");
        await saveResumeData({});
      }

      // ==================== STAGE 2: OCR ====================
      if (!completedStages.has("ocr") || !normalizedText) {
        await ctx.runMutation(internal.documents.updateStatusInternal, {
          documentId: args.documentId,
          status: "ocr_in_progress",
        });
        await updateProgress(2, "Extracting text (OCR & normalization)");

        const azureResult = await ctx.runAction(internal.ingest.ocrWithAzure, {
          storageId: document.storageId,
          mimeType: document.mimeType,
          filename: document.filename,
        });
        const extractedText = azureResult.text;
        ocrMethod = (azureResult as any).ocrMethod ?? "azure-read";
        if (azureResult.pageCount) {
          pageCount = azureResult.pageCount;
        }

        const { normalizeText } = await import("./ingest");
        normalizedText = normalizeText(extractedText);

        await ctx.runMutation(internal.documents.updateMetadataInternal, {
          documentId: args.documentId,
          metadata: {
            pageCount,
            ocrMethod,
            extractedAt: new Date().toISOString(),
          },
        });

        completedStages.add("ocr");
        await saveResumeData({
          ocrMethod,
          normalizedText,
          pageCount,
        });
      }

      // ==================== STAGE 3: CHUNK ====================
      if (!completedStages.has("chunk") || !partialChunks) {
        await ctx.runMutation(internal.documents.updateStatusInternal, {
          documentId: args.documentId,
          status: "chunking",
        });
        await updateProgress(3, "Chunking content");

        const { Chunker } = await import("@tenderbot/rag");
        const chunks = Chunker.chunk(normalizedText, args.documentId, {
          strategy: "recursive",
          maxTokens: 512,
          overlap: 50,
          preserveStructure: true,
        });

        if (chunks.length === 0) {
          throw new Error("No chunks generated from document");
        }

        partialChunks = chunks.map((chunk, index) => ({
          sequence: index,
          text: chunk.text,
          tokens: chunk.tokens,
          metadata: chunk.metadata ?? {},
        }));

        completedStages.add("chunk");
        await saveResumeData({
          partialChunks,
        });
      }

      // ==================== STAGE 4: EMBEDDINGS ====================
      if (!completedStages.has("embedding")) {
        if (!partialChunks || partialChunks.length === 0) {
          throw new Error("Chunk data missing for embedding stage");
        }

        await ctx.runMutation(internal.documents.updateStatusInternal, {
          documentId: args.documentId,
          status: "embedding",
        });
        await updateProgress(4, `Generating embeddings for ${partialChunks.length} chunks`);

        const cohereApiKey = process.env.AZURE_COHERE_KEY ?? process.env.COHERE_API_KEY;
        if (!cohereApiKey) {
          throw new Error("Embedding API key not configured (set AZURE_COHERE_KEY or COHERE_API_KEY)");
        }

        const { EmbeddingClient } = await import("@tenderbot/rag");
        const azureModelOverride = process.env.AZURE_COHERE_MODEL;
        const embeddingClient = azureModelOverride
          ? new EmbeddingClient(cohereApiKey, azureModelOverride)
          : new EmbeddingClient(cohereApiKey);

        const texts = partialChunks.map((chunk) => chunk.text);
        const embeddings = await embeddingClient.embedBatch(texts, 96, "search_document");

        if (embeddings.length !== partialChunks.length) {
          throw new Error("Embedding service returned unexpected number of vectors");
        }

        const chunksData = partialChunks.map((chunk, index) => ({
          documentId: args.documentId,
          sequence: chunk.sequence,
          text: chunk.text,
          tokens: chunk.tokens,
          embedding: embeddings[index],
          metadata: chunk.metadata,
          organizationId: document.organizationId,
        }));

        await ctx.runMutation(internal.chunks.deleteByDocument, {
          documentId: args.documentId,
        });

        await ctx.runMutation(internal.chunks.insertBatch, {
          chunks: chunksData,
        });

        chunkCount = chunksData.length;

        completedStages.add("embedding");
        await saveResumeData({
          partialChunks: undefined,
          chunkCount,
        });
      } else {
        chunkCount = resumeData.chunkCount ?? chunkCount;
      }

      // ==================== STAGE 5: GEMINI FILE SEARCH (if enabled) ====================
      if (USE_GEMINI_FILE_SEARCH && !completedStages.has("gemini_upload")) {
        try {
          await ctx.runMutation(internal.documents.updateGeminiMetadata, {
            documentId: args.documentId,
            geminiStatus: "indexing",
          });
          await updateProgress(USE_GEMINI_FILE_SEARCH ? 5 : 4, "Uploading to Gemini File Search");

          const geminiResult = await ctx.runAction(internal.geminiFileSearch.uploadFileToGeminiStore, {
            documentId: args.documentId,
            bundleId: document.bundleId,
            organizationId: document.organizationId,
          });

          await ctx.runMutation(internal.documents.updateGeminiMetadata, {
            documentId: args.documentId,
            geminiFileResourceName: geminiResult.fileResourceName,
            geminiStatus: "ready",
          });

          completedStages.add("gemini_upload");
          await saveResumeData({});
        } catch (error) {
          // Log error but don't fail the entire ingestion
          console.error(`[Gemini File Search] Failed to upload document ${args.documentId}:`, error);
          await ctx.runMutation(internal.documents.updateGeminiMetadata, {
            documentId: args.documentId,
            geminiStatus: "error",
          });
          // Continue with rest of ingestion
          completedStages.add("gemini_upload");
          await saveResumeData({});
        }
      }

      // ==================== FINALIZE ====================
      const finalStageNumber = USE_GEMINI_FILE_SEARCH ? 6 : 5;
      await updateProgress(finalStageNumber, "Finalizing document");

      // IMPORTANT: Set document to "ready" BEFORE detecting bundle
      // so that bundle metadata sees the document as ready
      await ctx.runMutation(internal.documents.updateStatusInternal, {
        documentId: args.documentId,
        status: "ready",
      });

      // Now detect/update bundle - it will see this document as ready
      const bundleResult = await ctx.runMutation(internal.bundles.detectBundle, {
        documentId: args.documentId,
      });

      // Check if bundle is ready and trigger analysis
      if (bundleResult.bundleId) {
        const bundle = await ctx.runQuery(internal.bundles.getInternal, {
          id: bundleResult.bundleId,
        });

        console.log(`[Bundle Analysis Check] Bundle ${bundleResult.bundleId} status: ${bundle?.status}`);

        if (bundle && bundle.status === "ready") {
          // Trigger new tender analysis system (idempotent)
          console.log(`[Bundle Analysis] Starting analysis for bundle ${bundle._id}`);

          try {
            const analysisResult = await ctx.runAction(internal.analyses.startAnalysisForBundleInternal, {
              bundleId: bundle._id,
              createdBy: job.createdBy,
              organizationId: job.organizationId,
            });

            if (analysisResult.isNew) {
              console.log(`[Bundle Analysis] Created new analysis ${analysisResult.analysisId}`);
            } else {
              console.log(`[Bundle Analysis] Reusing existing analysis ${analysisResult.analysisId}`);
            }
          } catch (error) {
            console.error(`[Bundle Analysis] Failed to start analysis:`, error);
            // Don't fail the document ingestion job if analysis fails to start
          }
        } else {
          console.log(`[Bundle Analysis] Bundle not ready yet - status: ${bundle?.status}`);
        }
      } else {
        console.log(`[Bundle Analysis] No bundle detected for document ${args.documentId}`);
      }

        await ctx.runMutation(internal.jobs.markJobCompleted, {
          jobId: args.jobId,
          output: {
            documentId: args.documentId,
            chunksCreated: chunkCount,
            ocrMethod,
            pageCount,
          },
        });
    } catch (error) {
      await ctx.runMutation(internal.documents.updateStatusInternal, {
        documentId: args.documentId,
        status: "failed",
      });

      const retryable = error instanceof Error && isRetryableError(error);

      await ctx.runMutation(internal.jobs.markJobFailedWithRetry, {
        jobId: args.jobId,
        message: error instanceof Error ? error.message : "Unknown error",
        retryable,
      });

      throw error;
    }
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
      resumeData: undefined,
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

export const markJobFailedWithRetry = internalMutation({
  args: {
    jobId: v.id("jobs"),
    message: v.string(),
    retryable: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "failed",
      error: {
        message: args.message,
        retryable: args.retryable,
      },
      finishedAt: Date.now(),
    });
  },
});

export const updateResumeData = internalMutation({
  args: {
    jobId: v.id("jobs"),
    resumeData: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      resumeData: args.resumeData,
    });
  },
});

/**
 * Retry a failed job
 */
export const retry = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);
    const job = await ctx.db.get(args.jobId);

    if (!job) {
      throw new Error("Job not found");
    }

    if (job.createdBy !== identity.clerkUserId) {
      throw new Error("Forbidden");
    }

    if (job.status !== "failed") {
      throw new Error("Only failed jobs can be retried");
    }

    if (job.attempts >= job.maxAttempts) {
      throw new Error("Job has exceeded maximum retry attempts");
    }

    // Reset job to pending
    await ctx.db.patch(args.jobId, {
      status: "pending",
      error: undefined,
      finishedAt: undefined,
    });

    // Re-schedule the job
    if (job.type === "document_ingest") {
      await ctx.scheduler.runAfter(0, internal.jobs.processDocumentIngestion, {
        jobId: args.jobId,
        documentId: job.input.documentId,
      });
    } else if (job.type === "analyze_opportunity") {
      await ctx.scheduler.runAfter(0, internal.jobs.processBundleAnalysis, {
        jobId: args.jobId,
        bundleId: job.input.bundleId,
      });
    }

    return { success: true };
  },
});

/**
 * Cancel a running or pending job
 */
export const cancel = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);
    const job = await ctx.db.get(args.jobId);

    if (!job) {
      throw new Error("Job not found");
    }

    if (job.createdBy !== identity.clerkUserId) {
      throw new Error("Forbidden");
    }

    if (job.status === "completed" || job.status === "cancelled") {
      throw new Error("Cannot cancel completed or already cancelled job");
    }

    await ctx.db.patch(args.jobId, {
      status: "cancelled",
      finishedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Get all jobs for a document
 * OPTIMIZED: Uses compound index instead of full table scan
 * Note: Internal tool - all authenticated users can see all jobs
 */
export const getJobsForDocument = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    // OPTIMIZED: Use compound index for efficient lookup
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_type_document", (q) =>
        q.eq("type", "document_ingest").eq("documentId", args.documentId)
      )
      .take(20);

    return jobs;
  },
});

export const getInternal = internalQuery({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

/**
 * Get all jobs for a bundle
 * OPTIMIZED: Uses compound index instead of full table scan
 * Note: Internal tool - all authenticated users can see all jobs
 */
export const getJobsForBundle = query({
  args: {
    bundleId: v.id("bundles"),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    // OPTIMIZED: Use compound index for efficient lookup
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_type_bundle", (q) =>
        q.eq("type", "analyze_opportunity").eq("bundleId", args.bundleId)
      )
      .take(20);

    return jobs;
  },
});

/**
 * Internal query to get all jobs for a bundle (for actions)
 * OPTIMIZED: Uses compound index instead of full table scan
 */
export const getJobsForBundleInternal = internalQuery({
  args: {
    bundleId: v.id("bundles"),
  },
  handler: async (ctx, args) => {
    // OPTIMIZED: Use compound index for efficient lookup
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_type_bundle", (q) =>
        q.eq("type", "analyze_opportunity").eq("bundleId", args.bundleId)
      )
      .take(20);

    return jobs;
  },
});

/**
 * Enqueue bundle analysis job
 * Note: Internal tool - all authenticated users can enqueue analysis
 */
export const enqueueBundleAnalysis = mutation({
  args: {
    bundleId: v.id("bundles"),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);
    const bundle = await ctx.db.get(args.bundleId);

    if (!bundle) {
      throw new Error("Bundle not found");
    }

    const jobId = await ctx.db.insert("jobs", {
      type: "analyze_opportunity",
      input: { bundleId: args.bundleId },
      output: undefined,
      status: "pending",
      progress: {
        current: 0,
        total: 4,
        message: "Queued",
      },
      error: undefined,
      attempts: 0,
      maxAttempts: 3,
      resumeToken: undefined,
      resumeData: undefined,
      createdBy: identity.clerkUserId,
      createdAt: Date.now(),
      startedAt: undefined,
      finishedAt: undefined,
      scheduledFor: undefined,
      // OPTIMIZATION: Top-level field for indexed lookups
      bundleId: args.bundleId,
    });

    await ctx.scheduler.runAfter(0, internal.jobs.processBundleAnalysis, {
      jobId,
      bundleId: args.bundleId,
    });

    return { jobId };
  },
});

/**
 * Internal mutation to enqueue bundle analysis (called from finalize)
 */
export const enqueueBundleAnalysisInternal = internalMutation({
  args: {
    bundleId: v.id("bundles"),
    createdBy: v.string(),
    organizationId: v.optional(v.string()), // Kept for backward compatibility but not used
  },
  handler: async (ctx, args) => {
    const jobId = await ctx.db.insert("jobs", {
      type: "analyze_opportunity",
      input: { bundleId: args.bundleId },
      output: undefined,
      status: "pending",
      progress: {
        current: 0,
        total: 4,
        message: "Queued for analysis",
      },
      error: undefined,
      attempts: 0,
      maxAttempts: 3,
      resumeToken: undefined,
      resumeData: undefined,
      createdBy: args.createdBy,
      createdAt: Date.now(),
      startedAt: undefined,
      finishedAt: undefined,
      scheduledFor: undefined,
      // OPTIMIZATION: Top-level field for indexed lookups
      bundleId: args.bundleId,
    });

    await ctx.scheduler.runAfter(0, internal.jobs.processBundleAnalysis, {
      jobId,
      bundleId: args.bundleId,
    });

    return { jobId };
  },
});

/**
 * Process bundle analysis job
 */
export const processBundleAnalysis = internalAction({
  args: {
    jobId: v.id("jobs"),
    bundleId: v.id("bundles"),
  },
  handler: async (ctx, args) => {
    console.log(`[Bundle Analysis Job] Starting analysis for bundle ${args.bundleId}`);

    await ctx.runMutation(internal.jobs.markJobStarted, {
      jobId: args.jobId,
    });

    const job = await ctx.runQuery(internal.jobs.getInternal, {
      jobId: args.jobId,
    });

    if (!job) {
      throw new Error("Job not found");
    }

    try {
      const updateProgress = async (stageNumber: number, message: string) => {
        console.log(`[Bundle Analysis Job] Stage ${stageNumber}/4: ${message}`);
        await ctx.runMutation(internal.jobs.updateJobProgress, {
          jobId: args.jobId,
          current: stageNumber,
          total: 4,
          message,
        });
      };

      // ==================== STAGE 1: VALIDATE BUNDLE ====================
      await updateProgress(1, "Validating bundle");

      const bundle = await ctx.runQuery(internal.bundles.getInternal, {
        id: args.bundleId,
      });

      if (!bundle) {
        throw new Error("Bundle not found");
      }

      console.log(`[Bundle Analysis Job] Bundle name: ${bundle.name}, status: ${bundle.status}`);

      if (bundle.status !== "ready") {
        throw new Error(`Bundle status is ${bundle.status}, expected ready`);
      }

      // Get all documents in the bundle
      const documents = await ctx.runQuery(internal.bundles.getDocumentsInternal, {
        bundleId: args.bundleId,
      });

      console.log(`[Bundle Analysis Job] Found ${documents.length} documents in bundle`);

      if (documents.length === 0) {
        throw new Error("Bundle has no documents");
      }

      const allReady = documents.every((doc: any) => doc.status === "ready");
      console.log(`[Bundle Analysis Job] All documents ready: ${allReady}`);

      if (!allReady) {
        const docStatuses = documents.map((d: any) => `${d.filename}: ${d.status}`).join(", ");
        throw new Error(`Not all documents in bundle are ready. Statuses: ${docStatuses}`);
      }

      // Determine which analysis engine to use
      // Priority: Claude (primary) > Gemini File Search > Legacy OpenAI
      const hasClaudeConfig = Boolean(
        process.env.AZURE_CLAUDE_ENDPOINT && process.env.AZURE_CLAUDE_API_KEY
      );
      const useClaudeAnalysis = USE_CLAUDE_FOR_ANALYSIS && hasClaudeConfig;

      let useGeminiAnalysis = false;
      if (!useClaudeAnalysis && USE_GEMINI_FILE_SEARCH_ANALYSIS) {
        // Fall back to Gemini if Claude is not configured
        const allGeminiReady = documents.every((doc: any) => doc.geminiStatus === "ready");
        const geminiStatuses = documents.map((d: any) => `${d.filename}: ${d.geminiStatus || "not_uploaded"}`).join(", ");
        console.log(`[Bundle Analysis Job] Gemini statuses: ${geminiStatuses}`);

        if (!allGeminiReady) {
          const hasErrors = documents.some((doc: any) => doc.geminiStatus === "error");
          if (hasErrors) {
            console.warn(`[Bundle Analysis Job] Some documents failed Gemini upload. Falling back to legacy analysis.`);
            useGeminiAnalysis = false;
          } else {
            throw new Error(`Not all documents are indexed in Gemini. Statuses: ${geminiStatuses}. Please wait for indexing to complete.`);
          }
        } else {
          useGeminiAnalysis = true;
        }
      }

      console.log(`[Bundle Analysis Job] Analysis engine: ${useClaudeAnalysis ? 'Claude Sonnet 4.5' : useGeminiAnalysis ? 'Gemini File Search' : 'Legacy OpenAI'}`);

      const extraction = useClaudeAnalysis
        ? await runClaudeBundleExtraction(ctx, args, bundle, documents, updateProgress)
        : useGeminiAnalysis
          ? await runGeminiBundleExtraction(ctx, args, bundle, documents, updateProgress)
          : await runLegacyBundleExtraction(ctx, args, bundle, documents, updateProgress);

      const data = extraction.data;
      const metadata = extraction.metadata;
      const contextChunks = extraction.contextChunks;
      const contextText = extraction.contextText;
      const analysisMetadataExtras = extraction.analysisMetadataExtras ?? {};
      const geminiTenderAnalysis = extraction.geminiTenderAnalysis;

      // Use shared utilities for normalization
      const requirements = normalizeRequirements(data.requirements ?? [], args.bundleId);
      const risks = normalizeRisks(data.risks ?? [], args.bundleId);

      // Fold required submission documents into requirements as compliance items
      if (Array.isArray(data.requiredDocuments) && data.requiredDocuments.length > 0) {
        data.requiredDocuments.forEach(
          (doc: { name: string; mandatory?: boolean; notes?: string }, idx: number) => {
          requirements.push({
            id: `req-doc-${args.bundleId}-${idx}`,
            type: "compliance",
            description: `Required document: ${doc.name}${doc.notes ? ` - ${doc.notes}` : ""}`,
            mandatory: doc.mandatory ?? true,
            status: "unknown",
          });
        }
        );
      }

      const safeTitle = safeString(data.title, "Untitled Opportunity");
      const safeIssuer = safeString(data.issuer, "Unknown Issuer");
      const normalizedDueDate = normalizeTimestamp(data.dueDate);
      const normalizedPublishedDate = normalizeTimestamp(data.publishedDate);
      const safeDueDate = normalizedDueDate ?? Date.now();

      console.log(`[Bundle Analysis Job] LLM extraction complete. Requirements: ${requirements.length}, Risks: ${risks.length}`);
      console.log(`[Bundle Analysis Job] Model: ${metadata.model}, Tokens: ${metadata.tokensUsed?.total}, Cost: $${metadata.cost?.toFixed(4)}`);

      // ==================== STAGE 4: PERSIST DATA ====================
      await updateProgress(4, "Saving opportunity and analysis");

      const analysisSummary = (data.summary && data.summary.trim().length)
        ? data.summary
        : `Analyzed bundle "${bundle.name}" with ${documents.length} documents. Extracted ${requirements.length} requirements and identified ${risks.length} risks.`;

      // Create analysis record first
      const metadataEnvelope = {
        tokensUsed: metadata.tokensUsed?.total,
        cost: metadata.cost,
        latencyMs: metadata.latencyMs,
        ...analysisMetadataExtras,
      };

      // Normalize documentsChecklist for both paths
      const documentsChecklist = geminiTenderAnalysis?.documentsChecklist
        ?? (data.requiredDocuments ?? []).map((doc: { name: string; mandatory?: boolean; notes?: string }) => ({
            name: doc.name,
            mandatory: doc.mandatory ?? true,
            instructions: doc.notes,
          }));

      const analysisResultPayload = geminiTenderAnalysis
        ? {
            ...geminiTenderAnalysis,
            summary: analysisSummary,
            _metadata: metadataEnvelope,
          }
        : {
            ...data,
            documentsChecklist, // Ensure documentsChecklist is always present
            summary: analysisSummary,
            _metadata: metadataEnvelope,
          };

      const analysisId = await ctx.runMutation(internal.analyses.create, {
        bundleId: args.bundleId,
        status: "completed",
        model: metadata.model,
        promptVersion: "1.0",
        inputBytes: 0, // Not tracked in this flow
        inputChars: contextText.length,
        tokensIn: metadata.tokensIn ?? metadata.tokensUsed?.prompt,
        tokensOut: metadata.tokensOut ?? metadata.tokensUsed?.completion,
        result: analysisResultPayload,
        createdBy: job.createdBy,
        organizationId: job.organizationId,
      });

      // Construct the analysis object expected by opportunities.ts
      const analysisObject = {
        opportunity: {
            title: safeTitle,
            issuer: safeIssuer,
            issuerCategory: data.issuerCategory,
            referenceNumber: data.referenceNumber,
            currency: data.currency ?? "ZAR",
            description: data.description,
        },
        timelines: {
            dueDate: safeDueDate,
            publishedDate: normalizedPublishedDate,
        },
        requirements: requirements,
        risks: risks,
        summary: data.summary
      };

      // Create opportunity with requirements
      const opportunityId = await ctx.runMutation(internal.opportunities.createFromAnalysis, {
        analysis: analysisObject,
        bundleId: args.bundleId,
        analysisId,
        createdBy: job.createdBy,
        organizationId: job.organizationId,
      });

      // Mark job as completed
      await ctx.runMutation(internal.jobs.markJobCompleted, {
        jobId: args.jobId,
        output: {
          bundleId: args.bundleId,
          opportunityId,
          requirementsExtracted: requirements.length,
          risksIdentified: risks.length,
          chunksAnalyzed: contextChunks.length,
        },
      });

      console.log(`[Bundle Analysis Job] ✅ Complete! Created opportunity ${opportunityId}`);
    } catch (error) {
      console.error(`[Bundle Analysis Job] ❌ Failed:`, error);

      const retryable = error instanceof Error && isRetryableError(error);

      await ctx.runMutation(internal.jobs.markJobFailedWithRetry, {
        jobId: args.jobId,
        message: error instanceof Error ? error.message : "Unknown error",
        retryable,
      });

      throw error;
    }
  },
});

type ExtractionMetadata = {
  model: string;
  tokensUsed?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
  tokensIn?: number;
  tokensOut?: number;
  cost?: number;
  latencyMs?: number;
};

type BundleExtractionResult = {
  data: any;
  metadata: ExtractionMetadata;
  contextChunks: Array<{ text: string; documentId: string; sequence: number }>;
  contextText: string;
  analysisMetadataExtras?: Record<string, unknown>;
  geminiTenderAnalysis?: any;
};

/**
 * Claude Sonnet 4.5 bundle extraction - PRIMARY analysis engine
 *
 * Features:
 * - Structured outputs with guaranteed JSON schema compliance
 * - Extended thinking for complex multi-document analysis
 * - Optimized prompts for comprehensive tender extraction
 */
async function runClaudeBundleExtraction(
  ctx: any,
  args: { bundleId: any },
  bundle: any,
  documents: any[],
  updateProgress: (stageNumber: number, message: string) => Promise<void>
): Promise<BundleExtractionResult> {
  await updateProgress(2, "Collecting document context for Claude analysis");

  // Claude has 200K context - collect ALL content without truncation
  const MAX_TOTAL_CHARS = 400000; // ~100K tokens, well within Claude's limit

  const contextChunks: Array<{ text: string; documentId: string; sequence: number }> = [];
  let totalChars = 0;

  for (const doc of documents) {
    const chunks = await ctx.runQuery(internal.chunks.listByDocumentInternalLightweight, {
      documentId: doc._id,
      limit: 100000, // Get all chunks
    });

    for (const chunk of chunks) {
      if (totalChars + chunk.text.length > MAX_TOTAL_CHARS) break;
      contextChunks.push({
        text: chunk.text,
        documentId: doc._id,
        sequence: chunk.sequence,
      });
      totalChars += chunk.text.length;
    }
    if (totalChars >= MAX_TOTAL_CHARS) break;
  }

  if (contextChunks.length === 0) {
    throw new Error("No chunks found in bundle documents");
  }

  // Format context with document headers for better source tracking
  const docIdToName = new Map(documents.map((d: any) => [d._id.toString(), d.filename]));
  let currentDocId = "";
  const formattedChunks: string[] = [];

  for (const chunk of contextChunks) {
    if (chunk.documentId.toString() !== currentDocId) {
      currentDocId = chunk.documentId.toString();
      const docName = docIdToName.get(currentDocId) || "Unknown Document";
      formattedChunks.push(`\n=== DOCUMENT: ${docName} ===\n`);
    }
    formattedChunks.push(chunk.text);
  }

  const contextText = formattedChunks.join("\n\n");
  const totalPages = documents.reduce((sum: number, d: any) => sum + (d.metadata?.pageCount || 0), 0);

  console.log(
    `[Claude Analysis] Collected ${contextChunks.length} chunks (${totalChars} chars) from ${documents.length} docs, ${totalPages} pages`
  );

  await updateProgress(3, "Analyzing with Claude Sonnet 4.5");

  // Check if Claude is configured
  const hasClaudeConfig = Boolean(
    process.env.AZURE_CLAUDE_ENDPOINT && process.env.AZURE_CLAUDE_API_KEY
  );

  if (!hasClaudeConfig) {
    throw new Error(
      "Claude not configured. Set AZURE_CLAUDE_ENDPOINT and AZURE_CLAUDE_API_KEY environment variables."
    );
  }

  const {
    ClaudeClient,
    getClaudeConfig,
    buildClaudeTenderAnalysisPrompt,
    CLAUDE_TENDER_SYSTEM_PROMPT,
  } = await import("@tenderbot/llm");
  const { TenderAnalysisSchema } = await import("@tenderbot/contracts");

  const claudeClient = new ClaudeClient(getClaudeConfig());

  const prompt = buildClaudeTenderAnalysisPrompt(
    bundle.name,
    documents.map((d: any) => ({
      filename: d.filename,
      pageCount: d.metadata?.pageCount,
    })),
    contextText
  );

  // Determine if we should use extended thinking
  const useExtendedThinking = claudeClient.shouldUseExtendedThinking(documents.length, totalPages);

  console.log(
    `[Claude Analysis] Starting analysis. Extended thinking: ${useExtendedThinking}`
  );

  const startTime = Date.now();

  const result = await claudeClient.analyze(
    prompt,
    TenderAnalysisSchema,
    documents.length,
    totalPages,
    {
      systemPrompt: CLAUDE_TENDER_SYSTEM_PROMPT,
      maxTokens: 16384,
    }
  );

  const latencyMs = Date.now() - startTime;

  console.log(
    `[Claude Analysis] Complete. Tokens: ${result.usage.totalTokens}, Latency: ${latencyMs}ms`
  );

  return {
    data: result.data,
    metadata: {
      model: result.model,
      tokensIn: result.usage.inputTokens,
      tokensOut: result.usage.outputTokens,
      cost: undefined, // Claude via Azure doesn't have direct cost tracking
      latencyMs,
    },
    contextChunks,
    contextText,
    analysisMetadataExtras: {
      source: "claude_sonnet_4_5",
      extendedThinkingUsed: useExtendedThinking,
      thinkingContent: result.thinkingContent,
    },
  };
}

async function runLegacyBundleExtraction(
  ctx: any,
  args: { bundleId: any },
  bundle: any,
  documents: any[],
  updateProgress: (stageNumber: number, message: string) => Promise<void>
): Promise<BundleExtractionResult> {
  await updateProgress(2, "Collecting document context");

  // Default to FULL context - modern LLMs (GPT-4.1, etc.) can handle 128K+ tokens
  // A 50-page tender is typically only ~20K tokens, so there's no need to truncate
  // Set LLM_FULL_CONTEXT=false only if you specifically need to limit context
  const limitContext = process.env.LLM_FULL_CONTEXT === "false";
  const MAX_CHUNKS_PER_DOC = limitContext ? 50 : 100000;
  const MAX_TOTAL_CHARS = limitContext ? 150000 : Number.POSITIVE_INFINITY;

  const contextChunks: Array<{ text: string; documentId: string; sequence: number }> = [];
  let totalChars = 0;

  for (const doc of documents) {
    // OPTIMIZED: Use lightweight query (excludes embeddings, saves ~12KB per chunk)
    const chunks = await ctx.runQuery(internal.chunks.listByDocumentInternalLightweight, {
      documentId: doc._id,
      limit: MAX_CHUNKS_PER_DOC,
    });

    for (const chunk of chunks) {
      if (totalChars + chunk.text.length > MAX_TOTAL_CHARS) {
        break;
      }
      contextChunks.push({
        text: chunk.text,
        documentId: doc._id,
        sequence: chunk.sequence,
      });
      totalChars += chunk.text.length;
    }

    if (totalChars >= MAX_TOTAL_CHARS) {
      break;
    }
  }

  if (contextChunks.length === 0) {
    throw new Error("No chunks found in bundle documents");
  }

  const contextText = contextChunks.map((c) => c.text).join("\n\n");
  console.log(
    `[Bundle Analysis Job] Collected ${contextChunks.length} chunks (${totalChars} chars). FullContext=${!limitContext}`
  );

  await updateProgress(3, "Extracting opportunity data with LLM");

  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
  const hasAzureOpenAI = Boolean(
    process.env.AZURE_OPENAI_API_KEY &&
      process.env.AZURE_OPENAI_ENDPOINT &&
      process.env.AZURE_OPENAI_DEPLOYMENT
  );

  if (!hasOpenAI && !hasAzureOpenAI) {
    throw new Error(
      "LLM API not configured. Set OPENAI_API_KEY or Azure OpenAI credentials (AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT)"
    );
  }

  const { StructuredOutputClient, ModelRouter, PROMPTS } = await import("@tenderbot/llm");
  const { z } = await import("@tenderbot/contracts");

  const router = new ModelRouter({
    defaultProvider: "openai",
    fallbackProviders: [],
  });

  const apiKey = process.env.OPENAI_API_KEY ?? process.env.AZURE_OPENAI_API_KEY;
  const client = new StructuredOutputClient(apiKey, router);

  const ExtractionSchema = z.object({
    title: z.string().min(1).default("Untitled Opportunity"),
    issuer: z.string().min(1).default("Unknown Issuer"),
    issuerCategory: z.string().optional().nullable(),
    referenceNumber: z.string().optional().nullable(),
    dueDate: z.number().int().optional().nullable(),
    publishedDate: z.number().int().optional().nullable(),
    estimatedValue: z.number().optional().nullable(),
    currency: z.string().min(1).default("ZAR"),
    description: z.string().optional().nullable(),
    summary: z.string().optional().nullable(),
    requiredDocuments: z
      .array(
        z.object({
          name: z.string(),
          mandatory: z.boolean().optional().default(true),
          notes: z.string().optional(),
        })
      )
      .default([]),
    requirements: z
      .array(
        z.union([
          z.object({
            id: z.string().optional(),
            type: z
              .enum([
                "compliance",
                "technical",
                "commercial",
                "legal",
                "bee",
                "eligibility",
                "other",
              ])
              .default("other"),
            description: z.string().optional(),
            mandatory: z.boolean().optional().default(false),
            status: z
              .enum(["met", "partial", "unknown", "not_met"])
              .optional()
              .default("unknown"),
            confidence: z.number().min(0).max(1).optional(),
            notes: z.string().optional(),
          }),
          z.string(),
        ])
      )
      .default([]),
    risks: z
      .array(
        z.union([
          z.object({
            id: z.string().optional(),
            category: z
              .enum([
                "eligibility",
                "bee_compliance",
                "financial",
                "technical",
                "timeline",
                "commercial",
                "legal",
              ])
              .default("commercial"),
            severity: z.enum(["low", "medium", "high", "critical"]).optional().default("medium"),
            description: z.string().optional(),
            mitigation: z.string().optional(),
            likelihood: z.number().min(0).max(1).optional(),
            impact: z.number().min(0).max(1).optional(),
          }),
          z.string(),
        ])
      )
      .default([]),
    score: z
      .object({
        overall: z.number().min(0).max(100).optional(),
        eligibility: z.number().min(0).max(100).optional(),
        competitiveness: z.number().min(0).max(100).optional(),
        strategicFit: z.number().min(0).max(100).optional(),
      })
      .optional(),
  });

  const prompt = PROMPTS.extractDocument(
    contextText,
    `Extract ALL tender opportunity information comprehensively:

1. BASIC INFO: title, issuer, reference number, due date, description
2. REQUIRED DOCUMENTS (CRITICAL): Extract EVERY document mentioned in 'Administrative Compliance', 'Returnable Documents', or similar sections. Use EXACT names as written (e.g., "CSD Report", "SARS Tax Clearance Certificate", "CIPC/CIPRO Certificate", "B-BBEE Status Level Verification Certificate", "SBD 1", "SBD 3.1", "SBD 4", "SBD 6.1", "Letter of Appointment", "Board Resolution", "CV and ID of director"). Do NOT summarize - list each document separately.
3. REQUIREMENTS: All eligibility, technical, BEE, financial, and compliance requirements
4. RISKS: Potential disqualification risks, timeline risks, capacity risks
5. SUMMARY: Concise overview of the tender scope and key points

Search the ENTIRE document including all tables and annexures.`
  );

  const extraction = await client.generate({
    schema: ExtractionSchema,
    prompt,
    model: {
      provider: "openai",
      model: process.env.LLM_MODEL ?? "gpt-4.1",
      temperature: 0.1,
      maxTokens: 32768,
    },
    options: { maxRetries: 3 },
  });

  return {
    data: extraction.data,
    metadata: {
      model: extraction.metadata.model,
      tokensUsed: extraction.metadata.tokensUsed,
      tokensIn: extraction.metadata.tokensUsed?.prompt,
      tokensOut: extraction.metadata.tokensUsed?.completion,
      cost: extraction.metadata.cost,
      latencyMs: extraction.metadata.latencyMs,
    },
    contextChunks,
    contextText,
    analysisMetadataExtras: {
      source: "legacy_rag",
      promptVersion: "1.0",
    },
  };
}

async function runGeminiBundleExtraction(
  ctx: any,
  args: { bundleId: any },
  bundle: any,
  documents: any[],
  updateProgress: (stageNumber: number, message: string) => Promise<void>
): Promise<BundleExtractionResult> {
  await updateProgress(2, "Running Gemini File Search analysis");

  const geminiAnalysis = await ctx.runAction(internal.analyses.runGeminiFileSearchAnalysis, {
    bundleId: args.bundleId,
  });

  const data = {
    title: geminiAnalysis.analysis.opportunity.title,
    issuer: geminiAnalysis.analysis.opportunity.issuer,
    issuerCategory: geminiAnalysis.analysis.opportunity.issuerCategory,
    referenceNumber: geminiAnalysis.analysis.opportunity.referenceNumber,
    dueDate: geminiAnalysis.analysis.timelines.dueDate,
    publishedDate: geminiAnalysis.analysis.timelines.publishedDate,
    currency: geminiAnalysis.analysis.opportunity.currency,
    description:
      geminiAnalysis.analysis.opportunity.description ?? geminiAnalysis.analysis.summary,
    summary: geminiAnalysis.analysis.summary,
    requirements: geminiAnalysis.analysis.requirements,
    risks: geminiAnalysis.analysis.risks,
    requiredDocuments: (geminiAnalysis.analysis.documentsChecklist ?? []).map(
      (doc: { name: string; mandatory: boolean; instructions?: string }) => ({
        name: doc.name,
        mandatory: doc.mandatory,
        notes: doc.instructions,
      })
    ),
  };

  console.log(
    `[Bundle Analysis Job] Gemini File Search analysis complete for bundle ${bundle.name}`
  );

  return {
    data,
    metadata: {
      model: geminiAnalysis.model,
      tokensUsed: {
        prompt: geminiAnalysis.usageMetadata?.promptTokenCount,
        completion: geminiAnalysis.usageMetadata?.candidatesTokenCount,
        total: geminiAnalysis.usageMetadata?.totalTokenCount,
      },
      tokensIn: geminiAnalysis.usageMetadata?.promptTokenCount,
      tokensOut: geminiAnalysis.usageMetadata?.candidatesTokenCount,
      latencyMs: geminiAnalysis.latencyMs,
    },
    contextChunks: [],
    contextText: "",
    analysisMetadataExtras: {
      source: "gemini_file_search",
      usage: geminiAnalysis.usageMetadata,
      grounding: geminiAnalysis.groundingMetadata,
    },
    geminiTenderAnalysis: geminiAnalysis.analysis,
  };
}
