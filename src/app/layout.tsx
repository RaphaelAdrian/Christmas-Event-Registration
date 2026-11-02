import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Chakra_Petch } from "next/font/google";
import { RevealObserver } from "@/components/RevealObserver";
import { getEventSettings } from "@/lib/event";
import "./globals.css";

// Variable font: its optical-size axis switches to the Display cut at large sizes.
// Next has no fallback metrics for it, so it doesn't try to size-match a fallback font.
const shoulders = Big_Shoulders({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-shoulders",
  display: "swap",
  adjustFontFallback: false,
});

const chakra = Chakra_Petch({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-chakra",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const event = await getEventSettings();
  return {
    title: {
      default: event.name,
      template: `%s | ${event.shortName}`,
    },
    description: event.tagline,
  };
}

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-PH" className={`${shoulders.variable} ${chakra.variable}`} suppressHydrationWarning>
      <head>
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
