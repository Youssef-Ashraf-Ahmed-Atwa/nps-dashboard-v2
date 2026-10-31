import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";

// Covers Arabic and Latin text, so the Arabic upload page and the English dashboard share one font.
const plex = IBM_Plex_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "Aftersales customer satisfaction",
  description: "NPS and CSAT dashboard with a 48-hour customer recovery tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${plex.className} min-h-screen bg-[#EEF1F4] text-slate-900 antialiased`}>
        {children}
      </body>
    </html>
  );
}
