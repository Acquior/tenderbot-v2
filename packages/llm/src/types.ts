import { z } from "zod";

/**
 * Supported LLM providers
 */
export type LLMProvider = "openai" | "deepseek" | "xai" | "cohere";

/**
 * Model configuration
 */
export interface ModelConfig {
  provider: LLMProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
}

/**
 * LLM request options
 */
export interface LLMRequestOptions {
  useReasoning?: boolean; // Use reasoning model (o4-mini, DeepSeek-R1)
  costPriority?: "low" | "medium" | "high"; // Cost vs quality tradeoff
  maxRetries?: number;
  timeout?: number;
}

/**
 * LLM response with metadata
 */
export interface LLMResponse<T = unknown> {
  data: T;
  metadata: {
    model: string;
    provider: LLMProvider;
    tokensUsed?: {
      prompt: number;
      completion: number;
      total: number;
    };
    cost?: number;
    latencyMs: number;
    finishReason?: string;
  };
}

/**
 * Structured output request
 */
export interface StructuredOutputRequest<T extends z.ZodType> {
  prompt: string;
  schema: T;
  model?: ModelConfig;
  options?: LLMRequestOptions;
}

/**
 * Chat message
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Chat request
 */
export interface ChatRequest {
  messages: ChatMessage[];
  model?: ModelConfig;
  options?: LLMRequestOptions;
}
