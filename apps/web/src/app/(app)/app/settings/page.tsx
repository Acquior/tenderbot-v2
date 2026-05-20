import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Files, ScrollText, ArrowRight } from "lucide-react";

const SETTINGS_SECTIONS = [
  {
    href: "/app/settings/company-profile",
    title: "Company Profile",
    description:
      "Maintain the canonical master profile, verify critical fields, and control activation readiness.",
    icon: Building2,
    badge: "Critical",
  },
  {
    href: "/app/settings/company-documents",
    title: "Company Documents",
    description:
      "Upload reusable company documents, track expiry, and approve only the files that may auto-attach.",
    icon: Files,
    badge: "Operational",
  },
  {
    href: "/app/settings/audit",
    title: "Audit Log",
    description:
      "Review immutable evidence of profile edits, verification actions, document decisions, and exports.",
    icon: ScrollText,
    badge: "Evidence",
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure the single-company workspace around verified facts, approved documents, and
          auditable operations.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {SETTINGS_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href} className="group">
              <Card className="h-full border-border/40 transition-colors group-hover:border-border">
                <CardHeader className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border/50 bg-background/50">
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-[0.2em]">
                      {section.badge}
                    </Badge>
                  </div>
                  <CardTitle className="flex items-center justify-between text-base normal-case">
                    {section.title}
                    <ArrowRight className="h-4 w-4 opacity-50 transition-transform group-hover:translate-x-1" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-muted-foreground">{section.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
