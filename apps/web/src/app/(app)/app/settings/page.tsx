import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">
          Manage workspace access, notifications, model routing, and observability integrations.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Access Control</CardTitle>
            <CardDescription>Clerk org/team mappings to Convex row-level security</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>Role-based permissions (admin, user, viewer)</li>
              <li>Row-level rules enforced per bundle/opportunity</li>
              <li>Audit trail with model fingerprints</li>
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
            <CardDescription>Telemetry and storage providers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Sentry</span>
              <Badge variant="secondary">Planned</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Langfuse</span>
              <Badge variant="secondary">Planned</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Cloudflare R2</span>
              <Badge variant="secondary">Planned</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
