import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nexora AI — Premium AI Platform",
  description:
    "Nexora AI is a premium, light-first AI workspace: chat, image generation, presentations and a dev assistant — beautifully designed, one prompt away.",
  keywords: ["Nexora AI", "AI platform", "Next.js", "TypeScript", "Tailwind CSS"],
  authors: [{ name: "Abolfazl Nasiri" }],
  openGraph: {
    title: "Nexora AI — Premium AI Platform",
    description:
      "A premium, light-first AI workspace: chat, image generation, presentations and a dev assistant.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-nexora-bg text-nexora-text">{children}</body>
    </html>
  );
}
