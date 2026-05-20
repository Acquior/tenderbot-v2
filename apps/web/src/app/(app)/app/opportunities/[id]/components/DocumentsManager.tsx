"use client";

import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import type { TenderAnalysis } from "@tenderbot/contracts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ClipboardList,
  Download,
  Edit3,
  ExternalLink,
  FileIcon,
  FolderOpen,
  Package,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
  CheckSquare,
  Square,
} from "lucide-react";

interface DocumentsManagerProps {
  opportunity: Doc<"opportunities">;
  analysisData?: TenderAnalysis;
  bundle?: Doc<"bundles"> | null;
  sourceDocuments?: Array<Doc<"documents"> & { url?: string | null }> | undefined;
}

export function DocumentsManager({
  opportunity,
  analysisData,
  bundle,
  sourceDocuments,
}: DocumentsManagerProps) {
  // Mutations for documents checklist editing
  const updateDocumentsChecklist = useMutation(api.opportunities.updateDocumentsChecklist);
  const resetDocumentsChecklist = useMutation(api.opportunities.resetDocumentsChecklist);

  // Documents checklist state for editing
  type ChecklistItem = {
    name: string;
    mandatory: boolean;
    instructions?: string;
    category?: "administrative" | "technical" | "financial" | "commercial" | "legal" | "bee" | "sbd_form" | "other";
    source?: { documentId?: string; page?: number; quote?: string };
  };

  const [isEditingChecklist, setIsEditingChecklist] = useState(false);
  const [editedChecklist, setEditedChecklist] = useState<ChecklistItem[]>([]);
  const [isSavingChecklist, setIsSavingChecklist] = useState(false);

  // Get the active checklist (edited or original)
  const activeChecklist = useMemo(() => {
    if (opportunity?.editedDocumentsChecklist && opportunity.editedDocumentsChecklist.length > 0) {
      return opportunity.editedDocumentsChecklist;
    }
    return analysisData?.documentsChecklist ?? [];
  }, [opportunity?.editedDocumentsChecklist, analysisData?.documentsChecklist]);

  const hasManualEdits = Boolean(opportunity?.editedDocumentsChecklist && opportunity.editedDocumentsChecklist.length > 0);

  // Start editing - copy current list to edit state
  const handleStartEditing = () => {
    setEditedChecklist(
      activeChecklist.map((item) => ({
        name: item.name,
        mandatory: item.mandatory,
        instructions: item.instructions ?? undefined,
        category: "category" in item ? item.category ?? undefined : undefined,
        source: item.source
          ? {
              documentId: item.source.documentId ?? undefined,
              page: item.source.page ?? undefined,
              quote: item.source.quote ?? undefined,
            }
          : undefined,
      }))
    );
    setIsEditingChecklist(true);
  };

  // Cancel editing
  const handleCancelEditing = () => {
    setEditedChecklist([]);
    setIsEditingChecklist(false);
  };

  // Save edited checklist
  const handleSaveChecklist = async () => {
    if (!opportunity) return;
    setIsSavingChecklist(true);
    try {
      await updateDocumentsChecklist({
        opportunityId: opportunity._id,
        documentsChecklist: editedChecklist,
      });
      setIsEditingChecklist(false);
      setEditedChecklist([]);
    } catch (error) {
      console.error("Failed to save checklist:", error);
    } finally {
      setIsSavingChecklist(false);
    }
  };

  // Reset to original LLM-extracted list
  const handleResetChecklist = async () => {
    if (!opportunity) return;
    setIsSavingChecklist(true);
    try {
      await resetDocumentsChecklist({ opportunityId: opportunity._id });
    } catch (error) {
      console.error("Failed to reset checklist:", error);
    } finally {
      setIsSavingChecklist(false);
    }
  };

  // Add new item
  const handleAddItem = () => {
    setEditedChecklist([...editedChecklist, { name: "", mandatory: true }]);
  };

  // Update item
  const handleUpdateItem = (index: number, field: keyof ChecklistItem, value: string | boolean) => {
    const updated = [...editedChecklist];
    updated[index] = { ...updated[index], [field]: value };
    setEditedChecklist(updated);
  };

  // Delete item
  const handleDeleteItem = (index: number) => {
    setEditedChecklist(editedChecklist.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
        {/* Bundle Info */}
      {bundle && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Bundle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{bundle.name}</span>
                <Badge variant="outline">{bundle.status}</Badge>
              </div>
              {bundle.completeness?.score !== undefined && (
                <p className="text-xs text-muted-foreground">
                  Completeness: {Math.round(bundle.completeness.score * 100)}%
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Source Tender Documents */}
      {sourceDocuments && sourceDocuments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Source Tender Documents
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Click to view the original tender documents and verify the analysis
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sourceDocuments.map((doc) => (
                <div
                  key={doc._id}
                  className="flex items-center justify-between p-3 border border-border/40 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.filename}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {(doc.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {doc.status}
                        </Badge>
                        {doc.metadata?.pageCount && (
                          <span className="text-xs text-muted-foreground">
                            {doc.metadata.pageCount} pages
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {doc.url && (
                      <>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 hover:bg-accent rounded-md transition-colors"
                          title="View document"
                        >
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </a>
                        <a
                          href={doc.url}
                          download={doc.filename}
                          className="p-2 hover:bg-accent rounded-md transition-colors"
                          title="Download document"
                        >
                          <Download className="h-4 w-4 text-muted-foreground" />
                        </a>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents Required for Submission - with manual override */}
      <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Documents Required for Submission
                {hasManualEdits && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    Edited
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                {!isEditingChecklist ? (
                  <>
                    {hasManualEdits && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleResetChecklist}
                        disabled={isSavingChecklist}
                        title="Reset to original LLM-extracted list"
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Reset
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={handleStartEditing}>
                      <Edit3 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" onClick={handleCancelEditing}>
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveChecklist}
                      disabled={isSavingChecklist}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      {isSavingChecklist ? "Saving..." : "Save"}
                    </Button>
                  </>
                )}
              </div>
            </div>
            {!isEditingChecklist && (
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-xs text-muted-foreground">
                  {activeChecklist.length} documents
                </span>
                <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                  {activeChecklist.filter(d => d.mandatory).length} mandatory
                </Badge>
                <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200">
                  {activeChecklist.filter(d => !d.mandatory).length} optional
                </Badge>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {/* View Mode */}
            {!isEditingChecklist && (
              <div className="space-y-2">
                {activeChecklist.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No required documents identified.</p>
                ) : (
                    activeChecklist.map((doc, index) => (
                    <div
                        key={index}
                        className="flex items-start gap-3 p-3 border border-border/40 rounded-lg"
                    >
                        <div className="mt-0.5">
                        {doc.mandatory ? (
                            <CheckSquare className="h-4 w-4 text-red-500" />
                        ) : (
                            <Square className="h-4 w-4 text-gray-400" />
                        )}
                        </div>
                        <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{doc.name}</span>
                            {doc.mandatory && (
                            <Badge variant="destructive" className="text-xs">
                                Mandatory
                            </Badge>
                            )}
                        </div>
                        {doc.instructions && (
                            <p className="text-xs text-muted-foreground mt-1">
                            {doc.instructions}
                            </p>
                        )}
                        </div>
                    </div>
                    ))
                )}
              </div>
            )}

            {/* Edit Mode */}
            {isEditingChecklist && (
              <div className="space-y-3">
                {editedChecklist.map((doc, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 border border-border/40 rounded-lg bg-accent/20"
                  >
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateItem(index, "mandatory", !doc.mandatory)}
                        className="focus:outline-none"
                        title={doc.mandatory ? "Mark as optional" : "Mark as mandatory"}
                      >
                        {doc.mandatory ? (
                          <CheckSquare className="h-4 w-4 text-red-500" />
                        ) : (
                          <Square className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                    <div className="flex-1 space-y-2">
                      <Input
                        value={doc.name}
                        onChange={(e) => handleUpdateItem(index, "name", e.target.value)}
                        placeholder="Document name (e.g., Tax Clearance Certificate)"
                        className="text-sm"
                      />
                      <Input
                        value={doc.instructions || ""}
                        onChange={(e) => handleUpdateItem(index, "instructions", e.target.value)}
                        placeholder="Instructions (optional)"
                        className="text-xs"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteItem(index)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Document
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
