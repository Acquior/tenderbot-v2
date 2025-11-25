# Gemini File Search API Research & Platform Comparison

**Date:** January 2025  
**Platform:** TenderBot v2  
**Research Focus:** Gemini File Search API vs. Current Custom RAG Implementation

---

## Executive Summary

Google's Gemini File Search API is a fully managed RAG (Retrieval-Augmented Generation) system that abstracts away the complexity of building and maintaining retrieval pipelines. This research document analyzes its capabilities, compares it with TenderBot's current custom RAG implementation, and evaluates potential benefits for the platform.

**Key Finding:** Gemini File Search could significantly simplify TenderBot's RAG infrastructure while potentially reducing costs, but would require architectural changes and may reduce fine-grained control over retrieval strategies.

---

## 1. Current TenderBot RAG Architecture

### 1.1 Document Ingestion Pipeline

**Current Flow:**
1. **Upload** → Documents stored in Convex File Storage (with Cloudflare R2 fallback)
2. **OCR/Text Extraction** → Azure Document Intelligence (Read model) with native PDF fallback
3. **Chunking** → Custom recursive chunking strategy (`packages/rag/src/chunker.ts`)
   - Supports fixed, recursive, and semantic chunking
   - Configurable max tokens (default: 512), overlap (default: 50)
   - Preserves document structure
4. **Embedding Generation** → Cohere Embed API (`embed-english-v4.0`)
   - 1536-dimensional vectors
   - Batch processing with rate limiting
   - Azure Cohere endpoint support
5. **Vector Storage** → Convex native vector search
   - Vector index: `by_embedding` (1536 dimensions)
   - Metadata filtering by `documentId`, `organizationId`
6. **Retrieval** → Hybrid search combining:
   - Vector similarity search (Convex)
   - Keyword search (planned BM25 fallback)
   - Cohere Rerank v3.5 for final ranking

### 1.2 Current Components

**Key Files:**
- `convex/ingest.ts` - OCR and text extraction
- `convex/chunks.ts` - Vector search queries
- `packages/rag/src/chunker.ts` - Text chunking strategies
- `packages/rag/src/embeddings.ts` - Cohere embedding client
- `packages/rag/src/retrieval.ts` - Hybrid search utilities
- `packages/rag/src/rerank.ts` - Cohere reranking

**Storage:**
- Convex collections for documents, chunks, embeddings
- Convex File Storage for raw files
- Cloudflare R2 for large files

**Cost Structure:**
- Azure Document Intelligence: Pay-per-page OCR
- Cohere Embeddings: Pay-per-token embedding generation
- Cohere Rerank: Pay-per-query reranking
- Convex: Database and storage costs
- Cloudflare R2: Storage costs

---

## 2. Gemini File Search API Overview

### 2.1 Core Capabilities

**Fully Managed RAG System:**
- Automatic file storage, chunking, embedding, and indexing
- Built-in semantic search using Gemini Embedding model (`gemini-embedding-001`)
- Integrated with `generateContent` API as a tool
- Automatic citation generation

**Key Features:**
1. **Simple Upload & Indexing**
   - Direct upload to File Search store
   - Automatic chunking (configurable: max tokens, overlap)
   - Automatic embedding generation
   - Automatic indexing

2. **Semantic Search**
   - Vector search powered by Gemini embeddings
   - Query-time embedding generation (free)
   - Context injection into prompts

3. **Built-in Citations**
   - Automatic citation generation
   - Grounding metadata in responses
   - Source attribution

4. **File Format Support**
   - PDF, DOCX, TXT, JSON
   - Common programming language files
   - Up to 100 MB per file

5. **Metadata Filtering**
   - Custom metadata key-value pairs
   - Filter queries by metadata
   - Supports string and numeric values

### 2.2 API Workflow

```python
# 1. Create File Search Store
file_search_store = client.file_search_stores.create(
    config={'display_name': 'tender-documents'}
)

# 2. Upload and Index File
operation = client.file_search_stores.upload_to_file_search_store(
    file='tender.pdf',
    file_search_store_name=file_search_store.name,
    config={
        'display_name': 'RFP-2024-123',
        'custom_metadata': [
            {'key': 'bundleId', 'string_value': 'bundle-123'},
            {'key': 'organizationId', 'string_value': 'org-456'}
        ],
        'chunking_config': {
            'white_space_config': {
                'max_tokens_per_chunk': 512,
                'max_overlap_tokens': 50
            }
        }
    }
)

# 3. Query with File Search
response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="What are the key requirements in this tender?",
    config=types.GenerateContentConfig(
        tools=[types.Tool(
            file_search=types.FileSearch(
                file_search_store_names=[file_search_store.name],
                metadata_filter="bundleId='bundle-123'"
            )
        )]
    )
)
```

### 2.3 Pricing Model

**Cost Structure:**
- **Storage:** Free (indefinite storage)
- **Query-time embeddings:** Free
- **Initial indexing:** $0.15 per 1M tokens (one-time cost)
- **File Search queries:** Included in Gemini API pricing

**Storage Limits (per project):**
- Free tier: 1 GB total
- Tier 1: 10 GB
- Tier 2: 100 GB
- Tier 3: 1 TB

**Note:** File Search store size ≈ 3x input data size (includes embeddings)

---

## 3. Feature Comparison Matrix

| Feature | TenderBot (Current) | Gemini File Search |
|---------|---------------------|-------------------|
| **File Storage** | Convex + Cloudflare R2 | Managed by Google |
| **OCR/Text Extraction** | Azure Document Intelligence + native PDF | Automatic (built-in) |
| **Chunking Strategy** | Custom recursive/fixed/semantic | Configurable whitespace-based |
| **Embedding Model** | Cohere `embed-english-v4.0` (1536 dim) | Gemini `embedding-001` |
| **Vector Storage** | Convex native vector search | Managed by Google |
| **Retrieval Method** | Hybrid (vector + keyword + rerank) | Semantic search only |
| **Reranking** | Cohere Rerank v3.5 | Built-in (no separate step) |
| **Citations** | Manual implementation needed | Automatic |
| **Metadata Filtering** | Custom Convex queries | Built-in metadata filter API |
| **Multi-format Support** | PDF, DOCX, TXT (custom extractors) | PDF, DOCX, TXT, JSON, code files |
| **Cost Model** | Pay-per-use (OCR, embeddings, rerank) | Pay-per-indexing, free queries |
| **Scalability** | Manual scaling | Auto-scaling |
| **Customization** | Full control | Limited to API parameters |

---

## 4. Potential Benefits for TenderBot

### 4.1 Operational Simplification

**Reduced Infrastructure Complexity:**
- **Eliminate:** Custom chunking logic (`packages/rag/src/chunker.ts`)
- **Eliminate:** Embedding client (`packages/rag/src/embeddings.ts`)
- **Eliminate:** Vector storage management in Convex
- **Eliminate:** Reranking client (`packages/rag/src/rerank.ts`)
- **Simplify:** Document ingestion pipeline (`convex/ingest.ts`)

**Estimated Code Reduction:**
- ~500+ lines of RAG infrastructure code
- Simplified ingestion jobs
- Fewer dependencies (no Cohere SDK, reduced embedding logic)

### 4.2 Cost Optimization

**Current Costs (per document):**
- Azure OCR: ~$0.001-0.01 per page (varies)
- Cohere Embeddings: ~$0.0001 per 1K tokens
- Cohere Rerank: ~$0.001 per query
- Convex storage: Included in plan

**Gemini File Search Costs:**
- Indexing: $0.15 per 1M tokens (one-time)
- Storage: Free
- Query-time embeddings: Free
- Queries: Included in Gemini API usage

**Cost Analysis Example (100-page tender, ~50K tokens):**
- **Current:** ~$0.10 OCR + $0.005 embeddings = ~$0.105 per document
- **Gemini:** $0.0075 indexing (one-time) = **93% cost reduction** for indexing

**Note:** Query costs shift to Gemini API usage, but query-time embeddings are free.

### 4.3 Built-in Features

**Automatic Citations:**
- Current platform would need custom citation implementation
- Gemini provides `grounding_metadata` automatically
- Better user experience for knowledge chat

**Metadata Filtering:**
- Current: Custom Convex queries with filters
- Gemini: Built-in metadata filter API
- Similar functionality, cleaner API

**Multi-format Support:**
- Current: Custom extractors for PDF, DOCX, TXT
- Gemini: Broader format support (JSON, code files)
- Could enable new use cases

### 4.4 Scalability

**Current Limitations:**
- Manual scaling of Convex vector search
- Rate limiting for Cohere APIs
- Storage management across Convex + R2

**Gemini Advantages:**
- Auto-scaling infrastructure
- No rate limit concerns (within API limits)
- Unified storage

---

## 5. Potential Challenges & Considerations

### 5.1 Loss of Control

**Custom Chunking Strategies:**
- Current: Recursive chunking with structure preservation
- Gemini: Whitespace-based chunking only
- **Impact:** May affect retrieval quality for structured documents

**Hybrid Search:**
- Current: Vector + keyword + rerank pipeline
- Gemini: Semantic search only
- **Impact:** May reduce precision for exact keyword matches

**Reranking:**
- Current: Cohere Rerank v3.5 with fine-tuned parameters
- Gemini: Built-in reranking (not separately configurable)
- **Impact:** Less control over final ranking

### 5.2 Vendor Lock-in

**Current Architecture:**
- Multi-vendor (Azure OCR, Cohere embeddings, Convex storage)
- Can swap components independently

**Gemini File Search:**
- Single vendor (Google)
- Harder to migrate if needed
- Tied to Gemini API ecosystem

### 5.3 Integration Complexity

**Current Integration Points:**
- Convex schema (`chunks` table with vector index)
- Convex queries (`chunks.search`)
- Custom retrieval utilities

**Migration Required:**
- Replace Convex vector search with Gemini File Search
- Update document ingestion pipeline
- Modify knowledge chat implementation
- Handle organization/bundle scoping via metadata

### 5.4 Feature Gaps

**Missing Features:**
- No direct access to raw embeddings
- Limited chunking customization
- No hybrid search (vector + keyword)
- Metadata filtering syntax limitations
- File size limit: 100 MB per file

**Current Platform Advantages:**
- Fine-grained chunk metadata (page numbers, sections)
- Custom retrieval strategies
- Direct embedding access for analysis
- No file size limits (handled via R2)

### 5.5 Cost Considerations

**Query Costs:**
- Current: Pay for embeddings + rerank per query
- Gemini: Query costs included in Gemini API usage
- **Impact:** Cost shifts from per-query to per-token generation

**Storage Costs:**
- Current: Convex + R2 storage costs
- Gemini: Free storage (within limits)
- **Benefit:** Reduced storage costs

---

## 6. Hybrid Approach: Best of Both Worlds?

### 6.1 Potential Hybrid Architecture

**Option A: Dual Mode**
- Use Gemini File Search for simple queries
- Keep custom RAG for complex, fine-tuned retrieval
- Route queries based on complexity

**Option B: Gradual Migration**
- Start with new documents in Gemini File Search
- Keep existing documents in Convex
- Migrate gradually based on performance

**Option C: Specialized Use Cases**
- Gemini File Search for knowledge chat (simple Q&A)
- Custom RAG for structured extraction (requirements, risk analysis)
- Best tool for each job

### 6.2 Integration Points

**Metadata Mapping:**
```typescript
// Map TenderBot metadata to Gemini File Search
const geminiMetadata = [
  { key: 'bundleId', string_value: bundleId },
  { key: 'documentId', string_value: documentId },
  { key: 'organizationId', string_value: organizationId },
  { key: 'uploadedAt', numeric_value: Date.now() }
];
```

**Store Organization:**
- One File Search store per organization?
- One store per bundle?
- Single store with metadata filtering?

---

## 7. Recommendations

### 7.1 Short-term (Proof of Concept)

1. **Implement Gemini File Search for Knowledge Chat**
   - Create a separate File Search store for testing
   - Upload sample tender documents
   - Compare retrieval quality vs. current system
   - Measure cost differences

2. **A/B Testing**
   - Route 10% of queries to Gemini File Search
   - Compare response quality, latency, costs
   - Gather user feedback

### 7.2 Medium-term (If Successful)

1. **Hybrid Architecture**
   - Use Gemini File Search for knowledge chat
   - Keep custom RAG for structured extraction
   - Optimize based on use case

2. **Cost Optimization**
   - Migrate high-volume, simple queries to Gemini
   - Keep complex queries on custom RAG
   - Monitor cost savings

### 7.3 Long-term (If Fully Adopted)

1. **Full Migration**
   - Migrate all documents to Gemini File Search
   - Deprecate custom RAG infrastructure
   - Simplify codebase significantly

2. **Feature Enhancement**
   - Leverage Gemini's broader format support
   - Build new features on top of File Search
   - Focus on application logic vs. infrastructure

---

## 8. Implementation Considerations

### 8.1 Technical Requirements

**New Dependencies:**
- `@google/genai` SDK (or REST API)
- Gemini API key

**Code Changes:**
- New `convex/gemini-file-search.ts` module
- Update `convex/ingest.ts` to support Gemini upload
- Modify `convex/analyses.ts` for knowledge chat
- Update frontend chat component

**Migration Path:**
- Dual-write to both systems initially
- Gradual cutover
- Rollback plan

### 8.2 Data Migration

**Existing Documents:**
- Re-index existing documents in Gemini File Search
- Maintain Convex storage during transition
- Validate data consistency

**Metadata Preservation:**
- Map existing metadata to Gemini format
- Ensure organization/bundle scoping works
- Test metadata filtering

### 8.3 Testing Strategy

**Unit Tests:**
- File upload and indexing
- Query with metadata filters
- Citation extraction

**Integration Tests:**
- End-to-end knowledge chat flow
- Compare retrieval results vs. current system
- Performance benchmarking

**User Acceptance Testing:**
- Compare response quality
- Measure latency
- Gather feedback on citations

---

## 9. Conclusion

Gemini File Search API offers significant potential benefits for TenderBot:

**Pros:**
- ✅ Simplified infrastructure (eliminate ~500+ lines of RAG code)
- ✅ Lower indexing costs (93% reduction estimated)
- ✅ Built-in citations
- ✅ Auto-scaling
- ✅ Free storage and query-time embeddings

**Cons:**
- ❌ Loss of fine-grained control over chunking/retrieval
- ❌ No hybrid search (vector + keyword)
- ❌ Vendor lock-in
- ❌ Migration complexity
- ❌ Limited customization

**Recommendation:**
Start with a **proof of concept** for knowledge chat use case. If successful, consider a **hybrid approach** where Gemini File Search handles simple Q&A while custom RAG handles structured extraction. This balances simplification with maintaining control where needed.

---

## 10. Next Steps

1. **Set up Gemini API access** and create test File Search store
2. **Implement POC** for knowledge chat with Gemini File Search
3. **Benchmark** retrieval quality, latency, and costs
4. **Evaluate** user experience and citation quality
5. **Decide** on hybrid vs. full migration based on results

---

## References

- [Gemini File Search Documentation](https://ai.google.dev/gemini-api/docs/file-search)
- [Gemini File Search Blog Post](https://blog.google/technology/developers/file-search-gemini-api/)
- [Gemini Embeddings Documentation](https://ai.google.dev/gemini-api/docs/embeddings)
- [TenderBot Architecture Docs](./ARCHITECTURE.md)

