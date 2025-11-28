"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { TenderAnalysis } from "@tenderbot/contracts";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { OpportunityHeader } from "./components/OpportunityHeader";
import { OpportunityOverview } from "./components/OpportunityOverview";
import { RequirementsList } from "./components/RequirementsList";
import { RisksList } from "./components/RisksList";
import { DocumentsManager } from "./components/DocumentsManager";

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
        <TabsList className="grid w-full grid-cols-4 lg:w-[400px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
          <TabsTrigger value="risks">Risks</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
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
      </Tabs>
    </div>
  );
}
