import type * as PDFParse from "pdf-parse";
// @ts-expect-error - pdf-parse has incorrect types, using require as workaround
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf: typeof PDFParse.default = require("pdf-parse");

/**
 * Configuration for Azure Document Intelligence OCR
 */
export interface AzureOCRConfig {
  endpoint: string;
  key: string;
}

/**
 * Extracted page content with metadata
 */
export interface ExtractedPage {
  documentId: string;
  page: number;
  text: string;
  method: "native" | "ocr";
  wordCount: number;
}

/**
 * Document metadata for extracted content
 */
export interface DocumentMetadata {
  documentId: string;
  filename: string;
  pageCount: number;
  totalBytes: number;
}

/**
 * Complete extraction result
 */
export interface ExtractionResult {
  pages: ExtractedPage[];
  documents: Map<string, DocumentMetadata>;
  aggregatedText: string;
  totalChars: number;
  totalBytes: number;
}

/**
 * Bundle document for extraction
 */
export interface BundleDocument {
  documentId: string;
  filename: string;
  buffer: Buffer;
}

/**
 * Detect if a page has low text content (likely needs OCR)
 * Heuristic: < 50 words OR < 200 characters indicates low text
 */
function isLowTextPage(text: string): boolean {
  const wordCount = text.trim().split(/\s+/).length;
  const charCount = text.trim().length;
  return wordCount < 50 || charCount < 200;
}

/**
 * Extract text from a PDF page using Azure Document Intelligence OCR
 */
async function ocrPageWithAzure(
  buffer: Buffer,
  pageNumber: number,
  config: AzureOCRConfig
): Promise<string> {
  // Use REST API directly to avoid complex typing issues
  const baseUrl = config.endpoint.replace(/\/$/, "");
  const apiVersion = "2024-02-29-preview";

  // Start analyze operation
  const analyzeUrl = `${baseUrl}/documentintelligence/documentModels/prebuilt-read:analyze?api-version=${apiVersion}&pages=${pageNumber}`;

  const initialResponse = await fetch(analyzeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/pdf",
      "Ocp-Apim-Subscription-Key": config.key,
    },
    body: buffer,
  });

  if (!initialResponse.ok) {
    throw new Error(
      `OCR initiation failed: ${initialResponse.status} ${await initialResponse.text()}`
    );
  }

  // Get operation location from response headers
  const operationLocation = initialResponse.headers.get("operation-location");
  if (!operationLocation) {
    throw new Error("No operation-location header in OCR response");
  }

  // Poll for completion
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result: any;
  let attempts = 0;
  const maxAttempts = 30; // 30 seconds max wait

  while (attempts < maxAttempts) {
    const resultResponse = await fetch(operationLocation, {
      method: "GET",
      headers: {
        "Ocp-Apim-Subscription-Key": config.key,
      },
    });

    if (resultResponse.ok) {
      result = await resultResponse.json();
      if (result.status === "succeeded") {
        break;
      } else if (result.status === "failed") {
        throw new Error(`OCR failed: ${result.error?.message || "Unknown error"}`);
      }
    }

    // Wait 1 second before next poll
    await new Promise((resolve) => setTimeout(resolve, 1000));
    attempts++;
  }

  if (!result || result.status !== "succeeded") {
    throw new Error("OCR timeout or failed to complete");
  }

  // Extract text from result
  const pages = result.analyzeResult?.pages || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const targetPage = pages.find((p: any) => p.pageNumber === pageNumber);

  if (!targetPage) {
    return "";
  }

  // Concatenate all text lines
  const lines = targetPage.lines || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return lines.map((line: any) => line.content).join("\n");
}

/**
 * Extract text from a single PDF document
 * Uses native extraction first, falls back to OCR for low-text pages
 */
async function extractFromPDF(
  doc: BundleDocument,
  azureConfig?: AzureOCRConfig
): Promise<ExtractedPage[]> {
  const pages: ExtractedPage[] = [];

  try {
    // First attempt: native PDF text extraction
    const data = await pdf(doc.buffer);
    const pageCount = data.numpages;

    // Extract text page by page
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const pageData = await pdf(doc.buffer, {
        max: pageNum,
        pagerender: null,
      } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      const pageText = pageData.text || "";
      const isLowText = isLowTextPage(pageText);

      if (isLowText && azureConfig) {
        // Fallback to OCR for low-text pages
        try {
          const ocrText = await ocrPageWithAzure(doc.buffer, pageNum, azureConfig);
          pages.push({
            documentId: doc.documentId,
            page: pageNum,
            text: ocrText,
            method: "ocr",
            wordCount: ocrText.trim().split(/\s+/).length,
          });
        } catch (ocrError) {
          // If OCR fails, use the native text anyway
          // eslint-disable-next-line no-console
          console.error(`OCR failed for ${doc.filename} page ${pageNum}:`, ocrError);
          pages.push({
            documentId: doc.documentId,
            page: pageNum,
            text: pageText,
            method: "native",
            wordCount: pageText.trim().split(/\s+/).length,
          });
        }
      } else {
        // Use native text extraction
        pages.push({
          documentId: doc.documentId,
          page: pageNum,
          text: pageText,
          method: "native",
          wordCount: pageText.trim().split(/\s+/).length,
        });
      }
    }
  } catch (error) {
    throw new Error(
      `Failed to extract text from ${doc.filename}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return pages;
}

/**
 * Extract and normalize text from a bundle of PDF documents
 * Returns structured pages and aggregated long-context string with markers
 */
export async function extractBundleText(
  documents: BundleDocument[],
  azureConfig?: AzureOCRConfig
): Promise<ExtractionResult> {
  const allPages: ExtractedPage[] = [];
  const docMap = new Map<string, DocumentMetadata>();
  let totalBytes = 0;

  // Process each document
  for (const doc of documents) {
    const pages = await extractFromPDF(doc, azureConfig);
    allPages.push(...pages);

    docMap.set(doc.documentId, {
      documentId: doc.documentId,
      filename: doc.filename,
      pageCount: pages.length,
      totalBytes: doc.buffer.length,
    });

    totalBytes += doc.buffer.length;
  }

  // Build aggregated text with markers
  const textParts: string[] = [];

  for (const page of allPages) {
    const metadata = docMap.get(page.documentId);
    const filename = metadata?.filename || "unknown";

    // Add marker with document context
    textParts.push(
      `<<<DOC:docId=${page.documentId} NAME=${filename} PAGE=${page.page}>>>`
    );
    textParts.push(page.text);
    textParts.push("<<<END>>>");
    textParts.push(""); // Empty line separator
  }

  const aggregatedText = textParts.join("\n");

  return {
    pages: allPages,
    documents: docMap,
    aggregatedText,
    totalChars: aggregatedText.length,
    totalBytes,
  };
}
