import { z } from "zod";

export const WorkspaceStatusSchema = z.enum([
  "draft",
  "assembling",
  "ready_for_review",
  "blocked",
  "approved",
  "exported",
]);

export const WorkspaceReadinessSchema = z.enum(["red", "yellow", "green"]);

export const WorkspaceItemTypeSchema = z.enum(["folder", "file", "placeholder"]);
export const WorkspaceItemSourceTypeSchema = z.enum([
  "company_document",
  "tender_document",
  "generated",
  "manual",
]);
export const WorkspaceItemStatusSchema = z.enum(["attached", "missing", "generated", "blocked"]);

export const RequirementMatchStatusSchema = z.enum([
  "matched",
  "partial",
  "missing",
  "conflict",
]);

export const RequirementMatchOverrideStatusSchema = z.enum([
  "none",
  "manual_selected",
  "manual_rejected",
]);

export const TenderWorkspaceSchema = z.object({
  id: z.string(),
  opportunityId: z.string(),
  bundleId: z.string().optional(),
  profileId: z.string(),
  status: WorkspaceStatusSchema,
  readiness: WorkspaceReadinessSchema,
  missingMandatoryCount: z.number().int(),
  criticalConflictCount: z.number().int(),
  exportDocumentId: z.string().optional(),
  summary: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.number().int(),
  updatedAt: z.number().int().optional(),
  organizationId: z.string().optional(),
});

export type TenderWorkspace = z.infer<typeof TenderWorkspaceSchema>;

export const WorkspaceItemSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  path: z.string(),
  itemType: WorkspaceItemTypeSchema,
  sourceType: WorkspaceItemSourceTypeSchema.optional(),
  sourceDocumentId: z.string().optional(),
  companyDocumentId: z.string().optional(),
  requirementId: z.string().optional(),
  status: WorkspaceItemStatusSchema,
  notes: z.string().optional(),
  createdAt: z.number().int(),
  organizationId: z.string().optional(),
});

export type WorkspaceItem = z.infer<typeof WorkspaceItemSchema>;

export const RequirementMatchSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  requirementId: z.string(),
  status: RequirementMatchStatusSchema,
  confidence: z.number().optional(),
  selectedCompanyDocumentId: z.string().optional(),
  rationale: z.string().optional(),
  sourceEvidence: z
    .object({
      documentId: z.string().optional(),
      page: z.number().int().optional(),
      quote: z.string().optional(),
    })
    .optional(),
  companyEvidence: z
    .object({
      documentId: z.string().optional(),
      page: z.number().int().optional(),
      quote: z.string().optional(),
    })
    .optional(),
  overrideStatus: RequirementMatchOverrideStatusSchema.optional(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.number().int().optional(),
  createdAt: z.number().int(),
  updatedAt: z.number().int().optional(),
  organizationId: z.string().optional(),
});

export type RequirementMatch = z.infer<typeof RequirementMatchSchema>;
