import { z } from "zod";

export const FormRunStatusSchema = z.enum([
  "draft",
  "filled_preview",
  "manual_required",
  "approved",
  "blocked",
]);

export const FormFieldValidationStatusSchema = z.enum([
  "valid",
  "invalid",
  "unverified",
  "conflict",
]);

export const FormRunFieldSchema = z.object({
  fieldKey: z.string(),
  resolvedValue: z.string().optional(),
  sourceType: z.enum(["company_profile", "tender_fact", "manual"]).optional(),
  sourcePath: z.string().optional(),
  evidenceDocumentId: z.string().optional(),
  evidencePage: z.number().int().optional(),
  evidenceQuote: z.string().optional(),
  validationStatus: FormFieldValidationStatusSchema,
  requiresReview: z.boolean(),
});

export const FormRunSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  sourceDocumentId: z.string(),
  templateId: z.string().optional(),
  status: FormRunStatusSchema,
  outputDocumentId: z.string().optional(),
  fields: z.array(FormRunFieldSchema),
  createdAt: z.number().int(),
  updatedAt: z.number().int().optional(),
  organizationId: z.string().optional(),
});

export type FormRun = z.infer<typeof FormRunSchema>;
