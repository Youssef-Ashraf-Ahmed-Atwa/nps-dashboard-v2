"use client";

import { AppNav } from "@/components/AppNav";
import { LanguageToggle, useLang } from "@/lib/i18n";
import { UploadPanel } from "./UploadPanel";

export function UploadShell() {
  const { t, dir } = useLang();

  return (
    <main dir={dir} className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="no-print flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("uploadTitle")}</h1>
          <p className="mt-1 max-w-prose text-sm text-slate-600">{t("uploadIntro")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AppNav />
          <LanguageToggle />
        </div>
      </header>

      <UploadPanel />
    </main>
  );
}
