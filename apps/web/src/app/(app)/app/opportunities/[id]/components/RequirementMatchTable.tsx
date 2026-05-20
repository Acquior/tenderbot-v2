"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RequirementMatchRow = {
  _id: string;
  status: string;
  rationale?: string;
  requirement?: {
    description?: string;
    mandatory?: boolean;
  } | null;
  companyDocument?: {
    title?: string;
  } | null;
};

function matchVariant(status: string): "secondary" | "destructive" | "outline" {
  if (status === "matched") return "secondary";
  if (status === "missing" || status === "conflict") return "destructive";
  return "outline";
}

export function RequirementMatchTable({ matches }: { matches: RequirementMatchRow[] | undefined }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base normal-case">Requirement Matches</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Requirement</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Selected Document</TableHead>
              <TableHead>Rationale</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(matches ?? []).map((match) => (
              <TableRow key={match._id}>
                <TableCell className="align-top">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{match.requirement?.description ?? "Unknown requirement"}</p>
                    {match.requirement?.mandatory && (
                      <Badge variant="destructive" className="text-[10px]">
                        Mandatory
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <Badge variant={matchVariant(match.status)}>{match.status}</Badge>
                </TableCell>
                <TableCell className="align-top text-sm text-muted-foreground">
                  {match.companyDocument?.title ?? "None selected"}
                </TableCell>
                <TableCell className="align-top text-sm text-muted-foreground">
                  {match.rationale ?? "No rationale recorded."}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
