import { z } from "zod";

/**
 * Citation/reference to source document
 */
export const CitationSchema = z.object({
  documentId: z.string(),
  chunkId: z.string().optional(),
  page: z.number().int().optional(),
  quote: z.string(),
  confidence: z.number().min(0).max(1).optional(),
});

export type Citation = z.infer<typeof CitationSchema>;

/**
 * Analysis finding with structured data
 */
export const FindingSchema = z.object({
  id: z.string(),
  category: z.string(),
  title: z.string(),
  description: z.string(),
  severity: z.enum(["info", "low", "medium", "high", "critical"]).optional(),
  citations: z.array(CitationSchema).default([]),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type Finding = z.infer<typeof FindingSchema>;

/**
 * Actionable task from analysis
 */
export const ActionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  dueDate: z.number().int().optional(),
  assignedTo: z.string().optional(), // User ID
  status: z.enum(["pending", "in_progress", "completed", "blocked"]).default("pending"),
  relatedFindingId: z.string().optional(),
});

export type Action = z.infer<typeof ActionSchema>;

/**
 * Analysis result
 */
export const AnalysisSchema = z.object({
  id: z.string(),
  type: z.enum(["document", "opportunity", "bundle", "gap"]),
  targetId: z.string(), // documentId, opportunityId, or bundleId
  summary: z.string(),
  findings: z.array(FindingSchema).default([]),
  actions: z.array(ActionSchema).default([]),
  citations: z.array(CitationSchema).default([]),
  metadata: z
    .object({
      model: z.string().optional(),
      tokensUsed: z.number().int().optional(),
      cost: z.number().optional(),
      latencyMs: z.number().int().optional(),
      groundedness: z.number().min(0).max(1).optional(),
    })
    .optional(),
  createdBy: z.string(),
  organizationId: z.string().optional(),
  createdAt: z.number().int(),
  version: z.string().default("1.0"),
});

export type Analysis = z.infer<typeof AnalysisSchema>;

/**
 * Gap analysis for opportunity vs capabilities
 */
export const GapAnalysisSchema = z.object({
  opportunityId: z.string(),
  gaps: z.array(
    z.object({
      requirementId: z.string(),
      severity: z.enum(["minor", "moderate", "major", "critical"]),
      description: z.string(),
      recommendation: z.string(),
    })
  ),
  completeness: z.number().min(0).max(100),
  readiness: z.enum(["not_ready", "partial", "ready", "strong"]),
});

export type GapAnalysis = z.infer<typeof GapAnalysisSchema>;
