import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUser } from "./auth";
import JSZip from "jszip";

function sanitizePathSegment(value: string): string {
  return value.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/\s+/g, " ").trim();
}

function formatDateSegment(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
}

function buildRootFolder(opportunity: any): string {
  const issuer = sanitizePathSegment(opportunity.issuer ?? "Issuer").replace(/\s+/g, "_");
  const reference = sanitizePathSegment(opportunity.referenceNumber ?? opportunity._id).replace(/\s+/g, "_");
  return `Tender_${issuer}_${reference}_${formatDateSegment(Date.now())}`;
}

async function downloadDocumentBytes(
  ctx: { storage: { getUrl: (storageId: string) => Promise<string | null> } },
  storageId: string
): Promise<Uint8Array> {
  const url = await ctx.storage.getUrl(storageId);
  if (!url) {
    throw new Error("Unable to resolve storage URL for export.");
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download export file (${response.status}).`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

function toBlobPart(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function buildGapsMarkdown(workspace: any, items: any[], matches: any[]): string {
  const missingItems = items.filter((item) => item.status === "missing" || item.status === "blocked");
  const missingMatches = matches.filter((match) => match.status === "missing" || match.status === "conflict");

  const lines = [
    "# Tender Workspace Gaps",
    "",
    `Readiness: ${workspace.readiness}`,
    `Missing mandatory count: ${workspace.missingMandatoryCount}`,
    `Critical conflict count: ${workspace.criticalConflictCount}`,
    "",
    "## Missing or blocked items",
  ];

  if (missingItems.length === 0) {
    lines.push("", "No missing or blocked workspace items.");
  } else {
    for (const item of missingItems) {
      lines.push(`- ${item.path}: ${item.notes ?? item.status}`);
    }
  }

  lines.push("", "## Requirement match issues");
  if (missingMatches.length === 0) {
    lines.push("", "No unresolved requirement matches.");
  } else {
    for (const match of missingMatches) {
      lines.push(`- ${match.requirement?.description ?? match.requirementId}: ${match.rationale ?? match.status}`);
    }
  }

  return lines.join("\n");
}

function buildReviewChecklist(workspace: any, formRuns: any[]): string {
  const lines = [
    "# Review Checklist",
    "",
    `Workspace status: ${workspace.status}`,
    `Readiness: ${workspace.readiness}`,
    "",
    "- Confirm every mandatory attachment is present and current.",
    "- Confirm all critical company fields were sourced from verified profile values.",
    "- Confirm any yellow-state items were manually reviewed before submission.",
    "- Confirm form previews were checked against source tender instructions.",
  ];

  const blockedRuns = formRuns.filter((run) => run.status === "blocked");
  if (blockedRuns.length > 0) {
    lines.push("", "## Blocked form runs");
    for (const run of blockedRuns) {
      lines.push(`- ${run.sourceDocumentId}: blocked by validation.`);
    }
  }

  return lines.join("\n");
}

export const exportZip = action({
  args: {
    workspaceId: v.id("tenderWorkspaces"),
  },
  handler: async (ctx, args): Promise<any> => {
    const identity = await requireUser(ctx);

    const workspace: any = await ctx.runQuery(internal.tenderWorkspaces.getInternal, {
      workspaceId: args.workspaceId,
    });
    if (!workspace) {
      throw new Error("Workspace not found.");
    }

    if (workspace.readiness === "red") {
      throw new Error("Red workspaces cannot be exported.");
    }

    const opportunity: any = await ctx.runQuery(internal.opportunities.getInternal, {
      opportunityId: workspace.opportunityId,
    });
    if (!opportunity) {
      throw new Error("Opportunity not found.");
    }

    const items: any[] = await ctx.runQuery(internal.tenderWorkspaces.listWorkspaceItemsInternal, {
      workspaceId: args.workspaceId,
    });
    const matches: any[] = await ctx.runQuery(internal.tenderWorkspaces.listRequirementMatchesInternal, {
      workspaceId: args.workspaceId,
    });
    const formRuns: any[] = await ctx.runQuery(internal.formRuns.listByWorkspaceInternal, {
      workspaceId: args.workspaceId,
    });

    const rootFolder = buildRootFolder(opportunity);
    const zip = new JSZip();

    for (const item of [...items].sort((a, b) => a.path.localeCompare(b.path))) {
      const normalizedPath = `${rootFolder}/${item.path}`;

      if (item.itemType === "folder") {
        zip.folder(normalizedPath);
        continue;
      }

      if (item.itemType === "placeholder") {
        zip.file(normalizedPath, item.notes ?? "Manual review required.");
        continue;
      }

      if (!item.sourceDocumentId) {
        zip.file(normalizedPath, item.notes ?? "Referenced file is missing from source storage.");
        continue;
      }

      const sourceDocument = await ctx.runQuery(internal.documents.getInternal, {
        documentId: item.sourceDocumentId,
      });

      if (!sourceDocument) {
        zip.file(normalizedPath, "Referenced file is missing from the documents table.");
        continue;
      }

      const bytes = await downloadDocumentBytes(ctx, sourceDocument.storageId);
      zip.file(normalizedPath, bytes);
    }

    const manifest = {
      workspaceId: args.workspaceId,
      opportunityId: workspace.opportunityId,
      readiness: workspace.readiness,
      status: workspace.status,
      summary: workspace.summary,
      generatedAt: new Date().toISOString(),
      reviewRequired: workspace.readiness === "yellow",
      items: items.map((item) => ({
        path: item.path,
        itemType: item.itemType,
        status: item.status,
        sourceDocumentId: item.sourceDocumentId ?? null,
        requirementId: item.requirementId ?? null,
      })),
    };

    zip.file(`${rootFolder}/07_Generated/manifest.json`, JSON.stringify(manifest, null, 2));
    zip.file(`${rootFolder}/07_Generated/gaps.md`, buildGapsMarkdown(workspace, items, matches));
    zip.file(`${rootFolder}/00_README/review-checklist.md`, buildReviewChecklist(workspace, formRuns));
    zip.file(
      `${rootFolder}/07_Generated/form-field-report.json`,
      JSON.stringify(formRuns, null, 2)
    );

    const zipBytes = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
    });

    const storageId = await ctx.storage.store(
      new Blob([toBlobPart(zipBytes)], { type: "application/zip" })
    );

    const exportDocumentId: any = await ctx.runMutation(internal.documents.createGeneratedInternal, {
      filename: `${rootFolder}.zip`,
      mimeType: "application/zip",
      size: zipBytes.length,
      storageId,
      kind: "generated_export",
      createdBy: identity.clerkUserId,
      bundleId: workspace.bundleId,
      profileId: workspace.profileId,
      workspaceId: args.workspaceId,
      documentCategory: "workspace_export",
      approvalStatus: "approved",
    });

    await ctx.runMutation(internal.tenderWorkspaces.updateWorkspaceStateInternal, {
      workspaceId: args.workspaceId,
      status: "exported",
      readiness: workspace.readiness,
      missingMandatoryCount: workspace.missingMandatoryCount,
      criticalConflictCount: workspace.criticalConflictCount,
      summary: workspace.summary,
      exportDocumentId,
    });

    await ctx.runMutation(internal.auditEvents.logInternal, {
      entityType: "workspace",
      entityId: args.workspaceId,
      action: "workspace_exported",
      actorId: identity.clerkUserId,
      payload: {
        exportDocumentId,
        reviewRequired: workspace.readiness === "yellow",
      },
    });

    return {
      exportDocumentId,
      filename: `${rootFolder}.zip`,
    };
  },
});
