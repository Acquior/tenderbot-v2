"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type WorkspaceLike = {
  readiness: string;
};

type WorkspaceItemRow = {
  _id: string;
  path: string;
  status: string;
  notes?: string;
};

export function GapReport({
  workspace,
  items,
}: {
  workspace: WorkspaceLike | null | undefined;
  items: WorkspaceItemRow[] | undefined;
}) {
  const gapItems = (items ?? []).filter(
    (item) => item.status === "missing" || item.status === "blocked"
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base normal-case">Gap Report</CardTitle>
        <Badge variant={workspace?.readiness === "red" ? "destructive" : "outline"}>
          {gapItems.length} open gaps
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {gapItems.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No missing or blocked items are currently recorded.
          </p>
        )}
        {gapItems.map((item) => (
          <div key={item._id} className="rounded-lg border border-border/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">{item.path}</p>
              <Badge variant={item.status === "blocked" ? "destructive" : "outline"}>
                {item.status}
              </Badge>
            </div>
            {item.notes && <p className="mt-2 text-sm text-muted-foreground">{item.notes}</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
