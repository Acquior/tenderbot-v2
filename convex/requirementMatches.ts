import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./auth";

async function logAudit(
  ctx: any,
  workspaceId: string,
  actorId: string,
  payload?: unknown
) {
  await ctx.db.insert("auditEvents", {
    entityType: "workspace",
    entityId: workspaceId,
    action: "requirement_match_overridden",
    actorId,
    payload,
    createdAt: Date.now(),
  });
}

export const listByWorkspace = query({
  args: {
    workspaceId: v.id("tenderWorkspaces"),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const matches = await ctx.db
      .query("requirementMatches")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(500);

    return await Promise.all(
      matches.map(async (match) => ({
        ...match,
        requirement: await ctx.db.get(match.requirementId),
        companyDocument: match.selectedCompanyDocumentId
          ? await ctx.db.get(match.selectedCompanyDocumentId)
          : null,
      }))
    );
  },
});

export const overrideMatch = mutation({
  args: {
    matchId: v.id("requirementMatches"),
    selectedCompanyDocumentId: v.optional(v.id("companyDocuments")),
    status: v.union(
      v.literal("matched"),
      v.literal("partial"),
      v.literal("missing"),
      v.literal("conflict")
    ),
    rationale: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);
    const match = await ctx.db.get(args.matchId);
    if (!match) {
      throw new Error("Requirement match not found");
    }

    await ctx.db.patch(args.matchId, {
      selectedCompanyDocumentId: args.selectedCompanyDocumentId,
      status: args.status,
      rationale: args.rationale,
      overrideStatus: args.selectedCompanyDocumentId ? "manual_selected" : "manual_rejected",
      reviewedBy: identity.clerkUserId,
      reviewedAt: Date.now(),
      updatedAt: Date.now(),
    });

    await logAudit(ctx, match.workspaceId, identity.clerkUserId, {
      matchId: args.matchId,
      selectedCompanyDocumentId: args.selectedCompanyDocumentId,
      status: args.status,
    });

    return args.matchId;
  },
});
