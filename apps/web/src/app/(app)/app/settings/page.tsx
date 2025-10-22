import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Plug, Bell, Users } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage workspace configuration, access control, and integrations
        </p>
      </div>

      {/* Settings Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Access Control */}
        <Card className="border-border/40">
          <CardHeader className="pb-4">
            <div className="h-10 w-10 rounded-lg bg-accent/50 flex items-center justify-center mb-3">
              <Shield className="h-5 w-5 text-accent-foreground" />
            </div>
            <CardTitle className="text-base">Access Control</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground leading-relaxed">
            <p>• Role-based permissions with granular access levels</p>
            <p>• Row-level security enforced per organization</p>
            <p>• Comprehensive audit trail with change tracking</p>
          </CardContent>
        </Card>

        {/* Team Management */}
        <Card className="border-border/40">
          <CardHeader className="pb-4">
            <div className="h-10 w-10 rounded-lg bg-accent/50 flex items-center justify-center mb-3">
              <Users className="h-5 w-5 text-accent-foreground" />
            </div>
            <CardTitle className="text-base">Team Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground leading-relaxed">
            <p>• Invite team members with role assignment</p>
            <p>• Organization-based access control</p>
            <p>• Activity monitoring and user analytics</p>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="border-border/40">
          <CardHeader className="pb-4">
            <div className="h-10 w-10 rounded-lg bg-accent/50 flex items-center justify-center mb-3">
              <Bell className="h-5 w-5 text-accent-foreground" />
            </div>
            <CardTitle className="text-base">Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground leading-relaxed">
            <p>• Document processing status updates</p>
            <p>• Analysis completion alerts</p>
            <p>• Deadline warnings and reminders</p>
          </CardContent>
        </Card>

        {/* Integrations */}
        <Card className="border-border/40">
          <CardHeader className="pb-4">
            <div className="h-10 w-10 rounded-lg bg-accent/50 flex items-center justify-center mb-3">
              <Plug className="h-5 w-5 text-accent-foreground" />
            </div>
            <CardTitle className="text-base">Integrations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Sentry</span>
              <Badge variant="secondary" className="text-xs">Planned</Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Langfuse</span>
              <Badge variant="secondary" className="text-xs">Planned</Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Cloudflare R2</span>
              <Badge variant="secondary" className="text-xs">Planned</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
