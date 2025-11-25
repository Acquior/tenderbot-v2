"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  CircleDot,
  DollarSign,
  FileText,
  Package,
  Shield,
  XCircle,
  ArrowLeft,
} from "lucide-react";

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

export default function OpportunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const opportunityId = params.id as Id<"opportunities">;

  const opportunity = useQuery(api.opportunities.get, { id: opportunityId });
  const requirements = useQuery(api.requirements.listByOpportunity, { opportunityId });
  const bundle = useQuery(
    api.bundles.get,
    opportunity?.bundleId ? { id: opportunity.bundleId } : "skip"
  );

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

  const mandatoryCount = requirements?.filter((r) => r.mandatory).length ?? 0;
  const metCount = requirements?.filter((r) => r.status === "met").length ?? 0;
  const notMetCount = requirements?.filter((r) => r.status === "not_met").length ?? 0;

  if (opportunity === undefined) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Loading opportunity details…</p>
      </div>
    );
  }

  if (opportunity === null) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">Opportunity not found</p>
        <Button variant="outline" onClick={() => router.push("/app/opportunities")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Opportunities
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/app/opportunities")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{opportunity.title}</h1>
          <p className="text-sm text-muted-foreground">{opportunity.issuer}</p>
        </div>
        <Badge>{opportunity.status.replaceAll("_", " ")}</Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Due Date</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {new Date(opportunity.dueDate).toLocaleDateString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {Math.ceil((opportunity.dueDate - Date.now()) / (1000 * 60 * 60 * 24))} days remaining
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Requirements</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{requirements?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {mandatoryCount} mandatory, {metCount} met, {notMetCount} not met
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Estimated Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {opportunity.estimatedValue
                ? `${opportunity.currency} ${opportunity.estimatedValue.toLocaleString()}`
                : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {opportunity.referenceNumber || "No reference"}
            </p>
          </CardContent>
        </Card>
      </div>

      {opportunity.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {opportunity.description}
            </p>
          </CardContent>
        </Card>
      )}

      {bundle && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Bundle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{bundle.name}</span>
                <Badge variant="outline">{bundle.status}</Badge>
              </div>
              {bundle.completeness?.score !== undefined && (
                <p className="text-xs text-muted-foreground">
                  Completeness: {Math.round(bundle.completeness.score * 100)}%
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {opportunity.score && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Opportunity Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {opportunity.score.overall !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground">Overall</p>
                  <p className="text-xl font-semibold">{opportunity.score.overall}%</p>
                </div>
              )}
              {opportunity.score.eligibility !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground">Eligibility</p>
                  <p className="text-xl font-semibold">{opportunity.score.eligibility}%</p>
                </div>
              )}
              {opportunity.score.competitiveness !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground">Competitiveness</p>
                  <p className="text-xl font-semibold">{opportunity.score.competitiveness}%</p>
                </div>
              )}
              {opportunity.score.strategicFit !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground">Strategic Fit</p>
                  <p className="text-xl font-semibold">{opportunity.score.strategicFit}%</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Requirements</CardTitle>
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

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push("/app/opportunities")}>
          Back to List
        </Button>
        <Button>
          Approve & Continue
        </Button>
      </div>
    </div>
  );
}
