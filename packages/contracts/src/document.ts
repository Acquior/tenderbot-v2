import { z } from "zod";

/**
 * Document status lifecycle
 */
export const DocumentStatus = z.enum([
  "uploading",
  "uploaded",
  "processing",
  "ocr_in_progress",
  "ocr_failed",
  "chunking",
  "embedding",
  "ready",
  "failed",
]);

export type DocumentStatus = z.infer<typeof DocumentStatus>;

export const DocumentKindSchema = z.enum([
  "tender_source",
  "company_reference",
  "workspace_artifact",
  "generated_export",
  "form_template",
]);

export type DocumentKind = z.infer<typeof DocumentKindSchema>;

export const DocumentApprovalStatusSchema = z.enum([
  "draft",
  "approved",
  "expired",
  "rejected",
]);

export type DocumentApprovalStatus = z.infer<typeof DocumentApprovalStatusSchema>;

/**
 * Document metadata and storage information
 */
export const DocumentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number().int().positive(),
  storageKey: z.string(), // Convex storage ID or R2 key
  status: DocumentStatus,
  kind: DocumentKindSchema.default("tender_source"),
  checksums: z.object({
    md5: z.string().optional(),
    sha256: z.string().optional(),
  }),
  metadata: z
    .object({
      pageCount: z.number().int().optional(),
      language: z.string().optional(),
      extractedAt: z.string().optional(),
      ocrMethod: z.enum(["native", "tesseract", "azure", "google"]).optional(),
    })
    .optional(),
  createdBy: z.string(), // Clerk user ID
  organizationId: z.string().optional(),
  createdAt: z.number().int(), // Unix timestamp
  updatedAt: z.number().int().optional(),
  bundleId: z.string().optional(), // Link to tender bundle
  profileId: z.string().optional(),
  workspaceId: z.string().optional(),
  documentCategory: z.string().optional(),
  approvalStatus: DocumentApprovalStatusSchema.optional(),
  expiresAt: z.number().int().optional(),
  sourceDocumentId: z.string().optional(),
});

export type Document = z.infer<typeof DocumentSchema>;

/**
 * Document upload request
 */
export const DocumentUploadRequestSchema = z.object({
  filename: z.string(),
  mimeType: z.string(),
  size: z.number().int().positive(),
  bundleId: z.string().optional(),
  kind: DocumentKindSchema.optional(),
  profileId: z.string().optional(),
  workspaceId: z.string().optional(),
  documentCategory: z.string().optional(),
});

export type DocumentUploadRequest = z.infer<typeof DocumentUploadRequestSchema>;

/**
 * Document upload response with presigned URL
 */
export const DocumentUploadResponseSchema = z.object({
  uploadUrl: z.string().url(),
  storageId: z.string(),
  documentId: z.string(),
  jobId: z.string().optional(),
});

export type DocumentUploadResponse = z.infer<typeof DocumentUploadResponseSchema>;
