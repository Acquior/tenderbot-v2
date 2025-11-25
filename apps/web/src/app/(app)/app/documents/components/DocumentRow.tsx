"use client";

import { useQuery } from "convex/react";
import { RefreshCw, X, Package } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatFileSize } from "@/lib/format";
import { useDocumentJobs } from "../hooks/useDocumentJobs";
import { JobProgress } from "./JobProgress";
import { STATUS_STAGE_LABELS, STATUS_BADGE_VARIANT } from "../constants";

interface DocumentRowProps {
  document: Doc<"documents">;
}

export function DocumentRow({ document }: DocumentRowProps) {
  const bundle = useQuery(
    api.bundles.get,
    document.bundleId ? { id: document.bundleId } : "skip"
  );

  const {
    displayJob,
    activeBundleJob,
    retryPending,
    cancelPending,
    handleRetry,
    handleCancel,
    canRetry,
    canCancel,
  } = useDocumentJobs(document._id, document.bundleId);

  const statusVariant =
    STATUS_BADGE_VARIANT[document.status] ??
    (document.status === "ready" ? "secondary" : "outline");
  const stageLabel =
    STATUS_STAGE_LABELS[document.status] ?? document.status.replaceAll("_", " ");

  const bundleCompleteness =
    bundle?.completeness?.score !== undefined
      ? Math.round(bundle.completeness.score * 100)
      : undefined;
  const bundleDetectionLabel = bundle
    ? bundle.metadata?.detectedAt
      ? "Auto-detected"
      : "Manual"
    : "";

  return (
    <div className="border border-border/40 rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate text-foreground">
              {document.filename}
            </p>
            {bundle && (
              <Badge variant="outline" className="gap-1 flex-shrink-0">
                <Package className="h-3 w-3" />
                {bundle.name}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>{formatFileSize(document.size)}</span>
            <span>{new Date(document.createdAt).toLocaleString()}</span>
            {document.metadata?.pageCount && (
              <span>{document.metadata.pageCount} pages</span>
            )}
            {document.metadata?.ocrMethod && (
              <span className="capitalize">
                {document.metadata.ocrMethod.replace("-", " ")} extraction
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant={statusVariant}>{stageLabel}</Badge>
          {canRetry && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1"
              onClick={handleRetry}
              disabled={retryPending}
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </Button>
          )}
          {canCancel && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1"
              onClick={handleCancel}
              disabled={cancelPending}
            >
              <X className="h-3 w-3" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Document Job Progress */}
      {displayJob && <JobProgress job={displayJob} />}

      {/* Bundle Analysis Progress */}
      {activeBundleJob && (
        <div className="border-t border-border/40 pt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Bundle Analysis
          </p>
          <JobProgress job={activeBundleJob} label="Analyzing…" />
        </div>
      )}

      {/* Bundle Info */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {bundle ? (
          <>
            <span className="flex items-center gap-1">
              <Badge variant="outline" className="uppercase">
                {bundleDetectionLabel || "Manual"}
              </Badge>
              <span>Status: {bundle.status.replaceAll("_", " ")}</span>
            </span>
            {bundleCompleteness !== undefined && (
              <span>Completeness: {bundleCompleteness}%</span>
            )}
          </>
        ) : document.bundleId ? (
          <span>Loading bundle details…</span>
        ) : (
          <span>No bundle detected</span>
        )}
      </div>
    </div>
  );
}
