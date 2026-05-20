"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useState } from "react";

interface OpportunityHeaderProps {
  opportunity: Doc<"opportunities">;
}

export function OpportunityHeader({ opportunity }: OpportunityHeaderProps) {
  const router = useRouter();
  const updateStatus = useMutation(api.opportunities.updateStatus);
  const [isApproving, setIsApproving] = useState(false);

  const handleApprove = async () => {
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
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-500 hover:bg-green-600";
      case "in_review":
        return "bg-blue-500 hover:bg-blue-600";
      case "rejected":
        return "bg-red-500 hover:bg-red-600";
      default:
        return "bg-gray-500 hover:bg-gray-600";
    }
  };

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/app/opportunities")} className="-mt-1">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{opportunity.title}</h1>
          <p className="text-sm text-muted-foreground">{opportunity.issuer}</p>
        </div>
        <Badge variant={opportunity.status === "approved" ? "default" : "secondary"} className="mt-1 capitalize">
          {opportunity.status.replaceAll("_", " ")}
        </Badge>
      </div>

      <div className="flex items-center gap-2 ml-14 md:ml-0">
        <Button
          onClick={handleApprove}
          disabled={isApproving || opportunity.status === "approved"}
          className={opportunity.status === "approved" ? "bg-green-600 hover:bg-green-700" : ""}
        >
          {isApproving ? (
            "Approving..."
          ) : opportunity.status === "approved" ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Approved
            </>
          ) : (
            "Approve Opportunity"
          )}
        </Button>
      </div>
    </div>
  );
}


