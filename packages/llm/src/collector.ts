import { TenderAnalysisSchema, type TenderAnalysis } from "@tenderbot/contracts";
import { StructuredOutputClient } from "./structured";
import { ModelRouter } from "./router";

/**
 * Configuration for tender analysis
 */
export interface TenderAnalysisConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  promptVersion?: string;
}

/**
 * Result of tender analysis including metadata
 */
export interface TenderAnalysisResult {
  data: TenderAnalysis;
  metadata: {
    model: string;
    promptVersion: string;
    tokensIn: number;
    tokensOut: number;
    totalTokens: number;
    latencyMs: number;
    cost?: number;
  };
}

/**
 * System prompt for tender analysis
 */
const TENDER_ANALYSIS_SYSTEM_PROMPT = `You are a tender analysis engine specialized in South African government and private sector procurement.

Your task is to extract structured information from tender document bundles and return STRICT JSON matching EXACTLY this structure:

{
  "opportunity": {
    "title": "string - tender title",
    "issuer": "string - issuing organization",
    "issuerCategory": "optional string - e.g. Government, Private, Parastatal",
    "referenceNumber": "optional string - tender reference number",
    "description": "optional string - brief description",
    "currency": "string - default ZAR"
  },
  "timelines": {
    "dueDate": number (Unix timestamp in milliseconds),
    "publishedDate": optional number (Unix timestamp),
    "questionsDue": optional number (Unix timestamp),
    "siteMeeting": optional { "date": number, "time": "string", "address": "string", "mandatory": boolean }
  },
  "location": {
    "country": "optional string",
    "province": "optional string",
    "city": "optional string",
    "submissionAddress": "optional string"
  },
  "submission": {
    "method": "online" | "email" | "physical",
    "portalUrl": "optional string URL",
    "email": "optional string email",
    "instructions": "optional string",
    "validityPeriodDays": optional number
  },
  "fees": {
    "tenderFee": optional number,
    "bidBond": optional { "amount": number, "currency": "string" },
    "otherFees": optional array of { "name": string, "amount": number, "currency": string }
  },
  "evaluationCriteria": optional array of { "criterion": string, "description": string, "weight": number },
  "summary": "string - max 1200 chars summarizing the tender",
  "documentsChecklist": [
    {
      "name": "string - document name",
      "mandatory": boolean,
      "instructions": "optional string",
      "source": { "documentId": "string", "page": number, "quote": "string" }
    }
  ],
  "requirements": [
    {
      "id": "string - unique ID like req-1",
      "type": "compliance" | "technical" | "commercial" | "legal" | "bee" | "eligibility" | "other",
      "description": "string - requirement description",
      "mandatory": boolean,
      "status": "unknown",
      "evidence": [{ "documentId": "string", "page": number, "quote": "string" }]
    }
  ],
  "risks": [
    {
      "id": "string - unique ID like risk-1",
      "category": "eligibility" | "bee_compliance" | "financial" | "technical" | "timeline" | "commercial" | "legal",
      "severity": "low" | "medium" | "high" | "critical",
      "description": "string - risk description",
      "mitigation": "optional string - suggested mitigation"
    }
  ]
}

Guidelines:
1. Extract all information accurately from the provided documents
2. For missing or unclear information:
   - Use "unknown" for string fields that cannot be determined
   - Omit optional fields if information is not present
   - Set mandatory boolean to true only if explicitly stated
3. For dates, convert to Unix timestamps (milliseconds since epoch)
4. Maintain accuracy - do not hallucinate or infer information not present in documents
5. Be thorough - extract all requirements, risks, and checklist items mentioned
6. Generate unique IDs for requirements (req-1, req-2, etc.) and risks (risk-1, risk-2, etc.)
7. Return ONLY valid JSON matching the structure above - no prose, explanations, or text outside the JSON

Focus on accuracy, completeness, and proper structure.`;

/**
 * Build user prompt from aggregated text
 */
function buildUserPrompt(aggregatedText: string): string {
  return `Analyze the following tender document bundle and extract all relevant information.

The documents are marked with headers indicating document ID, filename, and page number.
Use these markers to provide accurate citations.

${aggregatedText}

Return a complete tender analysis as a JSON object matching the schema. Include citations for all claims.`;
}

/**
 * Analyze a tender bundle using GPT-4.1 with 1M token context
 */
export async function analyzeTenderBundle(
  aggregatedText: string,
  config: TenderAnalysisConfig = {}
): Promise<TenderAnalysisResult> {
  const {
    model = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4-turbo-2024-04-09", // GPT-4 Turbo with 128K context
    temperature = 0,
    maxTokens = 4096, // Output tokens - input can be up to 128K
    promptVersion = "v1.0.0",
  } = config;

  // Validate input size (rough estimate: 1 token ≈ 4 chars)
  const estimatedInputTokens = Math.ceil(
    (TENDER_ANALYSIS_SYSTEM_PROMPT.length + aggregatedText.length) / 4
  );
  const maxInputTokens = 128000; // GPT-4 Turbo context window

  if (estimatedInputTokens > maxInputTokens) {
    throw new Error(
      `Input too large: ~${estimatedInputTokens} tokens exceeds ${maxInputTokens} token limit. ` +
      `Consider splitting the bundle or reducing document size.`
    );
  }

  // Initialize router and client
  const router = new ModelRouter({
    defaultProvider: "openai",
    fallbackProviders: [],
  });
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.AZURE_OPENAI_API_KEY;
  const client = new StructuredOutputClient(apiKey, router);

  // Build full prompt
  const userPrompt = buildUserPrompt(aggregatedText);
  const fullPrompt = `${TENDER_ANALYSIS_SYSTEM_PROMPT}\n\n${userPrompt}`;

  // Generate structured output
  const response = await client.generate({
    prompt: fullPrompt,
    schema: TenderAnalysisSchema,
    model: {
      model,
      provider: process.env.AZURE_OPENAI_ENDPOINT ? "openai" : "openai",
      temperature,
      maxTokens,
    },
    options: {
      maxRetries: 2,
    },
  });

  // Extract metadata
  const tokensIn = response.metadata.tokensUsed?.prompt ?? 0;
  const tokensOut = response.metadata.tokensUsed?.completion ?? 0;
  const totalTokens = response.metadata.tokensUsed?.total ?? tokensIn + tokensOut;

  return {
    data: response.data,
    metadata: {
      model: response.metadata.model,
      promptVersion,
      tokensIn,
      tokensOut,
      totalTokens,
      latencyMs: response.metadata.latencyMs,
      cost: response.metadata.cost,
    },
  };
}

/**
 * Validate that analysis contains required citations
 */
export function validateCitations(analysis: TenderAnalysis): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check checklist items have sources
  for (const item of analysis.documentsChecklist) {
    if (!item.source?.documentId && !item.source?.quote) {
      errors.push(`Checklist item "${item.name}" missing citation`);
    }
  }

  // Check requirements have evidence
  for (const req of analysis.requirements) {
    if (!req.evidence || req.evidence.length === 0) {
      errors.push(`Requirement "${req.description}" missing evidence`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
