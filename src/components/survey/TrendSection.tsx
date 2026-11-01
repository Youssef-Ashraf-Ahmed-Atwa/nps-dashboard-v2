"use client";

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { weeklyTrend } from "@/lib/survey-analytics";
import { useLang } from "@/lib/i18n";
import type { CleanedSurvey } from "@/lib/survey-cleaner";

/** A week with fewer NPS answers than this is only a hint. */
const FEW_ANSWERS = 5;

/** Two line charts, NPS and average CSAT, one point per week. */
export function TrendSection({ rows }: { rows: CleanedSurvey[] }) {
  const { t } = useLang();
  const weeks = useMemo(() => weeklyTrend(rows), [rows]);

  if (weeks.length < 2) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">{t("trendTitle")}</h2>
        <p className="mt-1 text-sm text-slate-600">{t("trendNeedMore")}</p>
      </section>
    );
  }

  const data = weeks.map((w) => ({
    week: w.week,
    nps: w.summary.nps,
    csat: w.summary.avgCsat === null ? null : Number(w.summary.avgCsat.toFixed(2)),
    npsCount: w.summary.npsCount,
    csatCount: w.summary.csatCount,
  }));

  const tooltipStyle = { borderRadius: 8, border: "1px solid #E5E9EE", fontSize: 13 };

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-lg font-semibold">{t("trendTitle")}</h2>
        <p className="text-sm text-slate-600">{t("trendDesc")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium text-slate-700">{t("trendNpsTitle")}</h3>
          <div dir="ltr" className="mt-2 h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="#E5E9EE" vertical={false} />
                <XAxis dataKey="week" tickFormatter={(w: string) => w.slice(5)} tickLine={false} axisLine={false} fontSize={12} />
                <YAxis domain={[-100, 100]} tickLine={false} axisLine={false} fontSize={12} />
                <ReferenceLine y={0} stroke="#9AA5B1" strokeDasharray="4 4" />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(w) => t("weekOf", { date: String(w) })}
                  formatter={(value, _name, item) => [
                    `${value} (${t("statNpsHint", { n: String(item?.payload?.npsCount ?? 0) })})`,
                    "NPS",
                  ]}
                />
                <Line type="monotone" dataKey="nps" stroke="#0F2A33" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-slate-700">{t("trendCsatTitle")}</h3>
          <div dir="ltr" className="mt-2 h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="#E5E9EE" vertical={false} />
                <XAxis dataKey="week" tickFormatter={(w: string) => w.slice(5)} tickLine={false} axisLine={false} fontSize={12} />
                <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(w) => t("weekOf", { date: String(w) })}
                  formatter={(value, _name, item) => [
                    `${value} (${t("statCsatHint", { n: String(item?.payload?.csatCount ?? 0) })})`,
                    "CSAT",
                  ]}
                />
                <Line type="monotone" dataKey="csat" stroke="#0E8A8F" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The same weeks as a table, for the printed manager report (charts print unreliably). */
export function TrendTable({ rows }: { rows: CleanedSurvey[] }) {
  const { t } = useLang();
  const weeks = useMemo(() => weeklyTrend(rows).filter((w) => w.summary.total > 0), [rows]);

  let previousNps: number | null = null;
  const lines = weeks.map((w) => {
    const change = w.summary.nps !== null && previousNps !== null ? w.summary.nps - previousNps : null;
    if (w.summary.nps !== null) previousNps = w.summary.nps;
    return { ...w, change };
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-start text-sm">
        <thead className="border-b border-slate-200 text-slate-600">
          <tr>
            <th scope="col" className="py-2 pe-4 text-start font-medium">{t("colWeek")}</th>
            <th scope="col" className="py-2 pe-4 text-start font-medium">{t("colResponses")}</th>
            <th scope="col" className="py-2 pe-4 text-start font-medium">{t("colCsatAvg")}</th>
            <th scope="col" className="py-2 pe-4 text-start font-medium">NPS</th>
            <th scope="col" className="py-2 text-start font-medium">{t("colChange")}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((w) => {
            const nps = w.summary.nps;
            const npsColor = nps === null ? "" : nps > 0 ? "text-emerald-700" : nps < 0 ? "text-red-700" : "";
            return (
              <tr key={w.week} className="border-b border-slate-100">
                <td className="py-2 pe-4 tabular-nums">
                  {w.week}
                  {w.summary.npsCount < FEW_ANSWERS && (
                    <span className="ms-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{t("trendFew")}</span>
                  )}
                </td>
                <td className="py-2 pe-4 tabular-nums">{w.summary.total}</td>
                <td className="py-2 pe-4 tabular-nums">{w.summary.avgCsat === null ? "-" : w.summary.avgCsat.toFixed(2)}</td>
                <td className={`py-2 pe-4 font-semibold tabular-nums ${npsColor}`}>
                  {nps === null ? "-" : nps > 0 ? `+${nps}` : nps}
                </td>
                <td
                  dir="ltr"
                  className={`py-2 text-start tabular-nums ${
                    w.change === null ? "text-slate-400" : w.change > 0 ? "text-emerald-700" : w.change < 0 ? "text-red-700" : ""
                  }`}
                >
                  {w.change === null ? "-" : w.change > 0 ? `▲ +${w.change}` : w.change < 0 ? `▼ ${w.change}` : "0"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
