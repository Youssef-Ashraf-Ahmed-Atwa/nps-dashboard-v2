"use client";

import { useMemo, useState } from "react";
import {
  buildLists,
  complaintBreakdown,
  dateBounds,
  filterByDate,
  scoreDistribution,
  summarize,
  type ComplaintScope,
} from "@/lib/survey-analytics";
import { CATEGORY_KEYS, useLang } from "@/lib/i18n";
import type { CleanedSurvey } from "@/lib/survey-cleaner";
import { ComplaintSection } from "./ComplaintSection";
import { DateFilter } from "./DateFilter";
import { ManagerReport } from "./ManagerReport";
import { NpsCharts } from "./NpsCharts";
import { SurveyTable } from "./SurveyTable";

interface Props {
  surveys: CleanedSurvey[];
  fileName: string;
}

function StatCard({
  label,
  value,
  hint,
  accent,
  valueClass = "",
}: {
  label: string;
  value: string;
  hint: string;
  accent: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4" style={{ borderTop: `4px solid ${accent}` }}>
      <p className="text-sm text-slate-600">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

export function SurveyDashboard({ surveys, fileName }: Props) {
  const { t, reason } = useLang();
  const bounds = useMemo(() => dateBounds(surveys), [surveys]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [scope, setScope] = useState<ComplaintScope>("dissatisfied");
  const [exportError, setExportError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  const rangeInvalid = from !== "" && to !== "" && from > to;
  const rows = useMemo(() => (rangeInvalid ? [] : filterByDate(surveys, from, to)), [surveys, from, to, rangeInvalid]);

  const summary = useMemo(() => summarize(rows), [rows]);
  const distribution = useMemo(() => scoreDistribution(rows), [rows]);
  const breakdown = useMemo(() => complaintBreakdown(rows, scope), [rows, scope]);
  const lists = useMemo(() => buildLists(rows), [rows]);

  async function handleExport() {
    setExportError(null);
    try {
      // Loaded on demand so the xlsx library is not part of the page's first download.
      const XLSX = await import("xlsx");
      const data = rows.map((r) => ({
        [t("colDate")]: r.survey_date,
        [t("colName")]: r.customer_name ?? "",
        [t("colPhone")]: r.phone ?? r.raw_phone ?? "",
        [t("colPhoneValid")]: r.phone ? t("yes") : t("no"),
        [t("colModel")]: r.vehicle_model ?? "",
        CSAT: r.csat ?? "",
        NPS: r.nps ?? "",
        [t("colCategory")]: r.root_cause ? t(CATEGORY_KEYS[r.root_cause]) : "",
        [t("colDetail")]: r.root_cause_detail ? reason(r.root_cause_detail) : "",
        [t("colComment")]: r.comment ?? "",
      }));
      const sheet = XLSX.utils.json_to_sheet(data);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Cleaned_Data");
      const label = `${from || bounds?.min || "all"}_${to || bounds?.max || "all"}`;
      XLSX.writeFile(book, `Survey_Cleaned_${label}.xlsx`);
    } catch {
      setExportError(t("exportError"));
    }
  }

  if (!bounds) return null;

  // The manager report replaces the whole dashboard (no phones, names or long lists).
  if (showReport && rows.length > 0) {
    return (
      <ManagerReport
        rows={rows}
        from={from}
        to={to}
        fileName={fileName}
        onBack={() => setShowReport(false)}
      />
    );
  }

  const npsText = summary.nps === null ? "-" : summary.nps > 0 ? `+${summary.nps}` : `${summary.nps}`;
  const npsColor =
    summary.nps === null ? "" : summary.nps > 0 ? "text-emerald-700" : summary.nps < 0 ? "text-red-700" : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{t("dashTitle")}</h2>
          <p className="text-sm text-slate-600">{fileName}</p>
        </div>
        <div className="text-end">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowReport(true)}
              disabled={rows.length === 0}
              className="rounded-md border border-[#0F2A33] bg-white px-4 py-2 text-sm font-medium text-[#0F2A33] hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E8A8F]"
            >
              {t("reportBtn")}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={rows.length === 0}
              className="rounded-md bg-[#0F2A33] px-4 py-2 text-sm font-medium text-white hover:bg-[#17414f] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E8A8F]"
            >
              {t("exportBtn")}
            </button>
          </div>
          {exportError && (
            <p role="alert" className="mt-1 text-sm text-red-700">
              {exportError}
            </p>
          )}
        </div>
      </div>

      <DateFilter
        bounds={bounds}
        from={from}
        to={to}
        onChange={(f, t2) => {
          setFrom(f);
          setTo(t2);
        }}
        shown={rows.length}
        total={surveys.length}
      />

      {rows.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">
          {t("noResponsesInRange")}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label={t("statNps")}
              value={npsText}
              valueClass={npsColor}
              hint={t("statNpsHint", { n: summary.npsCount })}
              accent="#0F2A33"
            />
            <StatCard
              label={t("statCsat")}
              value={summary.avgCsat === null ? "-" : summary.avgCsat.toFixed(2)}
              hint={t("statCsatHint", { n: summary.csatCount })}
              accent="#0E8A8F"
            />
            <StatCard
              label={t("statDissat")}
              value={String(summary.dissatisfied)}
              hint={t("statDissatHint", { p: Math.round((summary.dissatisfied / summary.total) * 100) })}
              accent="#D6453D"
            />
            <StatCard
              label={t("statUseful")}
              value={String(lists.usefulComments.length)}
              hint={t("statUsefulHint")}
              accent="#3B6EA8"
            />
            <StatCard
              label={t("statFollow")}
              value={String(lists.needFollowUp.length)}
              hint={t("statFollowHint")}
              accent="#E0A100"
            />
            <StatCard
              label={t("statNoContact")}
              value={String(lists.noContact.length)}
              hint={t("statNoContactHint")}
              accent="#9AA5B1"
            />
          </div>

          <NpsCharts summary={summary} distribution={distribution} />

          <ComplaintSection breakdown={breakdown} scope={scope} onScopeChange={setScope} />

          {lists.needFollowUp.length > 0 && (
            <SurveyTable
              title={t("tblFollowTitle")}
              description={t("tblFollowDesc")}
              rows={lists.needFollowUp}
              accent="#D6453D"
            />
          )}

          {lists.noContact.length > 0 && (
            <SurveyTable
              title={t("tblNoContactTitle")}
              description={t("tblNoContactDesc")}
              rows={lists.noContact}
              accent="#9AA5B1"
            />
          )}

          {lists.usefulComments.length > 0 && (
            <SurveyTable
              title={t("tblCommentsTitle")}
              description={t("tblCommentsDesc")}
              rows={lists.usefulComments}
              accent="#3B6EA8"
            />
          )}
        </>
      )}
    </div>
  );
}
