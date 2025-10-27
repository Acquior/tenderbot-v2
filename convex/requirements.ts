import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUser } from "./auth";

/**
 * List requirements for an opportunity
 */
export const listByOpportunity = query({
  args: {
    opportunityId: v.id("opportunities"),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);

    // Verify access to opportunity
    const opportunity = await ctx.db.get(args.opportunityId);
    if (!opportunity) {
      throw new Error("Opportunity not found");
    }

    const hasAccess =
      opportunity.createdBy === identity.clerkUserId ||
      (identity.organizationId && opportunity.organizationId === identity.organizationId);

    if (!hasAccess) {
      throw new Error("Forbidden");
    }

    // Get requirements
    const requirements = await ctx.db
      .query("requirements")
      .withIndex("by_opportunity", (q) => q.eq("opportunityId", args.opportunityId))
      .collect();

    return requirements;
  },
});
