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
  id: z.string().nullable().optional(),
  type: z.enum([
    "compliance",
    "technical",
    "commercial",
    "financial", // Financial requirements (bonds, fees, insurance, etc.)
    "legal",
    "bee", // Black Economic Empowerment (South Africa)
    "eligibility",
    "administrative",
    "other",
  ]).nullable().optional().default("other"),
  description: z.string().nullable().optional(),
  text: z.string().nullable().optional(), // Alternative field name LLM might use
  name: z.string().nullable().optional(), // Alternative field name LLM might use
  mandatory: z.boolean().nullable().optional().default(false),
  status: z.enum(["met", "partial", "unknown", "not_met"]).nullable().optional().default("unknown"),
  confidence: z.number().nullable().optional(),
  evidence: z
    .array(
      z.object({
        documentId: z.string().nullable().optional(),
        page: z.number().int().nullable().optional(),
        quote: z.string().nullable().optional(),
      })
    )
    .nullable()
    .optional(),
  notes: z.string().nullable().optional(),
  citation: z.any().nullable().optional(), // Allow citation field from LLM
}).transform((data, ctx) => ({
  id: data.id || `req-${ctx.path.join("-") || Math.random().toString(36).slice(2, 8)}`,
  type: data.type || "other",
  description: data.description || data.text || data.name || "No description provided",
  mandatory: data.mandatory ?? false,
  status: data.status || "unknown",
  confidence: data.confidence,
  evidence: data.evidence,
  notes: data.notes,
}));

export type Requirement = z.infer<typeof RequirementSchema>;

/**
 * Risk assessment
 */
export const RiskSchema = z.object({
  id: z.string().nullable().optional(),
  category: z.enum([
    "eligibility",
    "bee_compliance",
    "financial",
    "technical",
    "timeline",
    "commercial",
    "legal",
    "administrative",
  ]).nullable().optional().default("commercial"),
  type: z.string().nullable().optional(), // Alternative field name LLM might use
  severity: z.enum(["low", "medium", "high", "critical"]).nullable().optional().default("medium"),
  description: z.string().nullable().optional(),
  text: z.string().nullable().optional(), // Alternative field name LLM might use
  name: z.string().nullable().optional(), // Alternative field name LLM might use
  mitigation: z.string().nullable().optional(),
  likelihood: z.number().nullable().optional(),
  impact: z.number().nullable().optional(),
  citation: z.any().nullable().optional(), // Allow citation field from LLM
}).transform((data, ctx) => ({
  id: data.id || `risk-${ctx.path.join("-") || Math.random().toString(36).slice(2, 8)}`,
  category: data.category || (data.type as typeof data.category) || "commercial",
  severity: data.severity || "medium",
  description: data.description || data.text || data.name || "No description provided",
  mitigation: data.mitigation,
  likelihood: data.likelihood,
  impact: data.impact,
}));

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
