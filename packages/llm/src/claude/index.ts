/**
 * Claude Sonnet 4.5 integration for TenderBot
 *
 * This module provides:
 * - ClaudeClient: Main client for structured tender analysis
 * - Configuration helpers for Azure Foundry
 * - Optimized prompts for tender document extraction
 */

export { ClaudeClient } from "./client";
export type {
  ClaudeResponse,
  ClaudeStructuredOptions,
  ClaudeThinkingOptions,
} from "./client";

export {
  getClaudeConfig,
  isClaudeConfigured,
  DEFAULT_CLAUDE_MODEL,
  EXTENDED_THINKING_THRESHOLD,
} from "./config";
export type { ClaudeConfig, ExtendedThinkingConfig } from "./config";

export {
  buildClaudeTenderAnalysisPrompt,
  buildClaudeFollowUpPrompt,
  CLAUDE_TENDER_SYSTEM_PROMPT,
} from "./prompts";
export type { DocumentInfo } from "./prompts";
