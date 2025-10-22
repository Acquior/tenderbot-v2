import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./auth";

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
