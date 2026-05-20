"use client";

import { useMemo } from "react";
import type { Doc } from "@convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert } from "lucide-react";

type RiskCategory = "eligibility" | "bee_compliance" | "financial" | "technical" | "timeline" | "commercial" | "legal";
type RiskSeverity = "low" | "medium" | "high" | "critical";

const RISK_CATEGORY_LABELS: Record<RiskCategory, string> = {
  eligibility: "Eligibility",
  bee_compliance: "BEE Compliance",
  financial: "Financial",
  technical: "Technical",
  timeline: "Timeline",
  commercial: "Commercial",
  legal: "Legal",
};

const RISK_SEVERITY_COLORS: Record<RiskSeverity, string> = {
  low: "bg-green-100 text-green-800 border-green-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  critical: "bg-red-100 text-red-800 border-red-200",
};

const RISK_SEVERITY_DOT_COLORS: Record<RiskSeverity, string> = {
  low: "bg-green-500",
  medium: "bg-yellow-500",
  high: "bg-orange-500",
  critical: "bg-red-500",
};

interface RisksListProps {
  risks: Doc<"opportunities">["risks"];
}

export function RisksList({ risks }: RisksListProps) {
  // Group risks by category
  type Risk = NonNullable<typeof risks> extends (infer R)[] | undefined ? R : never;
  const groupedRisks = useMemo(() => {
    if (!risks) return {} as Record<RiskCategory, Risk[]>;

    return risks.reduce((acc, risk) => {
      const category = risk.category as RiskCategory;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(risk);
      return acc;
    }, {} as Record<RiskCategory, Risk[]>);
  }, [risks]);

  // Risk summary counts
  const riskCounts = useMemo(() => {
    const riskList = risks ?? [];
    return {
      total: riskList.length,
      critical: riskList.filter((r) => r.severity === "critical").length,
      high: riskList.filter((r) => r.severity === "high").length,
      medium: riskList.filter((r) => r.severity === "medium").length,
      low: riskList.filter((r) => r.severity === "low").length,
    };
  }, [risks]);

  if (!risks || risks.length === 0) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4" />
                    Risks
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">No risks identified.</p>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" />
          Risks
        </CardTitle>
        {/* Risk Summary */}
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="text-xs text-muted-foreground">
            {riskCounts.total} identified
          </span>
          {riskCounts.critical > 0 && (
            <Badge variant="outline" className="text-xs bg-red-100 text-red-800 border-red-200">
              {riskCounts.critical} critical
            </Badge>
          )}
          {riskCounts.high > 0 && (
            <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 border-orange-200">
              {riskCounts.high} high
            </Badge>
          )}
          {riskCounts.medium > 0 && (
            <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-200">
              {riskCounts.medium} medium
            </Badge>
          )}
          {riskCounts.low > 0 && (
            <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-200">
              {riskCounts.low} low
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {(Object.entries(groupedRisks) as [RiskCategory, typeof risks][]).map(([category, catRisks]) => (
            <div key={category} className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                {RISK_CATEGORY_LABELS[category]}
                <Badge variant="outline">{catRisks.length}</Badge>
              </h3>
              <div className="space-y-2">
                {catRisks.map((risk, index) => {
                  const severity = risk.severity as RiskSeverity;
                  const severityColor = RISK_SEVERITY_COLORS[severity];
                  const dotColor = RISK_SEVERITY_DOT_COLORS[severity];

                  return (
                    <div
                      key={risk.id || index}
                      className="border border-border/40 rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 flex-1">
                          <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dotColor}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{risk.description}</p>
                            {risk.mitigation && (
                              <p className="text-xs text-muted-foreground mt-1">
                                <span className="font-medium">Mitigation:</span> {risk.mitigation}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge className={`text-xs border ${severityColor}`}>
                          {severity.charAt(0).toUpperCase() + severity.slice(1)}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}


