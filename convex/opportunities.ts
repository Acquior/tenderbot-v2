import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
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
    for (const req of analysis.requirements) {
      await ctx.db.insert("requirements", {
        opportunityId,
        sourceAnalysisId: args.analysisId,
        type: req.type,
        description: req.description,
        mandatory: req.mandatory,
        status: req.status,
        confidence: req.confidence,
        notes: req.notes,
        createdAt: Date.now(),
      });
    }

    return opportunityId;
  },
});
