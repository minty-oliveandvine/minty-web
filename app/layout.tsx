import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";

import { ToastProvider } from "@/components/ui/Toast";

import "./globals.css";

// The same face billing-frontend sets (app/layout.tsx there): a page here must read as one of
// its pages, with only the contents differing (decision 2026-09-21).
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Minty",
  description: "Minty - subscriptions, billing and invoices.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="m-0 min-w-0 overflow-x-clip antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
