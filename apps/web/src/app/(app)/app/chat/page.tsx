"use client";

import { useMemo, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Sparkles, Database, Search, Zap, Loader2, RotateCw } from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Array<{ fileUri?: string; chunkIndex?: number }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

const suggestions = [
  "Summarize the mandatory submission requirements",
  "What risks should we flag before bid/no-bid?",
  "List all evaluation criteria with weights",
  "What compliance documents do we still need?",
];

export default function ChatPage() {
  const ask = useAction(api.chat.ask);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const handleSend = async () => {
    if (!input.trim() || isThinking) {
      return;
    }

    const question = input.trim();
    setInput("");
    setError(null);
    setIsThinking(true);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await ask({ question });
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.answer,
        citations: response.citations,
        usageMetadata: response.usageMetadata,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsThinking(false);
      queueMicrotask(() => {
        scrollAreaRef.current?.scrollTo({
          top: scrollAreaRef.current.scrollHeight,
          behavior: "smooth",
        });
      });
    }
  };

  const handleSuggestion = (suggestion: string) => {
    setInput(suggestion);
  };

  const handleClear = () => {
    setMessages([]);
    setError(null);
  };

  const hasMessages = messages.length > 0;

  const renderCitations = (message: Message) => {
    if (!message.citations || message.citations.length === 0) {
      return null;
    }

    return (
      <div className="mt-3 text-xs text-muted-foreground space-y-1 border-l border-border/60 pl-3">
        <p className="font-medium text-foreground/70">Citations</p>
        <ul className="space-y-1">
          {message.citations.map((citation, index) => (
            <li key={`${message.id}-citation-${index}`}>
              [{index + 1}] {citation.fileUri ?? "Document"}{" "}
              {typeof citation.chunkIndex === "number" ? `(chunk ${citation.chunkIndex})` : null}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const usageSummary = (message: Message) => {
    if (!message.usageMetadata) {
      return null;
    }

    const { promptTokenCount, candidatesTokenCount, totalTokenCount } = message.usageMetadata;
    return (
      <p className="text-[11px] text-muted-foreground/80 mt-2">
        Tokens: prompt {promptTokenCount ?? "?"} · completion {candidatesTokenCount ?? "?"} · total{" "}
        {totalTokenCount ?? "?"}
      </p>
    );
  };

  const renderedMessages = useMemo(
    () =>
      messages.map((message) => (
        <div
          key={message.id}
          className={`rounded-lg px-4 py-3 border ${
            message.role === "user"
              ? "bg-primary/10 border-primary/30 text-primary-foreground/90"
              : "bg-muted/40 border-border/60"
          }`}
        >
          <div className="text-xs uppercase tracking-wide text-muted-foreground/70 mb-1">
            {message.role === "user" ? "You" : "TenderBot"}
          </div>
          <div className="prose prose-sm max-w-none text-foreground/90 whitespace-pre-line">
            {message.content}
          </div>
          {renderCitations(message)}
          {usageSummary(message)}
        </div>
      )),
    [messages]
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Knowledge Chat</h2>
        <p className="text-sm text-muted-foreground">
          Grounded answers powered by Gemini File Search with automatic citations
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Chat Interface */}
        <div className="space-y-6">
          <Card className="border-border/40">
            <CardContent className="p-0">
              <div className="flex flex-col h-full">
                <div
                  ref={scrollAreaRef}
                  className="min-h-[360px] max-h-[520px] overflow-y-auto p-6 space-y-4 bg-muted/20"
                >
                  {hasMessages ? (
                    renderedMessages
                  ) : (
                    <div className="min-h-[300px] rounded-lg border border-dashed border-border/60 bg-background flex items-center justify-center p-10 text-center space-y-4 flex-col">
                      <div className="h-12 w-12 rounded-full bg-accent/50 flex items-center justify-center">
                        <Sparkles className="h-6 w-6 text-accent-foreground" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">Start a conversation</p>
                        <p className="text-xs text-muted-foreground max-w-md">
                          Ask about compliance, requirements, risks, or any specific clause. TenderBot
                          automatically scopes to your organization’s documents.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                        {suggestions.slice(0, 2).map((suggestion) => (
                          <span key={suggestion} className="px-3 py-1 rounded-full bg-muted">
                            {suggestion}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {error ? (
                  <div className="px-6 pt-4 text-sm text-destructive">{error}</div>
                ) : null}

                <div className="p-6 space-y-4 border-t border-border/60">
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => handleSuggestion(suggestion)}
                        className="text-xs px-3 py-1 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <Textarea
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      placeholder="Ask a question about your tender documents..."
                      className="min-h-[100px] resize-none"
                      disabled={isThinking}
                    />
                    <div className="flex gap-2">
                      <Button
                        className="gap-2"
                        onClick={handleSend}
                        disabled={!input.trim() || isThinking}
                      >
                        {isThinking ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Thinking
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4" />
                            Send
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        onClick={handleClear}
                        disabled={messages.length === 0 && !input}
                      >
                        <RotateCw className="h-4 w-4" />
                        Clear
                      </Button>
                    </div>
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
                <Sparkles className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <p>Gemini File Search automatically chunks, embeds, and indexes documents.</p>
              </div>
              <div className="flex items-start gap-2">
                <Search className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <p>Scoped by organization, bundle, or document metadata for precise answers.</p>
              </div>
              <div className="flex items-start gap-2">
                <Zap className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <p>Answers include inline citations plus grounding metadata for traceability.</p>
              </div>
              <div className="flex items-start gap-2">
                <Database className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <p>No manual chunking or vector tuning required—Gemini handles storage + retrieval.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
