import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUser } from "./auth";

/**
 * List requirements for an opportunity
 * Note: Internal tool - all authenticated users can access any opportunity's requirements
 */
export const listByOpportunity = query({
  args: {
    opportunityId: v.id("opportunities"),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    // Get requirements
    // OPTIMIZED: Added limit to prevent unbounded data transfer
    const requirements = await ctx.db
      .query("requirements")
      .withIndex("by_opportunity", (q) => q.eq("opportunityId", args.opportunityId))
      .take(100);

    return requirements;
  },
});
