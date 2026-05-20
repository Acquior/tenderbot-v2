import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireUser } from "./auth";

/**
 * Get a single opportunity by ID
 * Note: Internal tool - all authenticated users can access any opportunity
 */
export const get = query({
  args: { id: v.id("opportunities") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const opportunity = await ctx.db.get(args.id);
    return opportunity;
  },
});

/**
 * List all opportunities
 * Note: Internal tool - all authenticated users can see all opportunities
 */
export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("analyzing"),
        v.literal("analysis_complete"),
        v.literal("in_review"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("submitted"),
        v.literal("closed")
      )
    ),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    let results = await ctx.db
      .query("opportunities")
      .withIndex("by_created_at")
      .order("desc")
      .take(50);

    if (args.status) {
      results = results.filter((opportunity) => opportunity.status === args.status);
    }

    return results;
  },
});

/**
 * Get opportunity by bundle ID
 * Returns the opportunity linked to a specific bundle (if exists)
 */
export const getByBundle = query({
  args: { bundleId: v.id("bundles") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const opportunity = await ctx.db
      .query("opportunities")
      .withIndex("by_bundle", (q) => q.eq("bundleId", args.bundleId))
      .first();
    return opportunity;
  },
});

export const getInternal = internalQuery({
  args: { opportunityId: v.id("opportunities") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.opportunityId);
  },
});

export const upsert = mutation({
  args: {
    id: v.optional(v.id("opportunities")),
    title: v.string(),
    issuer: v.string(),
    dueDate: v.number(),
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
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);

    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing) {
        throw new Error("Opportunity not found");
      }

      await ctx.db.patch(args.id, {
        title: args.title,
        issuer: args.issuer,
        dueDate: args.dueDate,
        status: args.status,
        description: args.description,
        updatedAt: Date.now(),
      });

      return args.id;
    }

    return await ctx.db.insert("opportunities", {
      title: args.title,
      issuer: args.issuer,
      issuerCategory: undefined,
      referenceNumber: undefined,
      dueDate: args.dueDate,
      publishedDate: undefined,
      estimatedValue: undefined,
      currency: "ZAR",
      description: args.description,
      status: args.status,
      bundleId: undefined,
      score: undefined,
      createdBy: identity.clerkUserId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update opportunity status
 */
export const updateStatus = mutation({
  args: {
    id: v.id("opportunities"),
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
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const opportunity = await ctx.db.get(args.id);
    if (!opportunity) {
      throw new Error("Opportunity not found");
    }

    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

/**
 * Internal mutation to create opportunity from TenderAnalysis
 */
export const createFromAnalysis = internalMutation({
  args: {
    analysis: v.any(), // TenderAnalysis JSON from LLM
    bundleId: v.id("bundles"),
    analysisId: v.id("analyses"),
    createdBy: v.string(),
    organizationId: v.optional(v.string()), // Kept for backward compatibility but not used
  },
  handler: async (ctx, args) => {
    const analysis = args.analysis;
    const requirements = Array.isArray(analysis.requirements) ? analysis.requirements : [];

    // Ensure idempotency: reuse existing opportunity for this bundle if present
    const existingOpportunity = (
      await ctx.db
        .query("opportunities")
        .withIndex("by_bundle", (q) => q.eq("bundleId", args.bundleId))
        .take(1)
    )[0];

    const baseOpportunityData = {
      title: analysis.opportunity.title,
      issuer: analysis.opportunity.issuer,
      issuerCategory: analysis.opportunity.issuerCategory,
      referenceNumber: analysis.opportunity.referenceNumber,
      dueDate: analysis.timelines.dueDate,
      publishedDate: analysis.timelines.publishedDate,
      estimatedValue: undefined, // Not in TenderAnalysis schema
      currency: analysis.opportunity.currency,
      description: analysis.opportunity.description ?? analysis.summary,
      status: "analysis_complete" as const,
      bundleId: args.bundleId,
      analysisId: args.analysisId,
      score: undefined, // Could be calculated from risks
      risks: analysis.risks,
    };

    let opportunityId;

    if (existingOpportunity) {
      await ctx.db.patch(existingOpportunity._id, {
        ...baseOpportunityData,
        updatedAt: Date.now(),
      });
      opportunityId = existingOpportunity._id;

      // Remove existing requirements to avoid duplicates on retry
      // OPTIMIZED: Use paginated deletion to avoid loading all data at once
      while (true) {
        const existingRequirements = await ctx.db
          .query("requirements")
          .withIndex("by_opportunity", (q) => q.eq("opportunityId", existingOpportunity._id))
          .take(100);

        if (existingRequirements.length === 0) break;

        for (const requirement of existingRequirements) {
          await ctx.db.delete(requirement._id);
        }
      }
    } else {
      opportunityId = await ctx.db.insert("opportunities", {
        ...baseOpportunityData,
        createdBy: args.createdBy,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    // Insert requirements from analysis
    for (const req of requirements) {
      const normalizedEvidence = Array.isArray(req.evidence)
        ? req.evidence
            .filter((item: any) => item && typeof item === "object")
            .map((item: any) => ({
              documentId: item.documentId,
              page: typeof item.page === "number" ? item.page : undefined,
              quote: typeof item.quote === "string" ? item.quote : undefined,
              section: typeof item.section === "string" ? item.section : undefined,
              confidence: typeof item.confidence === "number" ? item.confidence : undefined,
            }))
        : undefined;

      await ctx.db.insert("requirements", {
        opportunityId,
        sourceAnalysisId: args.analysisId,
        type: req.type,
        description: req.description,
        normalizedName:
          typeof req.normalizedName === "string" ? req.normalizedName : undefined,
        documentCategoryNeeded:
          typeof req.documentCategoryNeeded === "string" ? req.documentCategoryNeeded : undefined,
        dueStage: typeof req.dueStage === "string" ? req.dueStage : undefined,
        formFillNeeded: typeof req.formFillNeeded === "boolean" ? req.formFillNeeded : undefined,
        reviewStatus: typeof req.reviewStatus === "string" ? req.reviewStatus : "draft",
        mandatory: req.mandatory,
        status: req.status,
        confidence: req.confidence,
        evidence: normalizedEvidence,
        notes: req.notes,
        createdAt: Date.now(),
      });
    }

    return opportunityId;
  },
});

/**
 * Update the documents checklist for an opportunity (manual override)
 */
export const updateDocumentsChecklist = mutation({
  args: {
    opportunityId: v.id("opportunities"),
    documentsChecklist: v.array(
      v.object({
        name: v.string(),
        mandatory: v.boolean(),
        instructions: v.optional(v.string()),
        source: v.optional(
          v.object({
            documentId: v.optional(v.string()),
            page: v.optional(v.number()),
            quote: v.optional(v.string()),
          })
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const opportunity = await ctx.db.get(args.opportunityId);
    if (!opportunity) {
      throw new Error("Opportunity not found");
    }

    await ctx.db.patch(args.opportunityId, {
      editedDocumentsChecklist: args.documentsChecklist,
      updatedAt: Date.now(),
    });

    return args.opportunityId;
  },
});

/**
 * Reset the documents checklist to the original LLM-extracted version
 */
export const resetDocumentsChecklist = mutation({
  args: {
    opportunityId: v.id("opportunities"),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const opportunity = await ctx.db.get(args.opportunityId);
    if (!opportunity) {
      throw new Error("Opportunity not found");
    }

    await ctx.db.patch(args.opportunityId, {
      editedDocumentsChecklist: undefined,
      updatedAt: Date.now(),
    });

    return args.opportunityId;
  },
});
