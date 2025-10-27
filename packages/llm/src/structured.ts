import OpenAI from "openai";
import type { ResponseCreateParamsBase } from "openai/resources/responses/responses";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { StructuredOutputRequest, LLMResponse, ChatMessage } from "./types";
import { ModelRouter } from "./router";

/**
 * Client for generating structured outputs using OpenAI Responses API
 */
export interface StructuredClientOptions {
  baseURL?: string;
  apiVersion?: string;
  defaultHeaders?: Record<string, string>;
  defaultQuery?: Record<string, string>;
}

export class StructuredOutputClient {
  private openai: OpenAI;
  private router: ModelRouter;

  constructor(apiKey: string | undefined, router: ModelRouter, options: StructuredClientOptions = {}) {
    const explicitApiKey = apiKey ?? process.env.OPENAI_API_KEY ?? process.env.AZURE_OPENAI_API_KEY;

    if (!explicitApiKey && !process.env.AZURE_OPENAI_ENDPOINT) {
      throw new Error("Missing OpenAI API key. Set OPENAI_API_KEY or AZURE_OPENAI_API_KEY.");
    }

    const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    const isAzure = Boolean(azureEndpoint && azureDeployment);
    const baseURL =
      options.baseURL ??
      process.env.OPENAI_BASE_URL ??
      (isAzure
        ? `${azureEndpoint!.replace(/\/$/, "")}/openai/deployments/${azureDeployment}`
        : undefined);

    const apiVersion = options.apiVersion ?? process.env.OPENAI_API_VERSION ?? process.env.AZURE_OPENAI_API_VERSION;
    const defaultQuery = options.defaultQuery ?? (apiVersion ? { "api-version": apiVersion } : undefined);

    const defaultHeaders = {
      ...(options.defaultHeaders ?? {}),
      ...(isAzure ? { "api-key": explicitApiKey as string } : {}),
    };

    this.openai = new OpenAI({
      apiKey: explicitApiKey,
      baseURL,
      defaultHeaders: Object.keys(defaultHeaders).length ? defaultHeaders : undefined,
      defaultQuery,
    });

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
    const isAzure = Boolean(process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_DEPLOYMENT);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Convert Zod schema to JSON Schema
        const jsonSchema = zodToJsonSchema(request.schema, {
          name: "Response",
          $refStrategy: "none",
        }) as Record<string, unknown>;

        const effectiveModel = process.env.AZURE_OPENAI_DEPLOYMENT ?? modelConfig.model;

        if (isAzure) {
          // Use Azure Chat Completions with response_format: json_schema
          const chatResponse = await this.openai.chat.completions.create({
            model: effectiveModel,
            messages: [
              {
                role: "system",
                content:
                  "You are a structured extraction assistant. Respond with a valid JSON object only. Do not include any text outside JSON.",
              },
              { role: "user", content: `${request.prompt}\n\nReturn a JSON object.` },
            ],
            response_format: { type: "json_object" },
            temperature: modelConfig.temperature ?? 0.1,
            max_tokens: modelConfig.maxTokens ?? 4096,
          } as any);

          const content = chatResponse.choices?.[0]?.message?.content;
          if (!content) {
            throw new Error("No content in chat completion response");
          }

          const parsed = JSON.parse(content);
          const validated = request.schema.parse(parsed);

          const latencyMs = Date.now() - startTime;
          const usage = (chatResponse as any).usage;

          return {
            data: validated,
            metadata: {
              model: effectiveModel,
              provider: modelConfig.provider,
              tokensUsed: usage
                ? {
                    prompt: usage.prompt_tokens,
                    completion: usage.completion_tokens,
                    total: usage.total_tokens,
                  }
                : undefined,
              cost: usage
                ? this.router.estimateCost(
                    modelConfig.provider,
                    usage.prompt_tokens,
                    usage.completion_tokens
                  )
                : undefined,
              latencyMs,
              finishReason: chatResponse.choices?.[0]?.finish_reason,
            },
          };
        }

        // Default: use OpenAI Responses API
        const requestInput = [
          {
            role: "user" as const,
            content: [{ type: "input_text" as const, text: request.prompt }],
          },
        ] satisfies ResponseCreateParamsBase["input"];

        const textConfig = {
          format: {
            type: "json_schema" as const,
            name: "response_schema",
            schema: jsonSchema,
            strict: true,
          },
        } satisfies ResponseCreateParamsBase["text"];

        const resp = await this.openai.responses.create({
          model: effectiveModel,
          input: requestInput,
          text: textConfig,
          temperature: modelConfig.temperature ?? 0.1,
          max_output_tokens: modelConfig.maxTokens ?? 4096,
        });

        const output = resp.output_text;
        if (!output) {
          throw new Error("No content in response");
        }

        const parsed = JSON.parse(output);
        const validated = request.schema.parse(parsed);

        const latencyMs = Date.now() - startTime;
        const tokensUsed = resp.usage;

        return {
          data: validated,
          metadata: {
            model: effectiveModel,
            provider: modelConfig.provider,
            tokensUsed: tokensUsed
              ? {
                  prompt: tokensUsed.input_tokens,
                  completion: tokensUsed.output_tokens,
                  total: tokensUsed.total_tokens,
                }
              : undefined,
            cost: tokensUsed
              ? this.router.estimateCost(
                  modelConfig.provider,
                  tokensUsed.input_tokens,
                  tokensUsed.output_tokens
                )
              : undefined,
            latencyMs,
            finishReason: resp.status,
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
    const isAzure = Boolean(process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_DEPLOYMENT);

    const jsonSchema = zodToJsonSchema(schema, {
      name: "Response",
      $refStrategy: "none",
    }) as Record<string, unknown>;

    const effectiveModel = process.env.AZURE_OPENAI_DEPLOYMENT ?? config.model;

    if (isAzure) {
      const chatResponse = await this.openai.chat.completions.create({
        model: effectiveModel,
        messages: [
          {
            role: "system",
            content:
              "You are a structured extraction assistant. Respond with a valid JSON object only. Do not include any text outside JSON.",
          },
          ...messages.map((m) => ({ role: m.role, content: `${m.content}\n\nReturn a JSON object.` })),
        ],
        response_format: { type: "json_object" },
        temperature: config.temperature ?? 0.1,
        max_tokens: config.maxTokens ?? 4096,
      } as any);

      const content = chatResponse.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("No content in chat completion response");
      }

      const parsed = JSON.parse(content);
      const validated = schema.parse(parsed);

      const latencyMs = Date.now() - startTime;
      const usage = (chatResponse as any).usage;

      return {
        data: validated,
        metadata: {
          model: effectiveModel,
          provider: config.provider,
          tokensUsed: usage
            ? {
                prompt: usage.prompt_tokens,
                completion: usage.completion_tokens,
                total: usage.total_tokens,
              }
            : undefined,
          cost: usage
            ? this.router.estimateCost(
                config.provider,
                usage.prompt_tokens,
                usage.completion_tokens
              )
            : undefined,
          latencyMs,
          finishReason: chatResponse.choices?.[0]?.finish_reason,
        },
      };
    }

    const chatInput = messages.map((message) => ({
      role: message.role,
      content: [{ type: "input_text" as const, text: message.content }],
    })) satisfies ResponseCreateParamsBase["input"];

    const textConfig = {
      format: {
        type: "json_schema" as const,
        name: "response_schema",
        schema: jsonSchema,
        strict: true,
      },
    } satisfies ResponseCreateParamsBase["text"];

    const response = await this.openai.responses.create({
      model: effectiveModel,
      input: chatInput,
      text: textConfig,
      temperature: config.temperature ?? 0.1,
      max_output_tokens: config.maxTokens ?? 4096,
    });

    const content = response.output_text;
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
        model: effectiveModel,
        provider: config.provider,
        tokensUsed: tokensUsed
          ? {
              prompt: tokensUsed.input_tokens,
              completion: tokensUsed.output_tokens,
              total: tokensUsed.total_tokens,
            }
          : undefined,
        cost: tokensUsed
          ? this.router.estimateCost(
              config.provider,
              tokensUsed.input_tokens,
              tokensUsed.output_tokens
            )
          : undefined,
        latencyMs,
        finishReason: response.status,
      },
    };
  }
}
