/**
 * Retrieval result with score
 */
export interface RetrievalResult {
  documentId: string;
  chunkId: string;
  text: string;
  score: number;
  metadata?: Record<string, unknown>;
}

/**
 * Hybrid retrieval configuration
 */
export interface RetrievalConfig {
  vectorWeight?: number; // Weight for vector similarity (0-1)
  keywordWeight?: number; // Weight for keyword search (0-1)
  topK?: number; // Number of results to return
  minScore?: number; // Minimum score threshold
  filters?: Record<string, unknown>; // Metadata filters
}

/**
 * Retrieval utilities
 */
export class Retriever {
  /**
   * Combine vector and keyword search results using RRF (Reciprocal Rank Fusion)
   */
  static hybridSearch(
    vectorResults: RetrievalResult[],
    keywordResults: RetrievalResult[],
    config: RetrievalConfig = {}
  ): RetrievalResult[] {
    const {
      vectorWeight = 0.7,
      keywordWeight = 0.3,
      topK = 10,
      minScore = 0.0,
    } = config;

    // Create a map of all unique results
    const resultMap = new Map<string, RetrievalResult>();

    // Add vector results
    vectorResults.forEach((result, index) => {
      const rrfScore = 1 / (index + 60); // RRF constant k=60
      const existing = resultMap.get(result.chunkId);

      if (existing) {
        existing.score += rrfScore * vectorWeight;
      } else {
        resultMap.set(result.chunkId, {
          ...result,
          score: rrfScore * vectorWeight,
        });
      }
    });

    // Add keyword results
    keywordResults.forEach((result, index) => {
      const rrfScore = 1 / (index + 60);
      const existing = resultMap.get(result.chunkId);

      if (existing) {
        existing.score += rrfScore * keywordWeight;
      } else {
        resultMap.set(result.chunkId, {
          ...result,
          score: rrfScore * keywordWeight,
        });
      }
    });

    // Convert to array, filter, sort, and slice
    return Array.from(resultMap.values())
      .filter((result) => result.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Filter results by metadata
   */
  static filterByMetadata(
    results: RetrievalResult[],
    filters: Record<string, unknown>
  ): RetrievalResult[] {
    return results.filter((result) => {
      if (!result.metadata) return false;

      return Object.entries(filters).every(([key, value]) => {
        return result.metadata?.[key] === value;
      });
    });
  }

  /**
   * Deduplicate results by similarity
   */
  static deduplicate(
    results: RetrievalResult[],
    similarityThreshold: number = 0.95
  ): RetrievalResult[] {
    const deduplicated: RetrievalResult[] = [];

    for (const result of results) {
      const isDuplicate = deduplicated.some((existing) => {
        // Simple text similarity check
        const similarity = this.textSimilarity(existing.text, result.text);
        return similarity >= similarityThreshold;
      });

      if (!isDuplicate) {
        deduplicated.push(result);
      }
    }

    return deduplicated;
  }

  /**
   * Calculate simple text similarity (Jaccard)
   */
  private static textSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));

    const intersection = new Set([...wordsA].filter((word) => wordsB.has(word)));
    const union = new Set([...wordsA, ...wordsB]);

    return intersection.size / union.size;
  }

  /**
   * Extract context window around chunks
   */
  static expandContext(
    results: RetrievalResult[],
    allChunks: Map<string, RetrievalResult>,
    _windowSize: number = 1
  ): RetrievalResult[] {
    const expanded: RetrievalResult[] = [];
    const seen = new Set<string>();
    void _windowSize;

    for (const result of results) {
      // Add the result itself
      if (!seen.has(result.chunkId)) {
        expanded.push(result);
        seen.add(result.chunkId);
      }

      // Add surrounding chunks (if available)
      // This requires chunks to have sequence metadata
      // TODO: Implement based on chunk sequence numbers
    }

    return expanded;
  }
}
