import { z } from "zod";

export const CompanyProfileStatusSchema = z.enum(["draft", "active", "archived"]);
export type CompanyProfileStatus = z.infer<typeof CompanyProfileStatusSchema>;

export const CompanyFieldVerificationStatusSchema = z.enum([
  "draft",
  "verified",
  "superseded",
  "rejected",
]);
export type CompanyFieldVerificationStatus = z.infer<typeof CompanyFieldVerificationStatusSchema>;

export const CompanyProfileSectionLegalSchema = z.object({
  legalName: z.string().optional(),
  tradingName: z.string().optional(),
  registrationNumber: z.string().optional(),
  incorporationCountry: z.string().optional(),
});

export const CompanyProfileSectionTaxSchema = z.object({
  vatNumber: z.string().optional(),
  taxNumber: z.string().optional(),
  csdNumber: z.string().optional(),
});

export const CompanyProfileSectionBankingSchema = z.object({
  accountHolderName: z.string().optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  branchCode: z.string().optional(),
  accountType: z.string().optional(),
});

export const CompanyProfileSectionAddressesSchema = z.object({
  physicalAddress: z.string().optional(),
  postalAddress: z.string().optional(),
});

export const CompanyProfileSectionContactsSchema = z.object({
  primaryContactName: z.string().optional(),
  primaryContactEmail: z.string().optional(),
  primaryContactPhone: z.string().optional(),
});

export const CompanyProfileSectionSignatorySchema = z.object({
  fullName: z.string().optional(),
  title: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
});

export const CompanyProfileSectionComplianceSchema = z.object({
  beeLevel: z.string().optional(),
  cidbGrade: z.string().optional(),
  oemSummary: z.string().optional(),
});

export const CompanyProfileSchema = z.object({
  id: z.string(),
  workspaceKey: z.string().default("main"),
  status: CompanyProfileStatusSchema,
  legal: CompanyProfileSectionLegalSchema,
  tax: CompanyProfileSectionTaxSchema,
  banking: CompanyProfileSectionBankingSchema,
  addresses: CompanyProfileSectionAddressesSchema,
  contacts: CompanyProfileSectionContactsSchema,
  signatory: CompanyProfileSectionSignatorySchema,
  compliance: CompanyProfileSectionComplianceSchema,
  createdBy: z.string(),
  organizationId: z.string().optional(),
  createdAt: z.number().int(),
  updatedAt: z.number().int().optional(),
});

export type CompanyProfile = z.infer<typeof CompanyProfileSchema>;

export const CompanyProfileInputSchema = CompanyProfileSchema.omit({
  id: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
});

export type CompanyProfileInput = z.infer<typeof CompanyProfileInputSchema>;

export const CompanyFieldVerificationSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  fieldPath: z.string(),
  valueSnapshot: z.string(),
  status: CompanyFieldVerificationStatusSchema,
  sourceDocumentId: z.string().optional(),
  sourcePage: z.number().int().optional(),
  sourceQuote: z.string().optional(),
  sourceSnippetHash: z.string().optional(),
  verifiedBy: z.string().optional(),
  verifiedAt: z.number().int().optional(),
  createdAt: z.number().int(),
  organizationId: z.string().optional(),
});

export type CompanyFieldVerification = z.infer<typeof CompanyFieldVerificationSchema>;

export const CompanyVerificationSummaryFieldSchema = z.object({
  fieldPath: z.string(),
  label: z.string(),
  value: z.string().optional(),
  status: z.enum(["missing", "draft", "verified", "rejected", "superseded", "unverified"]),
  verifiedAt: z.number().int().optional(),
  sourceDocumentId: z.string().optional(),
});

export const CompanyVerificationSummarySchema = z.object({
  profileId: z.string(),
  completedCriticalFields: z.number().int(),
  totalCriticalFields: z.number().int(),
  readyToActivate: z.boolean(),
  fields: z.array(CompanyVerificationSummaryFieldSchema),
});

export type CompanyVerificationSummary = z.infer<typeof CompanyVerificationSummarySchema>;
