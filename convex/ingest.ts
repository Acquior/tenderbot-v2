"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import DocumentIntelligence from "@azure-rest/ai-document-intelligence";
import { AzureKeyCredential } from "@azure/core-auth";
import JSZip from "jszip";

const DEFAULT_AZURE_MODEL = "prebuilt-read";
const FALLBACK_AZURE_MODELS = ["prebuilt-document"];

let pdfEnvironmentReady = false;

async function ensurePdfEnvironment(): Promise<void> {
  if (pdfEnvironmentReady) {
    return;
  }

  pdfEnvironmentReady = true;

  if (typeof (globalThis as any).DOMMatrix === "undefined") {
    class IdentityDOMMatrix {
      constructor() {}
      static fromMatrix() {
        return new IdentityDOMMatrix();
      }
      multiplySelf() {
        return this;
      }
      preMultiplySelf() {
        return this;
      }
      translateSelf() {
        return this;
      }
      scaleSelf() {
        return this;
      }
      rotateSelf() {
        return this;
      }
      invertSelf() {
        return this;
      }
      transformPoint(point: any) {
        return point;
      }
    }

    (globalThis as any).DOMMatrix = IdentityDOMMatrix;
  }
}

type PdfParseFn = (data: Buffer | Uint8Array | ArrayBuffer, options?: Record<string, unknown>) => Promise<any>;

let pdfParse: PdfParseFn | null = null;

async function getPdfParse(): Promise<PdfParseFn> {
  if (!pdfParse) {
    await ensurePdfEnvironment();
    const module = await import("pdf-parse");
    const parser =
      (module as any).default ??
      (module as any).PDFParse ??
      (typeof module === "function" ? module : null);

    if (typeof parser !== "function") {
      throw new Error("Failed to load pdf-parse parser function");
    }

    pdfParse = parser as PdfParseFn;
  }
  return pdfParse;
}

/**
 * Document characteristics from detection stage
 */
export interface DocumentCharacteristics {
  pageCount: number;
  hasText: boolean;
  isScanned: boolean;
  language?: string;
  size: number;
}

/**
 * OCR result with metadata
 */
export interface OCRResult {
  text: string;
  pageCount: number;
  ocrMethod: "native" | "azure-read";
  confidence?: number;
}

/**
 * Stage 1: Detect document characteristics
 * Fetches the file and extracts basic metadata without full processing
 */
export const detectDocumentCharacteristics = internalAction({
  args: {
    storageId: v.string(),
  },
  handler: async (_ctx, _args): Promise<DocumentCharacteristics> => {
    throw new Error("Document characteristics detection disabled (behind feature flag).");
  },
});

/**
 * Stage 2a: Extract text from native PDF (text-based PDFs)
 * This is the preferred method as it's free and fast
 */
export const extractTextNative = internalAction({
  args: {
    storageId: v.string(),
  },
  handler: async (ctx, args): Promise<OCRResult> => {
    await ensurePdfEnvironment();

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) {
      throw new Error("Failed to get storage URL");
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);

    try {
      const parse = await getPdfParse();
      const pdfData = await parse(uint8Array);

      // Check if we got meaningful text
      if (!pdfData.text || pdfData.text.trim().length < 50) {
        throw new Error("Insufficient text extracted - document may be scanned");
      }

      return {
        text: pdfData.text,
        pageCount: pdfData.numpages,
        ocrMethod: "native",
      };
    } catch (error) {
      throw new Error(`Native text extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});

/**
 * Stage 2b: OCR using Azure Document Intelligence (Read model)
 * Fallback for scanned PDFs or when native extraction fails
 */
export const ocrWithAzure = internalAction({
  args: {
    storageId: v.string(),
    mimeType: v.optional(v.string()),
    filename: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<OCRResult> => {
    // Get Azure credentials from environment
    const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
    const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;

    if (!endpoint || !key) {
      throw new Error(
        "Azure Document Intelligence credentials not configured. " +
        "Set AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_KEY"
      );
    }

    // Fetch file from storage
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) {
      throw new Error("Failed to get storage URL");
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    const fileBuffer = await response.arrayBuffer();

    const nonPdfResult = await extractTextWithoutAzure({
      buffer: fileBuffer,
      mimeType: args.mimeType,
      filename: args.filename,
    });

    if (nonPdfResult) {
      return nonPdfResult;
    }

    try {
      // Initialize Azure Document Intelligence client
      const client = DocumentIntelligence(
        endpoint,
        new AzureKeyCredential(key)
      );

      const preferredModel = (process.env.AZURE_DOCUMENT_INTELLIGENCE_MODEL ?? DEFAULT_AZURE_MODEL).trim() || DEFAULT_AZURE_MODEL;
      const modelCandidates = Array.from(new Set([preferredModel, ...FALLBACK_AZURE_MODELS]));

      let initialResponse: any = null;
      let lastFailure: { model: string; status: string | number; detail?: string } | null = null;

      for (const modelId of modelCandidates) {
        const response = await client
          .path("/documentModels/{modelId}:analyze", modelId)
          .post({
            contentType: "application/pdf",
            body: new Uint8Array(fileBuffer),
          });

        if (Number(response.status) === 202) {
          initialResponse = response;
          break;
        }

        lastFailure = {
          model: modelId,
          status: response.status,
          detail: formatAzureErrorResponse(response),
        };

        if (modelId !== modelCandidates[modelCandidates.length - 1]) {
          console.warn(
            `[Azure OCR] Model ${modelId} failed to start (status ${response.status}). Attempting fallback model.`
          );
        }
      }

      if (!initialResponse) {
        const failureMessage = lastFailure
          ? `Azure OCR failed to start (status ${lastFailure.status}, model ${lastFailure.model})${
              lastFailure.detail ? ` - ${lastFailure.detail}` : ""
            }`
          : "Azure OCR failed to start: no response from service";
        throw new Error(failureMessage);
      }

      // Get operation location for polling
      const operationLocation = initialResponse.headers["operation-location"];
      if (!operationLocation) {
        throw new Error("No operation location returned from Azure");
      }

      // Poll for completion
      let result: any;
      let attempts = 0;
      const maxAttempts = 60; // 60 attempts * 2 seconds = 2 minutes max

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds

        const statusResponse = await fetch(operationLocation, {
          headers: {
            "Ocp-Apim-Subscription-Key": key,
          },
        });

        if (!statusResponse.ok) {
          throw new Error(`Failed to check OCR status: ${statusResponse.statusText}`);
        }

        result = await statusResponse.json();

        if ((result as any).status === "succeeded") {
          break;
        } else if ((result as any).status === "failed") {
          const message =
            ((result as any).error && (result as any).error.message) || "Unknown error";
          throw new Error(`Azure OCR failed: ${message}`);
        }

        attempts++;
      }

      if (attempts >= maxAttempts) {
        throw new Error("Azure OCR timed out after 2 minutes");
      }

      // Extract text from result
      const pages = (result as any).analyzeResult?.pages || [];
      const extractedText = pages
        .map((page: any) => {
          const lines = page.lines || [];
          return lines.map((line: any) => line.content).join("\n");
        })
        .join("\n\n");

      // Calculate average confidence
      const allWords = pages.flatMap((page: any) => page.words || []);
      const avgConfidence = allWords.length > 0
        ? allWords.reduce((sum: number, word: any) => sum + (word.confidence || 0), 0) / allWords.length
        : undefined;

      return {
        text: extractedText,
        pageCount: pages.length,
        ocrMethod: "azure-read",
        confidence: avgConfidence,
      };
    } catch (error) {
      throw new Error(`Azure OCR failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});

/**
 * Normalize extracted text
 * Cleans up whitespace, encoding issues, and duplicates
 */
export function normalizeText(text: string): string {
  let normalized = text;

  // Fix common encoding issues
  normalized = normalized
    .replace(/\u00A0/g, " ") // Non-breaking space to regular space
    .replace(/\u2018|\u2019/g, "'") // Smart quotes to regular quotes
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u2013|\u2014/g, "-") // Em/en dashes to hyphens
    .replace(/\u2026/g, "..."); // Ellipsis

  // Normalize whitespace
  normalized = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");

  // Remove excessive blank lines (more than 2 consecutive)
  normalized = normalized.replace(/\n{3,}/g, "\n\n");

  // Remove duplicate consecutive lines (common OCR artifact)
  const lines = normalized.split("\n");
  const deduped: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (i === 0 || lines[i] !== lines[i - 1]) {
      deduped.push(lines[i]);
    }
  }
  normalized = deduped.join("\n");

  return normalized.trim();
}

function formatAzureErrorResponse(response: any): string | undefined {
  if (!response) {
    return undefined;
  }

  const body = (response as any).body;
  if (!body) {
    return undefined;
  }

  if (typeof body === "string") {
    return body;
  }

  try {
    return JSON.stringify(body);
  } catch (error) {
    return `Unable to parse Azure error body: ${error instanceof Error ? error.message : String(error)}`;
  }
}

interface ExtractionArgs {
  buffer: ArrayBuffer;
  mimeType?: string;
  filename?: string;
}

async function extractTextWithoutAzure({ buffer, mimeType, filename }: ExtractionArgs): Promise<OCRResult | null> {
  const normalizedMime = mimeType?.toLowerCase();
  const extension = filename?.split(".").pop()?.toLowerCase();

  if (normalizedMime?.startsWith("text/") || extension === "txt" || normalizedMime === "application/json") {
    const decoder = new TextDecoder();
    const text = decoder.decode(buffer);
    if (!text.trim()) {
      return null;
    }
    return {
      text,
      pageCount: estimatePageCountFromText(text),
      ocrMethod: "native",
    };
  }

  if (
    normalizedMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    extension === "docx"
  ) {
    const text = await extractDocxText(buffer);
    return {
      text,
      pageCount: estimatePageCountFromText(text),
      ocrMethod: "native",
    };
  }

  return null;
}

async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) {
    throw new Error("DOCX file is missing document.xml section");
  }

  const xmlContent = await documentFile.async("string");
  const paragraphs = xmlContent.split("</w:p>");
  const textParts: string[] = [];

  for (const paragraph of paragraphs) {
    const matches = paragraph.matchAll(/<w:t[^>]*>(.*?)<\/w:t>/g);
    const pieces: string[] = [];
    for (const match of matches) {
      const raw = match[1] ?? "";
      pieces.push(decodeXmlEntities(raw));
    }
    if (pieces.length > 0) {
      textParts.push(pieces.join(""));
    }
  }

  const cleaned = textParts
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n\n");

  if (!cleaned.trim()) {
    throw new Error("Unable to extract text content from DOCX file");
  }

  return cleaned;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

function estimatePageCountFromText(text: string): number {
  if (!text.trim()) {
    return 0;
  }

  const averageCharsPerPage = 1800;
  const estimated = Math.max(1, Math.round(text.length / averageCharsPerPage));
  return Number.isFinite(estimated) ? estimated : 1;
}
