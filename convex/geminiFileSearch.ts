"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import {
  FileSearchStore,
  queryWithFileSearch,
  FileSearchQueryOptions,
  FileSearchQueryResult,
} from "@tenderbot/llm";

type UploadResult = {
  fileResourceName: string;
  operation: unknown;
};

/**
 * Get or create File Search store and persist the name
 * This is idempotent - if store name exists in config, returns it
 */
export const getOrCreateFileSearchStore = internalAction({
  args: {},
  handler: async (ctx): Promise<string> => {
    // Check if we already have a store name in config
    const existingStoreName = await ctx.runQuery(internal.geminiStore.getStoreName);
    if (existingStoreName) {
      return existingStoreName;
    }

    // Create new store and persist
    const fileSearchStore = new FileSearchStore();
    const storeName = await fileSearchStore.getOrCreateStore();

    await ctx.runMutation(internal.geminiStore.setStoreName, {
      storeName,
    });

    return storeName;
  },
});

/**
 * Upload file to Gemini File Search store
 */
export const uploadFileToGeminiStore = internalAction({
  args: {
    documentId: v.id("documents"),
    bundleId: v.optional(v.id("bundles")),
    organizationId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<UploadResult> => {
    // Get document
    const document = (await ctx.runQuery(internal.documents.getInternal, {
      documentId: args.documentId,
    })) as Doc<"documents"> | null;

    if (!document) {
      throw new Error(`Document ${args.documentId} not found`);
    }

    // Get file from storage
    const fileUrl = await ctx.storage.getUrl(document.storageId);
    if (!fileUrl) {
      throw new Error(`Failed to get storage URL for document ${args.documentId}`);
    }

    // Fetch file
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    const fileBuffer = await response.arrayBuffer();
    const fileData = new Uint8Array(fileBuffer);

    // Ensure File Search store exists
    const storeName =
      (await ctx.runQuery(internal.geminiStore.getStoreName)) ??
      (await ctx.runAction(internal.geminiFileSearch.getOrCreateFileSearchStore, {}));

    // Build metadata
    const customMetadata: Array<{ key: string; stringValue?: string; numericValue?: number }> = [
      { key: "documentId", stringValue: args.documentId },
    ];

    if (args.bundleId) {
      customMetadata.push({ key: "bundleId", stringValue: args.bundleId });
    }

    if (args.organizationId) {
      customMetadata.push({ key: "organizationId", stringValue: args.organizationId });
    }

    customMetadata.push({
      key: "uploadedAt",
      numericValue: Date.now(),
    });

    // Upload to File Search store
    const fileSearchStore = new FileSearchStore({ storeResourceName: storeName });
    const result = await fileSearchStore.uploadFile(fileData, {
      displayName: document.filename,
      customMetadata,
    });

    // Update document with Gemini file resource name
    await ctx.runMutation(internal.documents.updateGeminiMetadata, {
      documentId: args.documentId,
      geminiFileResourceName: result.fileResourceName,
    });

    return {
      fileResourceName: result.fileResourceName,
      operation: result.operation,
    };
  },
});

/**
 * Query with File Search
 */
export const queryWithFileSearchInternal = internalAction({
  args: {
    prompt: v.string(),
    systemInstructions: v.optional(v.string()),
    organizationId: v.optional(v.string()),
    bundleId: v.optional(v.id("bundles")),
    documentId: v.optional(v.id("documents")),
    model: v.optional(v.string()),
    responseMimeType: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<FileSearchQueryResult> => {
    // Get store name
    const storeName =
      (await ctx.runQuery(internal.geminiStore.getStoreName)) ??
      (await ctx.runAction(internal.geminiFileSearch.getOrCreateFileSearchStore, {}));

    // Build metadata filter
    let metadataFilter: string | undefined;
    const filters: string[] = [];

    if (args.organizationId) {
      filters.push(`organizationId='${args.organizationId}'`);
    }

    if (args.bundleId) {
      filters.push(`bundleId='${args.bundleId}'`);
    }

    if (args.documentId) {
      filters.push(`documentId='${args.documentId}'`);
    }

    if (filters.length > 0) {
      metadataFilter = filters.join(" AND ");
    }

    // Query with File Search
    const result = await queryWithFileSearch({
      prompt: args.prompt,
      systemInstructions: args.systemInstructions,
      fileSearchStoreNames: [storeName],
      metadataFilter,
      model: args.model,
      responseMimeType: args.responseMimeType,
    });

    return result;
  },
});


