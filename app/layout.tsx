import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";

import { SidebarProvider } from "@/components/ui/Sidebar";
import { TermsGate } from "@/components/ui/TermsGate";
import { ToastProvider } from "@/components/ui/Toast";
import { ProfilePanel } from "@/features/profile";
import { SubscriptionsOverviewCard } from "@/features/subscription";

import "./globals.css";

// The same face minty-payment-request-web sets (app/layout.tsx there): a page here must read as one of
// its pages, with only the contents differing (decision 2026-09-21).
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

// The brand face, for the "Minty" name alone (components/ui/Wordmark.tsx) - never for body text.
// Weight 700 only, the one weight the mark is drawn at, as minty-onboarding-web sets it
// (its .topbar .brand: Plus Jakarta Sans 700, -0.005em).
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  weight: ["700"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "Minty",
  description: "Minty - subscriptions, billing and invoices.",
  // A shared link's preview card: the image is app/opengraph-image.png (and twitter-image.png).
  openGraph: { siteName: "Minty", type: "website" },
  twitter: { card: "summary_large_image" },
};

// Every page's shell, and the second place two features meet (eslint.config.mjs: app/layout
// may import the profile and subscription indexes, and nothing else of a feature's): the
// sidebar's My Profile view is the profile feature's panel with the subscription feature's
// overview card in its slot - the same composition as app/profile/page.tsx. Under it, the Terms
// gate over every page.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable}`}>
      <body className="m-0 min-w-0 overflow-x-clip antialiased">
        <ToastProvider>
          <SidebarProvider profile={<ProfilePanel subscriptions={<SubscriptionsOverviewCard />} />}>
            <TermsGate>{children}</TermsGate>
          </SidebarProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
