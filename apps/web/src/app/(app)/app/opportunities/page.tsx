"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { CreateOpportunityDialog } from "./components/CreateOpportunityDialog";
import { StatusStats } from "./components/StatusStats";
import { OpportunityList } from "./components/OpportunityList";

type OpportunityListArgs = {
  status?:
    | "draft"
    | "analyzing"
    | "analysis_complete"
    | "in_review"
    | "approved"
    | "rejected"
    | "submitted"
    | "closed";
};

export default function OpportunitiesPage() {
  const { isLoaded, isSignedIn } = useAuth();

  const opportunityArgs: OpportunityListArgs | "skip" =
    isLoaded && isSignedIn ? {} : "skip";

  const opportunities = useQuery(api.opportunities.list, opportunityArgs);

  if (!isLoaded) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Opportunities</h2>
        <p className="text-sm text-muted-foreground">Loading opportunity data…</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Opportunities</h2>
        <p className="text-sm text-muted-foreground">
          Sign in to manage tender opportunities and track progress.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Opportunities</h2>
          <p className="text-sm text-muted-foreground">
            Track requirements, assess risks, and manage tender submissions
          </p>
        </div>
        <CreateOpportunityDialog />
      </div>

      <StatusStats opportunities={opportunities} />

      <OpportunityList opportunities={opportunities} />
    </div>
  );
}
