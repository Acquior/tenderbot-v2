import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireUser } from "./auth";

/**
 * Create an analysis record
 */
export const create = internalMutation({
  args: {
    type: v.union(
      v.literal("document"),
      v.literal("opportunity"),
      v.literal("bundle"),
      v.literal("gap")
    ),
    targetId: v.string(),
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
    organizationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const analysisId = await ctx.db.insert("analyses", {
      type: args.type,
      targetId: args.targetId,
      summary: args.summary,
      metadata: args.metadata,
      version: args.version,
      createdBy: args.createdBy,
      organizationId: args.organizationId,
      createdAt: Date.now(),
    });

    return analysisId;
  },
});

/**
 * List analyses by target
 */
export const listByTarget = query({
  args: {
    type: v.union(
      v.literal("document"),
      v.literal("opportunity"),
      v.literal("bundle"),
      v.literal("gap")
    ),
    targetId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);

    const analyses = await ctx.db
      .query("analyses")
      .withIndex("by_target", (q) => q.eq("targetId", args.targetId))
      .filter((q) => q.eq(q.field("type"), args.type))
      .order("desc")
      .collect();

    // Filter by access control
    return analyses.filter((analysis) => {
      if (analysis.createdBy === identity.clerkUserId) {
        return true;
      }
      if (identity.organizationId && analysis.organizationId === identity.organizationId) {
        return true;
      }
      return false;
    });
  },
});

/**
 * Get all analyses for current user/organization
 */
export const list = query({
  args: {
    type: v.optional(
      v.union(
        v.literal("document"),
        v.literal("opportunity"),
        v.literal("bundle"),
        v.literal("gap")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);

    const analysesQuery = identity.organizationId
      ? ctx.db
          .query("analyses")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", identity.organizationId!)
          )
      : ctx.db
          .query("analyses")
          .filter((q) => q.eq(q.field("createdBy"), identity.clerkUserId));

    const analyses = await analysesQuery
      .order("desc")
      .take(args.limit ?? 50);

    if (args.type) {
      return analyses.filter((a) => a.type === args.type);
    }

    return analyses;
  },
});

/**
 * Get a single analysis by ID
 */
export const get = query({
  args: { id: v.id("analyses") },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);
    const analysis = await ctx.db.get(args.id);

    if (!analysis) {
      return null;
    }

    const authorized =
      analysis.createdBy === identity.clerkUserId ||
      (identity.organizationId && analysis.organizationId === identity.organizationId);

    if (!authorized) {
      throw new Error("Forbidden");
    }

    return analysis;
  },
});

/**
 * Delete an analysis
 */
export const remove = mutation({
  args: { id: v.id("analyses") },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);
    const analysis = await ctx.db.get(args.id);

    if (!analysis) {
      throw new Error("Analysis not found");
    }

    if (
      analysis.createdBy !== identity.clerkUserId &&
      analysis.organizationId !== identity.organizationId
    ) {
      throw new Error("Forbidden");
    }

    await ctx.db.delete(args.id);
  },
});
