import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_META = [
  { label: "Draft", description: "Needs review", variant: "outline" as const },
  { label: "In review", description: "Assigned owner", variant: "default" as const },
  { label: "Approved", description: "Ready to submit", variant: "secondary" as const },
];

export default function OpportunitiesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Opportunities</h1>
        <p className="text-muted-foreground">
          Track requirements, risks, and executive-ready summaries grounded in source documents.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {STATUS_META.map((status) => (
          <Card key={status.label}>
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-between">
                <CardTitle>{status.label}</CardTitle>
                <Badge variant={status.variant}>0</Badge>
              </div>
              <CardDescription>{status.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>Requirement matrix with evidence links</li>
                <li>Risk scoring by category & severity</li>
                <li>Actionable tasks with owners & due dates</li>
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
