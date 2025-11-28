"use client";

import { useState } from "react";
import Link from "next/link";
import type { Doc } from "@convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  Plus,
  Search,
  Calendar,
  Building2,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Circle,
} from "lucide-react";
import { CreateOpportunityDialog } from "./CreateOpportunityDialog";

interface OpportunityListProps {
  opportunities: Doc<"opportunities">[] | undefined;
}

export function OpportunityList({ opportunities }: OpportunityListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredOpportunities = opportunities?.filter((opp) => {
    const matchesSearch =
      opp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opp.issuer.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus =
      statusFilter === "all" || opp.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    switch (normalizedStatus) {
      case "approved":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-50">
            Approved
          </Badge>
        );
      case "in_review":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50">
            In Review
          </Badge>
        );
      case "draft":
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-50">
            Draft
          </Badge>
        );
      case "analysis_complete":
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-50">
            Analyzed
          </Badge>
        );
      case "analyzing":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-50">
            Analyzing
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="capitalize">
            {status.replaceAll("_", " ")}
          </Badge>
        );
    }
  };

  return (
    <Card className="border-border/40 shadow-sm">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <CardTitle className="text-lg font-semibold">Active Opportunities</CardTitle>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search opportunities..."
                className="pl-8 w-full sm:w-[250px] bg-background"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <CreateOpportunityDialog />
          </div>
        </div>
        
        <div className="mt-4">
          <Tabs defaultValue="all" value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="h-9 w-full sm:w-auto">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="draft">Draft</TabsTrigger>
              <TabsTrigger value="in_review">In Review</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {!opportunities && (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-muted-foreground">Fetching opportunities…</p>
          </div>
        )}

        {opportunities && opportunities.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-base font-medium mb-1">No opportunities yet</p>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              Create your first opportunity to track requirements and analyze tender submissions
            </p>
            <CreateOpportunityDialog />
          </div>
        )}

        {opportunities && opportunities.length > 0 && filteredOpportunities?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
             <p className="text-sm text-muted-foreground">No opportunities match your filter.</p>
          </div>
        )}

        {filteredOpportunities && filteredOpportunities.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[450px]">Title</TableHead>
                <TableHead className="w-[200px]">Issuer</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[150px]">Risks</TableHead>
                <TableHead className="text-right w-[120px]">Due Date</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOpportunities.map((opportunity) => {
                // Calculate risk indicators
                const risks = opportunity.risks ?? [];
                const criticalCount = risks.filter((r) => r.severity === "critical").length;
                const highCount = risks.filter((r) => r.severity === "high").length;
                const mediumCount = risks.filter((r) => r.severity === "medium").length;
                const lowCount = risks.filter((r) => r.severity === "low").length;
                
                const hasRisks = risks.length > 0;
                const hasBlockers = criticalCount > 0 || highCount > 0;

                return (
                  <TableRow 
                    key={opportunity._id} 
                    className="group cursor-pointer hover:bg-muted/40"
                  >
                    <TableCell className="font-medium">
                      <Link
                        href={`/app/opportunities/${opportunity._id}`}
                        className="block group-hover:text-primary transition-colors line-clamp-2"
                        title={opportunity.title}
                      >
                        {opportunity.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-muted-foreground">
                          <Building2 className="h-3 w-3 shrink-0" />
                          <span className="truncate" title={opportunity.issuer}>
                            {opportunity.issuer}
                          </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(opportunity.status)}
                    </TableCell>
                    <TableCell>
                      {hasBlockers ? (
                        <div className="flex flex-col gap-1">
                          {criticalCount > 0 && (
                            <Badge variant="outline" className="w-fit text-[10px] h-5 px-1.5 bg-red-50 text-red-700 border-red-200 gap-1">
                              <ShieldAlert className="h-3 w-3" /> {criticalCount} Critical
                            </Badge>
                          )}
                          {highCount > 0 && (
                            <Badge variant="outline" className="w-fit text-[10px] h-5 px-1.5 bg-orange-50 text-orange-700 border-orange-200 gap-1">
                              <AlertTriangle className="h-3 w-3" /> {highCount} High
                            </Badge>
                          )}
                        </div>
                      ) : hasRisks ? (
                         <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                            <ShieldCheck className="h-4 w-4 text-green-600" />
                            <span>{mediumCount + lowCount} issues</span>
                         </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-muted-foreground text-sm opacity-50">
                           <Circle className="h-3 w-3" />
                           <span>None</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      <div className="flex items-center justify-end gap-2">
                          <span>{new Date(opportunity.dueDate).toLocaleDateString()}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                        <Link 
                            href={`/app/opportunities/${opportunity._id}`}
                            className="flex items-center justify-center text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                        >
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
