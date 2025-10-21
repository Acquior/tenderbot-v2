import { Chunk, ChunkingConfig } from "@tenderbot/contracts";

/**
 * Text chunking utilities
 */
export class Chunker {
  /**
   * Chunk text using the specified strategy
   */
  static chunk(
    text: string,
    documentId: string,
    config: ChunkingConfig = {
      strategy: "recursive",
      maxTokens: 512,
      overlap: 50,
      preserveStructure: true,
    }
  ): Omit<Chunk, "id" | "createdAt" | "embeddingId">[] {
    switch (config.strategy) {
      case "fixed":
        return this.fixedChunk(text, documentId, config);
      case "semantic":
        return this.semanticChunk(text, documentId, config);
      case "recursive":
      default:
        return this.recursiveChunk(text, documentId, config);
    }
  }

  /**
   * Fixed-size chunking with overlap
   */
  private static fixedChunk(
    text: string,
    documentId: string,
    config: ChunkingConfig
  ): Omit<Chunk, "id" | "createdAt" | "embeddingId">[] {
    const chunks: Omit<Chunk, "id" | "createdAt" | "embeddingId">[] = [];
    const words = text.split(/\s+/);
    const chunkSize = Math.floor(config.maxTokens * 0.75); // Rough word-to-token ratio
    const overlapSize = Math.floor(config.overlap * 0.75);

    let sequence = 0;
    for (let i = 0; i < words.length; i += chunkSize - overlapSize) {
      const chunkWords = words.slice(i, i + chunkSize);
      const chunkText = chunkWords.join(" ");

      chunks.push({
        documentId,
        sequence: sequence++,
        text: chunkText,
        tokens: this.estimateTokens(chunkText),
        metadata: {
          startOffset: i,
          endOffset: i + chunkWords.length,
        },
      });
    }

    return chunks;
  }

  /**
   * Recursive chunking that preserves document structure
   */
  private static recursiveChunk(
    text: string,
    documentId: string,
    config: ChunkingConfig
  ): Omit<Chunk, "id" | "createdAt" | "embeddingId">[] {
    const chunks: Omit<Chunk, "id" | "createdAt" | "embeddingId">[] = [];
    const separators = ["\n\n", "\n", ". ", " "];

    const split = (text: string, separators: string[], depth: number = 0): string[] => {
      if (separators.length === 0) {
        return [text];
      }

      const separator = separators[0];
      const parts = text.split(separator);
      const result: string[] = [];

      for (const part of parts) {
        if (this.estimateTokens(part) <= config.maxTokens) {
          result.push(part);
        } else {
          result.push(...split(part, separators.slice(1), depth + 1));
        }
      }

      return result;
    };

    const textParts = split(text, separators);
    let currentChunk = "";
    let sequence = 0;

    for (const part of textParts) {
      if (this.estimateTokens(currentChunk + " " + part) <= config.maxTokens) {
        currentChunk += (currentChunk ? " " : "") + part;
      } else {
        if (currentChunk) {
          chunks.push({
            documentId,
            sequence: sequence++,
            text: currentChunk.trim(),
            tokens: this.estimateTokens(currentChunk),
            metadata: {},
          });
        }
        currentChunk = part;
      }
    }

    if (currentChunk) {
      chunks.push({
        documentId,
        sequence: sequence++,
        text: currentChunk.trim(),
        tokens: this.estimateTokens(currentChunk),
        metadata: {},
      });
    }

    return chunks;
  }

  /**
   * Semantic chunking (placeholder - requires sentence embeddings)
   */
  private static semanticChunk(
    text: string,
    documentId: string,
    config: ChunkingConfig
  ): Omit<Chunk, "id" | "createdAt" | "embeddingId">[] {
    // For now, fall back to recursive chunking
    // TODO: Implement semantic chunking with sentence embeddings
    return this.recursiveChunk(text, documentId, config);
  }

  /**
   * Estimate token count (rough approximation)
   */
  private static estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Extract page numbers from text if present
   */
  static extractPageNumber(text: string): number | undefined {
    const pageMatch = text.match(/\[Page (\d+)\]/i);
    return pageMatch ? parseInt(pageMatch[1], 10) : undefined;
  }

  /**
   * Extract section/heading from text if present
   */
  static extractSection(text: string): string | undefined {
    const sectionMatch = text.match(/^#+ (.+)/m);
    return sectionMatch ? sectionMatch[1] : undefined;
  }
}
