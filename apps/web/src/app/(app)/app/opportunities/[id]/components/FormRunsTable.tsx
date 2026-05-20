"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SourceDocumentRow = {
  _id: string;
  filename: string;
  mimeType: string;
};

type FormRunRow = {
  _id: string;
  sourceDocumentId: string;
  status: string;
  outputDocumentUrl?: string | null;
  fields?: Array<{
    fieldKey: string;
    resolvedValue?: string;
    sourcePath?: string;
    validationStatus: string;
    requiresReview?: boolean;
  }>;
};

function runVariant(status: string): "secondary" | "destructive" | "outline" {
  if (status === "filled_preview" || status === "approved") return "secondary";
  if (status === "blocked") return "destructive";
  return "outline";
}

export function FormRunsTable({
  sourceDocuments,
  formRuns,
  onGeneratePreview,
  onApprove,
  busyDocumentId,
}: {
  sourceDocuments: SourceDocumentRow[] | undefined;
  formRuns: FormRunRow[] | undefined;
  onGeneratePreview: (documentId: string) => void;
  onApprove: (runId: string) => void;
  busyDocumentId?: string | null;
}) {
  const setManualValue = useMutation(api.formRuns.setManualValue);
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [savingFieldKey, setSavingFieldKey] = useState<string | null>(null);

  const runsBySourceDocumentId = new Map((formRuns ?? []).map((run) => [run.sourceDocumentId, run]));
  const pdfCandidates = (sourceDocuments ?? []).filter(
    (document) => document.mimeType === "application/pdf"
  );

  const handleSetManualValue = async (runId: string, fieldKey: string) => {
    const compoundKey = `${runId}:${fieldKey}`;
    const value = manualValues[compoundKey];
    if (!value) return;

    setSavingFieldKey(compoundKey);
    try {
      await setManualValue({
        id: runId as never,
        fieldKey,
        value,
      });
    } finally {
      setSavingFieldKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base normal-case">Forms</CardTitle>
        </CardHeader>
        <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source PDF</TableHead>
              <TableHead>Run Status</TableHead>
              <TableHead>Validation</TableHead>
              <TableHead>Preview</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pdfCandidates.map((document) => {
              const run = runsBySourceDocumentId.get(document._id);
              const blockedFields =
                run?.fields?.filter((field) => field.validationStatus !== "valid").length ?? 0;

              return (
                <TableRow key={document._id}>
                  <TableCell className="align-top">
                    <p className="text-sm font-medium">{document.filename}</p>
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge variant={runVariant(run?.status ?? "draft")}>
                      {run?.status ?? "not_started"}
                    </Badge>
                  </TableCell>
                  <TableCell className="align-top text-sm text-muted-foreground">
                    {run ? `${blockedFields} fields need review` : "No preview generated"}
                  </TableCell>
                  <TableCell className="align-top">
                    {run?.outputDocumentUrl ? (
                      <a
                        href={run.outputDocumentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm underline underline-offset-4"
                      >
                        Open Preview
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">Not available</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onGeneratePreview(document._id)}
                      >
                        {busyDocumentId === document._id ? "Generating..." : "Generate Preview"}
                      </Button>
                      {run && (
                        <Button
                          size="sm"
                          onClick={() => onApprove(run._id)}
                          disabled={run.status === "blocked"}
                        >
                          Approve
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </CardContent>
      </Card>

      {(formRuns ?? [])
        .filter((run) => (run.fields?.length ?? 0) > 0)
        .map((run) => {
          const reviewFields = (run.fields ?? []).filter(
            (field) => field.validationStatus !== "valid" || field.requiresReview
          );

          return (
            <Card key={run._id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base normal-case">
                    Field Review for {pdfCandidates.find((document) => document._id === run.sourceDocumentId)?.filename ?? run.sourceDocumentId}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Manual overrides remain review-required and are never treated as automatically verified.
                  </p>
                </div>
                <Badge variant={runVariant(run.status)}>{run.status}</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                {reviewFields.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No field-level review items remain on this form run.
                  </p>
                )}
                {reviewFields.map((field) => {
                  const compoundKey = `${run._id}:${field.fieldKey}`;
                  return (
                    <div key={field.fieldKey} className="rounded-lg border border-border/40 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{field.fieldKey}</p>
                        <Badge variant={field.validationStatus === "conflict" || field.validationStatus === "invalid" ? "destructive" : "outline"}>
                          {field.validationStatus}
                        </Badge>
                      </div>
                      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                        <p>Resolved value: {field.resolvedValue || "None"}</p>
                        <p>Source path: {field.sourcePath || "Not mapped"}</p>
                      </div>
                      <div className="mt-3 flex flex-col gap-2 md:flex-row">
                        <Input
                          value={manualValues[compoundKey] ?? field.resolvedValue ?? ""}
                          onChange={(event) =>
                            setManualValues((current) => ({
                              ...current,
                              [compoundKey]: event.target.value,
                            }))
                          }
                          placeholder="Manual value"
                        />
                        <Button
                          variant="outline"
                          onClick={() => handleSetManualValue(run._id, field.fieldKey)}
                          disabled={savingFieldKey === compoundKey}
                        >
                          {savingFieldKey === compoundKey ? "Saving..." : "Apply Manual Value"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
    </div>
  );
}
