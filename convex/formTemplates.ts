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
  PDFCheckBox,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFSignature,
  PDFTextField,
  PDFDocument,
} from "pdf-lib";

type TemplateField = {
  key: string;
  label?: string;
  fieldType?: "text" | "checkbox" | "radio" | "dropdown" | "signature" | "date" | "unknown";
  required?: boolean;
};

async function downloadDocumentBytes(
  ctx: { storage: { getUrl: (storageId: string) => Promise<string | null> } },
  storageId: string
): Promise<Uint8Array> {
  const url = await ctx.storage.getUrl(storageId);
  if (!url) {
    throw new Error("Unable to resolve storage URL for document.");
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch document from storage (${response.status}).`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function classifyField(field: unknown): TemplateField["fieldType"] {
  if (field instanceof PDFTextField) return "text";
  if (field instanceof PDFCheckBox) return "checkbox";
  if (field instanceof PDFRadioGroup) return "radio";
  if (field instanceof PDFDropdown || field instanceof PDFOptionList) return "dropdown";
  if (field instanceof PDFSignature) return "signature";
  return "unknown";
}

async function inspectPdfDocument(
  bytes: Uint8Array
): Promise<{
  templateType: "fillable_pdf" | "non_fillable_pdf" | "unsupported";
  fields: TemplateField[];
}> {
  try {
    const pdfDocument = await PDFDocument.load(bytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    const form = pdfDocument.getForm();
    const fields = form.getFields().map((field) => ({
      key: field.getName(),
      fieldType: classifyField(field),
      required: false,
    }));

    if (fields.length === 0) {
      return {
        templateType: "non_fillable_pdf",
        fields: [],
      };
    }

    return {
      templateType: "fillable_pdf",
      fields,
    };
  } catch {
    return {
      templateType: "unsupported",
      fields: [],
    };
  }
}

async function getOrCreateTemplate(
  ctx: any,
  documentId: any
): Promise<any> {
  const document: any = await ctx.runQuery(internal.documents.getInternal, { documentId });
  if (!document) {
    throw new Error("Source document not found.");
  }

  const bytes = await downloadDocumentBytes(ctx, document.storageId);
  const sourceDocumentChecksum: string =
    document.checksums?.sha256 ??
    (await sha256Hex(bytes));

  const existing: any = await ctx.runQuery(internal.formTemplates.getByChecksumInternal, {
    checksum: sourceDocumentChecksum,
  });
  if (existing) {
    return existing;
  }

  const inspection = await inspectPdfDocument(bytes);
  const templateId: any = await ctx.runMutation(internal.formTemplates.insertInternal, {
    sourceDocumentChecksum,
    sourceFilename: document.filename,
    mimeType: document.mimeType,
    templateType: inspection.templateType,
    fields: inspection.fields,
    status:
      inspection.templateType === "fillable_pdf" ? "draft" : "manual_required",
  });

  return await ctx.runQuery(internal.formTemplates.getInternal, {
    templateId,
  });
}

export const getOrCreateForDocument = action({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args): Promise<any> => {
    await requireUser(ctx);
    return await getOrCreateTemplate(ctx, args.documentId);
  },
});

export const getOrCreateForDocumentInternal = internalAction({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args): Promise<any> => {
    return await getOrCreateTemplate(ctx, args.documentId);
  },
});

export const getByChecksumInternal = internalQuery({
  args: {
    checksum: v.string(),
  },
  handler: async (ctx, args) => {
    const template = await ctx.db
      .query("formTemplates")
      .withIndex("by_checksum", (q) => q.eq("sourceDocumentChecksum", args.checksum))
      .first();

    if (!template) return null;

    const mappings = await ctx.db
      .query("formFieldMappings")
      .withIndex("by_template", (q) => q.eq("templateId", template._id))
      .collect();

    return {
      ...template,
      mappings,
    };
  },
});

export const getInternal = internalQuery({
  args: {
    templateId: v.id("formTemplates"),
  },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) return null;

    const mappings = await ctx.db
      .query("formFieldMappings")
      .withIndex("by_template", (q) => q.eq("templateId", args.templateId))
      .collect();

    return {
      ...template,
      mappings,
    };
  },
});

export const listMappings = query({
  args: {
    templateId: v.id("formTemplates"),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db
      .query("formFieldMappings")
      .withIndex("by_template", (q) => q.eq("templateId", args.templateId))
      .collect();
  },
});

export const listMappingsInternal = internalQuery({
  args: {
    templateId: v.id("formTemplates"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("formFieldMappings")
      .withIndex("by_template", (q) => q.eq("templateId", args.templateId))
      .collect();
  },
});

export const insertInternal = internalMutation({
  args: {
    sourceDocumentChecksum: v.string(),
    sourceFilename: v.string(),
    mimeType: v.string(),
    templateType: v.union(
      v.literal("fillable_pdf"),
      v.literal("non_fillable_pdf"),
      v.literal("unsupported")
    ),
    fields: v.array(
      v.object({
        key: v.string(),
        label: v.optional(v.string()),
        fieldType: v.optional(
          v.union(
            v.literal("text"),
            v.literal("checkbox"),
            v.literal("radio"),
            v.literal("dropdown"),
            v.literal("signature"),
            v.literal("date"),
            v.literal("unknown")
          )
        ),
        required: v.optional(v.boolean()),
      })
    ),
    status: v.union(v.literal("draft"), v.literal("mapped"), v.literal("manual_required")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("formTemplates", {
      ...args,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const saveMappings = mutation({
  args: {
    templateId: v.id("formTemplates"),
    mappings: v.array(
      v.object({
        fieldKey: v.string(),
        sourceType: v.union(
          v.literal("company_profile"),
          v.literal("tender_fact"),
          v.literal("manual")
        ),
        sourcePath: v.optional(v.string()),
        validationType: v.optional(
          v.union(
            v.literal("exact_verified"),
            v.literal("email"),
            v.literal("phone"),
            v.literal("date"),
            v.literal("free_text")
          )
        ),
        requiredApproval: v.boolean(),
      })
    ),
  },
  handler: async (ctx, args): Promise<any> => {
    await requireUser(ctx);

    const template = await ctx.db.get(args.templateId);
    if (!template) {
      throw new Error("Form template not found.");
    }

    const existing = await ctx.db
      .query("formFieldMappings")
      .withIndex("by_template", (q) => q.eq("templateId", args.templateId))
      .collect();

    const nextKeys = new Set(args.mappings.map((mapping) => mapping.fieldKey));
    for (const row of existing) {
      if (!nextKeys.has(row.fieldKey)) {
        await ctx.db.delete(row._id);
      }
    }

    for (const mapping of args.mappings) {
      const current = existing.find((row) => row.fieldKey === mapping.fieldKey);
      if (current) {
        await ctx.db.patch(current._id, {
          ...mapping,
          updatedAt: Date.now(),
        });
      } else {
        await ctx.db.insert("formFieldMappings", {
          templateId: args.templateId,
          ...mapping,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }

    await ctx.db.patch(args.templateId, {
      status: args.mappings.length > 0 ? "mapped" : "draft",
      updatedAt: Date.now(),
    });

    return args.templateId;
  },
});
