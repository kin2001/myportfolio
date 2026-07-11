import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Artkin Carreon | AI Automation Specialist",
    template: "%s | Artkin Carreon",
  },
  description:
    "Artkin Carreon designs reliable workflow automation and AI-assisted systems for small businesses.",
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
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
