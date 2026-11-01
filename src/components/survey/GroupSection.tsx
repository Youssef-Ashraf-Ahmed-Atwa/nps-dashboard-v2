"use client";

import { useState } from "react";
import { groupBreakdown, type GroupField, type GroupStats } from "@/lib/survey-analytics";
import { useLang, type MessageKey } from "@/lib/i18n";
import type { CleanedSurvey } from "@/lib/survey-cleaner";

/** Fewer responses than this and the figures for a group are only a hint. */
const SMALL_SAMPLE = 10;
const COLLAPSED_ROWS = 12;

const FIELD_HEADER: Record<GroupField, MessageKey> = {
  vehicle_model: "colModel",
  governorate: "colGovernorate",
  service_center: "colServiceCenter",
};

/** The table alone, so the dashboard and the manager report share it. */
export function GroupTable({ stats, field }: { stats: GroupStats[]; field: GroupField }) {
  const { t, place } = useLang();

  const label = (key: string | null): string => {
    if (key === null) return t("notSpecified");
    return field === "governorate" ? place(key) : key;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-start text-sm">
        <thead className="border-b border-slate-200 text-slate-600">
          <tr>
            <th scope="col" className="py-2 pe-4 text-start font-medium">{t(FIELD_HEADER[field])}</th>
            <th scope="col" className="py-2 pe-4 text-start font-medium">{t("colResponses")}</th>
            <th scope="col" className="py-2 pe-4 text-start font-medium">{t("colCsatAvg")}</th>
            <th scope="col" className="py-2 pe-4 text-start font-medium">{t("colNpsAnswers")}</th>
            <th scope="col" className="py-2 pe-4 text-start font-medium">NPS</th>
            <th scope="col" className="py-2 text-start font-medium">{t("statDissat")}</th>
          </tr>
        </thead>
        <tbody>
          {stats.map(({ key, summary }) => {
            const npsColor =
              summary.nps === null ? "" : summary.nps > 0 ? "text-emerald-700" : summary.nps < 0 ? "text-red-700" : "";
            const npsText = summary.nps === null ? "-" : summary.nps > 0 ? `+${summary.nps}` : `${summary.nps}`;
            return (
              <tr key={key ?? "unknown"} className="border-b border-slate-100">
                <td className="py-2.5 pe-4 font-medium">
                  <span dir={field === "vehicle_model" ? "ltr" : undefined}>{label(key)}</span>
                  {summary.total < SMALL_SAMPLE && (
                    <span className="ms-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-600">
                      {t("smallSampleBadge")}
                    </span>
                  )}
                </td>
                <td className="py-2.5 pe-4 tabular-nums">{summary.total}</td>
                <td className="py-2.5 pe-4 tabular-nums">{summary.avgCsat === null ? "-" : summary.avgCsat.toFixed(2)}</td>
                <td className="py-2.5 pe-4 tabular-nums">{summary.npsCount}</td>
                <td className={`py-2.5 pe-4 font-semibold tabular-nums ${npsColor}`}>{npsText}</td>
                <td className="py-2.5 tabular-nums">{summary.dissatisfied}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function GroupSection({
  rows,
  field,
  title,
  description,
}: {
  rows: CleanedSurvey[];
  field: GroupField;
  title: string;
  description: string;
}) {
  const { t } = useLang();
  const [expanded, setExpanded] = useState(false);
  const stats = groupBreakdown(rows, field);
  const shown = expanded ? stats : stats.slice(0, COLLAPSED_ROWS);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-slate-600">{description}</p>
      <div className="mt-4">
        <GroupTable stats={shown} field={field} />
      </div>
      {stats.length > COLLAPSED_ROWS && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E8A8F]"
        >
          {expanded ? t("showFewerGroups") : t("showMoreGroups", { n: stats.length })}
        </button>
      )}
    </section>
  );
}
