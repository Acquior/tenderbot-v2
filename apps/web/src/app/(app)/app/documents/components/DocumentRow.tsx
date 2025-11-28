"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { RefreshCw, X, Package, ArrowRight, CheckCircle2, FileIcon, AlertCircle } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatFileSize } from "@/lib/format";
import { useDocumentJobs } from "../hooks/useDocumentJobs";
import { STATUS_STAGE_LABELS, STATUS_BADGE_VARIANT } from "../constants";
import { TableCell, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";

interface DocumentRowProps {
  document: Doc<"documents">;
}

export function DocumentRow({ document }: DocumentRowProps) {
  const bundle = useQuery(
    api.bundles.get,
    document.bundleId ? { id: document.bundleId } : "skip"
  );

  // Fetch opportunity linked to this bundle
  const opportunity = useQuery(
    api.opportunities.getByBundle,
    document.bundleId ? { bundleId: document.bundleId } : "skip"
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

  // Determine overall progress status
  const isProcessing = document.status !== "ready" && document.status !== "failed";
  const hasError = document.status === "failed";
  
  // Calculate progress percentage based on job if available
  const progressPercentage = displayJob ? Math.round((displayJob.completedSteps / displayJob.totalSteps) * 100) : 0;

  return (
    <TableRow className="group hover:bg-muted/40">
      {/* File Info */}
      <TableCell className="font-medium">
        <div className="flex items-start gap-3">
          <div className="mt-1 p-2 bg-muted/50 rounded-md">
             <FileIcon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <div className="font-medium text-sm truncate max-w-[300px] text-foreground" title={document.filename}>
              {document.filename}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
               <span>{formatFileSize(document.size)}</span>
               {document.metadata?.pageCount && (
                 <>
                   <span>•</span>
                   <span>{document.metadata.pageCount} pages</span>
                 </>
               )}
            </div>
          </div>
        </div>
      </TableCell>

      {/* Bundle/Context */}
      <TableCell>
        {bundle ? (
           <div className="flex flex-col gap-1">
             <div className="flex items-center gap-1.5">
               <Package className="h-3 w-3 text-muted-foreground" />
               <span className="text-sm font-medium truncate max-w-[150px]" title={bundle.name}>{bundle.name}</span>
             </div>
             {opportunity ? (
                <Link 
                  href={`/app/opportunities/${opportunity._id}`}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                   View Opportunity
                   <ArrowRight className="h-3 w-3" />
                </Link>
             ) : (
               <span className="text-xs text-muted-foreground">
                 {bundle.status === "analyzing" ? "Analyzing bundle..." : "No opportunity linked"}
               </span>
             )}
           </div>
        ) : (
           <span className="text-xs text-muted-foreground italic">No bundle</span>
        )}
      </TableCell>

      {/* Status & Progress */}
      <TableCell>
         <div className="flex flex-col gap-2 w-[180px]">
            <div className="flex items-center justify-between">
               <Badge variant={statusVariant} className="text-[10px] px-2 py-0.5 h-5">
                  {stageLabel}
               </Badge>
               {isProcessing && displayJob && (
                  <span className="text-[10px] text-muted-foreground">{progressPercentage}%</span>
               )}
            </div>
            
            {isProcessing && (
              <Progress value={progressPercentage} className="h-1.5" />
            )}
            
            {hasError && (
               <div className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  <span>Processing failed</span>
               </div>
            )}
         </div>
      </TableCell>

      {/* Date */}
      <TableCell className="text-muted-foreground text-xs">
         {new Date(document.createdAt).toLocaleDateString()}
         <div className="text-[10px] opacity-70">
            {new Date(document.createdAt).toLocaleTimeString()}
         </div>
      </TableCell>

      {/* Actions */}
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {canRetry && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={handleRetry}
              disabled={retryPending}
              title="Retry processing"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
          {canCancel && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={handleCancel}
              disabled={cancelPending}
              title="Cancel processing"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
