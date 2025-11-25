"use client";

import { useState, useRef, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";

export interface UploadState {
  filename: string;
  status: "idle" | "uploading" | "success" | "error";
  message?: string;
}

export function useDocumentUpload(isSignedIn: boolean) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadState, setUploadState] = useState<UploadState | null>(null);

  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const createDocument = useMutation(api.documents.create);
  const enqueueIngestion = useMutation(api.jobs.enqueueDocumentIngestion);

  const handleUploadClick = useCallback(() => {
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
  }, [isSignedIn]);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
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
    },
    [isSignedIn, generateUploadUrl, createDocument, enqueueIngestion]
  );

  return {
    fileInputRef,
    uploadState,
    handleUploadClick,
    handleFileChange,
    isUploading: uploadState?.status === "uploading",
  };
}
