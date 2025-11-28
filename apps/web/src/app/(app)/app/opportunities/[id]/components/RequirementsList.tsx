"use client";

import { useMemo } from "react";
import type { Doc } from "@convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, CircleDot, XCircle } from "lucide-react";

type RequirementType = "compliance" | "technical" | "commercial" | "legal" | "bee" | "eligibility" | "other";
type RequirementStatus = "met" | "partial" | "unknown" | "not_met";

const REQUIREMENT_TYPE_LABELS: Record<RequirementType, string> = {
  compliance: "Compliance",
  technical: "Technical",
  commercial: "Commercial",
  legal: "Legal",
  bee: "BEE",
  eligibility: "Eligibility",
  other: "Other",
};

const REQUIREMENT_STATUS_LABELS: Record<RequirementStatus, string> = {
  met: "Met",
  partial: "Partially Met",
  unknown: "Unknown",
  not_met: "Not Met",
};

const REQUIREMENT_STATUS_COLORS: Record<RequirementStatus, string> = {
  met: "text-green-600",
  partial: "text-yellow-600",
  unknown: "text-gray-600",
  not_met: "text-red-600",
};

const REQUIREMENT_STATUS_ICONS: Record<RequirementStatus, React.ElementType> = {
  met: CheckCircle2,
  partial: CircleDot,
  unknown: AlertCircle,
  not_met: XCircle,
};

interface RequirementsListProps {
  requirements: Doc<"requirements">[] | undefined;
}

export function RequirementsList({ requirements }: RequirementsListProps) {
  const groupedRequirements = useMemo(() => {
    if (!requirements) return {} as Record<RequirementType, Doc<"requirements">[]>;

    return requirements.reduce((acc, req) => {
      const type = req.type as RequirementType;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(req);
      return acc;
    }, {} as Record<RequirementType, Doc<"requirements">[]>);
  }, [requirements]);

  const eligibilityStats = useMemo(() => {
    const mandatory = requirements?.filter((r) => r.mandatory) ?? [];
    const met = mandatory.filter((r) => r.status === "met").length;
    const notMet = mandatory.filter((r) => r.status === "not_met").length;
    const unknown = mandatory.filter((r) => r.status === "unknown").length;
    const partial = mandatory.filter((r) => r.status === "partial").length;
    return { total: mandatory.length, met, notMet, unknown, partial };
  }, [requirements]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Requirements</CardTitle>
        {/* Eligibility Snapshot */}
        {requirements && requirements.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-xs text-muted-foreground">
              Mandatory: {eligibilityStats.total} total
            </span>
            {eligibilityStats.met > 0 && (
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                {eligibilityStats.met} met
              </Badge>
            )}
            {eligibilityStats.notMet > 0 && (
              <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                {eligibilityStats.notMet} not met
              </Badge>
            )}
            {eligibilityStats.unknown > 0 && (
              <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200">
                {eligibilityStats.unknown} unknown
              </Badge>
            )}
            {eligibilityStats.partial > 0 && (
              <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                {eligibilityStats.partial} partial
              </Badge>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {!requirements && (
          <p className="text-sm text-muted-foreground">Loading requirements…</p>
        )}

        {requirements && requirements.length === 0 && (
          <p className="text-sm text-muted-foreground">No requirements extracted yet.</p>
        )}

        {requirements && requirements.length > 0 && (
          <div className="space-y-6">
            {(Object.entries(groupedRequirements) as [RequirementType, Doc<"requirements">[]][]).map(([type, reqs]) => (
              <div key={type} className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  {REQUIREMENT_TYPE_LABELS[type]}
                  <Badge variant="outline">{reqs.length}</Badge>
                </h3>
                <div className="space-y-2">
                  {reqs.map((req) => {
                    const status = req.status as RequirementStatus;
                    const Icon = REQUIREMENT_STATUS_ICONS[status];
                    const statusColor = REQUIREMENT_STATUS_COLORS[status];

                    return (
                      <div
                        key={req._id}
                        className="border border-border/40 rounded-lg p-3 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2 flex-1">
                            <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${statusColor}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm">{req.description}</p>
                              {req.notes && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {req.notes}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {req.mandatory && (
                              <Badge variant="destructive" className="text-xs">
                                Mandatory
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {REQUIREMENT_STATUS_LABELS[req.status]}
                            </Badge>
                          </div>
                        </div>
                        {req.confidence !== undefined && (
                          <p className="text-xs text-muted-foreground">
                            Confidence: {Math.round(req.confidence * 100)}%
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

