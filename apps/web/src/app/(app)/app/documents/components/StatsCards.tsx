"use client";

import { useMemo } from "react";
import { Activity, FolderCheck, Shield, FileText, Database } from "lucide-react";
import type { Doc } from "@convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFileSize } from "@/lib/format";

interface StatsCardsProps {
  documents: Doc<"documents">[] | undefined;
}

export function StatsCards({ documents }: StatsCardsProps) {
  const pipelineCount =
    documents?.filter((doc) => doc.status !== "ready" && doc.status !== "failed").length ?? 0;
  const totalSize = documents?.reduce((total, doc) => total + doc.size, 0) ?? 0;
  const readyCount = documents?.filter((doc) => doc.status === "ready").length ?? 0;

  const stats = useMemo(
    () => [
      {
        title: "Total Documents",
        metric: (documents?.length ?? 0).toString(),
        description: "Uploaded documents across all tenders",
        icon: FileText,
      },
      {
        title: "Processing Pipeline",
        metric: pipelineCount.toString(),
        description:
          "Documents currently being processed (OCR, analysis)",
        icon: Activity,
        highlight: pipelineCount > 0,
      },
      {
        title: "Storage Usage",
        metric: totalSize ? formatFileSize(totalSize) : "0 B",
        description: "Total storage space used",
        icon: Database,
      },
    ],
    [documents?.length, pipelineCount, totalSize]
  );

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title} className="border-border/40 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <Icon className={`h-4 w-4 ${stat.highlight ? "text-blue-500 animate-pulse" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.metric}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
