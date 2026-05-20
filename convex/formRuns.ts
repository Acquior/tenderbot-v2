import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUser } from "./auth";
import {
  CRITICAL_PROFILE_FIELDS,
  getValueAtPath,
  isCriticalProfileField,
  requiredString,
  validateCheckboxBoolean,
  validateDate,
  validateEmail,
  validatePhone,
} from "./validators";
import {
  PDFCheckBox,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
  PDFDocument,
} from "pdf-lib";

const PROFILE_FIELD_ALIASES: Record<string, string[]> = {
  "legal.legalName": [
    "companyname",
    "legalname",
    "registeredname",
    "nameofbidder",
    "suppliername",
    "entityname",
    "vendorname",
    "biddername",
  ],
  "legal.tradingName": ["tradingname", "businessname"],
  "legal.registrationNumber": [
    "registrationnumber",
    "registrationno",
    "companyregistration",
    "regnumber",
    "regno",
    "cknumber",
  ],
  "tax.vatNumber": ["vatnumber", "vatno", "vatrg", "vatregistration"],
  "tax.taxNumber": ["taxnumber", "incometaxnumber", "taxref", "taxreference"],
  "tax.csdNumber": ["csdnumber", "suppliernumber"],
  "banking.accountHolderName": ["accountholder", "accountholdername", "bankaccountholder"],
  "banking.bankName": ["bankname", "nameofbank"],
  "banking.accountNumber": ["accountnumber", "bankaccountnumber"],
  "banking.branchCode": ["branchcode", "bankbranchcode"],
  "banking.accountType": ["accounttype"],
  "addresses.physicalAddress": ["physicaladdress", "streetaddress"],
  "addresses.postalAddress": ["postaladdress"],
  "contacts.primaryContactName": ["contactname", "primarycontact", "contactperson"],
  "contacts.primaryContactEmail": ["contactemail", "emailaddress", "email"],
  "contacts.primaryContactPhone": ["contactphone", "telephone", "phonenumber", "mobile"],
  "signatory.fullName": ["signatoryname", "authorisedsignatory", "authorizedsignatory", "fullname"],
  "signatory.title": ["signatorytitle", "designation", "title", "capacity"],
  "signatory.email": ["signatoryemail"],
  "signatory.phone": ["signatoryphone"],
  "compliance.beeLevel": ["beelevel", "bbbeelevel", "bbee"],
  "compliance.cidbGrade": ["cidbgrade"],
};

const TENDER_FACT_ALIASES: Record<string, string[]> = {
  "opportunity.referenceNumber": ["tendernumber", "referencenumber", "rfqnumber", "bidnumber", "tenderref"],
  "opportunity.title": ["tendertitle", "projectname", "contracttitle"],
  "opportunity.issuer": ["issuer", "department", "client", "institution", "procuringentity"],
  "opportunity.dueDate": ["duedate", "closingdate", "submissiondate"],
};

type FieldResolution = {
  fieldKey: string;
  resolvedValue?: string;
  sourceType?: "company_profile" | "tender_fact" | "manual";
  sourcePath?: string;
  evidenceDocumentId?: any;
  evidencePage?: number;
  evidenceQuote?: string;
  validationStatus: "valid" | "invalid" | "unverified" | "conflict";
  requiresReview: boolean;
};

function normalizeFieldKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function titleCaseFromKey(value: string): string {
  return value
    .replace(/[_\-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function getTenderFactValue(opportunity: any, path: string): string | undefined {
  if (path === "opportunity.referenceNumber") return opportunity.referenceNumber ?? undefined;
  if (path === "opportunity.title") return opportunity.title ?? undefined;
  if (path === "opportunity.issuer") return opportunity.issuer ?? undefined;
  if (path === "opportunity.dueDate") {
    return typeof opportunity.dueDate === "number"
      ? new Date(opportunity.dueDate).toISOString().slice(0, 10)
      : undefined;
  }
  return undefined;
}

function inferValidationType(
  fieldKey: string,
  sourcePath?: string
): "exact_verified" | "email" | "phone" | "date" | "free_text" {
  const normalizedKey = normalizeFieldKey(fieldKey);
  if (sourcePath && isCriticalProfileField(sourcePath)) return "exact_verified";
  if (sourcePath?.toLowerCase().includes("email") || normalizedKey.includes("email")) return "email";
  if (sourcePath?.toLowerCase().includes("phone") || normalizedKey.includes("phone") || normalizedKey.includes("tel")) {
    return "phone";
  }
  if (sourcePath?.toLowerCase().includes("date") || normalizedKey.includes("date")) return "date";
  return "free_text";
}

function findUniqueMapping(
  normalizedFieldKey: string,
  aliases: Record<string, string[]>
): { sourcePath: string } | null {
  let bestPath: string | null = null;
  let bestScore = 0;
  let duplicateBest = false;

  for (const [sourcePath, variants] of Object.entries(aliases)) {
    for (const variant of variants) {
      let score = 0;
      if (normalizedFieldKey === variant) score = 100;
      else if (normalizedFieldKey.includes(variant) || variant.includes(normalizedFieldKey)) score = 50;

      if (score === 0) continue;

      if (score > bestScore) {
        bestPath = sourcePath;
        bestScore = score;
        duplicateBest = false;
      } else if (score === bestScore) {
        duplicateBest = true;
      }
    }
  }

  if (!bestPath || duplicateBest) {
    return null;
  }

  return { sourcePath: bestPath };
}

async function downloadDocumentBytes(
  ctx: { storage: { getUrl: (storageId: string) => Promise<string | null> } },
  storageId: string
): Promise<Uint8Array> {
  const url = await ctx.storage.getUrl(storageId);
  if (!url) {
    throw new Error("Unable to resolve storage URL for form source.");
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch form source (${response.status}).`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

function resolveFromSavedMapping(
  fieldKey: string,
  manualField: any,
  savedMapping: any,
  profile: any,
  opportunity: any
): Pick<FieldResolution, "resolvedValue" | "sourceType" | "sourcePath"> {
  if (manualField?.resolvedValue) {
    return {
      resolvedValue: manualField.resolvedValue,
      sourceType: "manual",
      sourcePath: manualField.sourcePath,
    };
  }

  if (!savedMapping) {
    return {};
  }

  if (savedMapping.sourceType === "company_profile") {
    const value = getValueAtPath(profile as Record<string, any>, savedMapping.sourcePath);
    return {
      resolvedValue: typeof value === "string" ? value : undefined,
      sourceType: "company_profile",
      sourcePath: savedMapping.sourcePath,
    };
  }

  if (savedMapping.sourceType === "tender_fact") {
    return {
      resolvedValue: getTenderFactValue(opportunity, savedMapping.sourcePath),
      sourceType: "tender_fact",
      sourcePath: savedMapping.sourcePath,
    };
  }

  return {};
}

function resolveHeuristically(
  fieldKey: string,
  profile: any,
  opportunity: any
): Pick<FieldResolution, "resolvedValue" | "sourceType" | "sourcePath"> {
  const normalizedFieldKey = normalizeFieldKey(fieldKey);
  const profileMatch = findUniqueMapping(normalizedFieldKey, PROFILE_FIELD_ALIASES);
  if (profileMatch) {
    const value = getValueAtPath(profile as Record<string, any>, profileMatch.sourcePath);
    return {
      resolvedValue: typeof value === "string" ? value : undefined,
      sourceType: "company_profile",
      sourcePath: profileMatch.sourcePath,
    };
  }

  const tenderFactMatch = findUniqueMapping(normalizedFieldKey, TENDER_FACT_ALIASES);
  if (tenderFactMatch) {
    return {
      resolvedValue: getTenderFactValue(opportunity, tenderFactMatch.sourcePath),
      sourceType: "tender_fact",
      sourcePath: tenderFactMatch.sourcePath,
    };
  }

  return {};
}

async function validateResolvedField(
  ctx: any,
  workspace: any,
  fieldKey: string,
  sourceType: FieldResolution["sourceType"],
  sourcePath: string | undefined,
  value: string | undefined
): Promise<{ validationStatus: FieldResolution["validationStatus"]; requiresReview: boolean }> {
  if (!sourceType || !sourcePath) {
    return { validationStatus: "unverified", requiresReview: true };
  }

  if (sourceType === "manual") {
    return { validationStatus: value ? "unverified" : "invalid", requiresReview: true };
  }

  if (sourceType === "company_profile") {
    const validationType = inferValidationType(fieldKey, sourcePath);
    if (validationType === "exact_verified") {
      if (!value) {
        return { validationStatus: "invalid", requiresReview: true };
      }
      const result = await ctx.runQuery(internal.validators.exactVerifiedField, {
        profileId: workspace.profileId,
        fieldPath: sourcePath,
        value,
      });
      return {
        validationStatus: result.status,
        requiresReview: result.status !== "valid",
      };
    }

    const validator =
      validationType === "email"
        ? validateEmail
        : validationType === "phone"
          ? validatePhone
          : validationType === "date"
            ? validateDate
            : requiredString;

    const result = validator(value);
    return {
      validationStatus: result.status,
      requiresReview: false,
    };
  }

  const result = inferValidationType(fieldKey, sourcePath) === "date"
    ? validateDate(value)
    : requiredString(value);

  return {
    validationStatus: result.status,
    requiresReview: true,
  };
}

function isTruthyCheckboxValue(value: string): boolean {
  const normalized = value.toLowerCase();
  return ["true", "yes", "1", "on", "x", "checked"].includes(normalized);
}

function toBlobPart(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function sanitizeWorkspaceName(value: string, fallback: string): string {
  const normalized = value
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || fallback;
}

function applyFieldValue(field: any, resolved: FieldResolution) {
  if (!resolved.resolvedValue || resolved.validationStatus !== "valid") {
    return;
  }

  if (field instanceof PDFTextField) {
    field.setText(resolved.resolvedValue);
    return;
  }

  if (field instanceof PDFCheckBox) {
    const validation = validateCheckboxBoolean(resolved.resolvedValue);
    if (validation.status === "valid") {
      if (isTruthyCheckboxValue(resolved.resolvedValue)) {
        field.check();
      } else {
        field.uncheck();
      }
    }
    return;
  }

  if (field instanceof PDFRadioGroup) {
    try {
      field.select(resolved.resolvedValue);
    } catch {
      // Keep preview generation deterministic; incompatible values stay blank.
    }
    return;
  }

  if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
    try {
      field.select(resolved.resolvedValue);
    } catch {
      // Keep preview generation deterministic; incompatible values stay blank.
    }
  }
}

function shouldBlockField(resolved: FieldResolution): boolean {
  return (
    !!resolved.sourcePath &&
    isCriticalProfileField(resolved.sourcePath) &&
    resolved.validationStatus !== "valid"
  );
}

export const listByWorkspace = query({
  args: {
    workspaceId: v.id("tenderWorkspaces"),
  },
  handler: async (ctx, args): Promise<any> => {
    await requireUser(ctx);

    const runs = await ctx.db
      .query("formRuns")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(100);

    return await Promise.all(
      runs.map(async (run) => {
        const sourceDocument = await ctx.db.get(run.sourceDocumentId);
        const outputDocument = run.outputDocumentId ? await ctx.db.get(run.outputDocumentId) : null;
        const template = run.templateId ? await ctx.db.get(run.templateId) : null;
        return {
          ...run,
          sourceDocument,
          sourceDocumentUrl: sourceDocument ? await ctx.storage.getUrl(sourceDocument.storageId) : null,
          outputDocument,
          outputDocumentUrl: outputDocument ? await ctx.storage.getUrl(outputDocument.storageId) : null,
          template,
        };
      })
    );
  },
});

export const listByWorkspaceInternal = internalQuery({
  args: {
    workspaceId: v.id("tenderWorkspaces"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("formRuns")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

export const getByWorkspaceAndSourceInternal = internalQuery({
  args: {
    workspaceId: v.id("tenderWorkspaces"),
    sourceDocumentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("formRuns")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) => q.eq(q.field("sourceDocumentId"), args.sourceDocumentId))
      .first();
  },
});

export const upsertRunInternal = internalMutation({
  args: {
    workspaceId: v.id("tenderWorkspaces"),
    sourceDocumentId: v.id("documents"),
    templateId: v.optional(v.id("formTemplates")),
    status: v.union(
      v.literal("draft"),
      v.literal("filled_preview"),
      v.literal("manual_required"),
      v.literal("approved"),
      v.literal("blocked")
    ),
    outputDocumentId: v.optional(v.id("documents")),
    fields: v.array(
      v.object({
        fieldKey: v.string(),
        resolvedValue: v.optional(v.string()),
        sourceType: v.optional(
          v.union(
            v.literal("company_profile"),
            v.literal("tender_fact"),
            v.literal("manual")
          )
        ),
        sourcePath: v.optional(v.string()),
        evidenceDocumentId: v.optional(v.id("documents")),
        evidencePage: v.optional(v.number()),
        evidenceQuote: v.optional(v.string()),
        validationStatus: v.union(
          v.literal("valid"),
          v.literal("invalid"),
          v.literal("unverified"),
          v.literal("conflict")
        ),
        requiresReview: v.boolean(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("formRuns")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) => q.eq(q.field("sourceDocumentId"), args.sourceDocumentId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        templateId: args.templateId,
        status: args.status,
        outputDocumentId: args.outputDocumentId,
        fields: args.fields,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("formRuns", {
      workspaceId: args.workspaceId,
      sourceDocumentId: args.sourceDocumentId,
      templateId: args.templateId,
      status: args.status,
      outputDocumentId: args.outputDocumentId,
      fields: args.fields,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

async function generatePreviewCore(
  ctx: any,
  args: {
    workspaceId: any;
    sourceDocumentId: any;
    actorId: string;
  }
): Promise<any> {
  const workspace: any = await ctx.runQuery(internal.tenderWorkspaces.getInternal, {
    workspaceId: args.workspaceId,
  });
  if (!workspace) {
    throw new Error("Workspace not found.");
  }

  const sourceDocument: any = await ctx.runQuery(internal.documents.getInternal, {
    documentId: args.sourceDocumentId,
  });
  if (!sourceDocument) {
    throw new Error("Source form document not found.");
  }

  const opportunity: any = await ctx.runQuery(internal.opportunities.getInternal, {
    opportunityId: workspace.opportunityId,
  });
  const profile: any = await ctx.runQuery(internal.companyProfiles.getInternal, {
    profileId: workspace.profileId,
  });
  if (!opportunity || !profile) {
    throw new Error("Workspace dependencies are incomplete.");
  }

  const template: any = await ctx.runAction(internal.formTemplates.getOrCreateForDocumentInternal, {
    documentId: args.sourceDocumentId,
  });
  if (!template) {
    throw new Error("Unable to create form template.");
  }

  const existingRun: any = await ctx.runQuery(internal.formRuns.getByWorkspaceAndSourceInternal, {
    workspaceId: args.workspaceId,
    sourceDocumentId: args.sourceDocumentId,
  });
  const manualFieldMap = new Map(
    (existingRun?.fields ?? [])
      .filter((field: any) => field.sourceType === "manual" && field.resolvedValue)
      .map((field: any) => [field.fieldKey, field])
  );
  const mappingMap = new Map(
    (template.mappings ?? []).map((mapping: any) => [mapping.fieldKey, mapping])
  );

  if (template.templateType !== "fillable_pdf") {
    const runId: any = await ctx.runMutation(internal.formRuns.upsertRunInternal, {
      workspaceId: args.workspaceId,
      sourceDocumentId: args.sourceDocumentId,
      templateId: template._id,
      status: "manual_required",
      outputDocumentId: undefined,
      fields: [],
    });

    await ctx.runMutation(internal.auditEvents.logInternal, {
      entityType: "form_run",
      entityId: runId,
      action: "preview_generation_skipped",
      actorId: args.actorId,
      payload: {
        sourceDocumentId: args.sourceDocumentId,
        templateType: template.templateType,
      },
    });

    return {
      runId,
      status: "manual_required" as const,
      reason: template.templateType,
    };
  }

  const sourceBytes = await downloadDocumentBytes(ctx, sourceDocument.storageId);
  const pdfDocument = await PDFDocument.load(sourceBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });
  const form = pdfDocument.getForm();
  const pdfFields = new Map(form.getFields().map((field) => [field.getName(), field]));

  const resolvedFields: FieldResolution[] = [];
  let blocked = false;
  let needsReview = false;

  for (const templateField of template.fields) {
    const manualField = manualFieldMap.get(templateField.key);
    const savedMapping = mappingMap.get(templateField.key);
    let resolved = resolveFromSavedMapping(
      templateField.key,
      manualField,
      savedMapping,
      profile,
      opportunity
    );

    if (!resolved.sourceType) {
      resolved = resolveHeuristically(templateField.key, profile, opportunity);
    }

    const validation = await validateResolvedField(
      ctx,
      workspace,
      templateField.key,
      resolved.sourceType,
      resolved.sourcePath,
      resolved.resolvedValue
    );

    const fieldResolution: FieldResolution = {
      fieldKey: templateField.key,
      resolvedValue: resolved.resolvedValue,
      sourceType: resolved.sourceType,
      sourcePath: resolved.sourcePath,
      validationStatus: validation.validationStatus,
      requiresReview: validation.requiresReview,
    };

    if (shouldBlockField(fieldResolution)) {
      blocked = true;
    }
    if (fieldResolution.requiresReview) {
      needsReview = true;
    }

    const pdfField = pdfFields.get(templateField.key);
    if (pdfField) {
      applyFieldValue(pdfField, fieldResolution);
    }

    resolvedFields.push(fieldResolution);
  }

  form.updateFieldAppearances();
  const previewBytes = await pdfDocument.save();
  const storageId = await ctx.storage.store(
    new Blob([toBlobPart(previewBytes)], { type: "application/pdf" })
  );

  const outputDocumentId: any = await ctx.runMutation(internal.documents.createGeneratedInternal, {
    filename: `${sourceDocument.filename.replace(/\.pdf$/i, "") || "form"}-preview.pdf`,
    mimeType: "application/pdf",
    size: previewBytes.length,
    storageId,
    kind: "workspace_artifact",
    createdBy: args.actorId,
    bundleId: workspace.bundleId,
    profileId: workspace.profileId,
    workspaceId: args.workspaceId,
    documentCategory: "form_preview",
    approvalStatus: "draft",
    sourceDocumentId: args.sourceDocumentId,
  });

  const status =
    blocked
      ? "blocked"
      : needsReview
        ? "manual_required"
        : "filled_preview";

  const runId: any = await ctx.runMutation(internal.formRuns.upsertRunInternal, {
    workspaceId: args.workspaceId,
    sourceDocumentId: args.sourceDocumentId,
    templateId: template._id,
    status,
    outputDocumentId,
    fields: resolvedFields,
  });

  await ctx.runMutation(internal.tenderWorkspaces.insertWorkspaceItemInternal, {
    workspaceId: args.workspaceId,
    path: `06_Forms/${sanitizeWorkspaceName(
      `${sourceDocument.filename.replace(/\.pdf$/i, "") || "form"}-preview.pdf`,
      "preview.pdf"
    )}`,
    itemType: "file",
    sourceType: "generated",
    sourceDocumentId: outputDocumentId,
    status: status === "blocked" ? "blocked" : "generated",
    notes: `Preview generated from ${sourceDocument.filename}`,
  });

  await ctx.runMutation(internal.auditEvents.logInternal, {
    entityType: "form_run",
    entityId: runId,
    action: "preview_generated",
    actorId: args.actorId,
    payload: {
      outputDocumentId,
      blocked,
      needsReview,
      criticalFieldsTracked: CRITICAL_PROFILE_FIELDS,
    },
  });

  return {
    runId,
    status,
    outputDocumentId,
  };
}

export const generatePreviewInternal = internalAction({
  args: {
    workspaceId: v.id("tenderWorkspaces"),
    sourceDocumentId: v.id("documents"),
    actorId: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    return await generatePreviewCore(ctx, args);
  },
});

export const generatePreview = action({
  args: {
    workspaceId: v.id("tenderWorkspaces"),
    sourceDocumentId: v.id("documents"),
  },
  handler: async (ctx, args): Promise<any> => {
    const identity = await requireUser(ctx);
    return await generatePreviewCore(ctx, {
      workspaceId: args.workspaceId,
      sourceDocumentId: args.sourceDocumentId,
      actorId: identity.clerkUserId,
    });
  },
});

export const approveFormRun = mutation({
  args: {
    id: v.id("formRuns"),
  },
  handler: async (ctx, args): Promise<any> => {
    const identity = await requireUser(ctx);
    const run: any = await ctx.db.get(args.id);
    if (!run) {
      throw new Error("Form run not found.");
    }

    if (run.status === "blocked") {
      throw new Error("Blocked form runs cannot be approved.");
    }

    await ctx.db.patch(args.id, {
      status: "approved",
      updatedAt: Date.now(),
    });

    await ctx.db.insert("auditEvents", {
      entityType: "form_run",
      entityId: args.id,
      action: "approved",
      actorId: identity.clerkUserId,
      createdAt: Date.now(),
    });

    return args.id;
  },
});

export const setManualValue = mutation({
  args: {
    id: v.id("formRuns"),
    fieldKey: v.string(),
    value: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    const identity = await requireUser(ctx);
    const run: any = await ctx.db.get(args.id);
    if (!run) {
      throw new Error("Form run not found.");
    }

    const fields = run.fields.map((field: any) =>
      field.fieldKey === args.fieldKey
        ? {
            ...field,
            resolvedValue: args.value,
            sourceType: "manual" as const,
            sourcePath: field.sourcePath,
            validationStatus: args.value.trim().length > 0 ? ("unverified" as const) : ("invalid" as const),
            requiresReview: true,
          }
        : field
    );

    await ctx.db.patch(args.id, {
      fields,
      status: "manual_required",
      updatedAt: Date.now(),
    });

    await ctx.db.insert("auditEvents", {
      entityType: "form_run",
      entityId: args.id,
      action: "manual_field_override",
      actorId: identity.clerkUserId,
      payload: {
        fieldKey: args.fieldKey,
      },
      createdAt: Date.now(),
    });

    return args.id;
  },
});
