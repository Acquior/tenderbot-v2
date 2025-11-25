import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireUser } from "./auth";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { TenderAnalysisSchema, z } from "@tenderbot/contracts";
import { coerceTimestamp } from "./lib/timeUtils";

/**
 * Create a queued analysis record for a bundle
 */
export const createQueued = internalMutation({
  args: {
    bundleId: v.id("bundles"),
    model: v.string(),
    promptVersion: v.string(),
    createdBy: v.string(),
    organizationId: v.optional(v.string()),
    targetId: v.optional(v.string()), // Added targetId
  },
  handler: async (ctx, args) => {
    const analysisId = await ctx.db.insert("analyses", {
      bundleId: args.bundleId,
      status: "queued",
      model: args.model,
      promptVersion: args.promptVersion,
      inputBytes: 0, // Will be updated when processing starts
      inputChars: 0,
      createdBy: args.createdBy,
      organizationId: args.organizationId,
      targetId: args.targetId,
      createdAt: Date.now(),
    });

    return analysisId;
  },
});

/**
 * Update analysis to processing status
 */
export const updateToProcessing = internalMutation({
  args: {
    analysisId: v.id("analyses"),
    inputBytes: v.number(),
    inputChars: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.analysisId, {
      status: "processing",
      inputBytes: args.inputBytes,
      inputChars: args.inputChars,
    });
  },
});

/**
 * Update analysis to completed status with results
 */
export const updateToCompleted = internalMutation({
  args: {
    analysisId: v.id("analyses"),
    result: v.any(),
    tokensIn: v.number(),
    tokensOut: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.analysisId, {
      status: "completed",
      result: args.result,
      tokensIn: args.tokensIn,
      tokensOut: args.tokensOut,
      completedAt: Date.now(),
    });
  },
});

/**
 * Update analysis to failed status with error
 */
export const updateToFailed = internalMutation({
  args: {
    analysisId: v.id("analyses"),
    error: v.object({
      message: v.string(),
      code: v.optional(v.string()),
      stack: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.analysisId, {
      status: "failed",
      error: args.error,
      completedAt: Date.now(),
    });
  },
});

/**
 * Create an analysis record (internal)
 */
export const create = internalMutation({
  args: {
    bundleId: v.id("bundles"),
    status: v.union(
      v.literal("queued"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    model: v.string(),
    promptVersion: v.string(),
    inputBytes: v.number(),
    inputChars: v.number(),
    tokensIn: v.optional(v.number()),
    tokensOut: v.optional(v.number()),
    result: v.optional(v.any()),
    error: v.optional(
      v.object({
        message: v.string(),
        code: v.optional(v.string()),
        stack: v.optional(v.string()),
      })
    ),
    createdBy: v.string(),
    organizationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const analysisId = await ctx.db.insert("analyses", {
      bundleId: args.bundleId,
      status: args.status,
      model: args.model,
      promptVersion: args.promptVersion,
      inputBytes: args.inputBytes,
      inputChars: args.inputChars,
      tokensIn: args.tokensIn,
      tokensOut: args.tokensOut,
      result: args.result,
      error: args.error,
      createdBy: args.createdBy,
      organizationId: args.organizationId,
      createdAt: Date.now(),
      completedAt: args.status === "completed" || args.status === "failed" ? Date.now() : undefined,
    });

    return analysisId;
  },
});

/**
 * Start tender analysis for a bundle (internal)
 * Used by background jobs
 */
export const startAnalysisForBundleInternal = internalAction({
  args: {
    bundleId: v.id("bundles"),
    createdBy: v.string(),
    organizationId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ analysisId: Id<"analyses">; isNew: boolean }> => {
    // Check for existing queued or processing analysis
    const existingAnalysis = await ctx.runQuery(
      internal.analyses.findActiveAnalysisForBundle,
      {
        bundleId: args.bundleId,
      }
    );

    if (existingAnalysis) {
      return { analysisId: existingAnalysis._id, isNew: false };
    }

    // Create queued analysis record
    const analysisId: Id<"analyses"> = await ctx.runMutation(
      internal.analyses.createQueued,
      {
        bundleId: args.bundleId,
        model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4-turbo-preview",
        promptVersion: "v1.0.0",
        createdBy: args.createdBy,
        organizationId: args.organizationId,
        targetId: args.bundleId, // Ensure targetId is passed
      }
    );

    // Schedule the analysis to run
    await ctx.scheduler.runAfter(0, internal.analyses.runAnalysisForBundle, {
      analysisId,
    });

    return { analysisId, isNew: true };
  },
});

/**
 * Start tender analysis for a bundle
 * This creates the analysis record and triggers processing
 * IDEMPOTENT: Returns existing analysis if already queued/processing
 */
export const startAnalysisForBundle = action({
  args: {
    bundleId: v.id("bundles"),
  },
  handler: async (ctx, args): Promise<{ analysisId: Id<"analyses">; isNew: boolean }> => {
    const identity = await ctx.runQuery(internal.auth.getCurrentUser);
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Check for existing queued or processing analysis
    const existingAnalysis = await ctx.runQuery(
      internal.analyses.findActiveAnalysisForBundle,
      {
        bundleId: args.bundleId,
      }
    );

    if (existingAnalysis) {
      // Return existing analysis - idempotent behavior
      return { analysisId: existingAnalysis._id, isNew: false };
    }

    // Create queued analysis record
    const analysisId: Id<"analyses"> = await ctx.runMutation(
      internal.analyses.createQueued,
      {
        bundleId: args.bundleId,
        model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4-turbo-preview",
        promptVersion: "v1.0.0",
        createdBy: identity.clerkUserId,
        targetId: args.bundleId, // Ensure targetId is passed
      }
    );

    // Schedule the analysis to run
    await ctx.scheduler.runAfter(0, internal.analyses.runAnalysisForBundle, {
      analysisId,
    });

    return { analysisId, isNew: true };
  },
});

/**
 * Run the actual analysis for a bundle
 * This is an internal action that does the heavy lifting
 */
export const runAnalysisForBundle = internalAction({
  args: {
    analysisId: v.id("analyses"),
  },
  handler: async (ctx, args) => {
    try {
      // Get analysis record
      const analysis = await ctx.runQuery(internal.analyses.getById, {
        id: args.analysisId,
      });

      if (!analysis) {
        throw new Error("Analysis not found");
      }

      // Guard against historical malformed records
      const bundleId = analysis.bundleId;
      if (!bundleId) {
        throw new Error(
          `Analysis ${args.analysisId} is missing bundleId. This usually indicates legacy data; consider deleting the record.`
        );
      }

      // Get bundle and its documents
      const bundle = await ctx.runQuery(internal.bundles.getById, {
        id: bundleId,
      });

      if (!bundle) {
        throw new Error("Bundle not found");
      }

      const documents = await ctx.runQuery(internal.documents.listByBundle, {
        bundleId,
      });

      if (documents.length === 0) {
        throw new Error("No documents in bundle");
      }

      // Build context from already-extracted chunks instead of re-extracting from PDFs
      // This avoids pdf-parse which uses pdfjs-dist that requires structuredClone with transfer
      const MAX_CHUNKS_PER_DOC = 100;
      const MAX_TOTAL_CHARS = 100000;
      
      const textParts: string[] = [];
      let totalChars = 0;
      let totalBytes = 0;
      
      for (const doc of documents) {
        // OPTIMIZED: Use lightweight query (excludes embeddings, saves ~12KB per chunk)
        const chunks = await ctx.runQuery(internal.chunks.listByDocumentInternalLightweight, {
          documentId: doc._id,
          limit: MAX_CHUNKS_PER_DOC,
        });
        
        // Add document marker
        textParts.push(`<<<DOC:docId=${doc._id} NAME=${doc.filename}>>>`);
        
        for (const chunk of chunks) {
          if (totalChars + chunk.text.length > MAX_TOTAL_CHARS) {
            break;
          }
          textParts.push(chunk.text);
          totalChars += chunk.text.length;
        }
        
        textParts.push("<<<END>>>");
        textParts.push(""); // Empty line separator
        
        // Estimate bytes from storageId metadata (approximate)
        totalBytes += doc.size ?? 0;
        
        if (totalChars >= MAX_TOTAL_CHARS) {
          break;
        }
      }
      
      const aggregatedText = textParts.join("\n");

      // Import analysis functions (no longer need rag for PDF extraction)
      const llm = await import("@tenderbot/llm");
      const { analyzeTenderBundle } = llm;

      // Update analysis with input stats
      await ctx.runMutation(internal.analyses.updateToProcessing, {
        analysisId: args.analysisId,
        inputBytes: totalBytes,
        inputChars: totalChars,
      });

      // Run LLM analysis
      const analysisResult = await analyzeTenderBundle(aggregatedText, {
        model: analysis.model,
        temperature: 0,
        maxTokens: 16000,
        promptVersion: analysis.promptVersion,
      });

      // Validate citations before saving
      const { validateCitations } = llm;
      const citationValidation = validateCitations(analysisResult.data);

      if (!citationValidation.valid) {
        console.warn(
          `[Citation Validation] Analysis ${args.analysisId} has ${citationValidation.errors.length} citation issues:`,
          citationValidation.errors
        );
        // Log to metadata but don't fail the analysis
      } else {
        console.log(`[Citation Validation] Analysis ${args.analysisId} passed citation validation`);
      }

      // Update analysis with results and validation metadata
      await ctx.runMutation(internal.analyses.updateToCompleted, {
        analysisId: args.analysisId,
        result: {
          ...analysisResult.data,
          _metadata: {
            citationValidation: {
              valid: citationValidation.valid,
              errorCount: citationValidation.errors.length,
              errors: citationValidation.valid ? undefined : citationValidation.errors,
            },
          },
        },
        tokensIn: analysisResult.metadata.tokensIn,
        tokensOut: analysisResult.metadata.tokensOut,
      });

      // Create opportunity from analysis
      await ctx.runMutation(internal.opportunities.createFromAnalysis, {
        analysis: analysisResult.data,
        bundleId,
        analysisId: args.analysisId,
        createdBy: analysis.createdBy,
        organizationId: analysis.organizationId,
      });
    } catch (error) {
      // Update analysis to failed
      await ctx.runMutation(internal.analyses.updateToFailed, {
        analysisId: args.analysisId,
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: "ANALYSIS_ERROR",
          stack: error instanceof Error ? error.stack : undefined,
        },
      });

      throw error;
    }
  },
});

/**
 * Run tender analysis using Gemini File Search
 */
export const runGeminiFileSearchAnalysis = internalAction({
  args: {
    bundleId: v.id("bundles"),
  },
  handler: async (ctx, args): Promise<GeminiAnalysisResult> => {
    const bundle = await ctx.runQuery(internal.bundles.getInternal, {
      id: args.bundleId,
    });

    if (!bundle) {
      throw new Error("Bundle not found");
    }

    const documents = await ctx.runQuery(internal.bundles.getDocumentsInternal, {
      bundleId: args.bundleId,
    });

    if (documents.length === 0) {
      throw new Error("Bundle has no documents to analyze");
    }

    const model =
      process.env.GEMINI_ANALYSIS_MODEL ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash-exp";
    const systemInstructions = buildGeminiAnalysisSystemPrompt();
    const prompt = buildGeminiAnalysisPrompt(bundle.name ?? "Untitled Bundle", documents);
    const startedAt = Date.now();

    const response = await ctx.runAction(internal.geminiFileSearch.queryWithFileSearchInternal, {
      prompt,
      systemInstructions,
      organizationId: bundle.organizationId,
      bundleId: args.bundleId,
      model,
      responseMimeType: "application/json",
    });

    const latencyMs = Date.now() - startedAt;
    const parsed = parseGeminiJson(response.text);
    const normalized = normalizeTenderAnalysis(parsed);
    const analysis = TenderAnalysisSchema.parse(normalized);

    return {
      analysis,
      citations: response.citations ?? [],
      groundingMetadata: response.groundingMetadata,
      usageMetadata: response.usageMetadata,
      model,
      latencyMs,
    };
  },
});

type TenderAnalysis = z.infer<typeof TenderAnalysisSchema>;

type GeminiAnalysisResult = {
  analysis: TenderAnalysis;
  citations: Array<{ fileUri?: string; chunkIndex?: number }>;
  groundingMetadata: any;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  model: string;
  latencyMs: number;
};

/**
 * Get analysis by ID (internal)
 */
export const getById = internalQuery({
  args: { id: v.id("analyses") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

function buildGeminiAnalysisSystemPrompt(): string {
  return [
    "You are TenderBot, an expert tender analyst.",
    "Read the provided tender documents via File Search and return a JSON object that strictly matches this schema:",
    "{",
    '  "opportunity": {',
    '    "title": string,',
    '    "issuer": string,',
    '    "issuerCategory"?: string,',
    '    "referenceNumber"?: string,',
    '    "description"?: string,',
    '    "currency": string',
    "  },",
    '  "timelines": {',
    '    "dueDate": number (unix epoch ms),',
    '    "publishedDate"?: number,',
    '    "questionsDue"?: number,',
    '    "siteMeeting"?: { "date": number, "time"?: string, "address"?: string, "mandatory"?: boolean }',
    "  },",
    '  "location": { "country"?: string, "province"?: string, "city"?: string, "submissionAddress"?: string },',
    '  "submission": { "method": "online" | "email" | "physical", "portalUrl"?: string, "email"?: string, "instructions"?: string, "validityPeriodDays"?: number },',
    '  "fees": { "tenderFee"?: number, "bidBond"?: { "amount": number, "currency": string }, "otherFees"?: Array<{ "name": string, "amount"?: number, "currency"?: string }> },',
    '  "evaluationCriteria"?: Array<{ "criterion": string, "description"?: string, "weight"?: number }>,',
    '  "summary": string,',
    '  "documentsChecklist": Array<{ "name": string, "mandatory": boolean, "instructions"?: string, "source": { "documentId"?: string, "page"?: number, "quote"?: string } }>,',
    '  "requirements": Array<{ "type": "compliance"|"technical"|"commercial"|"legal"|"bee"|"eligibility"|"other", "description": string, "mandatory": boolean, "status": "met"|"partial"|"unknown"|"not_met", "confidence"?: number, "notes"?: string }>,',
    '  "risks": Array<{ "category": "eligibility"|"bee_compliance"|"financial"|"technical"|"timeline"|"commercial"|"legal", "severity": "low"|"medium"|"high"|"critical", "description": string, "mitigation"?: string, "likelihood"?: number, "impact"?: number }>,',
    '  "citations"?: Array<{ "documentId": string, "page"?: number, "quote": string, "confidence"?: number }>',
    "}",
    "Rules:",
    "- Output JSON only. Do NOT include commentary or code fences.",
    "- Use unix epoch milliseconds for every date/time value.",
    "- If information is unavailable, set the field to null or omit it; never invent facts.",
  ].join("\n");
}

function buildGeminiAnalysisPrompt(bundleName: string, documents: Array<{ filename: string }>): string {
  const docList = documents
    .map((doc, index) => `${index + 1}. ${doc.filename}`)
    .join("\n");

  return [
    `Bundle: ${bundleName}`,
    "Documents:",
    docList,
    "Analyze these tender documents and produce the structured JSON response described in the system instructions. Include requirements, risks, submission details, timelines, fees, evaluation criteria, and a concise summary. Highlight any missing information by leaving fields empty or null rather than guessing.",
    `Today's date: ${new Date().toISOString().split("T")[0]}`,
  ].join("\n\n");
}

function parseGeminiJson(text: string): any {
  const trimmed = text.trim();
  let content = trimmed;

  if (content.startsWith("```")) {
    const lines = content.split("```");
    content = lines.length >= 2 ? lines[1] : content;
  }

  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Gemini analysis did not return a JSON object");
  }

  const jsonPayload = content.slice(firstBrace, lastBrace + 1);
  return JSON.parse(jsonPayload);
}

function normalizeTenderAnalysis(raw: any) {
  const normalized = { ...raw };

  const opportunity = normalized.opportunity ?? {};
  normalized.opportunity = {
    title: opportunity.title ?? raw.title ?? "Untitled Opportunity",
    issuer: opportunity.issuer ?? raw.issuer ?? "Unknown Issuer",
    issuerCategory: opportunity.issuerCategory ?? raw.issuerCategory,
    referenceNumber: opportunity.referenceNumber ?? raw.referenceNumber,
    description: opportunity.description ?? raw.description ?? raw.summary,
    currency: opportunity.currency ?? raw.currency ?? "ZAR",
  };

  const timelines = normalized.timelines ?? {};
  timelines.dueDate =
    coerceTimestamp(timelines.dueDate ?? raw.dueDate ?? raw.due_date) ?? Date.now();
  timelines.publishedDate = coerceTimestamp(timelines.publishedDate ?? raw.publishedDate);
  timelines.questionsDue = coerceTimestamp(timelines.questionsDue ?? raw.questionsDue);

  if (timelines.siteMeeting) {
    const meetingDate = coerceTimestamp(
      timelines.siteMeeting.date ?? raw.timelines?.siteMeeting?.date
    );
    timelines.siteMeeting = meetingDate
      ? {
          ...timelines.siteMeeting,
          date: meetingDate,
        }
      : undefined;
  }

  normalized.timelines = timelines;
  normalized.location = normalized.location ?? {};

  const submission = normalized.submission ?? {};
  submission.method = normalizeSubmissionMethod(submission.method);
  normalized.submission = submission;

  normalized.fees = normalized.fees ?? {};
  normalized.evaluationCriteria = Array.isArray(normalized.evaluationCriteria)
    ? normalized.evaluationCriteria
    : [];
  normalized.documentsChecklist = Array.isArray(normalized.documentsChecklist)
    ? normalized.documentsChecklist
    : [];
  normalized.requirements = Array.isArray(normalized.requirements)
    ? normalized.requirements
    : [];
  normalized.risks = Array.isArray(normalized.risks) ? normalized.risks : [];
  normalized.summary = typeof normalized.summary === "string" ? normalized.summary : "";
  normalized.citations = Array.isArray(normalized.citations) ? normalized.citations : undefined;

  return normalized;
}

// coerceTimestamp is now imported from ./lib/timeUtils

function normalizeSubmissionMethod(value: unknown): "online" | "email" | "physical" {
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (["online", "portal", "website", "system"].includes(lower)) {
      return "online";
    }
    if (["email", "e-mail", "mail"].includes(lower)) {
      return "email";
    }
    if (["physical", "in-person", "courier", "hand", "delivery"].includes(lower)) {
      return "physical";
    }
  }

  return "online";
}

/**
 * Find active (queued or processing) analysis for a bundle
 * Used for idempotency checks
 */
export const findActiveAnalysisForBundle = internalQuery({
  args: { bundleId: v.id("bundles") },
  handler: async (ctx, args) => {
    const analyses = await ctx.db
      .query("analyses")
      .withIndex("by_bundle", (q) => q.eq("bundleId", args.bundleId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "queued"),
          q.eq(q.field("status"), "processing")
        )
      )
      .first();

    return analyses;
  },
});

/**
 * Get analysis by ID (public with auth)
 * Note: Internal tool - all authenticated users can access any analysis
 */
export const get = query({
  args: { id: v.id("analyses") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const analysis = await ctx.db.get(args.id);
    return analysis;
  },
});

/**
 * List analyses for a bundle
 * Note: Internal tool - all authenticated users can see all analyses
 */
export const listByBundle = query({
  args: {
    bundleId: v.id("bundles"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const analyses = await ctx.db
      .query("analyses")
      .withIndex("by_bundle", (q) => q.eq("bundleId", args.bundleId))
      .order("desc")
      .take(args.limit ?? 10);

    return analyses;
  },
});

/**
 * List all analyses
 * Note: Internal tool - all authenticated users can see all analyses
 * OPTIMIZED: Uses by_status index when status is provided
 */
export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const limit = args.limit ?? 50;

    // Use index when status is provided for better performance
    if (args.status) {
      return await ctx.db
        .query("analyses")
        .withIndex("by_status", (q) => q.eq("status", args.status))
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("analyses")
      .withIndex("by_created_at")
      .order("desc")
      .take(limit);
  },
});

/**
 * LIGHTWEIGHT: List analyses without large result/error fields
 * Use this for listing pages where you don't need full analysis data
 * Note: Internal tool - all authenticated users can see all analyses
 * OPTIMIZED: Uses by_status index when status is provided
 */
export const listLightweight = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const limit = args.limit ?? 50;

    // Use index when status is provided for better performance
    const analyses = args.status
      ? await ctx.db
          .query("analyses")
          .withIndex("by_status", (q) => q.eq("status", args.status))
          .order("desc")
          .take(limit)
      : await ctx.db
          .query("analyses")
          .withIndex("by_created_at")
          .order("desc")
          .take(limit);

    // Project only needed fields, EXCLUDE large result/error objects
    return analyses.map((a) => ({
      _id: a._id,
      bundleId: a.bundleId,
      status: a.status,
      model: a.model,
      promptVersion: a.promptVersion,
      summary: a.summary,
      type: a.type,
      tokensIn: a.tokensIn,
      tokensOut: a.tokensOut,
      createdBy: a.createdBy,
      createdAt: a.createdAt,
      completedAt: a.completedAt,
    }));
  },
});

/**
 * LIGHTWEIGHT: List analyses for a bundle without large fields
 * Note: Internal tool - all authenticated users can see all analyses
 */
export const listByBundleLightweight = query({
  args: {
    bundleId: v.id("bundles"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const analyses = await ctx.db
      .query("analyses")
      .withIndex("by_bundle", (q) => q.eq("bundleId", args.bundleId))
      .order("desc")
      .take(args.limit ?? 10);

    return analyses.map((a) => ({
      _id: a._id,
      bundleId: a.bundleId,
      status: a.status,
      model: a.model,
      summary: a.summary,
      tokensIn: a.tokensIn,
      tokensOut: a.tokensOut,
      createdBy: a.createdBy,
      createdAt: a.createdAt,
      completedAt: a.completedAt,
    }));
  },
});

/**
 * Delete an analysis
 * Note: Internal tool - all authenticated users can delete any analysis
 */
export const remove = mutation({
  args: { id: v.id("analyses") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const analysis = await ctx.db.get(args.id);

    if (!analysis) {
      throw new Error("Analysis not found");
    }

    await ctx.db.delete(args.id);
  },
});

