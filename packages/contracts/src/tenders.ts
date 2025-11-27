import { z } from "zod";
import { RequirementSchema, RiskSchema } from "./opportunity";

/**
 * Evidence/citation for claims extracted from tender documents
 */
export const EvidenceSchema = z
  .object({
    documentId: z.string().nullable().optional(),
    page: z.number().int().nullable().optional(),
    quote: z.string().nullable().optional(),
    confidence: z.number().nullable().optional(),
  })
  .passthrough(); // Allow additional fields from LLM

export type Evidence = z.infer<typeof EvidenceSchema>;

/**
 * Document category for organizing checklist items
 */
export const DocumentCategorySchema = z.enum([
  "administrative",
  "technical",
  "financial",
  "commercial",
  "legal",
  "bee",
  "sbd_form",
  "other",
]);

export type DocumentCategory = z.infer<typeof DocumentCategorySchema>;

/**
 * Checklist item for required documents/submissions
 */
export const ChecklistItemSchema = z
  .object({
    name: z.string().nullable().optional().default("Unknown document"),
    item: z.string().nullable().optional(), // Alternative field name LLM might use
    mandatory: z.boolean().nullable().optional().default(false),
    instructions: z.string().nullable().optional(),
    category: DocumentCategorySchema.nullable().optional(),
    source: z.object({
      documentId: z.string().nullable().optional(),
      page: z.number().int().nullable().optional(),
      quote: z.string().nullable().optional(),
      section: z.string().nullable().optional(),
    }).nullable().optional(),
    citation: z.any().nullable().optional(), // Allow citation field from LLM
  })
  .transform((data) => ({
    name: data.name || data.item || "Unknown document",
    mandatory: data.mandatory ?? false,
    instructions: data.instructions,
    category: data.category,
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
  z.array(z.record(z.unknown())).transform((arr) => ({
    otherFees: arr.map((item: Record<string, unknown>) => ({
      name: (item.name as string) || (item.description as string) || "Fee",
      amount: item.amount as number | undefined,
      currency: item.currency as string | undefined,
    })),
  })),
]).default({});

/**
 * Contract duration schema
 */
export const ContractDurationSchema = z.object({
  months: z.number().nullable().optional(),
  years: z.number().nullable().optional(),
  description: z.string().nullable().optional(),
}).nullable().optional();

export type ContractDuration = z.infer<typeof ContractDurationSchema>;

/**
 * Contact information for tender queries
 */
export const ContactInformationSchema = z.object({
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
}).nullable().optional();

export type ContactInformation = z.infer<typeof ContactInformationSchema>;

/**
 * BEE/B-BBEE requirements schema
 */
export const BeeRequirementsSchema = z.object({
  minimumLevel: z.number().nullable().optional(),
  targetLevel: z.number().nullable().optional(),
  points: z.number().nullable().optional(),
  percentageWeight: z.number().nullable().optional(),
  specificRequirements: z.array(z.object({
    category: z.string().nullable().optional(),
    requirement: z.string().nullable().optional(),
    mandatory: z.boolean().nullable().optional().default(false),
  })).nullable().optional(),
  exemptions: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
}).nullable().optional();

export type BeeRequirements = z.infer<typeof BeeRequirementsSchema>;

/**
 * Scoring/evaluation breakdown schema
 */
export const ScoringBreakdownSchema = z.object({
  functionality: z.object({
    weight: z.number().nullable().optional(),
    minimumScore: z.number().nullable().optional(),
    criteria: z.array(z.object({
      name: z.string().nullable().optional(),
      weight: z.number().nullable().optional(),
      description: z.string().nullable().optional(),
    })).nullable().optional(),
  }).nullable().optional(),
  price: z.object({
    weight: z.number().nullable().optional(),
    formula: z.string().nullable().optional(),
  }).nullable().optional(),
  bbbee: z.object({
    weight: z.number().nullable().optional(),
    breakdown: z.array(z.object({
      level: z.number().nullable().optional(),
      points: z.number().nullable().optional(),
    })).nullable().optional(),
  }).nullable().optional(),
  preference: z.object({
    weight: z.number().nullable().optional(),
    description: z.string().nullable().optional(),
  }).nullable().optional(),
}).nullable().optional();

export type ScoringBreakdown = z.infer<typeof ScoringBreakdownSchema>;

/**
 * Complete tender analysis output schema
 * This is the structured JSON output from Claude Sonnet 4.5 analysis
 */
export const TenderAnalysisSchema = z
  .object({
    // Support both nested "opportunity" and flat structure
    opportunity: z
      .object({
        title: z.string().nullable().optional().default("Untitled Tender"),
        issuer: z.string().nullable().optional().default("Unknown Issuer"),
        issuerCategory: z.string().nullable().optional(),
        referenceNumber: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        currency: z.string().nullable().default("ZAR"),
        estimatedValue: z.number().nullable().optional(),
        contractDuration: ContractDurationSchema,
        contactInformation: ContactInformationSchema,
      })
      .nullable()
      .optional()
      .default({}),
    
    // Flat fields that LLM might return instead of nested (nullable for LLM null returns)
    title: z.string().nullable().optional(),
    issuer: z.string().nullable().optional(),
    tenderId: z.string().nullable().optional(),
    referenceNumber: z.string().nullable().optional(),

    timelines: z
      .object({
        dueDate: z.union([z.number(), z.string()]).nullable().optional().transform((val) => {
          if (val === undefined || val === null) return undefined;
          if (typeof val === "number") return val;
          const num = Date.parse(val);
          return Number.isNaN(num) ? parseInt(val, 10) : num;
        }),
        publishedDate: z.union([z.number(), z.string()]).nullable().optional().transform((val) => {
          if (val === undefined || val === null) return undefined;
          if (typeof val === "number") return val;
          const num = Date.parse(val);
          return Number.isNaN(num) ? parseInt(val, 10) : num;
        }),
        questionsDue: z.union([z.number(), z.string()]).nullable().optional().transform((val) => {
          if (val === undefined || val === null) return undefined;
          if (typeof val === "number") return val;
          const num = Date.parse(val);
          return Number.isNaN(num) ? parseInt(val, 10) : num;
        }),
        siteMeeting: z
          .object({
            date: z.union([z.number(), z.string()]).nullable().optional().transform((val) => {
              if (val === undefined || val === null) return undefined;
              if (typeof val === "number") return val;
              const num = Date.parse(val);
              return Number.isNaN(num) ? parseInt(val, 10) : num;
            }),
            time: z.string().nullable().optional().transform((val) => val ?? undefined),
            address: z.string().nullable().optional().transform((val) => val ?? undefined),
            mandatory: z.boolean().nullable().optional().transform((val) => val ?? undefined),
          })
          .nullable()
          .optional()
          .transform((val) => {
            if (!val) return undefined;
            // If all fields are null/undefined, treat as no site meeting
            if (val.date === undefined && val.time === undefined && val.address === undefined) {
              return undefined;
            }
            return val;
          }),
      })
      .optional()
      .default({}),
    
    // Flat date fields LLM might return
    keyDates: z.any().optional(),
    dueDate: z.union([z.number(), z.string()]).optional(),

    location: z
      .object({
        country: z.string().nullable().optional(),
        province: z.string().nullable().optional(),
        city: z.string().nullable().optional(),
        submissionAddress: z.string().nullable().optional(),
      })
      .nullable()
      .optional()
      .transform((val) => val ?? {}),

    submission: z
      .object({
        method: z.enum(["online", "email", "physical"]).nullable().optional().default("physical"),
        portalUrl: z.string().nullable().optional(),
        email: z.string().nullable().optional(),
        instructions: z.string().nullable().optional(),
        validityPeriodDays: z.union([z.number(), z.string()]).nullable().optional().transform((val) => {
          if (val === undefined || val === null) return undefined;
          const num = typeof val === "string" ? parseInt(val, 10) : val;
          return Number.isNaN(num) ? undefined : num;
        }),
      })
      .nullable()
      .optional()
      .transform((val) => val ?? { method: "physical" as const }),
    
    // Flat submission fields LLM might return
    submissionDetails: z.any().optional(),

    fees: FeesSchema,

    evaluationCriteria: z
      .array(
        z.object({
            criterion: z.string().nullable().optional(),
            name: z.string().nullable().optional(), // Alternative field
            description: z.string().nullable().optional(),
            weight: z.number().nullable().optional(), // Allow null from LLM
            citation: z.any().nullable().optional(), // Allow citation field
          }).transform((data) => ({
            criterion: data.criterion || data.name || "Unknown criterion",
            description: data.description ?? undefined,
            weight: data.weight ?? undefined, // Convert null to undefined
          }))
      )
      .nullable()
      .optional()
      .transform((val) => val ?? []),

    summary: z.string().nullable().optional().transform((val) => val ?? "No summary available"),

    documentsChecklist: z.array(ChecklistItemSchema).nullable().optional().transform((val) => val ?? []),

    requirements: z.array(RequirementSchema).nullable().optional().transform((val) => val ?? []),

    risks: z.array(RiskSchema).nullable().optional().transform((val) => val ?? []),

    citations: z.array(EvidenceSchema).nullable().optional().transform((val) => val ?? undefined),

    // BEE/B-BBEE requirements (dedicated section)
    beeRequirements: BeeRequirementsSchema,

    // Scoring/evaluation breakdown
    scoring: ScoringBreakdownSchema,

    // Additional fields LLM might include (nullable for LLM null returns)
    description: z.string().nullable().optional(),
    siteBriefing: z.any().nullable().optional(),

    // Flat fields for backwards compatibility (nullable for LLM null returns)
    estimatedValue: z.number().nullable().optional(),
    contractDuration: z.any().nullable().optional(),
    contactInformation: z.any().nullable().optional(),
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
      // New fields
      estimatedValue: data.opportunity?.estimatedValue || data.estimatedValue,
      contractDuration: data.opportunity?.contractDuration || data.contractDuration,
      contactInformation: data.opportunity?.contactInformation || data.contactInformation,
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
      // New dedicated sections
      beeRequirements: data.beeRequirements,
      scoring: data.scoring,
    };
  });

export type TenderAnalysis = z.infer<typeof TenderAnalysisSchema>;
