"use client";

import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { ArrowRight, LayoutDashboard } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-purple-500/30 selection:text-purple-200 flex flex-col">
      
      {/* Navigation / Top Bar */}
      <header className="w-full px-6 py-6 flex justify-between items-start z-50">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] tracking-[0.2em] text-zinc-500 font-mono uppercase">Est. 2025</span>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 bg-white rounded-sm" />
            <span className="font-bold tracking-tight text-sm">TENDERBOT STUDIO</span>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-1">
           <span className="text-[10px] tracking-[0.2em] text-zinc-500 font-mono uppercase">Version 2.0</span>
           <div className="flex items-center gap-4">
             <SignedOut>
               <SignInButton mode="modal">
                 <button className="text-sm font-medium hover:text-white/70 transition-colors uppercase tracking-widest">Login</button>
               </SignInButton>
               <Link href="/sign-up" className="text-sm font-medium hover:text-white/70 transition-colors uppercase tracking-widest flex items-center gap-1">
                 Get Started <ArrowRight className="h-3 w-3" />
               </Link>
             </SignedOut>
             <SignedIn>
                <Link href="/app/documents" className="text-sm font-medium hover:text-white/70 transition-colors uppercase tracking-widest">
                  Dashboard
                </Link>
                <UserButton afterSignOutUrl="/" />
             </SignedIn>
           </div>
        </div>
      </header>

      {/* Main Content - Massive Typography */}
      <main className="flex-1 flex flex-col justify-center px-6 relative">
        <div className="max-w-[1800px] mx-auto w-full">
          <h1 className="text-[clamp(3rem,14vw,11rem)] font-black leading-[0.9] tracking-tighter uppercase">
            <div className="block text-white">Master Your</div>
            <div className="block bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent pb-4">
              Tender Flow
            </div>
            <div className="block text-white">With AI</div>
          </h1>
        </div>
      </main>

      {/* Footer / Grid Info */}
      <footer className="px-6 pb-12 pt-20">
        <div className="max-w-[1800px] mx-auto w-full grid grid-cols-1 md:grid-cols-4 gap-12 border-t border-white/10 pt-8">
          
          {/* Column 1 */}
          <div className="space-y-4">
            <h3 className="text-[10px] tracking-[0.2em] text-zinc-500 font-mono uppercase">(Capabilities)</h3>
            <ul className="space-y-2 text-sm text-zinc-400 font-mono">
              <li className="hover:text-white transition-colors cursor-default">Smart Extraction</li>
              <li className="hover:text-white transition-colors cursor-default">Knowledge Chat</li>
              <li className="hover:text-white transition-colors cursor-default">Risk Analysis</li>
              <li className="hover:text-white transition-colors cursor-default">Automated Compliance</li>
            </ul>
          </div>

          {/* Column 2 */}
          <div className="space-y-4">
            <h3 className="text-[10px] tracking-[0.2em] text-zinc-500 font-mono uppercase">(Stack)</h3>
            <ul className="space-y-2 text-sm text-zinc-400 font-mono">
              <li className="hover:text-white transition-colors cursor-default">Powered by LLMs</li>
              <li className="hover:text-white transition-colors cursor-default">Next.js / React 19</li>
              <li className="hover:text-white transition-colors cursor-default">Convex DB</li>
              <li className="hover:text-white transition-colors cursor-default">RAG Pipeline</li>
            </ul>
          </div>

          {/* Column 3 - Spacer or Additional Info */}
          <div className="hidden md:block">
             {/* Empty for spacing like the reference image */}
          </div>

          {/* Column 4 - Description */}
          <div className="flex flex-col justify-between h-full">
            <div className="md:text-right">
               <p className="text-zinc-400 text-sm max-w-xs md:ml-auto leading-relaxed">
                 A studio-grade platform showcasing the raw capabilities of TenderBot. 
                 Pushing the boundaries of document analysis, logic, and design.
               </p>
            </div>
            <div className="mt-8 md:mt-0 md:text-right">
               <p className="text-[10px] text-zinc-600 font-mono uppercase">
                 © {new Date().getFullYear()} TenderBot Inc.
               </p>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
}
