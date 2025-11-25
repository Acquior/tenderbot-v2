/**
 * Job utility functions for Convex job management
 * Centralizes error handling and normalization logic
 */

import { Id } from "../_generated/dataModel";

/**
 * Determine if an error is retryable (network, timeout, rate limit issues)
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("rate limit") ||
    message.includes("econnreset") ||
    message.includes("enotfound") ||
    message.includes("socket hang up")
  );
}

/**
 * Requirement type for normalization
 */
export type RequirementType =
  | "compliance"
  | "technical"
  | "commercial"
  | "legal"
  | "bee"
  | "eligibility"
  | "other";

export type RequirementStatus = "met" | "partial" | "unknown" | "not_met";

export interface NormalizedRequirement {
  id: string;
  type: RequirementType;
  description: string;
  mandatory: boolean;
  status: RequirementStatus;
  confidence?: number;
  notes?: string;
}

/**
 * Normalize requirements from various formats (string or object)
 */
export function normalizeRequirements(
  raw: any[],
  bundleId: Id<"bundles">
): NormalizedRequirement[] {
  return (raw ?? []).reduce<NormalizedRequirement[]>((acc, req, index) => {
    // Handle string items - coerce to objects
    if (typeof req === "string") {
      const text = req.trim();
      if (text.length === 0) return acc;
      acc.push({
        id: `req-${bundleId}-${index}`,
        type: "other",
        description: text,
        mandatory: false,
        status: "unknown",
      });
      return acc;
    }

    // Skip items without description
    if (!req.description) {
      return acc;
    }

    acc.push({
      id: req.id ?? `req-${bundleId}-${index}`,
      type: req.type ?? "other",
      description: req.description,
      mandatory: req.mandatory ?? false,
      status: req.status ?? "unknown",
      confidence: req.confidence,
      notes: req.notes,
    });

    return acc;
  }, []);
}

/**
 * Risk category type for normalization
 */
export type RiskCategory =
  | "eligibility"
  | "bee_compliance"
  | "financial"
  | "technical"
  | "timeline"
  | "commercial"
  | "legal";

export type RiskSeverity = "low" | "medium" | "high" | "critical";

export interface NormalizedRisk {
  id: string;
  category: RiskCategory;
  severity: RiskSeverity;
  description: string;
  mitigation?: string;
  likelihood?: number;
  impact?: number;
}

/**
 * Normalize risks from various formats (string or object)
 */
export function normalizeRisks(
  raw: any[],
  bundleId: Id<"bundles">
): NormalizedRisk[] {
  return (raw ?? []).reduce<NormalizedRisk[]>((acc, risk, index) => {
    // Handle string items - coerce to objects
    if (typeof risk === "string") {
      const text = risk.trim();
      if (text.length === 0) return acc;
      acc.push({
        id: `risk-${bundleId}-${index}`,
        category: "commercial",
        severity: "medium",
        description: text,
      });
      return acc;
    }

    // Skip items without description
    if (!risk.description) {
      return acc;
    }

    acc.push({
      id: risk.id ?? `risk-${bundleId}-${index}`,
      category: risk.category ?? "commercial",
      severity: risk.severity ?? "medium",
      description: risk.description,
      mitigation: risk.mitigation,
      likelihood: risk.likelihood,
      impact: risk.impact,
    });

    return acc;
  }, []);
}

/**
 * Normalize a safe string value with a default fallback
 */
export function safeString(value: unknown, defaultValue: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return defaultValue;
}

/**
 * Normalize a timestamp, returning undefined if invalid
 */
export function normalizeTimestamp(value: unknown): number | undefined {
  if (typeof value === "number" && !Number.isNaN(value) && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}
