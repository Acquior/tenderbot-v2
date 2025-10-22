"use client";

import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, MessageSquare, CheckCircle, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary" />
              <span className="text-lg font-semibold tracking-tight">TenderBot</span>
            </div>
            <div className="flex items-center gap-3">
              <SignedOut>
                <SignInButton mode="modal">
                  <Button variant="ghost" size="sm">Sign In</Button>
                </SignInButton>
                <Button size="sm" asChild>
                  <Link href="/sign-up">Get Started</Link>
                </Button>
              </SignedOut>
              <SignedIn>
                <Button size="sm" asChild>
                  <Link href="/app">Dashboard</Link>
                </Button>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 lg:px-8">
        <div className="mx-auto max-w-3xl py-24 text-center lg:py-32">
          <h1 className="text-4xl font-semibold tracking-tight lg:text-6xl mb-6">
            AI-Powered Tender
            <br />
            Analysis Platform
          </h1>
          <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            Streamline your tender process with intelligent document processing,
            real-time collaboration, and comprehensive risk analysis.
          </p>
          <div className="flex gap-3 justify-center items-center">
            <SignedOut>
              <Button size="lg" asChild>
                <Link href="/sign-up">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <SignInButton mode="modal">
                <Button size="lg" variant="outline">Sign In</Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Button size="lg" asChild>
                <Link href="/app">
                  Open Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </SignedIn>
          </div>
        </div>

        {/* Features */}
        <div className="pb-24 lg:pb-32">
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="border-border/40">
              <CardHeader className="pb-4">
                <div className="h-12 w-12 rounded-lg bg-accent/50 flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6 text-accent-foreground" />
                </div>
                <CardTitle className="text-xl">Document Intelligence</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground leading-relaxed">
                Automated OCR, extraction, and analysis of tender documents with
                intelligent bundling and duplicate detection.
              </CardContent>
            </Card>

            <Card className="border-border/40">
              <CardHeader className="pb-4">
                <div className="h-12 w-12 rounded-lg bg-accent/50 flex items-center justify-center mb-4">
                  <MessageSquare className="h-6 w-6 text-accent-foreground" />
                </div>
                <CardTitle className="text-xl">Knowledge Assistant</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground leading-relaxed">
                Ask questions and receive answers with precise citations using
                hybrid search and AI-powered reranking.
              </CardContent>
            </Card>

            <Card className="border-border/40">
              <CardHeader className="pb-4">
                <div className="h-12 w-12 rounded-lg bg-accent/50 flex items-center justify-center mb-4">
                  <CheckCircle className="h-6 w-6 text-accent-foreground" />
                </div>
                <CardTitle className="text-xl">Risk Assessment</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground leading-relaxed">
                Comprehensive gap analysis, requirement tracking, and automated
                compliance scoring for informed decision-making.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40">
        <div className="container mx-auto px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-muted-foreground">
            © 2024 TenderBot. Built with Next.js, Convex, and OpenAI.
          </div>
        </div>
      </footer>
    </div>
  );
}
