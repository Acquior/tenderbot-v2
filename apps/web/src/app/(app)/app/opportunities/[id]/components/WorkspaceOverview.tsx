"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type WorkspaceSummary = {
  readiness: "red" | "yellow" | "green";
  status: string;
  missingMandatoryCount: number;
  criticalConflictCount: number;
  summary?: string;
};

function readinessVariant(readiness: string): "secondary" | "destructive" | "outline" {
  if (readiness === "green") return "secondary";
  if (readiness === "red") return "destructive";
  return "outline";
}

export function WorkspaceOverview({
  workspace,
  itemCount,
  matchCount,
  onCreate,
  onRebuild,
  onApprove,
  busyLabel,
}: {
  workspace: WorkspaceSummary | null | undefined;
  itemCount: number;
  matchCount: number;
  onCreate: () => void;
  onRebuild: () => void;
  onApprove: () => void;
  busyLabel?: string | null;
}) {
  if (!workspace) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base normal-case">Workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            No tender workspace exists yet. Build one to match requirements against approved
            company evidence and assemble the export tree.
          </p>
          <Button onClick={onCreate} disabled={Boolean(busyLabel)}>
            {busyLabel ?? "Create Workspace"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-2">
          <CardTitle className="text-base normal-case">Workspace Status</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={readinessVariant(workspace.readiness)}>{workspace.readiness}</Badge>
            <Badge variant="outline">{workspace.status}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onRebuild} disabled={Boolean(busyLabel)}>
            {busyLabel ?? "Rebuild"}
          </Button>
          <Button onClick={onApprove} disabled={workspace.readiness === "red" || Boolean(busyLabel)}>
            Approve
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-border/40 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Missing Mandatory</p>
          <p className="mt-2 text-2xl font-semibold">{workspace.missingMandatoryCount}</p>
        </div>
        <div className="rounded-lg border border-border/40 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Conflicts</p>
          <p className="mt-2 text-2xl font-semibold">{workspace.criticalConflictCount}</p>
        </div>
        <div className="rounded-lg border border-border/40 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Workspace Items</p>
          <p className="mt-2 text-2xl font-semibold">{itemCount}</p>
        </div>
        <div className="rounded-lg border border-border/40 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Requirement Matches</p>
          <p className="mt-2 text-2xl font-semibold">{matchCount}</p>
        </div>
        <div className="md:col-span-4 rounded-lg border border-border/40 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Summary</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {workspace.summary || "No workspace summary generated yet."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
