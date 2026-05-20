import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { requireUser } from "./auth";
import { CRITICAL_PROFILE_FIELDS, getValueAtPath } from "./validators";

const DEFAULT_PROFILE = {
  workspaceKey: "main",
  status: "draft" as const,
  legal: {},
  tax: {},
  banking: {},
  addresses: {},
  contacts: {},
  signatory: {},
  compliance: {},
};

const CRITICAL_FIELD_LABELS: Record<(typeof CRITICAL_PROFILE_FIELDS)[number], string> = {
  "legal.legalName": "Legal Name",
  "legal.registrationNumber": "Registration Number",
  "tax.vatNumber": "VAT Number",
  "tax.taxNumber": "Tax Number",
  "banking.accountHolderName": "Bank Account Holder",
  "banking.bankName": "Bank Name",
  "banking.accountNumber": "Bank Account Number",
  "banking.branchCode": "Branch Code",
  "signatory.fullName": "Authorised Signatory Name",
  "signatory.title": "Authorised Signatory Title",
};

const REQUIRED_ACTIVE_FIELDS = CRITICAL_PROFILE_FIELDS;

async function logAudit(
  ctx: Parameters<typeof mutation>[0] extends never ? never : any,
  entityType: "company_profile",
  entityId: string,
  action: string,
  actorId: string,
  payload?: unknown
) {
  await ctx.db.insert("auditEvents", {
    entityType,
    entityId,
    action,
    actorId,
    payload,
    createdAt: Date.now(),
  });
}

export const getActive = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);

    const active = await ctx.db
      .query("companyProfiles")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .first();

    if (active) return active;

    const fallback = await ctx.db
      .query("companyProfiles")
      .withIndex("by_workspace_key", (q) => q.eq("workspaceKey", "main"))
      .order("desc")
      .first();

    return fallback;
  },
});

export const getInternal = internalQuery({
  args: {
    profileId: v.id("companyProfiles"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.profileId);
  },
});

export const createOrUpdateDraft = mutation({
  args: {
    profileId: v.optional(v.id("companyProfiles")),
    input: v.object({
      workspaceKey: v.optional(v.string()),
      status: v.optional(v.union(v.literal("draft"), v.literal("active"), v.literal("archived"))),
      legal: v.object({
        legalName: v.optional(v.string()),
        tradingName: v.optional(v.string()),
        registrationNumber: v.optional(v.string()),
        incorporationCountry: v.optional(v.string()),
      }),
      tax: v.object({
        vatNumber: v.optional(v.string()),
        taxNumber: v.optional(v.string()),
        csdNumber: v.optional(v.string()),
      }),
      banking: v.object({
        accountHolderName: v.optional(v.string()),
        bankName: v.optional(v.string()),
        accountNumber: v.optional(v.string()),
        branchCode: v.optional(v.string()),
        accountType: v.optional(v.string()),
      }),
      addresses: v.object({
        physicalAddress: v.optional(v.string()),
        postalAddress: v.optional(v.string()),
      }),
      contacts: v.object({
        primaryContactName: v.optional(v.string()),
        primaryContactEmail: v.optional(v.string()),
        primaryContactPhone: v.optional(v.string()),
      }),
      signatory: v.object({
        fullName: v.optional(v.string()),
        title: v.optional(v.string()),
        email: v.optional(v.string()),
        phone: v.optional(v.string()),
      }),
      compliance: v.object({
        beeLevel: v.optional(v.string()),
        cidbGrade: v.optional(v.string()),
        oemSummary: v.optional(v.string()),
      }),
    }),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);
    const now = Date.now();

    if (!args.profileId) {
      const profileId = await ctx.db.insert("companyProfiles", {
        ...DEFAULT_PROFILE,
        ...args.input,
        workspaceKey: args.input.workspaceKey ?? "main",
        status: "draft",
        createdBy: identity.clerkUserId,
        createdAt: now,
        updatedAt: now,
      });

      await logAudit(ctx, "company_profile", profileId, "created", identity.clerkUserId, {
        workspaceKey: args.input.workspaceKey ?? "main",
      });

      return profileId;
    }

    const existing = await ctx.db.get(args.profileId);
    if (!existing) {
      throw new Error("Company profile not found");
    }

    const merged = {
      ...existing,
      ...args.input,
      legal: { ...existing.legal, ...args.input.legal },
      tax: { ...existing.tax, ...args.input.tax },
      banking: { ...existing.banking, ...args.input.banking },
      addresses: { ...existing.addresses, ...args.input.addresses },
      contacts: { ...existing.contacts, ...args.input.contacts },
      signatory: { ...existing.signatory, ...args.input.signatory },
      compliance: { ...existing.compliance, ...args.input.compliance },
      status: existing.status === "active" ? "active" : "draft",
    };

    await ctx.db.patch(args.profileId, {
      workspaceKey: merged.workspaceKey,
      status: merged.status as "draft" | "active" | "archived",
      legal: merged.legal,
      tax: merged.tax,
      banking: merged.banking,
      addresses: merged.addresses,
      contacts: merged.contacts,
      signatory: merged.signatory,
      compliance: merged.compliance,
      updatedAt: now,
    });

    for (const fieldPath of CRITICAL_PROFILE_FIELDS) {
      const before = getValueAtPath(existing as Record<string, any>, fieldPath);
      const after = getValueAtPath(merged as Record<string, any>, fieldPath);

      if ((before ?? "") === (after ?? "")) continue;

      const priorRows = await ctx.db
        .query("companyFieldVerifications")
        .withIndex("by_profile_field", (q) =>
          q.eq("profileId", args.profileId!).eq("fieldPath", fieldPath)
        )
        .take(100);

      for (const row of priorRows) {
        if (row.status === "verified" || row.status === "draft") {
          await ctx.db.patch(row._id, {
            status: "superseded",
          });
        }
      }

      if (typeof after === "string" && after.trim().length > 0) {
        await ctx.db.insert("companyFieldVerifications", {
          profileId: args.profileId,
          fieldPath,
          valueSnapshot: after,
          status: "draft",
          createdAt: now,
        });
      }
    }

    await logAudit(ctx, "company_profile", args.profileId, "updated", identity.clerkUserId, {
      profileId: args.profileId,
    });

    return args.profileId;
  },
});

export const activate = mutation({
  args: {
    profileId: v.id("companyProfiles"),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);
    const profile = await ctx.db.get(args.profileId);
    if (!profile) {
      throw new Error("Company profile not found");
    }

    const verifications = await ctx.db
      .query("companyFieldVerifications")
      .withIndex("by_profile", (q) => q.eq("profileId", args.profileId))
      .collect();

    const latestByField = new Map<string, (typeof verifications)[number]>();
    for (const verification of verifications.sort((a, b) => b.createdAt - a.createdAt)) {
      if (!latestByField.has(verification.fieldPath)) {
        latestByField.set(verification.fieldPath, verification);
      }
    }

    for (const fieldPath of REQUIRED_ACTIVE_FIELDS) {
      const liveValue = getValueAtPath(profile as Record<string, any>, fieldPath);
      if (typeof liveValue !== "string" || liveValue.trim().length === 0) {
        throw new Error(`Cannot activate profile. Missing required field: ${CRITICAL_FIELD_LABELS[fieldPath]}`);
      }

      const latest = latestByField.get(fieldPath);
      if (!latest || latest.status !== "verified" || latest.valueSnapshot !== liveValue) {
        throw new Error(
          `Cannot activate profile. Field must be verified: ${CRITICAL_FIELD_LABELS[fieldPath]}`
        );
      }
    }

    const activeProfiles = await ctx.db
      .query("companyProfiles")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    for (const active of activeProfiles) {
      if (active._id !== args.profileId && active.workspaceKey === profile.workspaceKey) {
        await ctx.db.patch(active._id, {
          status: "archived",
          updatedAt: Date.now(),
        });
      }
    }

    await ctx.db.patch(args.profileId, {
      status: "active",
      updatedAt: Date.now(),
    });

    await logAudit(ctx, "company_profile", args.profileId, "activated", identity.clerkUserId);
    return args.profileId;
  },
});

export const getVerificationSummary = query({
  args: {
    profileId: v.id("companyProfiles"),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const profile = await ctx.db.get(args.profileId);
    if (!profile) {
      throw new Error("Company profile not found");
    }

    const verifications = await ctx.db
      .query("companyFieldVerifications")
      .withIndex("by_profile", (q) => q.eq("profileId", args.profileId))
      .collect();

    const latestByField = new Map<string, (typeof verifications)[number]>();
    for (const verification of verifications.sort((a, b) => b.createdAt - a.createdAt)) {
      if (!latestByField.has(verification.fieldPath)) {
        latestByField.set(verification.fieldPath, verification);
      }
    }

    const fields = CRITICAL_PROFILE_FIELDS.map((fieldPath) => {
      const value = getValueAtPath(profile as Record<string, any>, fieldPath);
      const latest = latestByField.get(fieldPath);
      const status =
        typeof value !== "string" || value.trim().length === 0
          ? "missing"
          : !latest
            ? "unverified"
            : latest.status === "verified" && latest.valueSnapshot === value
              ? "verified"
              : latest.status;

      return {
        fieldPath,
        label: CRITICAL_FIELD_LABELS[fieldPath],
        value: typeof value === "string" ? value : undefined,
        status,
        verifiedAt: latest?.verifiedAt,
        sourceDocumentId: latest?.sourceDocumentId,
      };
    });

    return {
      profileId: args.profileId,
      completedCriticalFields: fields.filter((field) => field.status === "verified").length,
      totalCriticalFields: fields.length,
      readyToActivate: fields.every((field) => field.status === "verified"),
      fields,
    };
  },
});
