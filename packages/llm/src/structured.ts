import OpenAI from "openai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { StructuredOutputRequest, LLMResponse, ChatMessage } from "./types";
import { ModelRouter } from "./router";

/**
 * Client for generating structured outputs using OpenAI Responses API
 */
export class StructuredOutputClient {
  private openai: OpenAI;
  private router: ModelRouter;

  constructor(apiKey: string, router: ModelRouter) {
    this.openai = new OpenAI({ apiKey });
    this.router = router;
  }

  /**
   * Generate structured output with automatic retries and validation
   */
  async generate<T extends z.ZodType>(
    request: StructuredOutputRequest<T>
  ): Promise<LLMResponse<z.infer<T>>> {
    const startTime = Date.now();
    const modelConfig = request.model || this.router.selectModel(request.options);
    const maxRetries = request.options?.maxRetries ?? 3;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Convert Zod schema to JSON Schema
        const jsonSchema = zodToJsonSchema(request.schema, {
          name: "Response",
          $refStrategy: "none",
        });

        // Call OpenAI with response_format
        const response = await this.openai.chat.completions.create({
          model: modelConfig.model,
          messages: [
            {
              role: "user",
              content: request.prompt,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "response_schema",
              strict: true,
              schema: jsonSchema as any,
            },
          },
          temperature: modelConfig.temperature ?? 0.1,
          max_tokens: modelConfig.maxTokens ?? 4096,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("No content in response");
        }

        // Parse and validate with Zod
        const parsed = JSON.parse(content);
        const validated = request.schema.parse(parsed);

        const latencyMs = Date.now() - startTime;
        const tokensUsed = response.usage;

        return {
          data: validated,
          metadata: {
            model: modelConfig.model,
            provider: modelConfig.provider,
            tokensUsed: tokensUsed
              ? {
                  prompt: tokensUsed.prompt_tokens,
                  completion: tokensUsed.completion_tokens,
                  total: tokensUsed.total_tokens,
                }
              : undefined,
            cost: tokensUsed
              ? this.router.estimateCost(
                  modelConfig.provider,
                  tokensUsed.prompt_tokens,
                  tokensUsed.completion_tokens
                )
              : undefined,
            latencyMs,
            finishReason: response.choices[0]?.finish_reason,
          },
        };
      } catch (error) {
        lastError = error as Error;
        console.error(`Attempt ${attempt + 1} failed:`, error);

        if (attempt < maxRetries - 1) {
          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
    }

    throw new Error(`Failed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Generate structured output with chat history
   */
  async chat<T extends z.ZodType>(
    messages: ChatMessage[],
    schema: T,
    modelConfig?: Parameters<StructuredOutputClient["generate"]>[0]["model"],
    options?: Parameters<StructuredOutputClient["generate"]>[0]["options"]
  ): Promise<LLMResponse<z.infer<T>>> {
    const startTime = Date.now();
    const config = modelConfig || this.router.selectModel(options);

    const jsonSchema = zodToJsonSchema(schema, {
      name: "Response",
      $refStrategy: "none",
    });

    const response = await this.openai.chat.completions.create({
      model: config.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "response_schema",
          strict: true,
          schema: jsonSchema as any,
        },
      },
      temperature: config.temperature ?? 0.1,
      max_tokens: config.maxTokens ?? 4096,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content in response");
    }

    const parsed = JSON.parse(content);
    const validated = schema.parse(parsed);

    const latencyMs = Date.now() - startTime;
    const tokensUsed = response.usage;

    return {
      data: validated,
      metadata: {
        model: config.model,
        provider: config.provider,
        tokensUsed: tokensUsed
          ? {
              prompt: tokensUsed.prompt_tokens,
              completion: tokensUsed.completion_tokens,
              total: tokensUsed.total_tokens,
            }
          : undefined,
        cost: tokensUsed
          ? this.router.estimateCost(
              config.provider,
              tokensUsed.prompt_tokens,
              tokensUsed.completion_tokens
            )
          : undefined,
        latencyMs,
        finishReason: response.choices[0]?.finish_reason,
      },
    };
  }
}
