"use client";

import { ReactNode, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";

let convexClient: ConvexReactClient | null = null;

function getConvexClient(url: string): ConvexReactClient {
  if (convexClient) {
    return convexClient;
  }

  convexClient = new ConvexReactClient(url);

  return convexClient;
}

export function ConvexClientProvider({ children, convexUrl }: { children: ReactNode; convexUrl: string }) {
  const client = useMemo(() => getConvexClient(convexUrl), [convexUrl]);

  return (
    <ConvexProviderWithClerk client={client} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
