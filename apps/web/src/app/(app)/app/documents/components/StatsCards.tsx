"use client";

import { useMemo } from "react";
import { Activity, FolderCheck, Shield } from "lucide-react";
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

  const stats = useMemo(
    () => [
      {
        title: "Processing Pipeline",
        metric: pipelineCount.toString(),
        description:
          "OCR, chunking, and embeddings tracked in real time with retry logic",
        icon: Activity,
      },
      {
        title: "Bundle Management",
        metric: (documents?.length ?? 0).toString(),
        description: "Automatic grouping with duplicate detection and completeness tracking",
        icon: FolderCheck,
      },
      {
        title: "Storage & Security",
        metric: totalSize ? formatFileSize(totalSize) : "—",
        description: "Secure storage with org-level access control and audit logging",
        icon: Shield,
      },
    ],
    [documents?.length, pipelineCount, totalSize]
  );

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title} className="border-border/40">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-2xl font-semibold">{stat.metric}</div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
