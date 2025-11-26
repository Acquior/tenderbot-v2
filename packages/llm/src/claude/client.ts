/**
 * Claude Sonnet 4.5 client for tender document analysis
 *
 * Features:
 * - Azure AI Foundry integration (Anthropic API format)
 * - Structured JSON output via prompt engineering
 * - Automatic retry and error handling
 */

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  ClaudeConfig,
  DEFAULT_THINKING_CONFIG,
  EXTENDED_THINKING_THRESHOLD,
} from "./config";

/**
 * Options for structured output generation
 */
export interface ClaudeStructuredOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

/**
 * Options for analysis with extended thinking
 */
export interface ClaudeThinkingOptions extends ClaudeStructuredOptions {
  thinkingBudgetTokens?: number;
}

/**
 * Response from Claude with metadata
 */
export interface ClaudeResponse<T> {
  data: T;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  thinkingContent?: string;
  latencyMs: number;
  model: string;
}

/**
 * Anthropic API response format (used by Azure AI Foundry)
 */
interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Streaming event types from Anthropic API
 */
interface StreamEvent {
  type: string;
  message?: AnthropicResponse;
  index?: number;
  content_block?: { type: string; text: string };
  delta?: { type: string; text?: string; stop_reason?: string };
  usage?: { output_tokens: number };
}

/**
 * Claude client for structured tender analysis via Azure AI Foundry
 *
 * Azure exposes Claude through the Anthropic messages API format
 */
export class ClaudeClient {
  private endpoint: string;
  private apiKey: string;
  private model: string;

  constructor(config: ClaudeConfig) {
    // The endpoint should be the full path to the messages API
    // e.g., https://xxx.services.ai.azure.com/anthropic/v1/messages
    this.endpoint = config.baseURL;
    this.apiKey = config.apiKey;
    this.model = config.deploymentName;
  }

  /**
   * Generate structured output using Azure's Anthropic API
   */
  async generateStructured<T extends z.ZodType>(
    prompt: string,
    schema: T,
    options: ClaudeStructuredOptions = {}
  ): Promise<ClaudeResponse<z.infer<T>>> {
    const startTime = Date.now();

    // Convert Zod schema to JSON Schema for the prompt
    const jsonSchema = zodToJsonSchema(schema, {
      name: "TenderAnalysis",
      $refStrategy: "none",
      target: "jsonSchema7",
    });

    // Build the enhanced prompt with JSON schema instructions
    const systemPrompt = options.systemPrompt || "";
    const enhancedSystemPrompt = `${systemPrompt}

CRITICAL OUTPUT FORMAT INSTRUCTIONS:
You MUST respond with a valid JSON object that matches this exact schema:
${JSON.stringify(jsonSchema, null, 2)}

Rules:
1. Output ONLY the JSON object - no markdown code blocks, no explanations, no additional text
2. Ensure all required fields are present
3. Use null for optional fields if data is not found
4. All dates must be Unix epoch milliseconds (numbers)
5. Do not invent or hallucinate information - if not found in the documents, use null`;

    const response = await this.callAnthropicAPI(
      enhancedSystemPrompt,
      prompt,
      {
        maxTokens: options.maxTokens || 16384,
        temperature: options.temperature ?? 0.1,
      }
    );

    // Use safe JSON parsing with repair for LLM outputs
    const content = response.content[0]?.text || "";
    const parsed = this.parseJsonSafe(content);
    const validated = schema.parse(parsed);

    return {
      data: validated,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      latencyMs: Date.now() - startTime,
      model: response.model || this.model,
    };
  }

  /**
   * Analyze with extended context for complex multi-document bundles
   * Uses streaming to avoid Azure gateway timeouts on large documents
   */
  async analyzeWithThinking<T extends z.ZodType>(
    prompt: string,
    schema: T,
    options: ClaudeThinkingOptions = {}
  ): Promise<ClaudeResponse<z.infer<T>>> {
    const startTime = Date.now();

    const jsonSchema = zodToJsonSchema(schema, {
      name: "TenderAnalysis",
      $refStrategy: "none",
      target: "jsonSchema7",
    });

    // Enhanced system prompt that encourages thorough analysis
    const baseSystemPrompt = options.systemPrompt || "";
    const enhancedSystemPrompt = `${baseSystemPrompt}

ANALYSIS APPROACH:
Before generating your response, mentally work through:
1. Read through ALL documents completely from start to finish
2. Identify every section that contains required documents, compliance requirements, or submission instructions
3. Cross-reference requirements across different sections to ensure nothing is missed
4. Note exact page numbers and quotes for citations
5. Only after thorough review, generate the structured output

CRITICAL OUTPUT FORMAT INSTRUCTIONS:
You MUST respond with a valid JSON object that matches this exact schema:
${JSON.stringify(jsonSchema, null, 2)}

Rules:
1. Output ONLY the JSON object - no markdown code blocks, no explanations
2. Ensure all required fields are present
3. Use null for optional fields if data is not found
4. All dates must be Unix epoch milliseconds (numbers)
5. Do not invent information - use null if not found
6. Include page numbers and exact quotes in citations where possible`;

    // Try non-streaming first (simpler, works better in serverless environments like Convex)
    // Fall back to streaming only if we get a 408 timeout error
    console.log(`[ClaudeClient] Starting extended analysis...`);

    let response: AnthropicResponse;
    try {
      response = await this.callAnthropicAPI(
        enhancedSystemPrompt,
        prompt,
        {
          maxTokens: options.maxTokens || 32768,
          temperature: options.temperature ?? 0.2,
        }
      );
    } catch (error) {
      // Check if it's a timeout error (408) - if so, try streaming
      const isTimeoutError = error instanceof Error &&
        (error.message.includes('408') || error.message.includes('timeout') || error.message.includes('Timeout'));

      if (isTimeoutError) {
        console.log(`[ClaudeClient] Non-streaming timed out, falling back to streaming...`);
        response = await this.callAnthropicAPIStreaming(
          enhancedSystemPrompt,
          prompt,
          {
            maxTokens: options.maxTokens || 32768,
            temperature: options.temperature ?? 0.2,
          }
        );
      } else {
        throw error;
      }
    }

    const content = response.content[0]?.text || "";

    // Use safe JSON parsing with repair for LLM outputs
    const parsed = this.parseJsonSafe(content);
    const validated = schema.parse(parsed);

    return {
      data: validated,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      thinkingContent: undefined,
      latencyMs: Date.now() - startTime,
      model: response.model || this.model,
    };
  }

  /**
   * Determine if extended thinking should be used based on document complexity
   */
  shouldUseExtendedThinking(documentCount: number, totalPages: number): boolean {
    return (
      documentCount >= EXTENDED_THINKING_THRESHOLD.documentCount ||
      totalPages >= EXTENDED_THINKING_THRESHOLD.pageCount
    );
  }

  /**
   * Smart analysis that automatically chooses between regular and extended analysis
   */
  async analyze<T extends z.ZodType>(
    prompt: string,
    schema: T,
    documentCount: number,
    totalPages: number,
    options: ClaudeThinkingOptions = {}
  ): Promise<ClaudeResponse<z.infer<T>>> {
    const useThinking = this.shouldUseExtendedThinking(documentCount, totalPages);

    console.log(
      `[ClaudeClient] Analyzing ${documentCount} documents, ${totalPages} pages. Deep analysis: ${useThinking}`
    );

    if (useThinking) {
      return this.analyzeWithThinking(prompt, schema, options);
    }

    return this.generateStructured(prompt, schema, options);
  }

  /**
   * Call Azure's Anthropic API (messages format)
   */
  private async callAnthropicAPI(
    systemPrompt: string,
    userPrompt: string,
    options: { maxTokens: number; temperature: number }
  ): Promise<AnthropicResponse> {
    // Build the full endpoint URL
    // If endpoint ends with /anthropic/ or /anthropic, append v1/messages
    // If endpoint already includes /v1/messages, use as-is
    let fullEndpoint = this.endpoint;
    if (!fullEndpoint.includes('/v1/messages')) {
      fullEndpoint = fullEndpoint.replace(/\/$/, '') + '/v1/messages';
    }

    console.log(`[ClaudeClient] Calling endpoint: ${fullEndpoint.substring(0, 60)}...`);

    const requestBody = {
      model: this.model,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    };

    // Set a generous timeout for large document analysis (10 minutes)
    // Large tenders (50+ pages) can take several minutes to process
    const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      // Azure Foundry uses x-api-key header (Anthropic standard), not api-key (Azure OpenAI style)
      const response = await fetch(fullEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ClaudeClient] API error ${response.status}: ${errorText}`);
        throw new Error(`Claude API error ${response.status}: ${errorText}`);
      }

      const data = await response.json() as AnthropicResponse;
      console.log(`[ClaudeClient] Success! Tokens: ${data.usage.input_tokens} in, ${data.usage.output_tokens} out`);
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Claude API request timed out after ${TIMEOUT_MS / 1000} seconds. The document may be too large.`);
      }
      throw error;
    }
  }

  /**
   * Call Azure's Anthropic API with streaming (for large documents)
   * Streaming helps avoid gateway timeouts by keeping the connection alive
   */
  private async callAnthropicAPIStreaming(
    systemPrompt: string,
    userPrompt: string,
    options: { maxTokens: number; temperature: number }
  ): Promise<AnthropicResponse> {
    let fullEndpoint = this.endpoint;
    if (!fullEndpoint.includes('/v1/messages')) {
      fullEndpoint = fullEndpoint.replace(/\/$/, '') + '/v1/messages';
    }

    console.log(`[ClaudeClient] Calling endpoint (streaming): ${fullEndpoint.substring(0, 60)}...`);

    const requestBody = {
      model: this.model,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      stream: true,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    };

    // Longer timeout for streaming - 15 minutes
    const TIMEOUT_MS = 15 * 60 * 1000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(fullEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ClaudeClient] API error ${response.status}: ${errorText}`);
        throw new Error(`Claude API error ${response.status}: ${errorText}`);
      }

      // Parse SSE stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body reader available");
      }

      const decoder = new TextDecoder();
      let fullText = "";
      let inputTokens = 0;
      let outputTokens = 0;
      let model = this.model;
      let buffer = "";
      let chunkCount = 0;
      let lastProgressLog = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunkCount++;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;

            try {
              const event = JSON.parse(data) as StreamEvent;

              if (event.type === "message_start" && event.message) {
                model = event.message.model || this.model;
                inputTokens = event.message.usage?.input_tokens || 0;
                console.log(`[ClaudeClient] Stream started. Input tokens: ${inputTokens}`);
              } else if (event.type === "content_block_delta" && event.delta?.text) {
                fullText += event.delta.text;
              } else if (event.type === "message_delta" && event.usage) {
                outputTokens = event.usage.output_tokens || 0;
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        }

        // Log progress every 10 seconds
        const now = Date.now();
        if (now - lastProgressLog > 10000) {
          console.log(`[ClaudeClient] Streaming progress: ${chunkCount} chunks, ${fullText.length} chars received...`);
          lastProgressLog = now;
        }
      }

      console.log(`[ClaudeClient] Streaming complete! Chunks: ${chunkCount}, Output chars: ${fullText.length}, Tokens: ${inputTokens} in, ${outputTokens} out`);

      return {
        id: "stream-response",
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: fullText }],
        model,
        stop_reason: "end_turn",
        usage: {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
        },
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Claude API streaming request timed out after ${TIMEOUT_MS / 1000} seconds.`);
      }
      throw error;
    }
  }

  /**
   * Extract JSON from response text
   * Handles markdown code blocks and other formatting
   */
  private extractJson(text: string): string {
    let jsonText = text.trim();

    // Remove markdown code blocks
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith("```")) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    // Find JSON object boundaries
    const firstBrace = jsonText.indexOf("{");
    const lastBrace = jsonText.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonText = jsonText.slice(firstBrace, lastBrace + 1);
    }

    return jsonText;
  }

  /**
   * Attempt to repair truncated or malformed JSON from LLM responses
   * Common issues: missing closing brackets, trailing commas, truncated strings
   */
  private repairJson(text: string): string {
    let json = text.trim();

    // Track bracket depth to find where to close
    let braceDepth = 0;
    let bracketDepth = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < json.length; i++) {
      const char = json[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === "\\") {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === "{") {
        braceDepth++;
      } else if (char === "}") {
        braceDepth--;
      } else if (char === "[") {
        bracketDepth++;
      } else if (char === "]") {
        bracketDepth--;
      }
    }

    // If we're still in a string, close it
    if (inString) {
      json += '"';
    }

    // Remove trailing commas before closing brackets
    json = json.replace(/,(\s*[\]}])/g, "$1");
    json = json.replace(/,\s*$/, "");

    // Close any unclosed brackets/braces
    while (bracketDepth > 0) {
      json += "]";
      bracketDepth--;
    }
    while (braceDepth > 0) {
      json += "}";
      braceDepth--;
    }

    return json;
  }

  /**
   * Parse JSON with automatic repair for LLM outputs
   */
  private parseJsonSafe(text: string): unknown {
    const jsonText = this.extractJson(text);

    // First try normal parsing
    try {
      return JSON.parse(jsonText);
    } catch (firstError) {
      console.warn(`[ClaudeClient] Initial JSON parse failed, attempting repair...`);

      // Try to repair and parse again
      try {
        const repairedJson = this.repairJson(jsonText);
        console.log(`[ClaudeClient] Repaired JSON (last 200 chars): ...${repairedJson.slice(-200)}`);
        return JSON.parse(repairedJson);
      } catch (repairError) {
        // Log the problematic area for debugging
        const errorMatch = (firstError as Error).message.match(/position (\d+)/);
        if (errorMatch) {
          const pos = parseInt(errorMatch[1], 10);
          const start = Math.max(0, pos - 100);
          const end = Math.min(jsonText.length, pos + 100);
          console.error(`[ClaudeClient] JSON error near position ${pos}:`);
          console.error(`[ClaudeClient] Context: ...${jsonText.slice(start, end)}...`);
        }
        throw firstError;
      }
    }
  }
}
