"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

interface NavItem {
  href: string;
  label: string;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/app/documents",
    label: "Documents",
    description: "Uploads, hygiene, and bundle view",
  },
  {
    href: "/app/opportunities",
    label: "Opportunities",
    description: "Requirement matrix, risks, actions",
  },
  {
    href: "/app/chat",
    label: "Knowledge Chat",
    description: "Grounded Q&A with citations",
  },
  {
    href: "/app/settings",
    label: "Settings",
    description: "Team, notifications, and integrations",
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "border-r bg-card/50 backdrop-blur lg:sticky lg:top-0 lg:block lg:h-screen lg:w-72",
          isMobileOpen ? "fixed inset-0 z-40" : "hidden"
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-6 py-4">
            <Link href="/app/documents" className="font-semibold">
              TenderBot
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsMobileOpen(false)}
              aria-label="Close sidebar"
            >
              X
            </Button>
          </div>
          <ScrollArea className="flex-1 px-4">
            <nav className="space-y-1 py-2">
              {NAV_ITEMS.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={cn(
                      "block rounded-lg px-3 py-2 text-sm transition",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <div className="font-medium">{item.label}</div>
                    <div className="text-xs">{item.description}</div>
                  </Link>
                );
              })}
            </nav>
          </ScrollArea>
          <div className="border-t px-4 py-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div>
                <div className="font-medium text-foreground">TenderBot v2</div>
                <div>Powered by Convex & OpenAI</div>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1">
        <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
          <div className="flex h-16 items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setIsMobileOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  TenderBot Workspace
                </div>
                <div className="text-lg font-semibold">
                  {NAV_ITEMS.find((item) => pathname.startsWith(item.href))?.label ??
                    "Overview"}
                </div>
              </div>
            </div>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </header>
        <main className="px-4 py-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
