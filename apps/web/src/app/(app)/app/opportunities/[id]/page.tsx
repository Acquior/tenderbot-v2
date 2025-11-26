"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import type { TenderAnalysis } from "@tenderbot/contracts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  CheckSquare,
  CircleDot,
  ClipboardList,
  DollarSign,
  Download,
  Edit3,
  ExternalLink,
  FileCheck,
  FileIcon,
  FileText,
  FolderOpen,
  Info,
  Mail,
  Package,
  Plus,
  RotateCcw,
  Save,
  Scale,
  Shield,
  ShieldAlert,
  Square,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";

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
  const analysis = useQuery(
    api.analyses.get,
    opportunity?.analysisId ? { id: opportunity.analysisId } : "skip"
  );
  const sourceDocuments = useQuery(
    api.documents.listByBundleWithUrls,
    opportunity?.bundleId ? { bundleId: opportunity.bundleId } : "skip"
  );

  // Type the analysis result as TenderAnalysis
  const analysisData = analysis?.result as TenderAnalysis | undefined;

  // Mutations for documents checklist editing
  const updateDocumentsChecklist = useMutation(api.opportunities.updateDocumentsChecklist);
  const resetDocumentsChecklist = useMutation(api.opportunities.resetDocumentsChecklist);
  const updateStatus = useMutation(api.opportunities.updateStatus);

  // Approval state
  const [isApproving, setIsApproving] = useState(false);

  // Documents checklist state for editing
  type ChecklistItem = {
    name: string;
    mandatory: boolean;
    instructions?: string;
    source?: { documentId?: string; page?: number; quote?: string };
  };

  const [isEditingChecklist, setIsEditingChecklist] = useState(false);
  const [editedChecklist, setEditedChecklist] = useState<ChecklistItem[]>([]);
  const [isSavingChecklist, setIsSavingChecklist] = useState(false);

  // Get the active checklist (edited or original)
  const activeChecklist = useMemo(() => {
    if (opportunity?.editedDocumentsChecklist && opportunity.editedDocumentsChecklist.length > 0) {
      return opportunity.editedDocumentsChecklist;
    }
    return analysisData?.documentsChecklist ?? [];
  }, [opportunity?.editedDocumentsChecklist, analysisData?.documentsChecklist]);

  const hasManualEdits = Boolean(opportunity?.editedDocumentsChecklist && opportunity.editedDocumentsChecklist.length > 0);

  // Start editing - copy current list to edit state
  const handleStartEditing = () => {
    setEditedChecklist([...activeChecklist]);
    setIsEditingChecklist(true);
  };

  // Cancel editing
  const handleCancelEditing = () => {
    setEditedChecklist([]);
    setIsEditingChecklist(false);
  };

  // Save edited checklist
  const handleSaveChecklist = async () => {
    if (!opportunity) return;
    setIsSavingChecklist(true);
    try {
      await updateDocumentsChecklist({
        opportunityId: opportunity._id,
        documentsChecklist: editedChecklist,
      });
      setIsEditingChecklist(false);
      setEditedChecklist([]);
    } catch (error) {
      console.error("Failed to save checklist:", error);
    } finally {
      setIsSavingChecklist(false);
    }
  };

  // Reset to original LLM-extracted list
  const handleResetChecklist = async () => {
    if (!opportunity) return;
    setIsSavingChecklist(true);
    try {
      await resetDocumentsChecklist({ opportunityId: opportunity._id });
    } catch (error) {
      console.error("Failed to reset checklist:", error);
    } finally {
      setIsSavingChecklist(false);
    }
  };

  // Add new item
  const handleAddItem = () => {
    setEditedChecklist([...editedChecklist, { name: "", mandatory: true }]);
  };

  // Update item
  const handleUpdateItem = (index: number, field: keyof ChecklistItem, value: string | boolean) => {
    const updated = [...editedChecklist];
    updated[index] = { ...updated[index], [field]: value };
    setEditedChecklist(updated);
  };

  // Delete item
  const handleDeleteItem = (index: number) => {
    setEditedChecklist(editedChecklist.filter((_, i) => i !== index));
  };

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

  // Eligibility snapshot - compute from mandatory requirements
  const eligibilityStats = useMemo(() => {
    const mandatory = requirements?.filter((r) => r.mandatory) ?? [];
    const met = mandatory.filter((r) => r.status === "met").length;
    const notMet = mandatory.filter((r) => r.status === "not_met").length;
    const unknown = mandatory.filter((r) => r.status === "unknown").length;
    const partial = mandatory.filter((r) => r.status === "partial").length;
    return { total: mandatory.length, met, notMet, unknown, partial };
  }, [requirements]);

  // Group risks by category
  type Risk = NonNullable<typeof opportunity>["risks"] extends (infer R)[] | undefined ? R : never;
  const groupedRisks = useMemo(() => {
    if (!opportunity?.risks) return {} as Record<RiskCategory, Risk[]>;

    return opportunity.risks.reduce((acc, risk) => {
      const category = risk.category as RiskCategory;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(risk);
      return acc;
    }, {} as Record<RiskCategory, Risk[]>);
  }, [opportunity?.risks]);

  // Risk summary counts
  const riskCounts = useMemo(() => {
    const risks = opportunity?.risks ?? [];
    return {
      total: risks.length,
      critical: risks.filter((r) => r.severity === "critical").length,
      high: risks.filter((r) => r.severity === "high").length,
      medium: risks.filter((r) => r.severity === "medium").length,
      low: risks.filter((r) => r.severity === "low").length,
    };
  }, [opportunity?.risks]);

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

      {/* Source Tender Documents */}
      {sourceDocuments && sourceDocuments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Source Tender Documents
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Click to view the original tender documents and verify the analysis
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sourceDocuments.map((doc) => (
                <div
                  key={doc._id}
                  className="flex items-center justify-between p-3 border border-border/40 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.filename}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {(doc.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {doc.status}
                        </Badge>
                        {doc.metadata?.pageCount && (
                          <span className="text-xs text-muted-foreground">
                            {doc.metadata.pageCount} pages
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {doc.url && (
                      <>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 hover:bg-accent rounded-md transition-colors"
                          title="View document"
                        >
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </a>
                        <a
                          href={doc.url}
                          download={doc.filename}
                          className="p-2 hover:bg-accent rounded-md transition-colors"
                          title="Download document"
                        >
                          <Download className="h-4 w-4 text-muted-foreground" />
                        </a>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents Required for Submission - with manual override */}
      {(activeChecklist.length > 0 || isEditingChecklist) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Documents Required for Submission
                {hasManualEdits && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    Edited
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                {!isEditingChecklist ? (
                  <>
                    {hasManualEdits && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleResetChecklist}
                        disabled={isSavingChecklist}
                        title="Reset to original LLM-extracted list"
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Reset
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={handleStartEditing}>
                      <Edit3 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" onClick={handleCancelEditing}>
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveChecklist}
                      disabled={isSavingChecklist}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      {isSavingChecklist ? "Saving..." : "Save"}
                    </Button>
                  </>
                )}
              </div>
            </div>
            {!isEditingChecklist && (
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-xs text-muted-foreground">
                  {activeChecklist.length} documents
                </span>
                <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                  {activeChecklist.filter(d => d.mandatory).length} mandatory
                </Badge>
                <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200">
                  {activeChecklist.filter(d => !d.mandatory).length} optional
                </Badge>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {/* View Mode */}
            {!isEditingChecklist && (
              <div className="space-y-2">
                {activeChecklist.map((doc, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 border border-border/40 rounded-lg"
                  >
                    <div className="mt-0.5">
                      {doc.mandatory ? (
                        <CheckSquare className="h-4 w-4 text-red-500" />
                      ) : (
                        <Square className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{doc.name}</span>
                        {doc.mandatory && (
                          <Badge variant="destructive" className="text-xs">
                            Mandatory
                          </Badge>
                        )}
                      </div>
                      {doc.instructions && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {doc.instructions}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Edit Mode */}
            {isEditingChecklist && (
              <div className="space-y-3">
                {editedChecklist.map((doc, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 border border-border/40 rounded-lg bg-accent/20"
                  >
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateItem(index, "mandatory", !doc.mandatory)}
                        className="focus:outline-none"
                        title={doc.mandatory ? "Mark as optional" : "Mark as mandatory"}
                      >
                        {doc.mandatory ? (
                          <CheckSquare className="h-4 w-4 text-red-500" />
                        ) : (
                          <Square className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                    <div className="flex-1 space-y-2">
                      <Input
                        value={doc.name}
                        onChange={(e) => handleUpdateItem(index, "name", e.target.value)}
                        placeholder="Document name (e.g., Tax Clearance Certificate)"
                        className="text-sm"
                      />
                      <Input
                        value={doc.instructions || ""}
                        onChange={(e) => handleUpdateItem(index, "instructions", e.target.value)}
                        placeholder="Instructions (optional)"
                        className="text-xs"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteItem(index)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Document
                </Button>
              </div>
            )}
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

      {/* Risks Card */}
      {opportunity.risks && opportunity.risks.length > 0 && (
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
              {(Object.entries(groupedRisks) as [RiskCategory, typeof opportunity.risks][]).map(([category, risks]) => (
                <div key={category} className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    {RISK_CATEGORY_LABELS[category]}
                    <Badge variant="outline">{risks.length}</Badge>
                  </h3>
                  <div className="space-y-2">
                    {risks.map((risk, index) => {
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
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push("/app/opportunities")}>
          Back to List
        </Button>
        <Button
          disabled={isApproving || opportunity?.status === "approved"}
          onClick={async () => {
            if (!opportunity) return;
            setIsApproving(true);
            try {
              await updateStatus({
                id: opportunity._id,
                status: "approved",
              });
              router.push("/app/opportunities");
            } catch (error) {
              console.error("Failed to approve opportunity:", error);
            } finally {
              setIsApproving(false);
            }
          }}
        >
          {isApproving ? "Approving…" : opportunity?.status === "approved" ? "Approved" : "Approve & Continue"}
        </Button>
      </div>
    </div>
  );
}
