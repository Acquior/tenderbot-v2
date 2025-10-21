/**
 * Prompt templates for common tasks
 */

export const PROMPTS = {
  /**
   * Document extraction prompt
   */
  extractDocument: (documentText: string, schema: string) => `
You are an expert at extracting structured information from tender documents.

Extract the following information from the document text below:
${schema}

Document text:
${documentText}

Instructions:
- Extract information accurately and completely
- If a field cannot be determined from the document, use null or an appropriate default
- Preserve exact quotes for important requirements
- Include page numbers or section references where applicable
- For dates, convert to Unix timestamps
- For monetary values, extract both amount and currency
- Maintain high confidence scores only for clearly stated information
`,

  /**
   * Requirement extraction prompt
   */
  extractRequirements: (documentText: string) => `
Analyze the following tender document and extract all requirements.

Categorize each requirement as:
- compliance: Legal or regulatory requirements
- technical: Technical specifications or capabilities
- commercial: Pricing, payment terms, delivery
- legal: Contractual terms and conditions
- bee: Black Economic Empowerment requirements (South Africa)
- eligibility: Eligibility criteria
- other: Other requirements

For each requirement:
- Determine if it is mandatory or optional
- Extract the exact text
- Identify the document section/page
- Assess confidence in the extraction

Document text:
${documentText}
`,

  /**
   * Gap analysis prompt
   */
  gapAnalysis: (
    requirements: string,
    capabilities: string
  ) => `
Conduct a gap analysis between the tender requirements and our capabilities.

Tender Requirements:
${requirements}

Our Capabilities:
${capabilities}

For each requirement:
1. Assess if we meet it (met, partial, not_met, unknown)
2. Provide confidence score (0.0 to 1.0)
3. Identify any gaps
4. Suggest evidence or documentation needed
5. Recommend mitigation strategies for gaps

Focus on:
- Eligibility criteria (critical)
- BEE compliance (if applicable)
- Technical capabilities
- Financial capacity
- Timeline feasibility
`,

  /**
   * Risk assessment prompt
   */
  riskAssessment: (opportunityDetails: string) => `
Conduct a comprehensive risk assessment for this tender opportunity.

Opportunity Details:
${opportunityDetails}

Identify and assess risks in these categories:
- Eligibility: Can we legally bid?
- BEE Compliance: BEE requirements and our status
- Financial: Budget, pricing, cash flow
- Technical: Capability to deliver
- Timeline: Can we meet deadlines?
- Commercial: Terms and conditions
- Legal: Contract risks

For each risk:
- Severity: low, medium, high, critical
- Likelihood: 0.0 to 1.0
- Impact: 0.0 to 1.0
- Mitigation strategy
- Supporting evidence or reasoning
`,

  /**
   * Citation extraction prompt
   */
  extractCitations: (query: string, context: string) => `
You are answering a question about tender documents. Provide citations for your answer.

Question: ${query}

Context from documents:
${context}

Instructions:
- Answer the question based only on the provided context
- For each claim, provide a citation with:
  - Document ID
  - Page number (if available)
  - Exact quote from the document
  - Confidence score (0.0 to 1.0)
- If information is not in the context, clearly state that
- Do not hallucinate or make up information
`,

  /**
   * Summarization prompt
   */
  summarize: (content: string, maxLength: number = 500) => `
Summarize the following content in ${maxLength} words or less.

Focus on:
- Key points and main ideas
- Important requirements or deadlines
- Critical risks or considerations
- Actionable items

Content:
${content}
`,

  /**
   * Bundle detection prompt
   */
  bundleDetection: (fileNames: string[]) => `
Analyze these uploaded file names and determine if they belong to the same tender bundle.

Files:
${fileNames.map((name, i) => `${i + 1}. ${name}`).join("\n")}

Determine:
1. Do these files belong to the same tender? (yes/no with confidence)
2. What is the tender reference number? (if identifiable)
3. What is the issuer name? (if identifiable)
4. What types of documents are these? (RFP, technical specs, pricing schedule, etc.)
5. Are any required documents missing?

Common tender document types:
- RFP/RFQ document
- Technical specifications
- Pricing schedule
- Terms and conditions
- Annexures/Attachments
- Clarifications/Addenda
`,
};
