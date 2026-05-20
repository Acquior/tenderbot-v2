"use client";

import type { Doc } from "@convex/_generated/dataModel";
import type { TenderAnalysis } from "@tenderbot/contracts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  DollarSign,
  FileText,
  Info,
  Scale,
  FileCheck,
  ExternalLink,
  Mail,
  Shield,
} from "lucide-react";

interface OpportunityOverviewProps {
  opportunity: Doc<"opportunities">;
  requirementsCount: number;
  analysisData?: TenderAnalysis;
}

export function OpportunityOverview({
  opportunity,
  requirementsCount,
  analysisData,
}: OpportunityOverviewProps) {
  const mandatoryCount = analysisData?.requirements?.filter((r) => r.mandatory).length ?? 0;
  
  return (
    <div className="space-y-6">
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
            <div className="text-2xl font-semibold">{requirementsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {mandatoryCount} mandatory requirements identified
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

      {/* Scope & Summary Card */}
      {(analysisData?.summary || opportunity.description) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4" />
              Scope & Key Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {analysisData?.summary || opportunity.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Evaluation Criteria & Submission Details - Side by Side */}
      {(analysisData?.evaluationCriteria?.length || analysisData?.submission) && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Evaluation Criteria */}
          {analysisData?.evaluationCriteria && analysisData.evaluationCriteria.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Evaluation Criteria
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysisData.evaluationCriteria.map((criteria, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 border border-border/40 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{criteria.criterion}</span>
                        {criteria.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {criteria.description}
                          </p>
                        )}
                      </div>
                      {criteria.weight !== undefined && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {criteria.weight}%
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submission Details */}
          {analysisData?.submission && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileCheck className="h-4 w-4" />
                  Submission Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-24">Method:</span>
                    <Badge variant="outline" className="text-xs capitalize">
                      {analysisData.submission.method}
                    </Badge>
                  </div>
                  {analysisData.submission.portalUrl && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-24">Portal:</span>
                      <a
                        href={analysisData.submission.portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        {analysisData.submission.portalUrl}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                  {analysisData.submission.email && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-24">Email:</span>
                      <a
                        href={`mailto:${analysisData.submission.email}`}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        {analysisData.submission.email}
                        <Mail className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                  {analysisData.submission.validityPeriodDays && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-24">Validity:</span>
                      <span className="text-xs">{analysisData.submission.validityPeriodDays} days</span>
                    </div>
                  )}
                  {analysisData.submission.instructions && (
                    <div className="pt-2 border-t border-border/40">
                      <p className="text-xs text-muted-foreground">
                        {analysisData.submission.instructions}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}


