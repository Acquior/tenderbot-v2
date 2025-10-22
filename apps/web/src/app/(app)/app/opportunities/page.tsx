"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { Plus, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type StatusColumn = {
  label: "Draft" | "In Review" | "Approved";
  statusKey: "draft" | "in_review" | "approved";
  icon: typeof FileText | typeof AlertCircle | typeof CheckCircle2;
  description: string;
  variant: "outline" | "secondary" | "default";
};

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

const STATUS_COLUMNS: StatusColumn[] = [
  {
    label: "Draft",
    statusKey: "draft",
    icon: FileText,
    description: "Awaiting review",
    variant: "outline",
  },
  {
    label: "In Review",
    statusKey: "in_review",
    icon: AlertCircle,
    description: "Under analysis",
    variant: "secondary",
  },
  {
    label: "Approved",
    statusKey: "approved",
    icon: CheckCircle2,
    description: "Ready to submit",
    variant: "default",
  },
];

interface OpportunityFormState {
  title: string;
  issuer: string;
  dueDate: string;
  description: string;
}

const defaultFormState: OpportunityFormState = {
  title: "",
  issuer: "",
  dueDate: "",
  description: "",
};

export default function OpportunitiesPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formState, setFormState] = useState<OpportunityFormState>(defaultFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const opportunityArgs: OpportunityListArgs | "skip" =
    isLoaded && isSignedIn ? {} : "skip";

  const opportunities = useQuery(api.opportunities.list, opportunityArgs);

  const upsertOpportunity = useMutation(api.opportunities.upsert);

  const statusAggregates = useMemo(() => {
    const counts: Record<StatusColumn["statusKey"], number> = {
      draft: 0,
      in_review: 0,
      approved: 0,
    };

    for (const opportunity of opportunities ?? []) {
      if (opportunity.status === "draft") {
        counts.draft += 1;
      } else if (opportunity.status === "in_review") {
        counts.in_review += 1;
      } else if (opportunity.status === "approved") {
        counts.approved += 1;
      }
    }

    return counts;
  }, [opportunities]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formState.title || !formState.issuer || !formState.dueDate) {
      setFormError("Please complete the required fields.");
      return;
    }

    const dueDateMs = Date.parse(formState.dueDate);
    if (Number.isNaN(dueDateMs)) {
      setFormError("Please provide a valid due date.");
      return;
    }

    try {
      setFormError(null);
      setIsSubmitting(true);
      await upsertOpportunity({
        title: formState.title,
        issuer: formState.issuer,
        dueDate: dueDateMs,
        status: "draft",
        description: formState.description || undefined,
      });

      setFormState(defaultFormState);
      setIsCreateOpen(false);
    } catch (error) {
      console.error("Failed to create opportunity", error);
      const message = error instanceof Error ? error.message : "Failed to create opportunity.";
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <Button type="button" className="gap-2" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New Opportunity
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {STATUS_COLUMNS.map((status) => {
          const Icon = status.icon;
          return (
            <Card key={status.label} className="border-border/40">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-lg bg-accent/50 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <Badge variant={status.variant}>
                    {statusAggregates[status.statusKey] ?? 0}
                  </Badge>
                </div>
                <CardTitle className="text-base">{status.label}</CardTitle>
                <p className="text-xs text-muted-foreground">{status.description}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                  <p>• Requirement matrix with evidence links</p>
                  <p>• Risk scoring by category and severity</p>
                  <p>• Action items with owners and deadlines</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="text-base">Active Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          {!opportunities && (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">Fetching opportunities…</p>
            </div>
          )}

          {opportunities && opportunities.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-lg bg-accent/50 flex items-center justify-center mb-4">
                <Plus className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium mb-1">No opportunities yet</p>
              <p className="text-xs text-muted-foreground mb-4 max-w-sm">
                Create your first opportunity to track requirements and analyze tender submissions
              </p>
              <Button size="sm" variant="outline" type="button" onClick={() => setIsCreateOpen(true)}>
                Create Opportunity
              </Button>
            </div>
          )}

          {opportunities && opportunities.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 font-medium">Title</th>
                    <th className="py-2 font-medium">Issuer</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {opportunities.map((opportunity) => (
                    <tr key={opportunity._id}>
                      <td className="py-3 font-medium text-foreground">{opportunity.title}</td>
                      <td className="py-3 text-muted-foreground">{opportunity.issuer}</td>
                      <td className="py-3">
                        <Badge
                          variant={
                            opportunity.status === "approved"
                              ? "default"
                              : opportunity.status === "in_review"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {opportunity.status.replaceAll("_", " ")}
                        </Badge>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {new Date(opportunity.dueDate).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur">
          <div className="w-full max-w-md rounded-lg border border-border/40 bg-card p-6 shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">Create Opportunity</h3>
                <p className="text-sm text-muted-foreground">
                  Capture the basics and start tracking requirements immediately.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsCreateOpen(false);
                  setFormError(null);
                }}
                aria-label="Close create opportunity dialog"
              >
                X
              </Button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="title">
                  Title
                </label>
                <Input
                  id="title"
                  value={formState.title}
                  onChange={(event) =>
                    setFormState((state) => ({ ...state, title: event.target.value }))
                  }
                  placeholder="e.g. Municipal Wi-Fi Expansion"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="issuer">
                  Issuer
                </label>
                <Input
                  id="issuer"
                  value={formState.issuer}
                  onChange={(event) =>
                    setFormState((state) => ({ ...state, issuer: event.target.value }))
                  }
                  placeholder="e.g. City of Cape Town"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="dueDate">
                  Due Date
                </label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formState.dueDate}
                  onChange={(event) =>
                    setFormState((state) => ({ ...state, dueDate: event.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="description">
                  Summary (optional)
                </label>
                <Textarea
                  id="description"
                  value={formState.description}
                  onChange={(event) =>
                    setFormState((state) => ({ ...state, description: event.target.value }))
                  }
                  placeholder="Key requirements, goals, or constraints"
                  rows={4}
                />
              </div>

              {formError && <p className="text-sm text-destructive">{formError}</p>}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setFormError(null);
                    setFormState(defaultFormState);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating…" : "Create Opportunity"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
