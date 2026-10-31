"use client";

import {
  CATEGORY_COLORS,
  CATEGORY_ORDER,
  NO_DETAIL_LABEL,
  type ComplaintBreakdown,
  type ComplaintScope,
} from "@/lib/survey-analytics";
import { CATEGORY_KEYS, useLang } from "@/lib/i18n";
import type { RootCause } from "@/lib/survey-cleaner";

const TOP_REASONS = 8;

interface Props {
  breakdown: ComplaintBreakdown;
  scope: ComplaintScope;
  onScopeChange: (scope: ComplaintScope) => void;
}

interface BarItem {
  label: string;
  count: number;
  color: string;
}

/** Horizontal bars drawn with plain HTML so long labels wrap cleanly in both directions. */
function BreakdownBars({ items }: { items: BarItem[] }) {
  const max = Math.max(...items.map((i) => i.count));
  const total = items.reduce((sum, i) => sum + i.count, 0);

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">{item.label}</span>
            <span className="shrink-0 tabular-nums text-slate-700">
              {item.count} <span className="text-slate-400">({Math.round((item.count / total) * 100)}%)</span>
            </span>
          </div>
          <div className="mt-1 h-2.5 rounded-full bg-slate-100">
            <div
              className="h-full rounded-full"
              style={{ width: `${(item.count / max) * 100}%`, backgroundColor: item.color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function CategoryPanel({ category, breakdown }: { category: RootCause; breakdown: ComplaintBreakdown }) {
  const { t, reason: translateReason } = useLang();
  const color = CATEGORY_COLORS[category];
  const all = breakdown.subReasons[category];
  const categoryTotal = all.reduce((sum, r) => sum + r.count, 0);

  // Answers where the customer picked the category but not a detailed reason.
  const detailed = all.filter((r) => r.reason !== NO_DETAIL_LABEL);
  const withoutDetail = categoryTotal - detailed.reduce((sum, r) => sum + r.count, 0);
  const shown = detailed.slice(0, TOP_REASONS);
  const hidden = detailed.length - shown.length;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5" style={{ borderTop: `4px solid ${color}` }}>
      <h3 className="text-base font-semibold">{t(CATEGORY_KEYS[category])}</h3>
      <p className="text-sm text-slate-600">{t("categoryCount", { n: categoryTotal })}</p>

      <div className="mt-4">
        {shown.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{t("noDetailInCategory")}</p>
        ) : (
          <BreakdownBars items={shown.map((r) => ({ label: translateReason(r.reason), count: r.count, color }))} />
        )}
      </div>

      {(hidden > 0 || (withoutDetail > 0 && shown.length > 0)) && (
        <p className="mt-3 text-xs text-slate-500">
          {hidden > 0 && `${t("moreReasons", { n: hidden })} `}
          {withoutDetail > 0 && t("withoutDetail", { n: withoutDetail })}
        </p>
      )}
    </section>
  );
}

export function ComplaintSection({ breakdown, scope, onScopeChange }: Props) {
  const { t } = useLang();
  // "Other" only gets its own panel when something landed in it.
  const panels = CATEGORY_ORDER.filter((c) => c !== "other" || breakdown.subReasons.other.length > 0);

  return (
    <section aria-label={t("complaintsAria")} className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{t("whereTitle")}</h2>
            <p className="text-sm text-slate-600">{t("whereDesc", { n: breakdown.total })}</p>
          </div>
          <div>
            <label htmlFor="complaint-scope" className="text-sm text-slate-600">
              {t("scopeLabel")}
            </label>
            <select
              id="complaint-scope"
              value={scope}
              onChange={(e) => onScopeChange(e.target.value as ComplaintScope)}
              className="mt-1 block rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E8A8F]"
            >
              <option value="dissatisfied">{t("scopeDissatisfied")}</option>
              <option value="all_with_category">{t("scopeAll")}</option>
            </select>
          </div>
        </div>

        <div className="mt-5">
          {breakdown.categories.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{t("noCategorized")}</p>
          ) : (
            <BreakdownBars
              items={breakdown.categories.map((c) => ({
                label: t(CATEGORY_KEYS[c.category]),
                count: c.count,
                color: CATEGORY_COLORS[c.category],
              }))}
            />
          )}
        </div>

        {breakdown.unspecified > 0 && (
          <p className="mt-4 text-xs text-slate-500">{t("unspecifiedNote", { n: breakdown.unspecified })}</p>
        )}
      </div>

      <div className={`grid gap-6 ${panels.length > 3 ? "lg:grid-cols-2 xl:grid-cols-4" : "lg:grid-cols-3"}`}>
        {panels.map((category) => (
          <CategoryPanel key={category} category={category} breakdown={breakdown} />
        ))}
      </div>
    </section>
  );
}
