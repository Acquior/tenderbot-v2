import { z } from "zod";

export const FormTemplateTypeSchema = z.enum([
  "fillable_pdf",
  "non_fillable_pdf",
  "unsupported",
]);

export const FormTemplateStatusSchema = z.enum(["draft", "mapped", "manual_required"]);

export const FormFieldTypeSchema = z.enum([
  "text",
  "checkbox",
  "radio",
  "dropdown",
  "signature",
  "date",
  "unknown",
]);

export const FormTemplateFieldSchema = z.object({
  key: z.string(),
  label: z.string().optional(),
  fieldType: FormFieldTypeSchema.optional(),
  required: z.boolean().optional(),
});

export const FormTemplateSchema = z.object({
  id: z.string(),
  sourceDocumentChecksum: z.string(),
  sourceFilename: z.string(),
  mimeType: z.string(),
  templateType: FormTemplateTypeSchema,
  fields: z.array(FormTemplateFieldSchema),
  status: FormTemplateStatusSchema,
  createdAt: z.number().int(),
  updatedAt: z.number().int().optional(),
});

export type FormTemplate = z.infer<typeof FormTemplateSchema>;

export const FormFieldMappingSourceTypeSchema = z.enum([
  "company_profile",
  "tender_fact",
  "manual",
]);

export const FormFieldMappingValidationTypeSchema = z.enum([
  "exact_verified",
  "email",
  "phone",
  "date",
  "free_text",
]);

export const FormFieldMappingSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  fieldKey: z.string(),
  sourceType: FormFieldMappingSourceTypeSchema,
  sourcePath: z.string().optional(),
  validationType: FormFieldMappingValidationTypeSchema.optional(),
  requiredApproval: z.boolean(),
  createdAt: z.number().int(),
  updatedAt: z.number().int().optional(),
});

export type FormFieldMapping = z.infer<typeof FormFieldMappingSchema>;
