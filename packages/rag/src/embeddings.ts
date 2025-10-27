import { CohereClient } from "cohere-ai";

/**
 * Embedding generation client
 */
export class EmbeddingClient {
  private cohere?: CohereClient;
  private apiKey: string;
  private model: string;
  private azureEndpoint?: string;
  private azureApiVersion?: string;

  constructor(apiKey: string, model: string = "embed-english-v4.0") {
    this.apiKey = apiKey;
    this.model = model;

    const endpoint = process.env.AZURE_COHERE_ENDPOINT;
    if (endpoint) {
      this.azureEndpoint = endpoint.replace(/\/+$/, "");
      this.azureApiVersion = process.env.AZURE_COHERE_API_VERSION ?? "2024-08-01-preview";
    } else {
      this.cohere = new CohereClient({ token: apiKey });
    }
  }

  /**
   * Generate embeddings for text chunks
   */
  async embed(texts: string[], inputType: "search_document" | "search_query" = "search_document"): Promise<number[][]> {
    try {
      if (this.azureEndpoint) {
        return await this.embedViaAzure(texts, inputType);
      }

      if (!this.cohere) {
        throw new Error("Cohere client not initialised");
      }

      const response = await this.cohere.embed({
        texts,
        model: this.model,
        inputType,
        embeddingTypes: ["float"],
      });

      const vectorData = Array.isArray(response.embeddings)
        ? response.embeddings
        : response.embeddings?.float;

      return vectorData ?? [];
    } catch (error) {
      console.error("Error generating embeddings:", error);
      throw new Error(`Failed to generate embeddings: ${(error as Error).message}`);
    }
  }

  /**
   * Generate a single embedding
   */
  async embedOne(text: string, inputType: "search_document" | "search_query" = "search_document"): Promise<number[]> {
    const embeddings = await this.embed([text], inputType);
    return embeddings[0] ?? [];
  }

  /**
   * Batch embed with rate limiting
   */
  async embedBatch(
    texts: string[],
    batchSize: number = 96,
    inputType: "search_document" | "search_query" = "search_document"
  ): Promise<number[][]> {
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const embeddings = await this.embed(batch, inputType);
      results.push(...embeddings);

      // Rate limiting delay
      if (i + batchSize < texts.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  private async embedViaAzure(
    texts: string[],
    inputType: "search_document" | "search_query"
  ): Promise<number[][]> {
    if (!this.azureEndpoint) {
      throw new Error("AZURE_COHERE_ENDPOINT not configured");
    }

    if (!this.apiKey) {
      throw new Error("Azure Cohere API key missing");
    }

    const apiVersion = this.azureApiVersion ?? "2024-08-01-preview";
    const separator = this.azureEndpoint.includes("?") ? "&" : "?";
    const url = `${this.azureEndpoint}${separator}api-version=${apiVersion}`;

    const mappedInputType = inputType === "search_query" ? "query" : "document";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": this.apiKey,
      },
      body: JSON.stringify({
        input: texts,
        input_type: mappedInputType,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Azure Cohere embedding request failed: ${response.status} ${errorBody}`);
    }

    const data = (await response.json()) as any;
    let embeddings: number[][] = [];

    if (Array.isArray(data?.embeddings?.float)) {
      embeddings = data.embeddings.float;
    } else if (Array.isArray(data?.embeddings)) {
      embeddings = data.embeddings;
    } else if (Array.isArray(data?.data)) {
      embeddings = data.data.map((item: any) => item?.embedding ?? item?.embeddings?.float ?? item?.embeddings);
    }

    const cleaned = (embeddings || []).filter((vector) => Array.isArray(vector)) as number[][];

    if (cleaned.length === 0) {
      throw new Error("Azure Cohere embedding response did not include embeddings");
    }

    return cleaned;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Vectors must have the same length");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
