"use client";

import { useMemo } from "react";
import {
  buildLists,
  groupBreakdown,
  hasField,
  CATEGORY_COLORS,
  CATEGORY_ORDER,
  complaintBreakdown,
  NO_DETAIL_LABEL,
  NPS_COLORS,
  summarize,
} from "@/lib/survey-analytics";
import { CATEGORY_KEYS, LanguageToggle, useLang } from "@/lib/i18n";
import type { CleanedSurvey } from "@/lib/survey-cleaner";
import { GroupTable } from "./GroupSection";
import { TrendTable } from "./TrendSection";

interface Props {
  rows: CleanedSurvey[]; // already filtered by the dashboard's date range
  from: string;
  to: string;
  fileName: string;
  onBack: () => void;
}

const TOP_TERMS = 3;
const REPORT_GROUP_ROWS = 10; // governorates / centres shown in the printed report
const SMALL_SAMPLE = 100;

// Print rules: only the report is printed, on A4, with the colours kept.
const PRINT_CSS = `
@media print {
  .no-print { display: none !important; }
  body { background: #fff !important; }
  .report-overlay { position: static !important; overflow: visible !important; background: #fff !important; }
  .report-page { margin: 0 !important; max-width: none !important; padding: 0 !important; box-shadow: none !important; border-radius: 0 !important; }
  .avoid-break { break-inside: avoid; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: A4; margin: 14mm; }
}
`;

/** A reason cell can hold several options ("A, B"); count each option separately. */
function countTerms(list: { reason: string; count: number }[]): { term: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const { reason, count } of list) {
    if (reason === NO_DETAIL_LABEL) continue;
    for (const term of reason.split(/[,\u060C]\s*/)) {
      const clean = term.trim();
      if (clean) counts.set(clean, (counts.get(clean) ?? 0) + count);
    }
  }
  return [...counts]
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count);
}

function Kpi({ label, value, hint, accent, valueClass = "" }: { label: string; value: string; hint?: string; accent: string; valueClass?: string }) {
  return (
    <div className="avoid-break rounded-lg border border-slate-200 p-4" style={{ borderTop: `4px solid ${accent}` }}>
      <p className="text-sm text-slate-600">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function ManagerReport({ rows, from, to, fileName, onBack }: Props) {
  const { t, dir, reason } = useLang();

  const summary = useMemo(() => summarize(rows), [rows]);
  const breakdown = useMemo(() => complaintBreakdown(rows, "dissatisfied"), [rows]);
  const lists = useMemo(() => buildLists(rows), [rows]);

  const dates = rows.map((r) => r.survey_date).sort();
  const periodFrom = from || dates[0] || "";
  const periodTo = to || dates[dates.length - 1] || "";

  const dissatisfiedPct = summary.total ? Math.round((summary.dissatisfied / summary.total) * 100) : 0;
  const npsText = summary.nps === null ? "-" : summary.nps > 0 ? `+${summary.nps}` : `${summary.nps}`;
  const npsColor =
    summary.nps === null ? "" : summary.nps > 0 ? "text-emerald-700" : summary.nps < 0 ? "text-red-700" : "";

  const topCategory = breakdown.categories[0];
  const panels = CATEGORY_ORDER.filter((c) => breakdown.subReasons[c].length > 0 && c !== "other");

  // Most mentioned single reason over all categories.
  const allTerms = countTerms(CATEGORY_ORDER.flatMap((c) => breakdown.subReasons[c]));
  const topTerm = allTerms[0];

  const points: string[] = [];
  if (summary.nps !== null) {
    points.push(
      t("reportPointNps", {
        nps: npsText,
        n: summary.npsCount,
        p: Math.round(summary.promoterPct),
        d: Math.round(summary.detractorPct),
      }),
    );
  }
  if (summary.avgCsat !== null) {
    points.push(
      t("reportPointCsat", { avg: summary.avgCsat.toFixed(2), p: dissatisfiedPct, n: summary.dissatisfied }),
    );
  }
  if (topCategory && breakdown.total > 0) {
    points.push(
      t("reportPointCategory", {
        cat: t(CATEGORY_KEYS[topCategory.category]),
        n: topCategory.count,
        p: Math.round((topCategory.count / breakdown.total) * 100),
      }),
    );
  }
  if (topTerm) {
    points.push(t("reportPointReason", { reason: reason(topTerm.term), n: topTerm.count }));
  }
  points.push(t("reportPointFollow", { a: lists.needFollowUp.length, b: lists.noContact.length }));
  if (summary.npsCount < SMALL_SAMPLE) points.push(t("reportSmallSample"));

  const groups = [
    { key: "promoter" as const, label: t("promoters"), count: summary.promoters, pct: summary.promoterPct },
    { key: "passive" as const, label: t("passives"), count: summary.passives, pct: summary.passivePct },
    { key: "detractor" as const, label: t("detractors"), count: summary.detractors, pct: summary.detractorPct },
  ];

  return (
    <div dir={dir} className="report-overlay fixed inset-0 z-50 overflow-y-auto bg-slate-100">
      <style>{PRINT_CSS}</style>

      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E8A8F]"
        >
          {t("reportBack")}
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-600">{t("reportPrintHint")}</span>
          <LanguageToggle />
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md bg-[#0F2A33] px-4 py-2 text-sm font-medium text-white hover:bg-[#17414f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E8A8F]"
          >
            {t("reportPrint")}
          </button>
        </div>
      </div>

      <article className="report-page mx-auto my-6 max-w-4xl space-y-6 rounded-xl bg-white p-8 shadow-sm">
        <header className="border-b border-slate-200 pb-4">
          <h1 className="text-2xl font-semibold tracking-tight">{t("reportTitle")}</h1>
          <p className="mt-1 text-sm text-slate-600">{t("reportPeriod", { from: periodFrom, to: periodTo })}</p>
          <p className="text-sm text-slate-500">{t("reportSource", { file: fileName })}</p>
        </header>

        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Kpi label={t("statNps")} value={npsText} valueClass={npsColor} hint={t("statNpsHint", { n: summary.npsCount })} accent="#0F2A33" />
          <Kpi
            label={t("statCsat")}
            value={summary.avgCsat === null ? "-" : summary.avgCsat.toFixed(2)}
            hint={t("statCsatHint", { n: summary.csatCount })}
            accent="#0E8A8F"
          />
          <Kpi label={t("kpiResponses")} value={String(summary.total)} accent="#3B6EA8" />
          <Kpi
            label={t("statDissat")}
            value={String(summary.dissatisfied)}
            hint={t("statDissatHint", { p: dissatisfiedPct })}
            accent="#D6453D"
          />
        </section>

        <section className="avoid-break">
          <h2 className="text-lg font-semibold">{t("reportKeyPoints")}</h2>
          <ul className="mt-2 list-disc space-y-1.5 ps-5 text-sm text-slate-800">
            {points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>

        {summary.npsCount > 0 && (
          <section className="avoid-break">
            <h2 className="text-lg font-semibold">{t("npsTitle")}</h2>
            <div dir="ltr" className="mt-3 flex h-6 overflow-hidden rounded-full bg-slate-100">
              {groups.map((g) => (
                <div key={g.key} style={{ width: `${g.pct}%`, backgroundColor: NPS_COLORS[g.key] }} />
              ))}
            </div>
            <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              {groups.map((g) => (
                <li key={g.key} className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: NPS_COLORS[g.key] }} />
                  <span className="flex-1">{g.label}</span>
                  <span className="font-semibold tabular-nums">{g.pct.toFixed(1)}%</span>
                  <span className="text-xs tabular-nums text-slate-500">({g.count})</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">{t("reportNpsNote")}</p>
          </section>
        )}

        {breakdown.categories.length > 0 && (
          <section className="avoid-break">
            <h2 className="text-lg font-semibold">{t("whereTitle")}</h2>
            <ul className="mt-3 space-y-3">
              {breakdown.categories.map((c) => {
                const max = breakdown.categories[0].count;
                return (
                  <li key={c.category}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium">{t(CATEGORY_KEYS[c.category])}</span>
                      <span className="tabular-nums text-slate-700">
                        {c.count} <span className="text-slate-400">({Math.round((c.count / breakdown.total) * 100)}%)</span>
                      </span>
                    </div>
                    <div className="mt-1 h-2.5 rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(c.count / max) * 100}%`, backgroundColor: CATEGORY_COLORS[c.category] }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="avoid-break">
          <h2 className="text-lg font-semibold">{t("trendTitle")}</h2>
          <div className="mt-3">
            <TrendTable rows={rows} />
          </div>
        </section>

        <section className="avoid-break">
          <h2 className="text-lg font-semibold">{t("modelTitle")}</h2>
          <div className="mt-3">
            <GroupTable stats={groupBreakdown(rows, "vehicle_model")} field="vehicle_model" />
          </div>
        </section>

        {hasField(rows, "governorate") && (
          <section className="avoid-break">
            <h2 className="text-lg font-semibold">{t("groupGovernorateTitle")}</h2>
            <div className="mt-3">
              <GroupTable stats={groupBreakdown(rows, "governorate").slice(0, REPORT_GROUP_ROWS)} field="governorate" />
            </div>
          </section>
        )}

        {hasField(rows, "service_center") && (
          <section className="avoid-break">
            <h2 className="text-lg font-semibold">{t("groupCenterTitle")}</h2>
            <div className="mt-3">
              <GroupTable stats={groupBreakdown(rows, "service_center").slice(0, REPORT_GROUP_ROWS)} field="service_center" />
            </div>
          </section>
        )}

        {panels.some((c) => countTerms(breakdown.subReasons[c]).length > 0) && (
          <section className="avoid-break">
            <h2 className="text-lg font-semibold">{t("reportTopReasons")}</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              {panels.map((c) => {
                const terms = countTerms(breakdown.subReasons[c]).slice(0, TOP_TERMS);
                if (terms.length === 0) return null;
                return (
                  <div
                    key={c}
                    className="rounded-lg border border-slate-200 p-3"
                    style={{ borderTop: `4px solid ${CATEGORY_COLORS[c]}` }}
                  >
                    <h3 className="text-sm font-semibold">{t(CATEGORY_KEYS[c])}</h3>
                    <ul className="mt-2 space-y-1 text-sm">
                      {terms.map((x) => (
                        <li key={x.term} className="flex justify-between gap-2">
                          <span>{reason(x.term)}</span>
                          <span className="tabular-nums text-slate-600">{x.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <footer className="border-t border-slate-200 pt-3 text-xs text-slate-500">{t("reportCleaning")}</footer>
      </article>
    </div>
  );
}
