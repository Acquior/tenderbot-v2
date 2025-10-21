import { CohereClient } from "cohere-ai";
import { RetrievalResult } from "./retrieval";

/**
 * Reranking client using Cohere Rerank
 */
export class RerankClient {
  private cohere: CohereClient;
  private model: string;

  constructor(apiKey: string, model: string = "rerank-v3.5") {
    this.cohere = new CohereClient({ token: apiKey });
    this.model = model;
  }

  /**
   * Rerank search results
   */
  async rerank(
    query: string,
    results: RetrievalResult[],
    topK?: number
  ): Promise<RetrievalResult[]> {
    try {
      // Cohere rerank has a context length limit (~4k tokens per document)
      // Truncate long documents to fit
      const documents = results.map((r) => this.truncateText(r.text, 4000));

      const response = await this.cohere.rerank({
        query,
        documents,
        model: this.model,
        topN: topK ?? results.length,
        returnDocuments: false,
      });

      // Map reranked results back to original
      return response.results.map((ranked) => ({
        ...results[ranked.index],
        score: ranked.relevanceScore,
      }));
    } catch (error) {
      console.error("Error reranking:", error);
      // Fallback to original results on error
      return results;
    }
  }

  /**
   * Truncate text to approximate character limit
   */
  private truncateText(text: string, maxChars: number): string {
    if (text.length <= maxChars) {
      return text;
    }

    // Truncate and try to end at a sentence
    const truncated = text.slice(0, maxChars);
    const lastPeriod = truncated.lastIndexOf(".");

    if (lastPeriod > maxChars * 0.8) {
      return truncated.slice(0, lastPeriod + 1);
    }

    return truncated + "...";
  }

  /**
   * Batch rerank with rate limiting
   */
  async rerankBatch(
    queries: string[],
    resultSets: RetrievalResult[][],
    topK?: number
  ): Promise<RetrievalResult[][]> {
    const reranked: RetrievalResult[][] = [];

    for (let i = 0; i < queries.length; i++) {
      const results = await this.rerank(queries[i], resultSets[i], topK);
      reranked.push(results);

      // Rate limiting delay
      if (i < queries.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return reranked;
  }
}
