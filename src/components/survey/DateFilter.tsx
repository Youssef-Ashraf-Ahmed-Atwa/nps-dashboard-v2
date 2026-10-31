"use client";

import { addDays } from "@/lib/survey-analytics";
import { useLang } from "@/lib/i18n";

interface Props {
  bounds: { min: string; max: string };
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  shown: number;
  total: number;
}

const inputClass =
  "mt-1 block rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E8A8F]";

export function DateFilter({ bounds, from, to, onChange, shown, total }: Props) {
  const { t } = useLang();
  const invalid = from !== "" && to !== "" && from > to;

  // Presets count back from the latest date in the file, not from today,
  // so an older weekly file still gives a meaningful "last 7 days".
  const presets = [
    { label: t("presetAll"), from: "", to: "" },
    { label: t("preset7"), from: addDays(bounds.max, -6), to: bounds.max },
    { label: t("preset30"), from: addDays(bounds.max, -29), to: bounds.max },
  ];

  return (
    <section
      aria-label={t("dateFilterAria")}
      className="flex flex-wrap items-end gap-x-5 gap-y-3 rounded-xl border border-slate-200 bg-white p-4"
    >
      <div>
        <label htmlFor="date-from" className="text-sm text-slate-600">
          {t("dateFrom")}
        </label>
        <input
          id="date-from"
          type="date"
          min={bounds.min}
          max={bounds.max}
          value={from}
          onChange={(e) => onChange(e.target.value, to)}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="date-to" className="text-sm text-slate-600">
          {t("dateTo")}
        </label>
        <input
          id="date-to"
          type="date"
          min={bounds.min}
          max={bounds.max}
          value={to}
          onChange={(e) => onChange(from, e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {presets.map((p) => {
          const active = p.from === from && p.to === to;
          return (
            <button
              key={p.label}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(p.from, p.to)}
              className={`rounded-md border px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E8A8F] ${
                active
                  ? "border-[#0F2A33] bg-[#0F2A33] text-white"
                  : "border-slate-300 bg-white hover:bg-slate-50"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <p role="status" className="ms-auto text-sm text-slate-600">
        {invalid ? (
          <span className="font-medium text-red-700">{t("rangeInvalid")}</span>
        ) : (
          t("showingRange", { shown, total, min: bounds.min, max: bounds.max })
        )}
      </p>
    </section>
  );
}
