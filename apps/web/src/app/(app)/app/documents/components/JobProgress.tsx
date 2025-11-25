"use client";

import type { Doc } from "@convex/_generated/dataModel";
import { Progress } from "@/components/ui/progress";

interface JobProgressProps {
  job: Doc<"jobs">;
  label?: string;
}

export function JobProgress({ job, label }: JobProgressProps) {
  const progress = job.progress;
  const progressValue =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label || progress?.message || "Processing…"}</span>
        {progress && (
          <span>
            {progress.current} / {progress.total}
          </span>
        )}
      </div>
      {progressValue !== undefined && (
        <Progress
          value={progressValue}
          className="h-1.5"
          aria-label={label ? `${label} progress` : "Progress"}
        />
      )}
      {job.status === "failed" && job.error?.message && (
        <p className="text-xs text-destructive">{job.error.message}</p>
      )}
    </div>
  );
}
