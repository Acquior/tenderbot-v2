"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { Upload } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDocumentUpload } from "./hooks/useDocumentUpload";
import { StatsCards } from "./components/StatsCards";
import { DocumentRow } from "./components/DocumentRow";
import { ACCEPTED_FILE_TYPES } from "./constants";

type DocumentsListArgs = {
  limit?: number;
  bundleId?: Id<"bundles">;
};

export default function DocumentsPage() {
  const { isLoaded, isSignedIn } = useAuth();

  const documentsArgs: DocumentsListArgs | "skip" =
    isLoaded && isSignedIn ? { limit: 50 } : "skip";
  const documents = useQuery(api.documents.list, documentsArgs);

  const {
    fileInputRef,
    uploadState,
    handleUploadClick,
    handleFileChange,
    isUploading,
  } = useDocumentUpload(isSignedIn ?? false);

  const canUpload = isSignedIn;

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
      {/* Header */}
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
            accept={ACCEPTED_FILE_TYPES}
            className="sr-only"
            tabIndex={-1}
            onChange={handleFileChange}
            multiple
          />
          <Button
            type="button"
            className="gap-2"
            onClick={handleUploadClick}
            disabled={isUploading || !canUpload}
            aria-describedby={uploadState?.message ? "upload-status" : undefined}
          >
            <Upload className="h-4 w-4" />
            {isUploading ? "Uploading…" : "Upload Documents"}
          </Button>
        </div>
      </div>

      {/* Upload Status */}
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

      {/* Stats Cards */}
      <StatsCards documents={documents} />

      {/* Document List */}
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
                Upload your first tender document to begin automated processing and
                analysis.
              </p>
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={handleUploadClick}
                disabled={isUploading || !canUpload}
              >
                Upload Documents
              </Button>
            </div>
          )}

          {documents && documents.length > 0 && (
            <div className="space-y-3">
              {documents.map((document) => (
                <DocumentRow key={document._id} document={document} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
