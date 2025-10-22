"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface UploadState {
  filename: string;
  status: "idle" | "uploading" | "success" | "error";
  message?: string;
}

export default function DocumentsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadState, setUploadState] = useState<UploadState | null>(null);

  const documents = useQuery(api.documents.list, isLoaded && isSignedIn ? { limit: 50 } : undefined);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const createDocument = useMutation(api.documents.create);
  const enqueueIngestion = useMutation(api.jobs.enqueueDocumentIngestion);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
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
        message: "You must be signed in to upload documents.",
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

        setUploadState({ filename: file.name, status: "success", message: "Ingestion queued" });
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

  const renderStatusBadge = (status: string | undefined) => {
    if (!status) return null;

    const variant = status === "ready" ? "secondary" : status === "failed" ? "destructive" : "outline";
    return <Badge variant={variant}>{status.replaceAll("_", " ")}</Badge>;
  };

  if (!isLoaded) {
    return <p className="text-sm text-muted-foreground">Loading authentication...</p>;
  }

  if (!isSignedIn) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Documents</h1>
        <p className="text-muted-foreground">
          Sign in to upload tenders, track ingestion progress, and monitor pipeline health.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Documents</h1>
          <p className="text-muted-foreground">
            Upload tender documents, track ingestion progress, and monitor pipeline health in real time.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button onClick={handleUploadClick} disabled={uploadState?.status === "uploading"}>
            {uploadState?.status === "uploading" ? "Uploading..." : "Upload files"}
          </Button>
          {uploadState?.message && (
            <p
              className={`text-sm ${
                uploadState.status === "error" ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              {uploadState.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Pipeline Health</CardTitle>
            <CardDescription>Durable ingestion stages with retries</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>OCR, chunking, embeddings tracked per job</li>
              <li>Selective OCR fallback queue</li>
              <li>Real-time progress via Convex jobs</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bundle Completeness</CardTitle>
            <CardDescription>Group related uploads automatically</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>SimHash duplicate detection</li>
              <li>Checklist coverage per opportunity</li>
              <li>Due date risk alerts</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Storage & Governance</CardTitle>
            <CardDescription>Convex storage with optional R2 replication</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>Signed URLs aligned with Clerk org access</li>
              <li>Checksum tracking & retention policies</li>
              <li>Observability hooks for cost & drift</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent uploads</CardTitle>
          <CardDescription>
            {documents ? "Latest 50 documents across your organisation." : "Fetching documents..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents && documents.length === 0 && (
            <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
          )}

          {documents && documents.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2">Filename</th>
                    <th className="py-2">Size</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Uploaded</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {documents.map((document) => (
                    <tr key={document._id} className="align-top">
                      <td className="py-3 font-medium text-foreground">{document.filename}</td>
                      <td className="py-3 text-muted-foreground">{formatFileSize(document.size)}</td>
                      <td className="py-3">{renderStatusBadge(document.status)}</td>
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
