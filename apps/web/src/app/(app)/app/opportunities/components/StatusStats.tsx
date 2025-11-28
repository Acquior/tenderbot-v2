"use client";

import { useMemo } from "react";
import type { Doc } from "@convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, FileText } from "lucide-react";

type StatusColumn = {
  label: "Draft" | "In Review" | "Approved";
  statusKey: "draft" | "in_review" | "approved";
  icon: typeof FileText | typeof AlertCircle | typeof CheckCircle2;
  description: string;
  variant: "outline" | "secondary" | "default";
};

const STATUS_COLUMNS: StatusColumn[] = [
  {
    label: "Draft",
    statusKey: "draft",
    icon: FileText,
    description: "Awaiting review",
    variant: "outline",
  },
  {
    label: "In Review",
    statusKey: "in_review",
    icon: AlertCircle,
    description: "Under analysis",
    variant: "secondary",
  },
  {
    label: "Approved",
    statusKey: "approved",
    icon: CheckCircle2,
    description: "Ready to submit",
    variant: "default",
  },
];

interface StatusStatsProps {
  opportunities: Doc<"opportunities">[] | undefined;
}

export function StatusStats({ opportunities }: StatusStatsProps) {
  const statusAggregates = useMemo(() => {
    const counts: Record<StatusColumn["statusKey"], number> = {
      draft: 0,
      in_review: 0,
      approved: 0,
    };

    for (const opportunity of opportunities ?? []) {
      if (opportunity.status === "draft") {
        counts.draft += 1;
      } else if (opportunity.status === "in_review") {
        counts.in_review += 1;
      } else if (opportunity.status === "approved") {
        counts.approved += 1;
      }
    }

    return counts;
  }, [opportunities]);

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {STATUS_COLUMNS.map((status) => {
        const Icon = status.icon;
        return (
          <Card key={status.label} className="border-border/40">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 rounded-lg bg-accent/50 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-accent-foreground" />
                </div>
                <Badge variant={status.variant}>
                  {statusAggregates[status.statusKey] ?? 0}
                </Badge>
              </div>
              <CardTitle className="text-base">{status.label}</CardTitle>
              <p className="text-xs text-muted-foreground">{status.description}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                <p>• Requirement matrix with evidence links</p>
                <p>• Risk scoring by category and severity</p>
                <p>• Action items with owners and deadlines</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

