"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Menu, 
  X, 
  FileText, 
  Briefcase, 
  MessageSquare, 
  Settings, 
  LayoutDashboard,
  ChevronRight
} from "lucide-react";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/app/documents",
    label: "Documents",
    icon: FileText,
  },
  {
    href: "/app/opportunities",
    label: "Opportunities",
    icon: Briefcase,
  },
  {
    href: "/app/chat",
    label: "Knowledge",
    icon: MessageSquare,
  },
  {
    href: "/app/settings",
    label: "Settings",
    icon: Settings,
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-black text-white font-sans selection:bg-purple-500/30 selection:text-purple-200">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
          "bg-black border-r border-white/10",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo & Close Button */}
          <div className="flex h-20 items-center justify-between px-8 border-b border-white/10">
            <Link href="/app/documents" className="flex items-center gap-3 group">
              <div className="h-6 w-6 bg-white rounded-sm flex items-center justify-center">
                <div className="h-2 w-2 bg-black rounded-full" />
              </div>
              <span className="font-bold tracking-tighter text-white text-xl uppercase">TenderBot</span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-zinc-400"
              onClick={() => setIsMobileOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 px-4 py-8">
            <div className="mb-4 px-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">Platform</p>
            </div>
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const active = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={cn(
                      "group flex items-center justify-between rounded-none px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all duration-200 border-l-2",
                      active
                        ? "border-white bg-white/5 text-white"
                        : "border-transparent text-zinc-500 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <Icon className={cn("h-4 w-4", active ? "text-white" : "text-zinc-600 group-hover:text-zinc-400")} />
                      {item.label}
                    </div>
                    {active && <div className="h-1.5 w-1.5 bg-purple-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)]" />}
                  </Link>
                );
              })}
            </nav>
          </ScrollArea>

          {/* Footer */}
          <div className="border-t border-white/10 px-8 py-6 bg-black">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">System Online</span>
                <span className="text-[10px] text-zinc-600 font-mono">v2.0.0-stable</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-white/10 bg-black/80 backdrop-blur-md supports-[backdrop-filter]:bg-black/60">
          <div className="flex h-20 items-center justify-between px-8 lg:px-10">
            <div className="flex items-center gap-6">
              <Button
                variant="ghost"
                size="icon"
                className="-ml-2 lg:hidden"
                onClick={() => setIsMobileOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <h1 className="text-sm font-bold tracking-widest uppercase text-white">
                {NAV_ITEMS.find((item) => pathname.startsWith(item.href))?.label ?? "Studio"}
              </h1>
            </div>
            <div className="flex items-center gap-6">
              <div className="hidden md:flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-zinc-500 border border-white/10 px-3 py-1">
                <span>Workspace: Main</span>
              </div>
              <SignedIn>
                <UserButton 
                  afterSignOutUrl="/" 
                  appearance={{
                    elements: {
                      avatarBox: "h-8 w-8 ring-2 ring-white/10 hover:ring-white transition-all rounded-none"
                    }
                  }}
                />
              </SignedIn>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-zinc-950">
          <div className="container max-w-[1600px] mx-auto px-6 py-8 lg:px-10 lg:py-12">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
