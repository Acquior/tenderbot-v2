import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TenderBot - AI-Powered Tender Analysis",
  description: "AI-powered tender analysis and opportunity management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const publishableKey =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? process.env.CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    throw new Error("Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY environment variable");
  }

  const convexUrl =
    process.env.NEXT_PUBLIC_CONVEX_URL ??
    process.env.CONVEX_URL ??
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL ??
    process.env.CONVEX_SITE_URL;

  if (!convexUrl) {
    throw new Error(
      "Missing Convex URL. Set NEXT_PUBLIC_CONVEX_URL (or CONVEX_URL / CONVEX_SITE_URL) in your env vars."
    );
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers publishableKey={publishableKey} convexUrl={convexUrl}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
