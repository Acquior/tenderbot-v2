"use client";

import { useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { Upload, Activity, FolderCheck, Shield } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface UploadState {
  filename: string;
  status: "idle" | "uploading" | "success" | "error";
  message?: string;
}

type DocumentsListArgs = {
  limit?: number;
  bundleId?: Id<"bundles">;
};

export default function DocumentsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadState, setUploadState] = useState<UploadState | null>(null);

  const documentsArgs: DocumentsListArgs | "skip" =
    isLoaded && isSignedIn ? { limit: 50 } : "skip";

  const documents = useQuery(api.documents.list, documentsArgs);

  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const createDocument = useMutation(api.documents.create);
  const enqueueIngestion = useMutation(api.jobs.enqueueDocumentIngestion);

  const pipelineCount =
    documents?.filter((doc) => doc.status !== "ready" && doc.status !== "failed").length ?? 0;
  const totalSize = documents?.reduce((total, doc) => total + doc.size, 0) ?? 0;

  const canUpload = isSignedIn;

  const stats = useMemo(
    () => [
      {
        title: "Processing Pipeline",
        metric: pipelineCount.toString(),
        description:
          "OCR, chunking, and embeddings tracked in real time with retry logic",
        icon: Activity,
      },
      {
        title: "Bundle Management",
        metric: (documents?.length ?? 0).toString(),
        description: "Automatic grouping with duplicate detection and completeness tracking",
        icon: FolderCheck,
      },
      {
        title: "Storage & Security",
        metric: totalSize ? formatFileSize(totalSize) : "—",
        description: "Secure storage with org-level access control and audit logging",
        icon: Shield,
      },
    ],
    [documents?.length, pipelineCount, totalSize]
  );

  const handleUploadClick = () => {
    if (!isSignedIn) {
      setUploadState({
        filename: "",
        status: "error",
        message: "Sign in to upload documents.",
      });
      return;
    }

    if (!fileInputRef.current) {
      setUploadState({
        filename: "",
        status: "error",
        message: "File picker unavailable. Please reload and try again.",
      });
      return;
    }

    fileInputRef.current.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    if (!isSignedIn) {
      setUploadState({
        filename: "",
        status: "error",
        message: "Sign in to upload documents.",
      });
      return;
    }

    const selectedFiles = Array.from(files);
    let lastFileName = "";

    try {
      for (const file of selectedFiles) {
        lastFileName = file.name;
        setUploadState({ filename: file.name, status: "uploading" });

        const uploadUrl = await generateUploadUrl();

        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed with status ${uploadResponse.status}`);
        }

        const { storageId } = (await uploadResponse.json()) as { storageId: string };
        if (!storageId) {
          throw new Error("Missing storageId in upload response");
        }

        const documentId = await createDocument({
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          storageId,
        });

        await enqueueIngestion({ documentId });
        setUploadState({
          filename: file.name,
          status: "success",
          message: "Upload complete — ingestion queued.",
        });
      }
    } catch (error) {
      console.error("Failed to upload document", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      setUploadState({ filename: lastFileName, status: "error", message });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (!isLoaded) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Documents</h2>
        <p className="text-sm text-muted-foreground">Loading your workspace…</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Documents</h2>
        <p className="text-sm text-muted-foreground">
          Please sign in to upload tenders and track ingestion progress.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Documents</h2>
          <p className="text-sm text-muted-foreground">
            Upload and manage your tender documents with automated processing
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            id="document-upload-input"
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
            className="sr-only"
            tabIndex={-1}
            onChange={handleFileChange}
            multiple
          />
          <Button
            type="button"
            className="gap-2"
            onClick={handleUploadClick}
            disabled={uploadState?.status === "uploading" || !canUpload}
            aria-describedby={uploadState?.message ? "upload-status" : undefined}
          >
            <Upload className="h-4 w-4" />
            {uploadState?.status === "uploading" ? "Uploading…" : "Upload Documents"}
          </Button>
        </div>
      </div>

      {uploadState?.message && (
        <p
          id="upload-status"
          className={`text-sm ${
            uploadState.status === "error" ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {uploadState.message}
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="border-border/40">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-2xl font-semibold">{stat.metric}</div>
                <p className="text-xs text-muted-foreground leading-relaxed">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="text-base">Recent Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {!documents && (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">Fetching documents…</p>
            </div>
          )}

          {documents && documents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-lg bg-accent/50 flex items-center justify-center mb-4">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium mb-1">No documents yet</p>
              <p className="text-xs text-muted-foreground mb-4 max-w-sm">
                Upload your first tender document to begin automated processing and analysis.
              </p>
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={handleUploadClick}
                disabled={uploadState?.status === "uploading" || !canUpload}
              >
                Upload Documents
              </Button>
            </div>
          )}

          {documents && documents.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 font-medium">Filename</th>
                    <th className="py-2 font-medium">Size</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium">Uploaded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {documents.map((document) => (
                    <tr key={document._id}>
                      <td className="py-3 font-medium text-foreground">{document.filename}</td>
                      <td className="py-3 text-muted-foreground">{formatFileSize(document.size)}</td>
                      <td className="py-3">
                        <Badge
                          variant={
                            document.status === "ready"
                              ? "secondary"
                              : document.status === "failed"
                                ? "destructive"
                                : "outline"
                          }
                        >
                          {document.status.replaceAll("_", " ")}
                        </Badge>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {new Date(document.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatFileSize(sizeInBytes: number): string {
  if (sizeInBytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(sizeInBytes) / Math.log(1024)), units.length - 1);
  const size = sizeInBytes / Math.pow(1024, index);
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[index]}`;
}
