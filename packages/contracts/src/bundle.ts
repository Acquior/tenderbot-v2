import { z } from "zod";

/**
 * Bundle status
 */
export const BundleStatus = z.enum([
  "draft",
  "processing",
  "ready",
  "incomplete",
  "complete",
]);

export type BundleStatus = z.infer<typeof BundleStatus>;

/**
 * Tender document bundle (group of related files)
 */
export const BundleSchema = z.object({
  id: z.string(),
  name: z.string(),
  issuer: z.string().optional(),
  referenceNumber: z.string().optional(),
  dueDate: z.number().int().optional(),
  status: BundleStatus,
  documentIds: z.array(z.string()).default([]),
  completeness: z
    .object({
      required: z.array(
        z.object({
          type: z.string(),
          name: z.string(),
          present: z.boolean(),
          documentId: z.string().optional(),
        })
      ),
      score: z.number().min(0).max(100).optional(),
    })
    .optional(),
  metadata: z
    .object({
      totalPages: z.number().int().optional(),
      totalSize: z.number().int().optional(),
      detectedAt: z.number().int().optional(),
      confidence: z.number().min(0).max(1).optional(),
    })
    .optional(),
  createdBy: z.string(),
  organizationId: z.string().optional(),
  createdAt: z.number().int(),
  updatedAt: z.number().int().optional(),
});

export type Bundle = z.infer<typeof BundleSchema>;

/**
 * Bundle completeness check result
 */
export const BundleCompletenessSchema = z.object({
  bundleId: z.string(),
  requiredDocuments: z.array(
    z.object({
      type: z.string(),
      required: z.boolean(),
      found: z.boolean(),
      confidence: z.number().min(0).max(1).optional(),
    })
  ),
  missingDocuments: z.array(z.string()),
  score: z.number().min(0).max(100),
  readyForSubmission: z.boolean(),
});

export type BundleCompleteness = z.infer<typeof BundleCompletenessSchema>;
