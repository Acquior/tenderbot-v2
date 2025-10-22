"use client";

import { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/components/convex-provider";
import { ThemeProvider } from "@/components/theme-provider";

interface ProvidersProps {
  children: ReactNode;
  publishableKey: string;
  convexUrl: string;
}

export function Providers({ children, publishableKey, convexUrl }: ProvidersProps) {
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ConvexClientProvider convexUrl={convexUrl}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </ConvexClientProvider>
    </ClerkProvider>
  );
}
