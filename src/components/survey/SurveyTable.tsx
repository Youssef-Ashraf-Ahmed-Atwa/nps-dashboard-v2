"use client";

import { useState } from "react";
import { CATEGORY_COLORS, NPS_COLORS, rowGroup, type NpsGroup } from "@/lib/survey-analytics";
import { CATEGORY_KEYS, useLang } from "@/lib/i18n";
import { isUsefulComment, type CleanedSurvey } from "@/lib/survey-cleaner";

const PAGE_SIZE = 25;

const ROW_TINT: Record<NpsGroup, string> = {
  promoter: "bg-emerald-50",
  passive: "bg-amber-50",
  detractor: "bg-red-50",
};

function ScoreBadge({ label, value, group }: { label: string; value: number | null; group: NpsGroup | null }) {
  if (value === null) return <span className="text-slate-400">-</span>;
  const color = group ? NPS_COLORS[group] : "#9AA5B1";
  return (
    <span
      className="inline-flex min-w-9 items-center justify-center rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums text-white"
      style={{ backgroundColor: color, color: group === "passive" ? "#1F1500" : "#fff" }}
      title={label}
    >
      {value}
    </span>
  );
}

interface Props {
  title: string;
  description: string;
  rows: CleanedSurvey[];
  accent: string; // top border colour
}

export function SurveyTable({ title, description, rows, accent }: Props) {
  const { t, reason, place } = useLang();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, PAGE_SIZE);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5" style={{ borderTop: `4px solid ${accent}` }}>
      <h2 className="text-lg font-semibold">
        {title} <span className="tabular-nums text-slate-500">({rows.length})</span>
      </h2>
      <p className="text-sm text-slate-600">{description}</p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[860px] text-start text-sm">
          <thead className="border-b border-slate-200 text-slate-600">
            <tr>
              <th scope="col" className="py-2 pe-4 text-start font-medium">{t("colPhone")}</th>
              <th scope="col" className="py-2 pe-4 text-start font-medium">{t("colModel")}</th>
              <th scope="col" className="py-2 pe-4 text-start font-medium">NPS</th>
              <th scope="col" className="py-2 pe-4 text-start font-medium">CSAT</th>
              <th scope="col" className="py-2 pe-4 text-start font-medium">{t("colCategory")}</th>
              <th scope="col" className="py-2 pe-4 text-start font-medium">{t("colDetail")}</th>
              <th scope="col" className="py-2 pe-4 text-start font-medium">{t("colComment")}</th>
              <th scope="col" className="py-2 text-start font-medium">{t("colDate")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => {
              const group = rowGroup(r);
              const useful = isUsefulComment(r.comment);
              return (
                <tr
                  key={`${r.survey_date}-${r.phone ?? r.raw_phone ?? "x"}-${i}`}
                  className={`border-b border-white align-top ${group ? ROW_TINT[group] : ""}`}
                >
                  <td className="py-2.5 pe-4 ps-3">
                    <span dir="ltr" className="font-mono">
                      {r.phone ?? r.raw_phone ?? "-"}
                    </span>
                    {r.phone === null && (
                      <span className="ms-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-700">
                        {t("invalidBadge")}
                      </span>
                    )}
                    {r.customer_name && <div className="text-xs text-slate-500">{r.customer_name}</div>}
                  </td>
                  <td className="py-2.5 pe-4">
                    {r.vehicle_model ? <span dir="ltr">{r.vehicle_model}</span> : <span className="text-slate-400">-</span>}
                    {(r.governorate || r.service_center) && (
                      <div className="text-xs text-slate-500">
                        {[r.governorate ? place(r.governorate) : null, r.service_center].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 pe-4"><ScoreBadge label="NPS" value={r.nps} group={group} /></td>
                  <td className="py-2.5 pe-4"><ScoreBadge label="CSAT" value={r.csat} group={group} /></td>
                  <td className="py-2.5 pe-4">
                    {r.root_cause ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[r.root_cause] }} />
                        {t(CATEGORY_KEYS[r.root_cause])}
                      </span>
                    ) : (
                      <span className="text-slate-400">{t("notSpecified")}</span>
                    )}
                  </td>
                  <td className="py-2.5 pe-4">
                    {r.root_cause_detail ? reason(r.root_cause_detail) : <span className="text-slate-400">-</span>}
                  </td>
                  <td className="py-2.5 pe-4">
                    {r.comment ? (
                      <span className={useful ? "" : "text-slate-400"}>{r.comment}</span>
                    ) : (
                      <span className="text-slate-400">{t("noComment")}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-2.5 tabular-nums text-slate-600">{r.survey_date}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length > PAGE_SIZE && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E8A8F]"
        >
          {expanded ? t("showFirst") : t("showAll", { n: rows.length })}
        </button>
      )}
    </section>
  );
}
