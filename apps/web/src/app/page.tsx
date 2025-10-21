import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4">TenderBot</h1>
          <p className="text-xl text-muted-foreground mb-8">
            AI-Powered Tender Analysis & Opportunity Management
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg">Get Started</Button>
            <Button size="lg" variant="outline">Learn More</Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <Card>
            <CardHeader>
              <CardTitle>Intelligent Document Processing</CardTitle>
              <CardDescription>
                Automated OCR, extraction, and analysis of tender documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>Multi-file bundle detection</li>
                <li>Smart chunking and embeddings</li>
                <li>Duplicate detection</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>RAG-Powered Q&A</CardTitle>
              <CardDescription>
                Ask questions and get answers with citations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>Hybrid search (vector + keyword)</li>
                <li>Cohere Rerank for accuracy</li>
                <li>Source citations</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gap Analysis & Scoring</CardTitle>
              <CardDescription>
                Automated requirement tracking and risk assessment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>Requirement extraction</li>
                <li>Compliance checking</li>
                <li>Risk scoring</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="bg-muted/50 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-4">Tech Stack</h2>
          <div className="flex flex-wrap gap-2">
            <Badge>Next.js 14</Badge>
            <Badge>Convex</Badge>
            <Badge>OpenAI GPT-4</Badge>
            <Badge>Cohere</Badge>
            <Badge>Clerk</Badge>
            <Badge>shadcn/ui</Badge>
            <Badge>Tailwind CSS</Badge>
            <Badge>TypeScript</Badge>
            <Badge>Zod</Badge>
            <Badge>pgvector</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
