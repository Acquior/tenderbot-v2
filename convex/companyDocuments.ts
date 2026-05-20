import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { requireUser } from "./auth";

async function logAudit(
  ctx: any,
  entityId: string,
  action: string,
  actorId: string,
  payload?: unknown
) {
  await ctx.db.insert("auditEvents", {
    entityType: "company_document",
    entityId,
    action,
    actorId,
    payload,
    createdAt: Date.now(),
  });
}

export const listByProfile = query({
  args: {
    profileId: v.id("companyProfiles"),
    validityStatus: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("approved"),
        v.literal("expired"),
        v.literal("rejected")
      )
    ),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    let documents = await ctx.db
      .query("companyDocuments")
      .withIndex("by_profile", (q) => q.eq("profileId", args.profileId))
      .order("desc")
      .take(200);

    if (args.validityStatus) {
      documents = documents.filter((document) => document.validityStatus === args.validityStatus);
    }

    const records = await Promise.all(
      documents.map(async (document) => ({
        ...document,
        documentRecord: await ctx.db.get(document.documentId),
      }))
    );

    return records;
  },
});

export const listApprovedInternal = internalQuery({
  args: {
    profileId: v.id("companyProfiles"),
  },
  handler: async (ctx, args) => {
    const companyDocuments = await ctx.db
      .query("companyDocuments")
      .withIndex("by_profile", (q) => q.eq("profileId", args.profileId))
      .collect();

    return await Promise.all(
      companyDocuments.map(async (document) => ({
        ...document,
        documentRecord: await ctx.db.get(document.documentId),
      }))
    );
  },
});

export const registerUploadedDocument = mutation({
  args: {
    profileId: v.id("companyProfiles"),
    documentId: v.id("documents"),
    category: v.union(
      v.literal("registration"),
      v.literal("tax"),
      v.literal("bee"),
      v.literal("banking"),
      v.literal("financials"),
      v.literal("proof_of_address"),
      v.literal("oem_letter"),
      v.literal("technical_datasheet"),
      v.literal("company_profile"),
      v.literal("sbd_attachment"),
      v.literal("other")
    ),
    title: v.string(),
    issuer: v.optional(v.string()),
    referenceNumber: v.optional(v.string()),
    effectiveFrom: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);
    const profile = await ctx.db.get(args.profileId);
    if (!profile) {
      throw new Error("Company profile not found");
    }

    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    await ctx.db.patch(args.documentId, {
      kind: "company_reference",
      profileId: args.profileId,
      documentCategory: args.category,
      approvalStatus: "draft",
      expiresAt: args.expiresAt,
      updatedAt: Date.now(),
    });

    const companyDocumentId = await ctx.db.insert("companyDocuments", {
      profileId: args.profileId,
      documentId: args.documentId,
      category: args.category,
      title: args.title,
      issuer: args.issuer,
      referenceNumber: args.referenceNumber,
      validityStatus: "draft",
      effectiveFrom: args.effectiveFrom,
      expiresAt: args.expiresAt,
      tags: args.tags,
      notes: args.notes,
      createdAt: Date.now(),
    });

    await logAudit(ctx, companyDocumentId, "registered", identity.clerkUserId, {
      documentId: args.documentId,
      category: args.category,
    });

    return companyDocumentId;
  },
});

export const approveDocument = mutation({
  args: {
    id: v.id("companyDocuments"),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);
    const companyDocument = await ctx.db.get(args.id);
    if (!companyDocument) {
      throw new Error("Company document not found");
    }

    const isExpired =
      typeof companyDocument.expiresAt === "number" && companyDocument.expiresAt < Date.now();

    await ctx.db.patch(args.id, {
      validityStatus: isExpired ? "expired" : "approved",
      approvedBy: identity.clerkUserId,
      approvedAt: Date.now(),
    });

    await ctx.db.patch(companyDocument.documentId, {
      approvalStatus: isExpired ? "expired" : "approved",
      expiresAt: companyDocument.expiresAt,
      updatedAt: Date.now(),
    });

    await logAudit(ctx, args.id, "approved", identity.clerkUserId, {
      documentId: companyDocument.documentId,
      expired: isExpired,
    });

    return args.id;
  },
});

export const rejectDocument = mutation({
  args: {
    id: v.id("companyDocuments"),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);
    const companyDocument = await ctx.db.get(args.id);
    if (!companyDocument) {
      throw new Error("Company document not found");
    }

    await ctx.db.patch(args.id, {
      validityStatus: "rejected",
      approvedBy: identity.clerkUserId,
      approvedAt: Date.now(),
    });

    await ctx.db.patch(companyDocument.documentId, {
      approvalStatus: "rejected",
      updatedAt: Date.now(),
    });

    await logAudit(ctx, args.id, "rejected", identity.clerkUserId, {
      documentId: companyDocument.documentId,
    });

    return args.id;
  },
});

export const markExpired = mutation({
  args: {
    id: v.id("companyDocuments"),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);
    const companyDocument = await ctx.db.get(args.id);
    if (!companyDocument) {
      throw new Error("Company document not found");
    }

    await ctx.db.patch(args.id, {
      validityStatus: "expired",
    });

    await ctx.db.patch(companyDocument.documentId, {
      approvalStatus: "expired",
      updatedAt: Date.now(),
    });

    await logAudit(ctx, args.id, "expired", identity.clerkUserId, {
      documentId: companyDocument.documentId,
    });

    return args.id;
  },
});
