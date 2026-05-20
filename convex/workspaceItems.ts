import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUser } from "./auth";

export const listByWorkspace = query({
  args: {
    workspaceId: v.id("tenderWorkspaces"),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db
      .query("workspaceItems")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("asc")
      .take(500);
  },
});
