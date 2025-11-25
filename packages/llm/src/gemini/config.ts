/**
 * Gemini API configuration
 */

export interface GeminiConfig {
  apiKey: string;
  model?: string;
  fileSearchStoreName?: string;
  chunkingConfig?: {
    maxTokensPerChunk?: number;
    maxOverlapTokens?: number;
  };
}

/**
 * Default Gemini model for File Search queries
 */
export const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash-exp";

/**
 * Default File Search store display name
 */
export const DEFAULT_FILE_SEARCH_STORE_NAME = "tenderbot-documents";

/**
 * Default chunking configuration
 * Matches current TenderBot RAG settings: 512 tokens max, 50 overlap
 */
export const DEFAULT_CHUNKING_CONFIG = {
  maxTokensPerChunk: 512,
  maxOverlapTokens: 50,
};

/**
 * Get Gemini configuration from environment variables
 */
export function getGeminiConfig(): GeminiConfig {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY environment variable is required. Set it in Convex dashboard or .env.local"
    );
  }

  return {
    apiKey,
    model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    fileSearchStoreName: process.env.GEMINI_FILE_SEARCH_STORE_NAME || DEFAULT_FILE_SEARCH_STORE_NAME,
    chunkingConfig: {
      maxTokensPerChunk: process.env.GEMINI_MAX_TOKENS_PER_CHUNK
        ? parseInt(process.env.GEMINI_MAX_TOKENS_PER_CHUNK, 10)
        : DEFAULT_CHUNKING_CONFIG.maxTokensPerChunk,
      maxOverlapTokens: process.env.GEMINI_MAX_OVERLAP_TOKENS
        ? parseInt(process.env.GEMINI_MAX_OVERLAP_TOKENS, 10)
        : DEFAULT_CHUNKING_CONFIG.maxOverlapTokens,
    },
  };
}

