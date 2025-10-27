Document Ingestion Pipeline Implementation Plan

     Architecture Overview

     - OCR: Azure Document Intelligence (Read model) with native PDF text extraction fallback
     - Vector Storage: Convex native vector search (v.array(v.number()), 1536 dimensions)
     - Bundle Detection: Automated grouping with configurable heuristics
     - Storage: Convex only (no R2 replication in this phase)

     Phase 1: Schema & Dependencies (30 min)

     1.1 Update Convex Schema

     File: convex/schema.ts (chunks table around line 84)
     - Replace embeddingId: v.optional(v.string()) with embedding: v.array(v.number())
     - Add vector index after line 90:
     .vectorIndex("by_embedding", { vectorField: "embedding", dimensions: 1536 })

     1.2 Install Dependencies

     bun add pdf-parse @azure-rest/ai-document-intelligence
     bun add --dev @types/pdf-parse

     1.3 Environment Configuration

     Convex Dashboard → Environment Variables:
     AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
     AZURE_DOCUMENT_INTELLIGENCE_KEY=your-key-here
     COHERE_API_KEY=already-configured
     CLERK_JWT_ISSUER_DOMAIN=already-configured

     Phase 2: Core Processing Actions (2 hours)

     2.1 Create convex/ingest.ts (NEW FILE)

     Purpose: "use node" actions for heavy processing (PDF parsing, Azure API calls)

     Functions:
     - detectDocumentCharacteristics(storageId): Fetch file → Extract basic metadata (pages, 
     size, type)
     - extractText(storageId): Native PDF extraction using pdf-parse
     - ocrDocument(storageId): Azure Document Intelligence Read model for scanned PDFs
     - normalizeText(rawText): Clean whitespace, fix encoding, remove duplicate lines

     Key implementation details:
     - Use @azure-rest/ai-document-intelligence SDK (GA v1.0.0)
     - Try native extraction first (cost-free), fallback to Read model only when needed
     - Store ocrMethod in document metadata: "native" | "azure-read"
     - Handle multi-page PDFs properly

     2.2 Create convex/chunks.ts (NEW FILE)

     Purpose: Chunk CRUD operations with vector search

     Mutations:
     - insert(documentId, chunks[]): Batch insert chunks with embeddings
     - deleteByDocument(documentId): Cleanup on re-processing

     Queries:
     - listByDocument(documentId): Get all chunks for a document
     - search(query, filters): Vector similarity search
     const results = await ctx.vectorSearch("chunks", "by_embedding", {
       vector: queryEmbedding,
       limit: topK,
       filter: (q) => q.eq("documentId", documentId) // optional
     });

     2.3 Create convex/bundles.ts (NEW FILE)

     Purpose: Bundle detection and management

     Functions:
     - detectBundle(documentId): Analyze upload patterns and create/link bundle
       - Heuristics: Same user + organizationId + within 5 minutes
       - Extract tender reference numbers using regex patterns
       - Match filename patterns (e.g., "RFP-2024-123-*.pdf")
     - create(name, metadata): Manual bundle creation
     - addDocument(bundleId, documentId): Link document to bundle
     - updateCompleteness(bundleId): Calculate bundle status and score

     Phase 3: Implement Processing Stages (3 hours)

     3.1 Update convex/jobs.ts:processDocumentIngestion

     Replace lines 62-117 (the empty loop) with actual stage logic:

     Stage 1: DETECT (status: processing)

     const url = await ctx.storage.getUrl(document.storageId);
     const characteristics = await ctx.runAction(internal.ingest.detectDocumentCharacteristics, {
       storageId: document.storageId
     });
     await ctx.runMutation(internal.documents.updateMetadata, {
       documentId,
       metadata: { pageCount: characteristics.pages, ... }
     });
     await updateJobProgress(ctx, { jobId, current: 1, message: "Characteristics detected" });

     Stage 2: OCR (status: ocr_in_progress)

     let text: string;
     let ocrMethod: "native" | "azure-read";

     try {
       text = await ctx.runAction(internal.ingest.extractText, { storageId });
       ocrMethod = "native";
     } catch {
       text = await ctx.runAction(internal.ingest.ocrDocument, { storageId });
       ocrMethod = "azure-read";
     }

     const normalized = normalizeText(text);
     await ctx.runMutation(internal.documents.updateMetadata, {
       documentId,
       metadata: { ocrMethod, extractedAt: Date.now() }
     });

     Stage 3: CHUNK (status: chunking)

     const { Chunker } = await import("@tenderbot/rag");
     const chunker = new Chunker({ strategy: "recursive", maxTokens: 512, overlap: 50 });
     const chunks = chunker.chunk(normalized);

     await updateJobProgress(ctx, { jobId, total: chunks.length, current: 0 });

     Stage 4: EMBEDDINGS (status: embedding)

     const { embed } = await import("@tenderbot/rag");
     const texts = chunks.map(c => c.text);

     // Batch embed (max 96 per request)
     const embeddings = await embed(texts, { inputType: "search_document" });

     await ctx.runMutation(internal.chunks.insert, {
       documentId,
       chunks: chunks.map((chunk, i) => ({
         ...chunk,
         embedding: embeddings[i],
         sequence: i
       }))
     });

     Stage 5: FINALIZE (status: ready)

     await ctx.runMutation(internal.bundles.detectBundle, { documentId });
     await ctx.runMutation(internal.documents.updateStatusInternal, {
       documentId,
       status: "ready"
     });
     await markJobCompleted(ctx, { jobId, output: { chunksCreated: chunks.length } });

     3.2 Add Error Handling

     try {
       // stage logic
     } catch (error) {
       await markJobFailed(ctx, {
         jobId,
         error: {
           message: error.message,
           code: error.code,
           retryable: isNetworkError(error) || isRateLimitError(error)
         }
       });
       
       await ctx.runMutation(internal.documents.updateStatusInternal, {
         documentId,
         status: "failed"
       });
       
       throw error;
     }

     3.3 Add Resume Logic

     - Store resumeToken with last completed stage
     - On retry, skip completed stages and resume from failure point

     Phase 4: Update RAG Package (30 min)

     4.1 Update packages/rag/src/embeddings.ts

     Modify embed() function:
     - Ensure inputType: "search_document" is passed for corpus embeddings
     - Ensure inputType: "search_query" is used for user queries
     - Confirm dimensions match Convex index (1536 by default for embed-v4)
     - Return number[][] type (arrays of floats)

     4.2 Update packages/rag/src/chunker.ts

     - Verify token counting is accurate enough for Cohere limits
     - Ensure metadata extraction works for tender documents
     - Test with sample PDFs

     Phase 5: UI Integration (1.5 hours)

     5.1 Update apps/web/src/app/(app)/app/documents/page.tsx

     Add job tracking queries:
     const jobs = useQuery(api.jobs.getJobsForDocument, { documentId: doc._id });
     const currentJob = jobs?.find(j => j.status === "running");

     Display components:
     - Stage badge: <Badge>{statusToStage[doc.status]}</Badge>
     - Progress bar: <Progress value={job.progress.current / job.progress.total * 100} />
     - Progress message: {job.progress.message}
     - Action buttons:
       - Retry button (visible on failed): onClick={() => retry({ jobId })}
       - Cancel button (visible on running): onClick={() => cancel({ jobId })}
     - Bundle indicator: {doc.bundleId ? <Badge>Bundle: {bundle.name}</Badge> : null}

     5.2 Add Job Control Mutations

     File: convex/jobs.ts
     export const retry = mutation({
       args: { jobId: v.id("jobs") },
       handler: async (ctx, args) => {
         // Reset to pending, increment attempts
       }
     });

     export const cancel = mutation({
       args: { jobId: v.id("jobs") },
       handler: async (ctx, args) => {
         // Set status to cancelled
       }
     });

     5.3 Bundle Completeness Display

     - Show bundle status badge
     - Display detected vs manual indicator
     - Show completeness score (percentage of expected documents)

     Phase 6: Testing & Validation (1 hour)

     6.1 Test Cases

     1. Native PDF (text-based): Should use pdf-parse, fast processing
     2. Scanned PDF: Should fallback to Azure Document Intelligence
     3. Batch upload (3-5 files within 5 min): Should auto-create bundle
     4. Large PDF (>50 pages): Should handle pagination correctly
     5. Invalid file: Should fail gracefully with clear error

     6.2 Vector Search Validation

     // Test similarity search works
     const results = await ctx.vectorSearch("chunks", "by_embedding", {
       vector: testEmbedding,
       limit: 5
     });
     // Should return relevant chunks

     6.3 Monitor & Optimize

     - Check Azure Document Intelligence costs (charged per page)
     - Monitor Cohere API usage (embeddings cost)
     - Tune batch sizes if rate limits hit
     - Add retry backoff for transient failures

     Implementation Order

     1. Schema changes (convex/schema.ts) → enables vector storage
     2. Dependencies (bun add commands) → tooling ready
     3. ingest.ts actions → PDF + Azure Document Intelligence
     4. chunks.ts CRUD → vector operations
     5. bundles.ts detection → grouping logic
     6. jobs.ts stages → orchestrate everything
     7. RAG package updates → ensure correct input types
     8. UI updates → progress tracking
     9. End-to-end testing → validate full pipeline

     Key Corrections Applied

     ✅ Use v.array(v.number()) not v.float64() in Convex schema✅ Use 
     @azure-rest/ai-document-intelligence (Read model) for PDF OCR✅ Cohere embed-v4 defaults to 
     1536 dimensions (confirm match with vector index)✅ Max 96 texts per Cohere batch, use 
     inputType: "search_document"✅ Environment vars: AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and 
     _KEY✅ Vector search: ctx.vectorSearch("chunks", "by_embedding", { vector, limit, filter })

     Estimated Timeline

     - Total: ~8 hours focused development
     - Schema + deps: 30 min
     - Core actions: 2 hours
     - Job stages: 3 hours
     - RAG updates: 30 min
     - UI integration: 1.5 hours
     - Testing: 1 hour