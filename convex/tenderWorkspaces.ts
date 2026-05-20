import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUser } from "./auth";

const STANDARD_FOLDERS = [
  "00_README",
  "01_Admin",
  "02_Compliance",
  "03_Technical",
  "04_Financial",
  "05_Commercial",
  "06_Forms",
  "07_Generated",
  "99_Missing",
] as const;

const DOCUMENT_CATEGORY_TO_FOLDER: Record<string, string> = {
  administrative: "01_Admin",
  legal: "02_Compliance",
  compliance: "02_Compliance",
  bee: "02_Compliance",
  technical: "03_Technical",
  financial: "04_Financial",
  commercial: "05_Commercial",
  sbd_form: "06_Forms",
  other: "07_Generated",
};

const COMPANY_DOCUMENT_CATEGORY_TO_REQUIREMENT: Record<string, string[]> = {
  registration: ["legal", "compliance", "administrative", "eligibility"],
  tax: ["tax", "financial", "compliance", "legal"],
  bee: ["bee", "compliance"],
  banking: ["financial", "commercial", "administrative"],
  financials: ["financial", "commercial"],
  proof_of_address: ["administrative", "compliance"],
  oem_letter: ["technical", "commercial"],
  technical_datasheet: ["technical"],
  company_profile: ["technical", "commercial", "administrative"],
  sbd_attachment: ["administrative", "compliance"],
  other: ["other", "administrative"],
};

const FORM_FILENAME_HINTS = [
  "sbd",
  "form",
  "schedule",
  "annex",
  "appendix",
  "pricing",
  "declaration",
  "questionnaire",
  "returnable",
  "submission",
  "bid",
] as const;

function sanitizeWorkspaceName(value: string, fallback: string): string {
  const normalized = value
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || fallback;
}

export function getFolderForRequirement(requirement: any) {
  const category = requirement.documentCategoryNeeded ?? requirement.type ?? "other";
  return DOCUMENT_CATEGORY_TO_FOLDER[category] ?? "07_Generated";
}

function candidateMatchesRequirement(companyDocument: any, requirement: any) {
  const allowedTypes = COMPANY_DOCUMENT_CATEGORY_TO_REQUIREMENT[companyDocument.category] ?? ["other"];
  const requirementType = requirement.type ?? "other";
  const categoryNeeded = requirement.documentCategoryNeeded ?? requirementType;
  return allowedTypes.includes(requirementType) || allowedTypes.includes(categoryNeeded);
}

export function isApprovedAndCurrent(companyDocument: any) {
  if (companyDocument.validityStatus !== "approved") return false;
  if (typeof companyDocument.expiresAt === "number" && companyDocument.expiresAt < Date.now()) return false;
  return true;
}

export function requirementSuggestsForm(requirement: any): boolean {
  if (requirement.formFillNeeded) return true;
  if (requirement.documentCategoryNeeded === "sbd_form") return true;

  const content = `${requirement.normalizedName ?? ""} ${requirement.description ?? ""}`.toLowerCase();
  return FORM_FILENAME_HINTS.some((hint) => content.includes(hint));
}

export function isLikelyFormDocument(document: any, requirements: any[], totalDocuments: number): boolean {
  if (document.mimeType !== "application/pdf") return false;

  const normalizedFilename = (document.filename ?? "").toLowerCase();
  if (FORM_FILENAME_HINTS.some((hint) => normalizedFilename.includes(hint))) {
    return true;
  }

  return totalDocuments === 1 && requirements.some(requirementSuggestsForm);
}

export const getByOpportunity = query({
  args: {
    opportunityId: v.id("opportunities"),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db
      .query("tenderWorkspaces")
      .withIndex("by_opportunity", (q) => q.eq("opportunityId", args.opportunityId))
      .order("desc")
      .first();
  },
});

export const createForOpportunity = mutation({
  args: {
    opportunityId: v.id("opportunities"),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);
    const opportunity = await ctx.db.get(args.opportunityId);
    if (!opportunity) {
      throw new Error("Opportunity not found");
    }

    const existing = await ctx.db
      .query("tenderWorkspaces")
      .withIndex("by_opportunity", (q) => q.eq("opportunityId", args.opportunityId))
      .first();

    if (existing) {
      return existing._id;
    }

    const profile = await ctx.db
      .query("companyProfiles")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .first();

    if (!profile) {
      throw new Error("Activate a company profile before creating a workspace.");
    }

    const workspaceId = await ctx.db.insert("tenderWorkspaces", {
      opportunityId: args.opportunityId,
      bundleId: opportunity.bundleId,
      profileId: profile._id,
      status: "draft",
      readiness: "red",
      missingMandatoryCount: 0,
      criticalConflictCount: 0,
      summary: undefined,
      createdBy: identity.clerkUserId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const jobId = await ctx.db.insert("jobs", {
      type: "build_tender_workspace",
      input: {
        workspaceId,
        opportunityId: args.opportunityId,
      },
      output: undefined,
      status: "pending",
      progress: {
        current: 0,
        total: 3,
        message: "Queued",
      },
      error: undefined,
      attempts: 0,
      maxAttempts: 3,
      resumeToken: undefined,
      resumeData: undefined,
      createdBy: identity.clerkUserId,
      createdAt: Date.now(),
      startedAt: undefined,
      finishedAt: undefined,
      scheduledFor: undefined,
      bundleId: opportunity.bundleId,
      documentId: undefined,
    });

    await ctx.db.insert("auditEvents", {
      entityType: "workspace",
      entityId: workspaceId,
      action: "workspace_created",
      actorId: identity.clerkUserId,
      payload: { jobId, opportunityId: args.opportunityId },
      createdAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.tenderWorkspaces.buildWorkspaceInternal, {
      workspaceId,
      jobId,
    });

    return workspaceId;
  },
});

export const rebuild = mutation({
  args: {
    workspaceId: v.id("tenderWorkspaces"),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const jobId = await ctx.db.insert("jobs", {
      type: "build_tender_workspace",
      input: {
        workspaceId: args.workspaceId,
        opportunityId: workspace.opportunityId,
      },
      output: undefined,
      status: "pending",
      progress: {
        current: 0,
        total: 3,
        message: "Queued",
      },
      error: undefined,
      attempts: 0,
      maxAttempts: 3,
      resumeToken: undefined,
      resumeData: undefined,
      createdBy: identity.clerkUserId,
      createdAt: Date.now(),
      startedAt: undefined,
      finishedAt: undefined,
      scheduledFor: undefined,
      bundleId: workspace.bundleId,
      documentId: undefined,
    });

    await ctx.scheduler.runAfter(0, internal.tenderWorkspaces.buildWorkspaceInternal, {
      workspaceId: args.workspaceId,
      jobId,
    });

    return jobId;
  },
});

export const approveWorkspace = mutation({
  args: {
    workspaceId: v.id("tenderWorkspaces"),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("Workspace not found");
    if (workspace.readiness === "red") {
      throw new Error("Workspace cannot be approved while readiness is red.");
    }

    await ctx.db.patch(args.workspaceId, {
      status: "approved",
      updatedAt: Date.now(),
    });

    await ctx.db.insert("auditEvents", {
      entityType: "workspace",
      entityId: args.workspaceId,
      action: "workspace_approved",
      actorId: identity.clerkUserId,
      createdAt: Date.now(),
    });

    return args.workspaceId;
  },
});

export const setReviewOutcome = mutation({
  args: {
    workspaceId: v.id("tenderWorkspaces"),
    readiness: v.union(v.literal("red"), v.literal("yellow"), v.literal("green")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireUser(ctx);
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("Workspace not found");

    await ctx.db.patch(args.workspaceId, {
      readiness: args.readiness,
      status: args.readiness === "red" ? "blocked" : "ready_for_review",
      summary: args.notes ?? workspace.summary,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("auditEvents", {
      entityType: "workspace",
      entityId: args.workspaceId,
      action: "workspace_review_outcome_set",
      actorId: identity.clerkUserId,
      payload: { readiness: args.readiness, notes: args.notes },
      createdAt: Date.now(),
    });

    return args.workspaceId;
  },
});

export const buildWorkspaceInternal = internalAction({
  args: {
    workspaceId: v.id("tenderWorkspaces"),
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.jobs.markJobStarted, { jobId: args.jobId });

    const workspace = await ctx.runQuery(internal.tenderWorkspaces.getInternal, {
      workspaceId: args.workspaceId,
    });
    if (!workspace) throw new Error("Workspace not found");

    await ctx.runMutation(internal.tenderWorkspaces.updateWorkspaceStateInternal, {
      workspaceId: args.workspaceId,
      status: "assembling",
      readiness: workspace.readiness,
      missingMandatoryCount: workspace.missingMandatoryCount,
      criticalConflictCount: workspace.criticalConflictCount,
      summary: workspace.summary,
    });

    const opportunity = await ctx.runQuery(internal.opportunities.getInternal, {
      opportunityId: workspace.opportunityId,
    });
    const requirements = await ctx.runQuery(internal.requirements.listByOpportunityInternal, {
      opportunityId: workspace.opportunityId,
    });
    const companyDocuments = await ctx.runQuery(internal.companyDocuments.listApprovedInternal, {
      profileId: workspace.profileId,
    });
    const sourceDocuments = workspace.bundleId
      ? await ctx.runQuery(internal.documents.listByBundle, {
          bundleId: workspace.bundleId,
        })
      : [];

    if (!opportunity) {
      throw new Error("Opportunity not found");
    }

    const existingItems = await ctx.runQuery(internal.tenderWorkspaces.listWorkspaceItemsInternal, {
      workspaceId: args.workspaceId,
    });
    for (const item of existingItems) {
      await ctx.runMutation(internal.tenderWorkspaces.deleteWorkspaceItemInternal, {
        id: item._id,
      });
    }

    const existingMatches = await ctx.runQuery(internal.tenderWorkspaces.listRequirementMatchesInternal, {
      workspaceId: args.workspaceId,
    });
    for (const match of existingMatches) {
      await ctx.runMutation(internal.tenderWorkspaces.deleteRequirementMatchInternal, {
        id: match._id,
      });
    }

    for (const folder of STANDARD_FOLDERS) {
      await ctx.runMutation(internal.tenderWorkspaces.insertWorkspaceItemInternal, {
        workspaceId: args.workspaceId,
        path: `${folder}/`,
        itemType: "folder",
        status: "generated",
      });
    }

    let missingMandatoryCount = 0;
    let criticalConflictCount = 0;
    let blockedFormCount = 0;
    let manualReviewFormCount = 0;
    const summaryParts: string[] = [];

    for (const requirement of requirements) {
      const candidates = companyDocuments.filter((document: any) =>
        candidateMatchesRequirement(document, requirement)
      );
      const approvedCandidates = candidates.filter(isApprovedAndCurrent);
      const folder = getFolderForRequirement(requirement);

      let status: "matched" | "partial" | "missing" | "conflict" = "missing";
      let selected = approvedCandidates[0] ?? null;
      let rationale = "";

      if (approvedCandidates.length === 1) {
        status = "matched";
        rationale = "Single approved company document matched the requirement category.";
      } else if (approvedCandidates.length > 1) {
        status = "conflict";
        selected = approvedCandidates[0];
        rationale = "Multiple approved company documents matched the requirement; review required.";
        criticalConflictCount += requirement.mandatory ? 1 : 0;
      } else if (candidates.length > 0) {
        status = "partial";
        rationale = "Matching company document exists but is not approved or has expired.";
        if (requirement.mandatory) {
          missingMandatoryCount += 1;
        }
      } else {
        status = "missing";
        rationale = "No matching company document found.";
        if (requirement.mandatory) {
          missingMandatoryCount += 1;
        }
      }

      await ctx.runMutation(internal.tenderWorkspaces.insertRequirementMatchInternal, {
        workspaceId: args.workspaceId,
        requirementId: requirement._id,
        status,
        confidence: requirement.confidence,
        selectedCompanyDocumentId: selected?._id,
        rationale,
        sourceEvidence: requirement.evidence?.[0]
          ? {
              documentId: requirement.evidence[0].documentId,
              page: requirement.evidence[0].page,
              quote: requirement.evidence[0].quote,
            }
          : undefined,
        companyEvidence: selected
          ? {
              documentId: selected.documentId,
            }
          : undefined,
      });

      if (selected && status !== "partial") {
        const documentRecord = selected.documentRecord ?? (await ctx.runQuery(internal.documents.getInternal, {
          documentId: selected.documentId,
        }));
        await ctx.runMutation(internal.tenderWorkspaces.insertWorkspaceItemInternal, {
          workspaceId: args.workspaceId,
          path: `${folder}/${selected.title}`,
          itemType: "file",
          sourceType: "company_document",
          sourceDocumentId: selected.documentId,
          companyDocumentId: selected._id,
          requirementId: requirement._id,
          status: "attached",
          notes: documentRecord?.filename,
        });
      } else {
        await ctx.runMutation(internal.tenderWorkspaces.insertWorkspaceItemInternal, {
          workspaceId: args.workspaceId,
          path: `99_Missing/${requirement.description.slice(0, 80)}.txt`,
          itemType: "placeholder",
          requirementId: requirement._id,
          status: status === "conflict" ? "blocked" : "missing",
          notes: rationale,
        });
      }
    }

    const likelyFormDocuments = sourceDocuments.filter((document: any) =>
      isLikelyFormDocument(document, requirements, sourceDocuments.length)
    );

    for (const document of likelyFormDocuments) {
      const sanitizedFilename = sanitizeWorkspaceName(document.filename, `form-${document._id}.pdf`);

      await ctx.runMutation(internal.tenderWorkspaces.insertWorkspaceItemInternal, {
        workspaceId: args.workspaceId,
        path: `06_Forms/${sanitizedFilename}`,
        itemType: "file",
        sourceType: "tender_document",
        sourceDocumentId: document._id,
        status: "attached",
        notes: "Tender source form document",
      });

      const template = await ctx.runAction(internal.formTemplates.getOrCreateForDocumentInternal, {
        documentId: document._id,
      });

      if (!template || template.templateType !== "fillable_pdf") {
        manualReviewFormCount += 1;
        await ctx.runMutation(internal.tenderWorkspaces.insertWorkspaceItemInternal, {
          workspaceId: args.workspaceId,
          path: `06_Forms/manual-review-${sanitizedFilename.replace(/\.pdf$/i, "")}.txt`,
          itemType: "placeholder",
          sourceType: "manual",
          sourceDocumentId: document._id,
          status: "missing",
          notes: "This PDF is not fillable. Manual completion and review are required.",
        });
        continue;
      }

      const previewResult = await ctx.runAction(internal.formRuns.generatePreviewInternal, {
        workspaceId: args.workspaceId,
        sourceDocumentId: document._id,
        actorId: workspace.createdBy,
      });

      if (previewResult.status === "blocked") {
        blockedFormCount += 1;
      } else if (previewResult.status === "manual_required") {
        manualReviewFormCount += 1;
      }

      if (previewResult.outputDocumentId) {
        const previewDocument = await ctx.runQuery(internal.documents.getInternal, {
          documentId: previewResult.outputDocumentId,
        });

        if (previewDocument) {
          await ctx.runMutation(internal.tenderWorkspaces.insertWorkspaceItemInternal, {
            workspaceId: args.workspaceId,
            path: `06_Forms/${sanitizeWorkspaceName(previewDocument.filename, "preview.pdf")}`,
            itemType: "file",
            sourceType: "generated",
            sourceDocumentId: previewDocument._id,
            status: previewResult.status === "blocked" ? "blocked" : "generated",
            notes: `Preview generated from ${document.filename}`,
          });
        }
      }
    }

    if (missingMandatoryCount > 0) {
      summaryParts.push(`${missingMandatoryCount} mandatory requirements are still unresolved.`);
    }
    if (criticalConflictCount > 0) {
      summaryParts.push(`${criticalConflictCount} mandatory requirements have conflicting candidate documents.`);
    }
    if (blockedFormCount > 0) {
      summaryParts.push(`${blockedFormCount} form previews are blocked because critical values could not be verified safely.`);
    }
    if (manualReviewFormCount > 0) {
      summaryParts.push(`${manualReviewFormCount} tender forms still require manual review or manual completion.`);
    }
    if (summaryParts.length === 0) {
      summaryParts.push("Workspace assembled successfully. All mandatory requirements have at least one approved supporting document.");
    }

    const readiness =
      missingMandatoryCount > 0 || criticalConflictCount > 0 || blockedFormCount > 0
        ? "red"
        : requirements.some((requirement: any) => !requirement.evidence || requirement.evidence.length === 0) ||
            manualReviewFormCount > 0
          ? "yellow"
          : "green";

    const status = readiness === "red" ? "blocked" : "ready_for_review";

    await ctx.runMutation(internal.tenderWorkspaces.updateWorkspaceStateInternal, {
      workspaceId: args.workspaceId,
      status,
      readiness,
      missingMandatoryCount,
      criticalConflictCount,
      summary: summaryParts.join(" "),
    });

    await ctx.runMutation(internal.jobs.markJobCompleted, {
      jobId: args.jobId,
      output: {
        workspaceId: args.workspaceId,
        readiness,
        missingMandatoryCount,
        criticalConflictCount,
      },
    });
  },
});

export const getInternal = internalQuery({
  args: {
    workspaceId: v.id("tenderWorkspaces"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.workspaceId);
  },
});

export const updateWorkspaceStateInternal = internalMutation({
  args: {
    workspaceId: v.id("tenderWorkspaces"),
    status: v.union(
      v.literal("draft"),
      v.literal("assembling"),
      v.literal("ready_for_review"),
      v.literal("blocked"),
      v.literal("approved"),
      v.literal("exported")
    ),
    readiness: v.union(v.literal("red"), v.literal("yellow"), v.literal("green")),
    missingMandatoryCount: v.number(),
    criticalConflictCount: v.number(),
    summary: v.optional(v.string()),
    exportDocumentId: v.optional(v.id("documents")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.workspaceId, {
      status: args.status,
      readiness: args.readiness,
      missingMandatoryCount: args.missingMandatoryCount,
      criticalConflictCount: args.criticalConflictCount,
      summary: args.summary,
      exportDocumentId: args.exportDocumentId,
      updatedAt: Date.now(),
    });
  },
});

export const insertWorkspaceItemInternal = internalMutation({
  args: {
    workspaceId: v.id("tenderWorkspaces"),
    path: v.string(),
    itemType: v.union(v.literal("folder"), v.literal("file"), v.literal("placeholder")),
    sourceType: v.optional(
      v.union(
        v.literal("company_document"),
        v.literal("tender_document"),
        v.literal("generated"),
        v.literal("manual")
      )
    ),
    sourceDocumentId: v.optional(v.id("documents")),
    companyDocumentId: v.optional(v.id("companyDocuments")),
    requirementId: v.optional(v.id("requirements")),
    status: v.union(
      v.literal("attached"),
      v.literal("missing"),
      v.literal("generated"),
      v.literal("blocked")
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("workspaceItems")
      .withIndex("by_workspace_path", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("path", args.path)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        itemType: args.itemType,
        sourceType: args.sourceType,
        sourceDocumentId: args.sourceDocumentId,
        companyDocumentId: args.companyDocumentId,
        requirementId: args.requirementId,
        status: args.status,
        notes: args.notes,
      });
      return existing._id;
    }

    return await ctx.db.insert("workspaceItems", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const listWorkspaceItemsInternal = internalQuery({
  args: {
    workspaceId: v.id("tenderWorkspaces"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workspaceItems")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

export const deleteWorkspaceItemInternal = internalMutation({
  args: { id: v.id("workspaceItems") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const insertRequirementMatchInternal = internalMutation({
  args: {
    workspaceId: v.id("tenderWorkspaces"),
    requirementId: v.id("requirements"),
    status: v.union(
      v.literal("matched"),
      v.literal("partial"),
      v.literal("missing"),
      v.literal("conflict")
    ),
    confidence: v.optional(v.number()),
    selectedCompanyDocumentId: v.optional(v.id("companyDocuments")),
    rationale: v.optional(v.string()),
    sourceEvidence: v.optional(
      v.object({
        documentId: v.optional(v.id("documents")),
        page: v.optional(v.number()),
        quote: v.optional(v.string()),
      })
    ),
    companyEvidence: v.optional(
      v.object({
        documentId: v.optional(v.id("documents")),
        page: v.optional(v.number()),
        quote: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("requirementMatches", {
      ...args,
      overrideStatus: "none",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const listRequirementMatchesInternal = internalQuery({
  args: {
    workspaceId: v.id("tenderWorkspaces"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("requirementMatches")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

export const deleteRequirementMatchInternal = internalMutation({
  args: {
    id: v.id("requirementMatches"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
