"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

interface OpportunityFormState {
  title: string;
  issuer: string;
  dueDate: string;
  description: string;
}

const defaultFormState: OpportunityFormState = {
  title: "",
  issuer: "",
  dueDate: "",
  description: "",
};

export function CreateOpportunityDialog() {
  const [open, setOpen] = useState(false);
  const [formState, setFormState] = useState<OpportunityFormState>(defaultFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const upsertOpportunity = useMutation(api.opportunities.upsert);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formState.title || !formState.issuer || !formState.dueDate) {
      setFormError("Please complete the required fields.");
      return;
    }

    const dueDateMs = Date.parse(formState.dueDate);
    if (Number.isNaN(dueDateMs)) {
      setFormError("Please provide a valid due date.");
      return;
    }

    try {
      setFormError(null);
      setIsSubmitting(true);
      await upsertOpportunity({
        title: formState.title,
        issuer: formState.issuer,
        dueDate: dueDateMs,
        status: "draft",
        description: formState.description || undefined,
      });

      setFormState(defaultFormState);
      setOpen(false);
    } catch (error) {
      console.error("Failed to create opportunity", error);
      const message = error instanceof Error ? error.message : "Failed to create opportunity.";
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Opportunity
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Opportunity</DialogTitle>
          <DialogDescription>
            Capture the basics and start tracking requirements immediately.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="title">
              Title
            </label>
            <Input
              id="title"
              value={formState.title}
              onChange={(event) =>
                setFormState((state) => ({ ...state, title: event.target.value }))
              }
              placeholder="e.g. Municipal Wi-Fi Expansion"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="issuer">
              Issuer
            </label>
            <Input
              id="issuer"
              value={formState.issuer}
              onChange={(event) =>
                setFormState((state) => ({ ...state, issuer: event.target.value }))
              }
              placeholder="e.g. City of Cape Town"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="dueDate">
              Due Date
            </label>
            <Input
              id="dueDate"
              type="date"
              value={formState.dueDate}
              onChange={(event) =>
                setFormState((state) => ({ ...state, dueDate: event.target.value }))
              }
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="description">
              Summary (optional)
            </label>
            <Textarea
              id="description"
              value={formState.description}
              onChange={(event) =>
                setFormState((state) => ({ ...state, description: event.target.value }))
              }
              placeholder="Key requirements, goals, or constraints"
              rows={4}
            />
          </div>

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setFormError(null);
                setFormState(defaultFormState);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create Opportunity"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


