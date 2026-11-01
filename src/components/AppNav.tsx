"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/lib/i18n";

/** Links between the two screens: upload and analysis, and customer follow-up. */
export function AppNav() {
  const { t } = useLang();
  const pathname = usePathname();
  const items = [
    { href: "/upload", label: t("navUpload") },
    { href: "/tickets", label: t("navTickets") },
  ];

  return (
    <nav className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md border px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E8A8F] ${
              active ? "border-[#0F2A33] bg-[#0F2A33] text-white" : "border-slate-300 bg-white hover:bg-slate-50"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
