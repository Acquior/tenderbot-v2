"use client";

import { useMemo, useState, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { ACTIVE_JOB_STATUSES } from "../constants";

export function useDocumentJobs(documentId: Id<"documents">, bundleId?: Id<"bundles">) {
  const [retryPending, setRetryPending] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);

  const jobs = useQuery(api.jobs.getJobsForDocument, { documentId });
  const bundleJobs = useQuery(
    api.jobs.getJobsForBundle,
    bundleId ? { bundleId } : "skip"
  );

  const retryJob = useMutation(api.jobs.retry);
  const cancelJob = useMutation(api.jobs.cancel);

  const sortedJobs = useMemo(() => {
    if (!jobs) {
      return [] as Doc<"jobs">[];
    }
    return [...jobs].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }, [jobs]);

  const activeJob = sortedJobs.find((job) => ACTIVE_JOB_STATUSES.includes(job.status));
  const latestJob = sortedJobs[0];
  const displayJob = activeJob ?? latestJob;
  const failedJob = sortedJobs.find((job) => job.status === "failed");

  // Bundle analysis jobs
  const bundleAnalysisJobs = bundleJobs
    ? bundleJobs.filter((job) => job.type === "analyze_opportunity")
    : [];
  const activeBundleJob = bundleAnalysisJobs.find((job) =>
    ACTIVE_JOB_STATUSES.includes(job.status)
  );

  const handleRetry = useCallback(async () => {
    if (!failedJob) return;
    try {
      setRetryPending(true);
      await retryJob({ jobId: failedJob._id });
    } catch (error) {
      console.error("Failed to retry job", error);
    } finally {
      setRetryPending(false);
    }
  }, [failedJob, retryJob]);

  const handleCancel = useCallback(async () => {
    if (!activeJob) return;
    try {
      setCancelPending(true);
      await cancelJob({ jobId: activeJob._id });
    } catch (error) {
      console.error("Failed to cancel job", error);
    } finally {
      setCancelPending(false);
    }
  }, [activeJob, cancelJob]);

  return {
    jobs,
    sortedJobs,
    activeJob,
    displayJob,
    failedJob,
    activeBundleJob,
    retryPending,
    cancelPending,
    handleRetry,
    handleCancel,
    canRetry: !!failedJob,
    canCancel: !!activeJob,
  };
}
