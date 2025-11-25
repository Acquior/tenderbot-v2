import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGeminiConfig, DEFAULT_CHUNKING_CONFIG } from "./config";

/**
 * Gemini client singleton
 */
let geminiClient: GoogleGenerativeAI | null = null;

/**
 * Get or create Gemini client instance
 */
export function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    const config = getGeminiConfig();
    geminiClient = new GoogleGenerativeAI(config.apiKey);
  }
  return geminiClient;
}

/**
 * Get Gemini model instance
 */
export function getGeminiModel(modelName?: string) {
  const client = getGeminiClient();
  const config = getGeminiConfig();
  return client.getGenerativeModel({
    model: modelName || config.model || "gemini-2.0-flash-exp",
  });
}

/**
 * REST API client for File Search (until SDK adds support)
 */
class FileSearchRestClient {
  private apiKey: string;
  private baseUrl = "https://generativelanguage.googleapis.com/v1beta";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}?key=${this.apiKey}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({ error: { message: response.statusText } }))) as {
        error?: { message?: string };
      };
      throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Create a File Search store
   */
  async createStore(displayName: string): Promise<{ name: string }> {
    return this.request<{ name: string }>("/fileSearchStores", {
      method: "POST",
      body: JSON.stringify({
        displayName,
      }),
    });
  }

  /**
   * Upload file to File Search store
   * Uses Google's resumable upload protocol
   */
  async uploadFile(
    file: File | Buffer | Uint8Array,
    storeName: string,
    options: {
      displayName?: string;
      customMetadata?: Array<{ key: string; stringValue?: string; numericValue?: number }>;
      chunkingConfig?: {
        maxTokensPerChunk?: number;
        maxOverlapTokens?: number;
      };
    }
  ): Promise<{ name: string }> {
    // Handle different file types and convert to Uint8Array
    let fileData: Uint8Array;
    let mimeType: string;
    
    if (file instanceof File) {
      const arrayBuffer = await file.arrayBuffer();
      fileData = new Uint8Array(arrayBuffer);
      mimeType = file.type || "application/pdf";
    } else if (Buffer.isBuffer(file)) {
      fileData = new Uint8Array(file);
      mimeType = "application/pdf";
    } else {
      fileData = file;
      mimeType = "application/pdf";
    }

    const displayName = options.displayName || "document.pdf";
    const numBytes = fileData.length;

    // Step 1: Start resumable upload session
    const startUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${this.apiKey}`;
    
    const startResponse = await fetch(startUrl, {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(numBytes),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file: {
          displayName,
        },
      }),
    });

    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      console.error("Failed to start upload:", errorText);
      throw new Error(`Failed to start upload: ${startResponse.status} - ${errorText}`);
    }

    // Get the upload URL from the response header
    const uploadUrl = startResponse.headers.get("X-Goog-Upload-URL");
    if (!uploadUrl) {
      // Try reading the response to see if there's useful info
      const responseText = await startResponse.text().catch(() => "");
      console.error("Start upload response:", responseText);
      throw new Error("No upload URL returned from start request");
    }

    // Step 2: Upload the file data
    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "X-Goog-Upload-Command": "upload, finalize",
        "X-Goog-Upload-Offset": "0",
        "Content-Length": String(numBytes),
      },
      body: fileData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("Failed to upload file data:", errorText);
      throw new Error(`Failed to upload file data: ${uploadResponse.status} - ${errorText}`);
    }

    const uploadResult = (await uploadResponse.json()) as { 
      file?: { name?: string; uri?: string };
      name?: string;
      uri?: string;
    };
    
    const fileInfo = uploadResult.file || uploadResult;
    const fileName = fileInfo.name;

    if (!fileName) {
      console.error("Upload response:", JSON.stringify(uploadResult));
      throw new Error("File upload did not return a file name");
    }

    console.log(`[Gemini Files API] Successfully uploaded file: ${fileName}`);

    // Now import the file into the File Search store
    const chunkingConfig = options.chunkingConfig || DEFAULT_CHUNKING_CONFIG;
    const importUrl = `${this.baseUrl}/${storeName}:importFile?key=${this.apiKey}`;
    
    const importResponse = await fetch(importUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName,
        customMetadata: options.customMetadata || [],
        chunkingConfig: {
          whiteSpaceConfig: {
            maxTokensPerChunk: chunkingConfig.maxTokensPerChunk || 512,
            maxOverlapTokens: chunkingConfig.maxOverlapTokens || 50,
          },
        },
      }),
    });

    if (!importResponse.ok) {
      const error = (await importResponse.json().catch(() => ({ error: { message: importResponse.statusText } }))) as {
        error?: { message?: string };
      };
      throw new Error(`File Search import error: ${error.error?.message || importResponse.statusText}`);
    }

    const importResult = (await importResponse.json()) as { name?: string };
    return {
      name: importResult.name || fileName,
    };
  }
}

/**
 * File Search store operations
 * Uses REST API directly until SDK adds File Search support
 */
interface FileSearchStoreOptions {
  storeResourceName?: string;
  displayName?: string;
}

export class FileSearchStore {
  private restClient: FileSearchRestClient;
  private storeDisplayName: string;
  private storeResourceName?: string;
  private config: ReturnType<typeof getGeminiConfig>;

  constructor(options?: FileSearchStoreOptions) {
    this.config = getGeminiConfig();
    this.restClient = new FileSearchRestClient(this.config.apiKey);
    this.storeDisplayName = options?.displayName || this.config.fileSearchStoreName || "tenderbot-documents";
    this.storeResourceName = options?.storeResourceName;
  }

  /**
   * Get or create File Search store
   * Returns the store resource name (e.g., "fileSearchStores/abc123")
   * Note: Store name should be persisted in Convex config after first creation
   */
  async getOrCreateStore(): Promise<string> {
    if (this.storeResourceName) {
      return this.storeResourceName;
    }

    try {
      const store = await this.restClient.createStore(this.storeDisplayName);
      this.storeResourceName = store.name;
      return store.name;
    } catch (error) {
      throw new Error(
        `Failed to create File Search store: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Upload file to File Search store
   * @param file - File, Buffer, or Uint8Array to upload
   * @param options - Upload options including metadata and chunking config
   * @returns File resource name and operation details
   */
  async uploadFile(
    file: File | Buffer | Uint8Array,
    options: {
      displayName?: string;
      customMetadata?: Array<{ key: string; stringValue?: string; numericValue?: number }>;
      chunkingConfig?: {
        maxTokensPerChunk?: number;
        maxOverlapTokens?: number;
      };
    }
  ): Promise<{ fileResourceName: string; operation: any }> {
    const storeName = await this.getOrCreateStore();

    // Upload file using REST API
    const result = await this.restClient.uploadFile(file, storeName, options);

    return {
      fileResourceName: result.name,
      operation: result,
    };
  }
}

/**
 * Query with File Search
 */
export interface FileSearchQueryOptions {
  prompt: string;
  systemInstructions?: string;
  fileSearchStoreNames: string[];
  metadataFilter?: string;
  model?: string;
  responseMimeType?: string;
}

export interface FileSearchQueryResult {
  text: string;
  citations?: Array<{
    fileUri?: string;
    chunkIndex?: number;
  }>;
  groundingMetadata?: any;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

/**
 * Query Gemini with File Search tool
 * Uses REST API directly until SDK adds File Search support
 */
export async function queryWithFileSearch(
  options: FileSearchQueryOptions
): Promise<FileSearchQueryResult> {
  const config = getGeminiConfig();
  const modelName = options.model || config.model || "gemini-2.0-flash-exp";
  
  // Build the request payload
  const contents: any[] = [];
  
  if (options.systemInstructions) {
    contents.push({
      role: "user",
      parts: [{ text: options.systemInstructions }],
    });
  }
  
  contents.push({
    role: "user",
    parts: [{ text: options.prompt }],
  });

  const requestBody: any = {
    contents,
    tools: [
      {
        fileSearch: {
          fileSearchStoreNames: options.fileSearchStoreNames,
          metadataFilter: options.metadataFilter,
        },
      },
    ],
  };

  if (options.responseMimeType) {
    requestBody.generationConfig = {
      responseMimeType: options.responseMimeType,
    };
  }

  // Make REST API call
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${config.apiKey}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({ error: { message: response.statusText } }))) as {
      error?: { message?: string };
    };
    throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`);
  }

  const result = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
      groundingMetadata?: {
        groundingChunks?: Array<{
          file?: { uri?: string };
          chunkIndex?: number;
        }>;
      };
    }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
  };
  
  // Extract text from response
  const candidate = result.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text || "";

  // Extract citations from grounding metadata
  const groundingMetadata = candidate?.groundingMetadata;
  const citations = groundingMetadata?.groundingChunks?.map((chunk) => ({
    fileUri: chunk.file?.uri,
    chunkIndex: chunk.chunkIndex,
  }));

  return {
    text,
    citations,
    groundingMetadata,
    usageMetadata: result.usageMetadata,
  };
}

