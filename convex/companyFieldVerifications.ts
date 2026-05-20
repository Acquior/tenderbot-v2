import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./auth";
import { getValueAtPath } from "./validators";

async function logAudit(
  ctx: any,
  profileId: string,
  action: string,
  actorId: string,
  payload?: unknown
) {
  await ctx.db.insert("auditEvents", {
    entityType: "company_profile",
    entityId: profileId,
    action,
    actorId,
    payload,
    createdAt: Date.now(),
  });
}

export const listByProfile = query({
  args: {
    profileId: v.id("companyProfiles"),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db
      .query("companyFieldVerifications")
      .withIndex("by_profile", (q) => q.eq("profileId", args.profileId))
      .order("desc")
      .take(200);
  },
});

export const verifyField = mutation({
  args: {
    profileId: v.id("companyProfiles"),
    fieldPath: v.string(),
    sourceDocumentId: v.optional(v.id("documents")),
    sourcePage: v.optional(v.number()),
    sourceQuote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);
    const profile = await ctx.db.get(args.profileId);
    if (!profile) {
      throw new Error("Company profile not found");
    }

    const value = getValueAtPath(profile as Record<string, any>, args.fieldPath);
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error("Cannot verify an empty field.");
    }

    const currentRows = await ctx.db
      .query("companyFieldVerifications")
      .withIndex("by_profile_field", (q) =>
        q.eq("profileId", args.profileId).eq("fieldPath", args.fieldPath)
      )
      .take(100);

    for (const row of currentRows) {
      if (row.status === "verified" || row.status === "draft") {
        await ctx.db.patch(row._id, {
          status: "superseded",
        });
      }
    }

    const verificationId = await ctx.db.insert("companyFieldVerifications", {
      profileId: args.profileId,
      fieldPath: args.fieldPath,
      valueSnapshot: value,
      status: "verified",
      sourceDocumentId: args.sourceDocumentId,
      sourcePage: args.sourcePage,
      sourceQuote: args.sourceQuote,
      verifiedBy: identity.clerkUserId,
      verifiedAt: Date.now(),
      createdAt: Date.now(),
    });

    await logAudit(ctx, args.profileId, "field_verified", identity.clerkUserId, {
      fieldPath: args.fieldPath,
      sourceDocumentId: args.sourceDocumentId,
      sourcePage: args.sourcePage,
    });

    return verificationId;
  },
});

export const rejectField = mutation({
  args: {
    profileId: v.id("companyProfiles"),
    fieldPath: v.string(),
    sourceDocumentId: v.optional(v.id("documents")),
    sourcePage: v.optional(v.number()),
    sourceQuote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);

    const currentRows = await ctx.db
      .query("companyFieldVerifications")
      .withIndex("by_profile_field", (q) =>
        q.eq("profileId", args.profileId).eq("fieldPath", args.fieldPath)
      )
      .take(100);

    for (const row of currentRows) {
      if (row.status === "draft") {
        await ctx.db.patch(row._id, {
          status: "superseded",
        });
      }
    }

    const rejectionId = await ctx.db.insert("companyFieldVerifications", {
      profileId: args.profileId,
      fieldPath: args.fieldPath,
      valueSnapshot: "",
      status: "rejected",
      sourceDocumentId: args.sourceDocumentId,
      sourcePage: args.sourcePage,
      sourceQuote: args.sourceQuote,
      verifiedBy: identity.clerkUserId,
      verifiedAt: Date.now(),
      createdAt: Date.now(),
    });

    await logAudit(ctx, args.profileId, "field_rejected", identity.clerkUserId, {
      fieldPath: args.fieldPath,
      sourceDocumentId: args.sourceDocumentId,
      sourcePage: args.sourcePage,
    });

    return rejectionId;
  },
});
