import { z } from "zod";

export const CompanyDocumentCategorySchema = z.enum([
  "registration",
  "tax",
  "bee",
  "banking",
  "financials",
  "proof_of_address",
  "oem_letter",
  "technical_datasheet",
  "company_profile",
  "sbd_attachment",
  "other",
]);

export type CompanyDocumentCategory = z.infer<typeof CompanyDocumentCategorySchema>;

export const CompanyDocumentValidityStatusSchema = z.enum([
  "draft",
  "approved",
  "expired",
  "rejected",
]);

export type CompanyDocumentValidityStatus = z.infer<typeof CompanyDocumentValidityStatusSchema>;

export const CompanyDocumentSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  documentId: z.string(),
  category: CompanyDocumentCategorySchema,
  title: z.string(),
  issuer: z.string().optional(),
  referenceNumber: z.string().optional(),
  validityStatus: CompanyDocumentValidityStatusSchema,
  effectiveFrom: z.number().int().optional(),
  expiresAt: z.number().int().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  approvedBy: z.string().optional(),
  approvedAt: z.number().int().optional(),
  createdAt: z.number().int(),
  organizationId: z.string().optional(),
});

export type CompanyDocument = z.infer<typeof CompanyDocumentSchema>;
