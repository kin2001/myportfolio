import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getSiteUrl } from "@/lib/env";
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
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Artkin Carreon | AI Automation Specialist",
    template: "%s | Artkin Carreon",
  },
  description:
    "Artkin Carreon designs reliable workflow automation and AI-assisted systems for small businesses.",
  alternates: { canonical: "/" },
  keywords: [
    "Artkin Carreon",
    "AI automation specialist",
    "workflow automation",
    "small business automation",
  ],
  openGraph: {
    title: "Artkin Carreon | AI Automation Specialist",
    description:
      "Reliable workflow automation and AI-assisted systems for small businesses.",
    type: "website",
    url: "/",
    siteName: "Artkin Carreon",
    images: [{
      url: "/artkin-hero.webp",
      width: 1024,
      height: 1024,
      alt: "Artkin Carreon",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Artkin Carreon | AI Automation Specialist",
    description:
      "Reliable workflow automation and AI-assisted systems for small businesses.",
    images: ["/artkin-hero.webp"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
