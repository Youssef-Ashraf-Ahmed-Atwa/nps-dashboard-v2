"use client";

import Link from "next/link";
import { LanguageToggle, useLang } from "@/lib/i18n";
import { UploadPanel } from "./UploadPanel";

export function UploadShell() {
  const { t, dir } = useLang();

  return (
    <main dir={dir} className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="no-print flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/" className="text-sm text-slate-600 underline-offset-2 hover:underline">
            {t("backHome")}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t("uploadTitle")}</h1>
          <p className="mt-1 max-w-prose text-sm text-slate-600">{t("uploadIntro")}</p>
        </div>
        <LanguageToggle />
      </header>

      <UploadPanel />
    </main>
  );
}
