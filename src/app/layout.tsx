import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { event } from "@/config/event";
import { RevealObserver } from "@/components/RevealObserver";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${event.name}: registration`,
    template: `%s | ${event.shortName}`,
  },
  description: event.summary,
};

export const viewport: Viewport = {
  themeColor: "#6bb4ee",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-PH" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://api.fontshare.com/v2/css?f[]=switzer@400,500,600&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
        <RevealObserver />
      </body>
    </html>
  );
}
