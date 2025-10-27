import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireUser } from "./auth";

/**
 * Get a single opportunity by ID
 */
export const get = query({
  args: { id: v.id("opportunities") },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);
    const opportunity = await ctx.db.get(args.id);

    if (!opportunity) {
      return null;
    }

    const authorized =
      opportunity.createdBy === identity.clerkUserId ||
      (identity.organizationId && opportunity.organizationId === identity.organizationId);

    if (!authorized) {
      throw new Error("Forbidden");
    }

    return opportunity;
  },
});

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
    const identity = await requireUser(ctx);

    const opportunitiesQuery = identity.organizationId
      ? ctx.db
          .query("opportunities")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", identity.organizationId)
          )
      : ctx.db
          .query("opportunities")
          .withIndex("by_created_by", (q) => q.eq("createdBy", identity.clerkUserId));

    const results = await opportunitiesQuery.order("desc").take(50);

    return results.filter((opportunity) => {
      if (opportunity.createdBy === identity.clerkUserId) {
        return true;
      }

      const inOrganization =
        Boolean(identity.organizationId) &&
        opportunity.organizationId === identity.organizationId;

      if (!inOrganization) {
        return false;
      }

      if (args.status && opportunity.status !== args.status) {
        return false;
      }

      return true;
    });
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

      if (
        existing.createdBy !== identity.clerkUserId &&
        existing.organizationId !== identity.organizationId
      ) {
        throw new Error("Forbidden");
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
      organizationId: identity.organizationId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Internal mutation to create opportunity from analysis
 */
export const createFromAnalysis = internalMutation({
  args: {
    bundleId: v.id("bundles"),
    title: v.string(),
    issuer: v.string(),
    issuerCategory: v.optional(v.string()),
    referenceNumber: v.optional(v.string()),
    dueDate: v.number(),
    publishedDate: v.optional(v.number()),
    estimatedValue: v.optional(v.number()),
    currency: v.string(),
    description: v.optional(v.string()),
    score: v.optional(
      v.object({
        overall: v.optional(v.number()),
        eligibility: v.optional(v.number()),
        competitiveness: v.optional(v.number()),
        strategicFit: v.optional(v.number()),
      })
    ),
    requirements: v.array(
      v.object({
        id: v.string(),
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
      })
    ),
    risks: v.array(
      v.object({
        id: v.string(),
        category: v.union(
          v.literal("eligibility"),
          v.literal("bee_compliance"),
          v.literal("financial"),
          v.literal("technical"),
          v.literal("timeline"),
          v.literal("commercial"),
          v.literal("legal")
        ),
        severity: v.union(
          v.literal("low"),
          v.literal("medium"),
          v.literal("high"),
          v.literal("critical")
        ),
        description: v.string(),
        mitigation: v.optional(v.string()),
        likelihood: v.optional(v.number()),
        impact: v.optional(v.number()),
      })
    ),
    createdBy: v.string(),
    organizationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Ensure idempotency: reuse existing opportunity for this bundle if present
    const existingOpportunity = (await ctx.db
      .query("opportunities")
      .withIndex("by_bundle", (q) => q.eq("bundleId", args.bundleId))
      .take(1))[0];

    const baseOpportunityData = {
      title: args.title,
      issuer: args.issuer,
      issuerCategory: args.issuerCategory,
      referenceNumber: args.referenceNumber,
      dueDate: args.dueDate,
      publishedDate: args.publishedDate,
      estimatedValue: args.estimatedValue,
      currency: args.currency,
      description: args.description,
      status: "analysis_complete" as const,
      bundleId: args.bundleId,
      score: args.score,
      risks: args.risks,
    };

    let opportunityId;

    if (existingOpportunity) {
      await ctx.db.patch(existingOpportunity._id, {
        ...baseOpportunityData,
        organizationId: args.organizationId ?? existingOpportunity.organizationId,
        updatedAt: Date.now(),
      });
      opportunityId = existingOpportunity._id;

      // Remove existing requirements to avoid duplicates on retry
      const existingRequirements = await ctx.db
        .query("requirements")
        .withIndex("by_opportunity", (q) => q.eq("opportunityId", existingOpportunity._id))
        .collect();

      for (const requirement of existingRequirements) {
        await ctx.db.delete(requirement._id);
      }
    } else {
      opportunityId = await ctx.db.insert("opportunities", {
        ...baseOpportunityData,
        organizationId: args.organizationId,
        createdBy: args.createdBy,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    // Insert requirements
    for (const req of args.requirements) {
      await ctx.db.insert("requirements", {
        opportunityId,
        type: req.type,
        description: req.description,
        mandatory: req.mandatory,
        status: req.status,
        confidence: req.confidence,
        notes: req.notes,
        createdAt: Date.now(),
        organizationId: args.organizationId,
      });
    }

    return opportunityId;
  },
});
