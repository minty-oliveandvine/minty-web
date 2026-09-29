import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";

import { SidebarProvider } from "@/components/ui/Sidebar";
import { TermsGate } from "@/components/ui/TermsGate";
import { ToastProvider } from "@/components/ui/Toast";
import { ProfilePanel } from "@/features/profile";
import { SubscriptionsOverviewCard } from "@/features/subscription";

import "./globals.css";

// The same face billing-frontend sets (app/layout.tsx there): a page here must read as one of
// its pages, with only the contents differing (decision 2026-09-21).
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Minty",
  description: "Minty - subscriptions, billing and invoices.",
};

// Every page's shell, and the second place two features meet (eslint.config.mjs: app/layout
// may import the profile and subscription indexes, and nothing else of a feature's): the
// sidebar's My Profile view is the profile feature's panel with the subscription feature's
// overview card in its slot - the same composition as app/profile/page.tsx. Under it, the Terms
// gate over every page.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
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
