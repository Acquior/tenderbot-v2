import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Sparkles, Database, Search, Zap } from "lucide-react";

export default function ChatPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Knowledge Chat</h2>
        <p className="text-sm text-muted-foreground">
          Ask questions about your documents and receive precise, cited answers
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Chat Interface */}
        <div className="space-y-6">
          <Card className="border-border/40">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="min-h-[400px] rounded-lg bg-muted/30 p-6 flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <div className="h-12 w-12 rounded-lg bg-accent/50 flex items-center justify-center mx-auto">
                      <Sparkles className="h-6 w-6 text-accent-foreground" />
                    </div>
                    <p className="text-sm font-medium">Start a conversation</p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      Ask questions about requirements, compliance, or any document content
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <Textarea
                    placeholder="Ask a question about your tender documents..."
                    className="min-h-[100px] resize-none"
                  />
                  <div className="flex gap-2">
                    <Button className="gap-2">
                      <Send className="h-4 w-4" />
                      Send
                    </Button>
                    <Button variant="outline" className="gap-2">
                      <Zap className="h-4 w-4" />
                      Use Rerank
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Retrieval Settings */}
        <div className="space-y-6">
          <Card className="border-border/40">
            <CardHeader className="pb-4">
              <div className="h-10 w-10 rounded-lg bg-accent/50 flex items-center justify-center mb-3">
                <Database className="h-5 w-5 text-accent-foreground" />
              </div>
              <CardTitle className="text-base">Retrieval Strategy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground leading-relaxed">
              <div className="flex items-start gap-2">
                <Search className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <p>pgvector semantic search with metadata filtering</p>
              </div>
              <div className="flex items-start gap-2">
                <Search className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <p>BM25 keyword fallback for precision</p>
              </div>
              <div className="flex items-start gap-2">
                <Zap className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <p>Cohere Rerank v3.5 for top candidates</p>
              </div>
              <div className="flex items-start gap-2">
                <Sparkles className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <p>Auto-truncated spans for optimal context</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
