import { LLMProvider, ModelConfig, LLMRequestOptions } from "./types";

/**
 * Model routing configuration
 */
export interface RouterConfig {
  defaultProvider: LLMProvider;
  fallbackProviders: LLMProvider[];
  costLimits?: {
    perRequest?: number;
    perDay?: number;
  };
}

/**
 * Default model configurations for each provider
 */
export const DEFAULT_MODELS: Record<LLMProvider, Record<string, ModelConfig>> = {
  openai: {
    standard: {
      provider: "openai",
      model: "gpt-4.1-turbo", // or gpt-5 when available
      temperature: 0.1,
      maxTokens: 4096,
    },
    reasoning: {
      provider: "openai",
      model: "o4-mini",
      temperature: 1.0, // Reasoning models typically use temperature 1.0
    },
  },
  deepseek: {
    standard: {
      provider: "deepseek",
      model: "deepseek-chat-v3.2-exp",
      temperature: 0.1,
      maxTokens: 4096,
    },
    reasoning: {
      provider: "deepseek",
      model: "deepseek-r1",
      temperature: 1.0,
    },
  },
  xai: {
    standard: {
      provider: "xai",
      model: "grok-4",
      temperature: 0.1,
      maxTokens: 4096,
    },
    reasoning: {
      provider: "xai",
      model: "grok-4",
      temperature: 0.1,
    },
  },
  cohere: {
    standard: {
      provider: "cohere",
      model: "command-r-plus",
      temperature: 0.1,
      maxTokens: 4096,
    },
    reasoning: {
      provider: "cohere",
      model: "command-r-plus",
      temperature: 0.3,
    },
  },
};

/**
 * Model router for selecting the best model based on requirements
 */
export class ModelRouter {
  private config: RouterConfig;

  constructor(config: RouterConfig) {
    this.config = config;
  }

  /**
   * Select the best model based on request options
   */
  selectModel(options?: LLMRequestOptions): ModelConfig {
    const provider = this.config.defaultProvider;
    const modelType = options?.useReasoning ? "reasoning" : "standard";

    // Apply cost priority adjustments
    if (options?.costPriority === "low") {
      // Prefer DeepSeek for cost optimization
      return DEFAULT_MODELS.deepseek[modelType];
    }

    // Return default model for selected provider
    return DEFAULT_MODELS[provider][modelType];
  }

  /**
   * Get fallback model if primary fails
   */
  getFallbackModel(failedProvider: LLMProvider, options?: LLMRequestOptions): ModelConfig | null {
    const availableFallbacks = this.config.fallbackProviders.filter(
      (p) => p !== failedProvider
    );

    if (availableFallbacks.length === 0) {
      return null;
    }

    const modelType = options?.useReasoning ? "reasoning" : "standard";
    return DEFAULT_MODELS[availableFallbacks[0]][modelType];
  }

  /**
   * Estimate cost for a request
   */
  estimateCost(provider: LLMProvider, promptTokens: number, completionTokens: number): number {
    // Cost per 1M tokens (approximate)
    const costTable: Record<LLMProvider, { prompt: number; completion: number }> = {
      openai: { prompt: 10.0, completion: 30.0 }, // GPT-4 pricing
      deepseek: { prompt: 0.27, completion: 1.1 }, // DeepSeek-V3 pricing
      xai: { prompt: 10.0, completion: 30.0 }, // Grok pricing (estimated)
      cohere: { prompt: 3.0, completion: 15.0 }, // Command-R+ pricing
    };

    const costs = costTable[provider];
    const promptCost = (promptTokens / 1_000_000) * costs.prompt;
    const completionCost = (completionTokens / 1_000_000) * costs.completion;

    return promptCost + completionCost;
  }
}
