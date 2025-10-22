"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, FileText, Briefcase, MessageSquare, Settings } from "lucide-react";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

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
    label: "Knowledge Chat",
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
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "border-r border-border/40 bg-card lg:sticky lg:top-0 lg:block lg:h-screen lg:w-64",
          isMobileOpen ? "fixed inset-0 z-50" : "hidden"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo & Close Button */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-border/40">
            <Link href="/app/documents" className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary" />
              <span className="font-semibold tracking-tight">TenderBot</span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsMobileOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 px-4 py-6">
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
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </ScrollArea>

          {/* Footer */}
          <div className="border-t border-border/40 px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                v2.0.0
              </div>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-16 items-center gap-4 px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-lg font-semibold tracking-tight">
                {NAV_ITEMS.find((item) => pathname.startsWith(item.href))?.label ?? "Dashboard"}
              </h1>
            </div>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 px-6 py-8 lg:px-8 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
