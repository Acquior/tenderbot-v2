"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { Upload, FileUp, Loader2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
          >
            {isUploading ? (
               <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
               <Upload className="h-4 w-4" />
            )}
            {isUploading ? "Uploading…" : "Upload Documents"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCards documents={documents} />

      {/* Document List */}
      <Card className="border-border/40 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Documents</CardTitle>
          {uploadState?.message && (
            <div className={`text-sm px-3 py-1 rounded-md flex items-center gap-2 ${
              uploadState.status === "error" 
                ? "bg-red-50 text-red-700 border border-red-200" 
                : "bg-blue-50 text-blue-700 border border-blue-200"
            }`}>
               {uploadState.status === "uploading" && <Loader2 className="h-3 w-3 animate-spin" />}
               {uploadState.message}
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {!documents && (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">Fetching documents…</p>
            </div>
          )}

          {documents && documents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <FileUp className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-base font-medium mb-1">No documents yet</p>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                Upload your first tender document to begin automated processing and
                analysis.
              </p>
              <Button
                size="sm"
                variant="default"
                type="button"
                onClick={handleUploadClick}
                disabled={isUploading || !canUpload}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Documents
              </Button>
            </div>
          )}

          {documents && documents.length > 0 && (
            <Table>
              <TableHeader>
                 <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[400px]">Document</TableHead>
                    <TableHead>Bundle / Opportunity</TableHead>
                    <TableHead className="w-[200px]">Status</TableHead>
                    <TableHead className="w-[150px]">Uploaded</TableHead>
                    <TableHead className="w-[100px] text-right"></TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((document) => (
                  <DocumentRow key={document._id} document={document} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
