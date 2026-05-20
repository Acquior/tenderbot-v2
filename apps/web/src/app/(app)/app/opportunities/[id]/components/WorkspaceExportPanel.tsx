"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type WorkspaceExportState = {
  readiness: string;
};

type ExportDocumentRow = {
  _id: string;
  filename: string;
  createdAt: number;
  url?: string | null;
};

export function WorkspaceExportPanel({
  workspace,
  exportDocuments,
  onExport,
  busy,
}: {
  workspace: WorkspaceExportState | null | undefined;
  exportDocuments: ExportDocumentRow[] | undefined;
  onExport: () => void;
  busy?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-2">
          <CardTitle className="text-base normal-case">Workspace Export</CardTitle>
          <p className="text-sm text-muted-foreground">
            Red workspaces are blocked. Yellow workspaces export with review requirements.
          </p>
        </div>
        <Badge variant={workspace?.readiness === "green" ? "secondary" : "outline"}>
          {workspace?.readiness ?? "no_workspace"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={onExport} disabled={!workspace || workspace.readiness === "red" || busy}>
          {busy ? "Exporting..." : "Export Workspace ZIP"}
        </Button>
        <div className="space-y-2">
          {(exportDocuments ?? []).map((document) => (
            <div
              key={document._id}
              className="flex items-center justify-between rounded-lg border border-border/40 p-3"
            >
              <div>
                <p className="text-sm font-medium">{document.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(document.createdAt).toLocaleString()}
                </p>
              </div>
              {document.url && (
                <a
                  href={document.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm underline underline-offset-4"
                >
                  Download
                </a>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
