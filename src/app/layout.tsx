import "@fontsource-variable/instrument-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import { SerwistProvider } from "@serwist/turbopack/react";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Harmonic Compass",
  title: {
    default: "Harmonic Compass",
    template: "%s · Harmonic Compass",
  },
  description:
    "Real-time harmonic navigation for guitarists. Never feel lost after playing a chord.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Harmonic Compass",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: "/icons/compass.svg",
    apple: "/icons/compass.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0d0c",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV === "development"}>
          {children}
        </SerwistProvider>
      </body>
    </html>
  );
}
