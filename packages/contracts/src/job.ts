import { z } from "zod";

/**
 * Job status for background processing
 */
export const JobStatus = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
  "retrying",
]);

export type JobStatus = z.infer<typeof JobStatus>;

/**
 * Job type definitions
 */
export const JobType = z.enum([
  "document_ingest",
  "ocr_process",
  "chunk_document",
  "generate_embeddings",
  "analyze_opportunity",
  "bundle_detect",
  "gap_analysis",
  "export_data",
  "notification_digest",
]);

export type JobType = z.infer<typeof JobType>;

/**
 * Background job for long-running tasks
 */
export const JobSchema = z.object({
  id: z.string(),
  type: JobType,
  input: z.record(z.unknown()), // Type-specific input data
  output: z.record(z.unknown()).optional(), // Type-specific output data
  status: JobStatus,
  progress: z
    .object({
      current: z.number().int().nonnegative(),
      total: z.number().int().positive(),
      message: z.string().optional(),
    })
    .optional(),
  error: z
    .object({
      message: z.string(),
      code: z.string().optional(),
      stack: z.string().optional(),
      retryable: z.boolean().default(true),
    })
    .optional(),
  attempts: z.number().int().nonnegative().default(0),
  maxAttempts: z.number().int().positive().default(3),
  resumeToken: z.string().optional(), // For resumable jobs
  createdBy: z.string(),
  createdAt: z.number().int(),
  startedAt: z.number().int().optional(),
  finishedAt: z.number().int().optional(),
  scheduledFor: z.number().int().optional(), // For delayed/scheduled jobs
});

export type Job = z.infer<typeof JobSchema>;

/**
 * Job creation request
 */
export const CreateJobRequestSchema = z.object({
  type: JobType,
  input: z.record(z.unknown()),
  scheduledFor: z.number().int().optional(),
});

export type CreateJobRequest = z.infer<typeof CreateJobRequestSchema>;
