import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default function ChatPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card className="flex flex-col">
        <CardHeader className="space-y-1">
          <CardTitle>Knowledge Chat</CardTitle>
          <CardDescription>
            Ask grounded questions across uploaded tenders and knowledge bases. Responses are
            structured via the OpenAI Responses API with JSON schema validation.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          <Textarea
            placeholder="e.g. Summarize the mandatory compliance requirements and cite supporting documents."
            className="min-h-[160px]"
          />
          <div className="flex gap-2">
            <Button>Send</Button>
            <Button variant="outline">Use Rerank</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Retrieval strategy</CardTitle>
          <CardDescription>Hybrid search + Cohere rerank</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>pgvector semantic search with metadata filters</li>
            <li>BM25 keyword fallbacks for precision</li>
            <li>Cohere Rerank v3.5 on top-k candidates</li>
            <li>Auto-truncated spans for 4k rerank window</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
