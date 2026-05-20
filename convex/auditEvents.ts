import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { requireUser } from "./auth";

export const logInternal = internalMutation({
  args: {
    entityType: v.union(
      v.literal("company_profile"),
      v.literal("company_document"),
      v.literal("requirement"),
      v.literal("workspace"),
      v.literal("form_run")
    ),
    entityId: v.string(),
    action: v.string(),
    actorId: v.string(),
    payload: v.optional(v.any()),
    organizationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("auditEvents", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const listRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db
      .query("auditEvents")
      .withIndex("by_created_at")
      .order("desc")
      .take(args.limit ?? 100);
  },
});
