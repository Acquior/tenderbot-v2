import { z } from "zod";

/**
 * Opportunity/Tender status
 */
export const OpportunityStatus = z.enum([
  "draft",
  "analyzing",
  "analysis_complete",
  "in_review",
  "approved",
  "rejected",
  "submitted",
  "closed",
]);

export type OpportunityStatus = z.infer<typeof OpportunityStatus>;

/**
 * Requirement extracted from tender documents
 */
export const RequirementSchema = z.object({
  id: z.string(),
  type: z.enum([
    "compliance",
    "technical",
    "commercial",
    "legal",
    "bee", // Black Economic Empowerment (South Africa)
    "eligibility",
    "other",
  ]),
  description: z.string(),
  mandatory: z.boolean(),
  status: z.enum(["met", "partial", "unknown", "not_met"]).default("unknown"),
  confidence: z.number().min(0).max(1).optional(),
  evidence: z
    .array(
      z.object({
        documentId: z.string(),
        page: z.number().int().optional(),
        quote: z.string().optional(),
      })
    )
    .optional(),
  notes: z.string().optional(),
});

export type Requirement = z.infer<typeof RequirementSchema>;

/**
 * Risk assessment
 */
export const RiskSchema = z.object({
  id: z.string(),
  category: z.enum([
    "eligibility",
    "bee_compliance",
    "financial",
    "technical",
    "timeline",
    "commercial",
    "legal",
  ]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  description: z.string(),
  mitigation: z.string().optional(),
  likelihood: z.number().min(0).max(1).optional(),
  impact: z.number().min(0).max(1).optional(),
});

export type Risk = z.infer<typeof RiskSchema>;

/**
 * Tender opportunity
 */
export const OpportunitySchema = z.object({
  id: z.string(),
  title: z.string(),
  issuer: z.string(),
  issuerCategory: z.string().optional(), // e.g., "Government", "Private", "Parastatal"
  referenceNumber: z.string().optional(),
  dueDate: z.number().int(), // Unix timestamp
  publishedDate: z.number().int().optional(),
  estimatedValue: z.number().optional(),
  currency: z.string().default("ZAR"),
  description: z.string().optional(),
  requirements: z.array(RequirementSchema).default([]),
  risks: z.array(RiskSchema).default([]),
  status: OpportunityStatus,
  bundleId: z.string().optional(), // Link to document bundle
  score: z
    .object({
      overall: z.number().min(0).max(100).optional(),
      eligibility: z.number().min(0).max(100).optional(),
      competitiveness: z.number().min(0).max(100).optional(),
      strategicFit: z.number().min(0).max(100).optional(),
    })
    .optional(),
  createdBy: z.string(),
  organizationId: z.string().optional(),
  createdAt: z.number().int(),
  updatedAt: z.number().int().optional(),
});

export type Opportunity = z.infer<typeof OpportunitySchema>;
