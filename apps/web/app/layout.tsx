import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/ui";

export const metadata: Metadata = {
  title: "Argumenté: Disagree. Debate. Understand.",
  description: "Human-owned AI Delegates and a neutral Mediator that help people understand each other's disagreements.",
};

// Self-hosted at build time: users' browsers never contact Google.
const display = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
const body = Source_Serif_4({ subsets: ["latin"], variable: "--font-source-serif", style: ["normal", "italic"], display: "swap" });
const ui = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${ui.variable} ${mono.variable}`}>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
