import { z } from "zod";

/**
 * Text chunk for RAG
 */
export const ChunkSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  sequence: z.number().int().nonnegative(),
  text: z.string(),
  tokens: z.number().int().positive(),
  metadata: z.object({
    page: z.number().int().optional(),
    section: z.string().optional(),
    heading: z.string().optional(),
    startOffset: z.number().int().optional(),
    endOffset: z.number().int().optional(),
  }),
  embeddingId: z.string().optional(), // Reference to vector DB
  createdAt: z.number().int(),
});

export type Chunk = z.infer<typeof ChunkSchema>;

/**
 * Chunking strategy configuration
 */
export const ChunkingConfigSchema = z.object({
  strategy: z.enum(["fixed", "semantic", "recursive"]),
  maxTokens: z.number().int().positive().default(512),
  overlap: z.number().int().nonnegative().default(50),
  preserveStructure: z.boolean().default(true),
});

export type ChunkingConfig = z.infer<typeof ChunkingConfigSchema>;
