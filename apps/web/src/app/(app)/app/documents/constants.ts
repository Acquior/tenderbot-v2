import type { Doc } from "@convex/_generated/dataModel";

export type DocumentStatus = Doc<"documents">["status"];
export type JobStatus = Doc<"jobs">["status"];

export const STATUS_STAGE_LABELS: Record<DocumentStatus, string> = {
  uploading: "Uploading",
  uploaded: "Queued",
  processing: "Detecting characteristics",
  ocr_in_progress: "OCR in progress",
  ocr_failed: "OCR failed",
  chunking: "Chunking",
  embedding: "Embedding",
  ready: "Ready",
  failed: "Failed",
};

export const STATUS_BADGE_VARIANT: Partial<
  Record<DocumentStatus, "secondary" | "destructive" | "outline">
> = {
  ready: "secondary",
  failed: "destructive",
  ocr_failed: "destructive",
  uploading: "outline",
  uploaded: "outline",
  processing: "outline",
  ocr_in_progress: "outline",
  chunking: "outline",
  embedding: "outline",
};

export const ACTIVE_JOB_STATUSES: JobStatus[] = ["running", "pending", "retrying"];

export const ACCEPTED_FILE_TYPES =
  "application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt";
