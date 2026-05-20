"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AuditPage() {
  const events = useQuery(api.auditEvents.listRecent, { limit: 100 });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Audit Log</h2>
        <p className="text-sm text-muted-foreground">
          Every critical action should be visible here before it can be trusted operationally.
        </p>
      </div>

      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="text-base normal-case">Recent Events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!events && <p className="text-sm text-muted-foreground">Loading audit events...</p>}
          {events?.map((event) => (
            <div
              key={event._id}
              className="rounded-lg border border-border/40 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{event.entityType}</Badge>
                <Badge variant="secondary">{event.action}</Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(event.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Actor: {event.actorId}</p>
              {event.payload && (
                <pre className="mt-3 overflow-auto rounded-md border border-border/40 bg-background/30 p-3 text-xs">
                  {JSON.stringify(event.payload, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
