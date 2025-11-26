/**
 * Claude Sonnet 4.5 configuration for Azure Foundry
 */

export interface ClaudeConfig {
  baseURL: string;
  apiKey: string;
  deploymentName: string;
  apiVersion: string;
}

export const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-5";
export const STRUCTURED_OUTPUTS_BETA = "structured-outputs-2025-11-13";

/**
 * Extended thinking configuration
 */
export interface ExtendedThinkingConfig {
  enabled: boolean;
  budgetTokens: number;
}

export const DEFAULT_THINKING_CONFIG: ExtendedThinkingConfig = {
  enabled: false,
  budgetTokens: 10000,
};

/**
 * Threshold for when to enable extended thinking
 * - Documents with 3+ files or 50+ total pages use extended thinking
 */
export const EXTENDED_THINKING_THRESHOLD = {
  documentCount: 3,
  pageCount: parseInt(process.env.CLAUDE_EXTENDED_THINKING_THRESHOLD || "50", 10),
};

/**
 * Get Claude configuration from environment variables
 */
export function getClaudeConfig(): ClaudeConfig {
  const baseURL = process.env.AZURE_CLAUDE_ENDPOINT;
  const apiKey = process.env.AZURE_CLAUDE_API_KEY;

  if (!baseURL || !apiKey) {
    throw new Error(
      "Claude configuration missing. Set AZURE_CLAUDE_ENDPOINT and AZURE_CLAUDE_API_KEY environment variables."
    );
  }

  return {
    baseURL: baseURL.replace(/\/$/, ""), // Remove trailing slash
    apiKey,
    deploymentName: process.env.AZURE_CLAUDE_DEPLOYMENT || DEFAULT_CLAUDE_MODEL,
    apiVersion: process.env.AZURE_CLAUDE_API_VERSION || "2023-06-01",
  };
}

/**
 * Check if Claude configuration is available
 */
export function isClaudeConfigured(): boolean {
  return Boolean(process.env.AZURE_CLAUDE_ENDPOINT && process.env.AZURE_CLAUDE_API_KEY);
}
