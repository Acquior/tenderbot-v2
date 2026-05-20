"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import type { TenderAnalysis } from "@tenderbot/contracts";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { OpportunityHeader } from "./components/OpportunityHeader";
import { OpportunityOverview } from "./components/OpportunityOverview";
import { RequirementsList } from "./components/RequirementsList";
import { RisksList } from "./components/RisksList";
import { DocumentsManager } from "./components/DocumentsManager";
import { WorkspaceOverview } from "./components/WorkspaceOverview";
import { RequirementMatchTable } from "./components/RequirementMatchTable";
import { GapReport } from "./components/GapReport";
import { FormRunsTable } from "./components/FormRunsTable";
import { WorkspaceExportPanel } from "./components/WorkspaceExportPanel";

type SourceDocument = Doc<"documents"> & { url?: string | null };
type FormRun = {
  _id: string;
  sourceDocumentId: string;
  status: string;
  outputDocumentUrl?: string | null;
  fields?: Array<{
    fieldKey: string;
    resolvedValue?: string;
    sourcePath?: string;
    validationStatus: string;
    requiresReview?: boolean;
  }>;
};

export default function OpportunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const opportunityId = params.id as Id<"opportunities">;
  const [workspaceBusyLabel, setWorkspaceBusyLabel] = useState<string | null>(null);
  const [busyFormDocumentId, setBusyFormDocumentId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

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
  const workspace = useQuery(api.tenderWorkspaces.getByOpportunity, { opportunityId });
  const workspaceItems = useQuery(
    api.workspaceItems.listByWorkspace,
    workspace?._id ? { workspaceId: workspace._id } : "skip"
  );
  const requirementMatches = useQuery(
    api.requirementMatches.listByWorkspace,
    workspace?._id ? { workspaceId: workspace._id } : "skip"
  );
  const formRuns = useQuery(
    api.formRuns.listByWorkspace,
    workspace?._id ? { workspaceId: workspace._id } : "skip"
  );
  const exportDocuments = useQuery(
    api.documents.listByWorkspaceWithUrls,
    workspace?._id
      ? { workspaceId: workspace._id, kind: "generated_export" }
      : "skip"
  );

  const createWorkspace = useMutation(api.tenderWorkspaces.createForOpportunity);
  const rebuildWorkspace = useMutation(api.tenderWorkspaces.rebuild);
  const approveWorkspace = useMutation(api.tenderWorkspaces.approveWorkspace);
  const approveFormRun = useMutation(api.formRuns.approveFormRun);
  const exportWorkspaceZip = useAction(api.workspaceExports.exportZip);
  const generatePreview = useAction(api.formRuns.generatePreview);

  // Type the analysis result as TenderAnalysis
  const analysisData = analysis?.result as TenderAnalysis | undefined;

  const handleCreateWorkspace = async () => {
    setWorkspaceBusyLabel("Creating...");
    try {
      await createWorkspace({ opportunityId });
    } finally {
      setWorkspaceBusyLabel(null);
    }
  };

  const handleRebuildWorkspace = async () => {
    if (!workspace?._id) return;
    setWorkspaceBusyLabel("Rebuilding...");
    try {
      await rebuildWorkspace({ workspaceId: workspace._id });
    } finally {
      setWorkspaceBusyLabel(null);
    }
  };

  const handleApproveWorkspace = async () => {
    if (!workspace?._id) return;
    setWorkspaceBusyLabel("Approving...");
    try {
      await approveWorkspace({ workspaceId: workspace._id });
    } finally {
      setWorkspaceBusyLabel(null);
    }
  };

  const handleGeneratePreview = async (documentId: string) => {
    if (!workspace?._id) return;
    setBusyFormDocumentId(documentId);
    try {
      await generatePreview({
        workspaceId: workspace._id,
        sourceDocumentId: documentId as Id<"documents">,
      });
    } finally {
      setBusyFormDocumentId(null);
    }
  };

  const handleApproveFormRun = async (runId: string) => {
    await approveFormRun({ id: runId as Id<"formRuns"> });
  };

  const handleExportWorkspace = async () => {
    if (!workspace?._id) return;
    setExporting(true);
    try {
      await exportWorkspaceZip({ workspaceId: workspace._id });
    } finally {
      setExporting(false);
    }
  };

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
      <OpportunityHeader opportunity={opportunity} />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-6 lg:w-[720px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
          <TabsTrigger value="risks">Risks</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="forms">Forms</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="mt-6">
          <OpportunityOverview 
            opportunity={opportunity} 
            requirementsCount={requirements?.length ?? 0}
            analysisData={analysisData}
          />
        </TabsContent>
        
        <TabsContent value="requirements" className="mt-6">
          <RequirementsList requirements={requirements} />
        </TabsContent>
        
        <TabsContent value="risks" className="mt-6">
          <RisksList risks={opportunity.risks} />
        </TabsContent>
        
        <TabsContent value="documents" className="mt-6">
          <DocumentsManager 
            opportunity={opportunity}
            analysisData={analysisData}
            bundle={bundle}
            sourceDocuments={sourceDocuments}
          />
        </TabsContent>

        <TabsContent value="workspace" className="mt-6 space-y-6">
          <WorkspaceOverview
            workspace={workspace}
            itemCount={workspaceItems?.length ?? 0}
            matchCount={requirementMatches?.length ?? 0}
            onCreate={handleCreateWorkspace}
            onRebuild={handleRebuildWorkspace}
            onApprove={handleApproveWorkspace}
            busyLabel={workspaceBusyLabel}
          />
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <RequirementMatchTable matches={requirementMatches} />
            <GapReport workspace={workspace} items={workspaceItems} />
          </div>
          <WorkspaceExportPanel
            workspace={workspace}
            exportDocuments={exportDocuments}
            onExport={handleExportWorkspace}
            busy={exporting}
          />
        </TabsContent>

        <TabsContent value="forms" className="mt-6">
          <FormRunsTable
            sourceDocuments={sourceDocuments as SourceDocument[] | undefined}
            formRuns={formRuns as FormRun[] | undefined}
            onGeneratePreview={handleGeneratePreview}
            onApprove={handleApproveFormRun}
            busyDocumentId={busyFormDocumentId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
