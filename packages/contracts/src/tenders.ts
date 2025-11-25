import { z } from "zod";
import { RequirementSchema, RiskSchema } from "./opportunity";

/**
 * Evidence/citation for claims extracted from tender documents
 */
export const EvidenceSchema = z
  .object({
    documentId: z.string(),
    page: z.number().int().optional(),
    quote: z.string().min(1),
    confidence: z.number().min(0).max(1).optional(),
  })
  .strict();

export type Evidence = z.infer<typeof EvidenceSchema>;

/**
 * Checklist item for required documents/submissions
 */
export const ChecklistItemSchema = z
  .object({
    name: z.string().optional().default("Unknown document"),
    item: z.string().optional(), // Alternative field name LLM might use
    mandatory: z.boolean().optional().default(false),
    instructions: z.string().optional(),
    source: EvidenceSchema.partial().optional(),
    citation: z.any().optional(), // Allow citation field from LLM
  })
  .transform((data) => ({
    name: data.name || data.item || "Unknown document",
    mandatory: data.mandatory ?? false,
    instructions: data.instructions,
    source: data.source || (data.citation ? { quote: String(data.citation) } : undefined),
  }));

export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

/**
 * Helper to coerce fees from array to object format
 */
const FeesSchema = z.union([
  // Expected object format
  z.object({
    tenderFee: z.number().optional(),
    bidBond: z.object({ amount: z.number(), currency: z.string() }).optional(),
    otherFees: z.array(
      z.object({
        name: z.string(),
        amount: z.number().optional(),
        currency: z.string().optional(),
      })
    ).optional(),
  }),
  // Handle array format from LLM
  z.array(z.any()).transform((arr) => ({
    otherFees: arr.map((item: any) => ({
      name: item.name || item.description || "Fee",
      amount: item.amount,
      currency: item.currency,
    })),
  })),
]).default({});

/**
 * Complete tender analysis output schema
 * This is the structured JSON output from GPT-4.1 analysis
 */
export const TenderAnalysisSchema = z
  .object({
    // Support both nested "opportunity" and flat structure
    opportunity: z
      .object({
        title: z.string().optional().default("Untitled Tender"),
        issuer: z.string().optional().default("Unknown Issuer"),
        issuerCategory: z.string().optional(),
        referenceNumber: z.string().optional(),
        description: z.string().optional(),
        currency: z.string().default("ZAR"),
      })
      .optional()
      .default({}),
    
    // Flat fields that LLM might return instead of nested
    title: z.string().optional(),
    issuer: z.string().optional(),
    tenderId: z.string().optional(),
    referenceNumber: z.string().optional(),

    timelines: z
      .object({
        dueDate: z.union([z.number(), z.string()]).optional().transform((val) => {
          if (val === undefined || val === null) return undefined;
          if (typeof val === "number") return val;
          const num = Date.parse(val);
          return Number.isNaN(num) ? parseInt(val, 10) : num;
        }),
        publishedDate: z.union([z.number(), z.string()]).optional().transform((val) => {
          if (val === undefined || val === null) return undefined;
          if (typeof val === "number") return val;
          const num = Date.parse(val);
          return Number.isNaN(num) ? parseInt(val, 10) : num;
        }),
        questionsDue: z.union([z.number(), z.string()]).optional().transform((val) => {
          if (val === undefined || val === null) return undefined;
          if (typeof val === "number") return val;
          const num = Date.parse(val);
          return Number.isNaN(num) ? parseInt(val, 10) : num;
        }),
        siteMeeting: z
          .object({
            date: z.union([z.number(), z.string()]).transform((val) => {
              if (typeof val === "number") return val;
              const num = Date.parse(val);
              return Number.isNaN(num) ? parseInt(val, 10) : num;
            }),
            time: z.string().optional(),
            address: z.string().optional(),
            mandatory: z.boolean().optional(),
          })
          .optional(),
      })
      .optional()
      .default({}),
    
    // Flat date fields LLM might return
    keyDates: z.any().optional(),
    dueDate: z.union([z.number(), z.string()]).optional(),

    location: z
      .object({
        country: z.string().optional(),
        province: z.string().optional(),
        city: z.string().optional(),
        submissionAddress: z.string().optional(),
      })
      .optional()
      .default({}),

    submission: z
      .object({
        method: z.enum(["online", "email", "physical"]).optional().default("physical"),
        portalUrl: z.string().optional(),
        email: z.string().optional(),
        instructions: z.string().optional(),
        validityPeriodDays: z.union([z.number(), z.string()]).nullable().optional().transform((val) => {
          if (val === undefined || val === null) return undefined;
          const num = typeof val === "string" ? parseInt(val, 10) : val;
          return Number.isNaN(num) ? undefined : num;
        }),
      })
      .optional()
      .default({}),
    
    // Flat submission fields LLM might return
    submissionDetails: z.any().optional(),

    fees: FeesSchema,

    evaluationCriteria: z
      .array(
        z.object({
            criterion: z.string().optional(),
            name: z.string().optional(), // Alternative field
            description: z.string().optional(),
            weight: z.number().optional(),
            citation: z.any().optional(), // Allow citation field
          }).transform((data) => ({
            criterion: data.criterion || data.name || "Unknown criterion",
            description: data.description,
            weight: data.weight,
          }))
      )
      .optional()
      .default([]),

    summary: z.string().optional().default("No summary available"),

    documentsChecklist: z.array(ChecklistItemSchema).default([]),

    requirements: z.array(RequirementSchema).default([]),

    risks: z.array(RiskSchema).default([]),

    citations: z.array(EvidenceSchema).optional(),
    
    // Additional fields LLM might include
    description: z.string().optional(),
    siteBriefing: z.any().optional(),
  })
  .passthrough() // Allow additional fields
  .transform((data) => {
    // Merge flat fields into nested structure
    const opportunity = {
      title: data.opportunity?.title || data.title || "Untitled Tender",
      issuer: data.opportunity?.issuer || data.issuer || "Unknown Issuer",
      issuerCategory: data.opportunity?.issuerCategory,
      referenceNumber: data.opportunity?.referenceNumber || data.referenceNumber || data.tenderId,
      description: data.opportunity?.description || data.description,
      currency: data.opportunity?.currency || "ZAR",
    };
    
    // Handle dueDate conversion
    let dueDate = data.timelines?.dueDate;
    if (!dueDate && data.dueDate) {
      dueDate = typeof data.dueDate === "string" ? new Date(data.dueDate).getTime() : data.dueDate;
    }
    if (!dueDate && data.keyDates?.closingDate) {
      dueDate = typeof data.keyDates.closingDate === "string" 
        ? new Date(data.keyDates.closingDate).getTime() 
        : data.keyDates.closingDate;
    }
    
    const timelines = {
      dueDate: dueDate || Date.now() + 30 * 24 * 60 * 60 * 1000, // Default to 30 days from now
      publishedDate: data.timelines?.publishedDate,
      questionsDue: data.timelines?.questionsDue,
      siteMeeting: data.timelines?.siteMeeting,
    };
    
    return {
      opportunity,
      timelines,
      location: data.location || {},
      submission: data.submission || { method: "physical" as const },
      fees: data.fees || {},
      evaluationCriteria: data.evaluationCriteria || [],
      summary: data.summary || "No summary available",
      documentsChecklist: data.documentsChecklist || [],
      requirements: data.requirements || [],
      risks: data.risks || [],
      citations: data.citations,
    };
  });

export type TenderAnalysis = z.infer<typeof TenderAnalysisSchema>;
