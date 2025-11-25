"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

type ChatResponse = {
  answer: string;
  citations: Array<{ fileUri?: string; chunkIndex?: number }>;
  groundingMetadata: unknown;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

export const ask = action({
  args: {
    question: v.string(),
    bundleId: v.optional(v.id("bundles")),
    documentId: v.optional(v.id("documents")),
  },
  handler: async (ctx, args): Promise<ChatResponse> => {
    const question = args.question.trim();
    if (!question) {
      throw new Error("Question cannot be empty");
    }

    const identity = await ctx.runQuery(internal.auth.getCurrentUser);
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Internal tool - no organization filtering needed

    const systemInstructions = [
      "You are TenderBot, a precise tender analyst.",
      "Answer questions strictly using the provided documents via File Search.",
      "Whenever possible reference the source material with short inline citations like [1], [2].",
      "Prioritize clarity, factual accuracy, and concise bullet points.",
    ].join(" ");

    const prompt = [
      `Question: ${question}`,
      "",
      "Instructions:",
      "- Provide a direct answer first.",
      "- Include up to 3 supporting bullet points when helpful.",
      "- Reference the source materials with inline citations.",
      "- If the answer is unknown, say so explicitly.",
    ].join("\n");

    const model =
      process.env.GEMINI_CHAT_MODEL ??
      process.env.GEMINI_MODEL ??
      "gemini-2.0-flash-exp";

    const response = await ctx.runAction(
      internal.geminiFileSearch.queryWithFileSearchInternal,
      {
        prompt,
        systemInstructions,
        bundleId: args.bundleId,
        documentId: args.documentId,
        model,
      }
    );

    return {
      answer: response.text,
      citations: response.citations ?? [],
      groundingMetadata: response.groundingMetadata,
      usageMetadata: response.usageMetadata,
    };
  },
});

