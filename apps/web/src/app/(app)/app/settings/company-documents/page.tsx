"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const CATEGORIES = [
  "registration",
  "tax",
  "bee",
  "banking",
  "financials",
  "proof_of_address",
  "oem_letter",
  "technical_datasheet",
  "company_profile",
  "sbd_attachment",
  "other",
] as const;

function validityVariant(status: string): "secondary" | "destructive" | "outline" {
  if (status === "approved") return "secondary";
  if (status === "expired" || status === "rejected") return "destructive";
  return "outline";
}

export default function CompanyDocumentsPage() {
  const profile = useQuery(api.companyProfiles.getActive, {});
  const companyDocuments = useQuery(
    api.companyDocuments.listByProfile,
    profile?._id ? { profileId: profile._id } : "skip"
  );
  const documentRecords = useQuery(
    api.documents.listByProfileWithUrls,
    profile?._id ? { profileId: profile._id } : "skip"
  );

  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const createDocument = useMutation(api.documents.create);
  const enqueueIngestion = useMutation(api.jobs.enqueueDocumentIngestion);
  const registerUploadedDocument = useMutation(api.companyDocuments.registerUploadedDocument);
  const approveDocument = useMutation(api.companyDocuments.approveDocument);
  const rejectDocument = useMutation(api.companyDocuments.rejectDocument);
  const markExpired = useMutation(api.companyDocuments.markExpired);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("registration");
  const [issuer, setIssuer] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const documentsById = new Map((documentRecords ?? []).map((record) => [record._id, record]));

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile?._id) return;

    setUploading(true);
    setMessage(null);
    try {
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
      const documentId = await createDocument({
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        storageId,
        kind: "company_reference",
        profileId: profile._id,
        documentCategory: category,
        approvalStatus: "draft",
        expiresAt: expiresAt ? new Date(expiresAt).getTime() : undefined,
      });

      await registerUploadedDocument({
        profileId: profile._id,
        documentId,
        category,
        title: title || file.name,
        issuer: issuer || undefined,
        referenceNumber: referenceNumber || undefined,
        expiresAt: expiresAt ? new Date(expiresAt).getTime() : undefined,
        notes: notes || undefined,
      });

      await enqueueIngestion({ documentId });

      setTitle("");
      setIssuer("");
      setReferenceNumber("");
      setExpiresAt("");
      setNotes("");
      setMessage("Company document uploaded and queued for ingestion.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Company Documents</h2>
        <p className="text-sm text-muted-foreground">
          Only approved, non-expired documents may be auto-attached into a tender workspace.
        </p>
      </div>

      {message && (
        <div className="rounded-md border border-border/50 bg-background/40 px-4 py-3 text-sm">
          {message}
        </div>
      )}

      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="text-base normal-case">Upload Reusable Company Document</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!profile?._id && (
            <p className="text-sm text-muted-foreground">
              Create a company profile first. Documents are attached to that canonical profile.
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" />
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as (typeof CATEGORIES)[number])}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <Input value={issuer} onChange={(event) => setIssuer(event.target.value)} placeholder="Issuer" />
            <Input
              value={referenceNumber}
              onChange={(event) => setReferenceNumber(event.target.value)}
              placeholder="Reference number"
            />
            <Input
              type="date"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              placeholder="Expiry date"
            />
          </div>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Notes"
            className="min-h-[100px]"
          />
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={!profile?._id || uploading}
            >
              {uploading ? "Uploading..." : "Upload Document"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {(companyDocuments ?? []).map((companyDocument) => {
          const documentRecord = documentsById.get(companyDocument.documentId);
          const expiryText =
            typeof companyDocument.expiresAt === "number"
              ? new Date(companyDocument.expiresAt).toLocaleDateString()
              : "No expiry";

          return (
            <Card key={companyDocument._id} className="border-border/40">
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-base normal-case">{companyDocument.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {companyDocument.category} · expires {expiryText}
                  </p>
                </div>
                <Badge variant={validityVariant(companyDocument.validityStatus)}>
                  {companyDocument.validityStatus}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                  <p>Issuer: {companyDocument.issuer || "Not set"}</p>
                  <p>Reference: {companyDocument.referenceNumber || "Not set"}</p>
                  <p>File: {documentRecord?.filename || "Missing source record"}</p>
                  <p>Status: {documentRecord?.status || "Unknown"}</p>
                </div>
                {companyDocument.notes && (
                  <p className="text-sm text-muted-foreground">{companyDocument.notes}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {documentRecord?.url && (
                    <a
                      href={documentRecord.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 items-center rounded-md border border-input px-4 text-sm"
                    >
                      View
                    </a>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => approveDocument({ id: companyDocument._id })}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => rejectDocument({ id: companyDocument._id })}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => markExpired({ id: companyDocument._id })}
                  >
                    Mark Expired
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
