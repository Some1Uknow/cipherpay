import type { Metadata } from "next";
import { DM_Sans, Plus_Jakarta_Sans } from "next/font/google";

import "./globals.css";
import { AppFrame } from "@/components/layout/AppFrame";
import { SolanaProvider } from "@/components/SolanaProvider";

const bodyFont = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

const displayFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "CipherPay",
  description: "Run wallet-funded payout cycles with clear review, clean status, and minimal overhead.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body className="bg-[var(--brand-surface)] font-sans text-[var(--brand-ink)]">
        <SolanaProvider>
          <AppFrame>{children}</AppFrame>
        </SolanaProvider>
      </body>
    </html>
  );
}
