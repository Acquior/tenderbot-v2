import { CohereClient } from "cohere-ai";

/**
 * Embedding generation client
 */
export class EmbeddingClient {
  private cohere: CohereClient;
  private model: string;

  constructor(apiKey: string, model: string = "embed-english-v4.0") {
    this.cohere = new CohereClient({ token: apiKey });
    this.model = model;
  }

  /**
   * Generate embeddings for text chunks
   */
  async embed(texts: string[], inputType: "search_document" | "search_query" = "search_document"): Promise<number[][]> {
    try {
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
