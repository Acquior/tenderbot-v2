"use client";

import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary" />
          <span className="text-lg font-semibold tracking-tight">TenderBot</span>
        </Link>
      </div>
      <SignIn
        appearance={{
          layout: { socialButtonsVariant: "iconButton" },
          elements: {
            rootBox: "mx-auto",
            card: "border-border/40 shadow-sm"
          }
        }}
      />
    </div>
  );
}
