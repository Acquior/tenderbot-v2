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

type StageId = "detect" | "ocr" | "chunk" | "embedding" | "finalize";

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
const TOTAL_STAGES = SHOULD_DETECT_CHARACTERISTICS ? 5 : 4;

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

      // ==================== STAGE 5: FINALIZE ====================
      await updateProgress(TOTAL_STAGES, "Finalizing document");

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
          // Check if analysis job already exists for this bundle
          const existingJobs = await ctx.runQuery(internal.jobs.getJobsForBundleInternal, {
            bundleId: bundle._id,
          });

          const hasActiveJob = existingJobs.some(
            (job: any) => job.status === "pending" || job.status === "running"
          );

          console.log(`[Bundle Analysis Check] Existing jobs: ${existingJobs.length}, hasActiveJob: ${hasActiveJob}`);

          if (!hasActiveJob) {
            console.log(`[Bundle Analysis] Enqueueing analysis for bundle ${bundle._id}`);
            await ctx.runMutation(internal.jobs.enqueueBundleAnalysisInternal, {
              bundleId: bundle._id,
              createdBy: document.createdBy,
              organizationId: document.organizationId,
            });
          } else {
            console.log(`[Bundle Analysis] Skipping - active job already exists`);
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

      // Determine if error is retryable
      const isNetworkError =
        error instanceof Error &&
        (error.message.includes("fetch") ||
          error.message.includes("network") ||
          error.message.includes("timeout") ||
          error.message.includes("rate limit"));

      await ctx.runMutation(internal.jobs.markJobFailedWithRetry, {
        jobId: args.jobId,
        message: error instanceof Error ? error.message : "Unknown error",
        retryable: isNetworkError,
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
 */
export const getJobsForDocument = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);

    const jobs = await ctx.db
      .query("jobs")
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), "document_ingest"),
          q.eq(q.field("input.documentId"), args.documentId)
        )
      )
      .collect();

    // Filter by access control
    return jobs.filter((job) => {
      if (job.createdBy === identity.clerkUserId) {
        return true;
      }
      if (identity.organizationId && job.organizationId === identity.organizationId) {
        return true;
      }
      return false;
    });
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
 */
export const getJobsForBundle = query({
  args: {
    bundleId: v.id("bundles"),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);

    const jobs = await ctx.db
      .query("jobs")
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), "analyze_opportunity"),
          q.eq(q.field("input.bundleId"), args.bundleId)
        )
      )
      .collect();

    // Filter by access control
    return jobs.filter((job) => {
      if (job.createdBy === identity.clerkUserId) {
        return true;
      }
      if (identity.organizationId && job.organizationId === identity.organizationId) {
        return true;
      }
      return false;
    });
  },
});

/**
 * Internal query to get all jobs for a bundle (for actions)
 */
export const getJobsForBundleInternal = internalQuery({
  args: {
    bundleId: v.id("bundles"),
  },
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query("jobs")
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), "analyze_opportunity"),
          q.eq(q.field("input.bundleId"), args.bundleId)
        )
      )
      .collect();

    return jobs;
  },
});

/**
 * Enqueue bundle analysis job
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

    if (bundle.createdBy !== identity.clerkUserId) {
      throw new Error("Forbidden");
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
      organizationId: identity.organizationId,
      createdAt: Date.now(),
      startedAt: undefined,
      finishedAt: undefined,
      scheduledFor: undefined,
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
    organizationId: v.optional(v.string()),
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
      organizationId: args.organizationId,
      createdAt: Date.now(),
      startedAt: undefined,
      finishedAt: undefined,
      scheduledFor: undefined,
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

      // ==================== STAGE 2: COLLECT CONTEXT ====================
      await updateProgress(2, "Collecting document context");

      // Quick-test flag to use full context (join ALL chunks per doc)
      // Set LLM_FULL_CONTEXT=true in env to enable.
      const useFullContext = process.env.LLM_FULL_CONTEXT === "true";

      // Get chunks from all documents, limit to top N per document
      // In full context mode, lift caps substantially.
      const MAX_CHUNKS_PER_DOC = useFullContext ? 100000 : 20;
      const MAX_TOTAL_CHARS = useFullContext ? Number.POSITIVE_INFINITY : 100000; // ~25k tokens when not full

      let contextChunks: Array<{ text: string; documentId: string; sequence: number }> = [];
      let totalChars = 0;

      for (const doc of documents) {
        const chunks = await ctx.runQuery(internal.chunks.listByDocumentInternal, {
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
      console.log(`[Bundle Analysis Job] Collected ${contextChunks.length} chunks (${totalChars} chars). FullContext=${useFullContext}`);

      // ==================== STAGE 3: LLM EXTRACTION ====================
      await updateProgress(3, "Extracting opportunity data with LLM");

      // Validate environment
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

      // Import LLM packages dynamically
      const { StructuredOutputClient, ModelRouter, PROMPTS } = await import("@tenderbot/llm");
      const { z } = await import("@tenderbot/contracts");

      // Create router and client
      const router = new ModelRouter({
        defaultProvider: "openai",
        fallbackProviders: [],
      });

      const apiKey = process.env.OPENAI_API_KEY ?? process.env.AZURE_OPENAI_API_KEY;
      const client = new StructuredOutputClient(apiKey, router);

      // Define extraction schema (subset of OpportunitySchema with requirements and risks)
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
                severity: z
                  .enum(["low", "medium", "high", "critical"])
                  .optional()
                  .default("medium"),
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
        "Extract tender opportunity information including title, issuer, reference number, due date, description, requirements array, risks array, scoring, a concise summary, and an explicit list of required submission documents."
      );

      const { data, metadata } = await client.generate({
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

      const requirements = (data.requirements ?? []).reduce(
        (acc: Array<{
          id: string;
          type: "compliance" | "technical" | "commercial" | "legal" | "bee" | "eligibility" | "other";
          description: string;
          mandatory: boolean;
          status: "met" | "partial" | "unknown" | "not_met";
          confidence?: number;
          notes?: string;
        }>, req, index) => {
          // Allow string items from the model and coerce to objects
          if (typeof req === "string") {
            const text = req.trim();
            if (text.length === 0) return acc;
            acc.push({
              id: `req-${args.bundleId}-${index}`,
              type: "other",
              description: text,
              mandatory: false,
              status: "unknown",
            });
            return acc;
          }

          if (!req.description) {
            return acc;
          }

          acc.push({
            id: req.id ?? `req-${args.bundleId}-${index}`,
            type: req.type ?? "other",
            description: req.description,
            mandatory: req.mandatory ?? false,
            status: req.status ?? "unknown",
            confidence: req.confidence,
            notes: req.notes,
          });

          return acc;
        },
        []
      );

      const risks = (data.risks ?? []).reduce(
        (acc: Array<{
          id: string;
          category:
            | "eligibility"
            | "bee_compliance"
            | "financial"
            | "technical"
            | "timeline"
            | "commercial"
            | "legal";
          severity: "low" | "medium" | "high" | "critical";
          description: string;
          mitigation?: string;
          likelihood?: number;
          impact?: number;
        }>, risk, index) => {
          if (typeof risk === "string") {
            const text = risk.trim();
            if (text.length === 0) return acc;
            acc.push({
              id: `risk-${args.bundleId}-${index}`,
              category: "commercial",
              severity: "medium",
              description: text,
            });
            return acc;
          }

          if (!risk.description) {
            return acc;
          }

          acc.push({
            id: risk.id ?? `risk-${args.bundleId}-${index}`,
            category: risk.category ?? "commercial",
            severity: risk.severity ?? "medium",
            description: risk.description,
            mitigation: risk.mitigation,
            likelihood: risk.likelihood,
            impact: risk.impact,
          });

          return acc;
        },
        []
      );

      // Fold required submission documents into requirements as compliance items
      if (Array.isArray(data.requiredDocuments) && data.requiredDocuments.length > 0) {
        data.requiredDocuments.forEach((doc, idx) => {
          requirements.push({
            id: `req-doc-${args.bundleId}-${idx}`,
            type: "compliance",
            description: `Required document: ${doc.name}${doc.notes ? ` - ${doc.notes}` : ""}`,
            mandatory: doc.mandatory ?? true,
            status: "unknown",
          });
        });
      }

      const safeTitle = data.title?.trim().length ? data.title.trim() : "Untitled Opportunity";
      const safeIssuer = data.issuer?.trim().length ? data.issuer.trim() : "Unknown Issuer";
      const normalizedDueDate =
        typeof data.dueDate === "number" && !Number.isNaN(data.dueDate) ? data.dueDate : undefined;
      const normalizedPublishedDate =
        typeof data.publishedDate === "number" && !Number.isNaN(data.publishedDate)
          ? data.publishedDate
          : undefined;
      const safeDueDate = normalizedDueDate ?? Date.now();

      console.log(`[Bundle Analysis Job] LLM extraction complete. Requirements: ${requirements.length}, Risks: ${risks.length}`);
      console.log(`[Bundle Analysis Job] Model: ${metadata.model}, Tokens: ${metadata.tokensUsed?.total}, Cost: $${metadata.cost?.toFixed(4)}`);

      // ==================== STAGE 4: PERSIST DATA ====================
      await updateProgress(4, "Saving opportunity and analysis");

      // Create opportunity with requirements
      const opportunityId = await ctx.runMutation(internal.opportunities.createFromAnalysis, {
        bundleId: args.bundleId,
        title: safeTitle,
        issuer: safeIssuer,
        issuerCategory: data.issuerCategory ?? undefined,
        referenceNumber: data.referenceNumber ?? undefined,
        dueDate: safeDueDate,
        publishedDate: normalizedPublishedDate,
        estimatedValue: typeof data.estimatedValue === "number" ? data.estimatedValue : undefined,
        currency: data.currency ?? "ZAR",
        description: data.description ?? undefined,
        score: data.score,
        requirements,
        risks,
        createdBy: job.createdBy,
        organizationId: job.organizationId,
      });

      // Create analysis record
      const analysisSummary = (data.summary && data.summary.trim().length)
        ? data.summary
        : `Analyzed bundle "${bundle.name}" with ${documents.length} documents. Extracted ${requirements.length} requirements and identified ${risks.length} risks.`;

      await ctx.runMutation(internal.analyses.create, {
        type: "bundle",
        targetId: args.bundleId,
        summary: analysisSummary,
        metadata: {
          model: metadata.model,
          tokensUsed: metadata.tokensUsed?.total,
          cost: metadata.cost,
          latencyMs: metadata.latencyMs,
        },
        version: "1.0",
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

      // Determine if error is retryable
      const isNetworkError =
        error instanceof Error &&
        (error.message.includes("fetch") ||
          error.message.includes("network") ||
          error.message.includes("timeout") ||
          error.message.includes("rate limit"));

      await ctx.runMutation(internal.jobs.markJobFailedWithRetry, {
        jobId: args.jobId,
        message: error instanceof Error ? error.message : "Unknown error",
        retryable: isNetworkError,
      });

      throw error;
    }
  },
});
