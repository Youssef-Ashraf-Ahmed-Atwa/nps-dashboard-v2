import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { LanguageProvider } from "@/lib/i18n";
import { SurveySessionProvider } from "@/lib/survey-session";
import "./globals.css";

// Covers Arabic and Latin text, so the Arabic and English interfaces share one font.
const plex = IBM_Plex_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "Aftersales customer satisfaction",
  description: "NPS and CSAT dashboard with a 48-hour customer recovery tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${plex.className} min-h-screen bg-[#EEF1F4] text-slate-900 antialiased`}>
        <LanguageProvider>
          <SurveySessionProvider>{children}</SurveySessionProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
