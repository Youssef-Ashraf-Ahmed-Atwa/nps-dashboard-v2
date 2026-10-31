"use client";

import { useMemo, useState } from "react";
import {
  buildLists,
  CATEGORY_LABELS,
  complaintBreakdown,
  dateBounds,
  filterByDate,
  scoreDistribution,
  summarize,
  type ComplaintScope,
} from "@/lib/survey-analytics";
import type { CleanedSurvey } from "@/lib/survey-cleaner";
import { ComplaintSection } from "./ComplaintSection";
import { DateFilter } from "./DateFilter";
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
  const bounds = useMemo(() => dateBounds(surveys), [surveys]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [scope, setScope] = useState<ComplaintScope>("dissatisfied");
  const [exportError, setExportError] = useState<string | null>(null);

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
        "التاريخ": r.survey_date,
        "الاسم": r.customer_name ?? "",
        "رقم الهاتف": r.phone ?? r.raw_phone ?? "",
        "الرقم صالح": r.phone ? "نعم" : "لا",
        "الموديل": r.vehicle_model ?? "",
        CSAT: r.csat ?? "",
        NPS: r.nps ?? "",
        "مجال المشكلة": r.root_cause ? CATEGORY_LABELS[r.root_cause] : "",
        "السبب التفصيلي": r.root_cause_detail ?? "",
        "التعليق": r.comment ?? "",
      }));
      const sheet = XLSX.utils.json_to_sheet(data);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Cleaned_Data");
      const label = `${from || bounds?.min || "all"}_${to || bounds?.max || "all"}`;
      XLSX.writeFile(book, `Survey_Cleaned_${label}.xlsx`);
    } catch {
      setExportError("تعذر إنشاء ملف Excel. حاول مرة أخرى.");
    }
  }

  if (!bounds) return null;

  const npsText = summary.nps === null ? "-" : summary.nps > 0 ? `+${summary.nps}` : `${summary.nps}`;
  const npsColor =
    summary.nps === null ? "" : summary.nps > 0 ? "text-emerald-700" : summary.nps < 0 ? "text-red-700" : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">نتائج CSAT وNPS</h2>
          <p className="text-sm text-slate-600">{fileName}</p>
        </div>
        <div className="text-end">
          <button
            type="button"
            onClick={handleExport}
            disabled={rows.length === 0}
            className="rounded-md bg-[#0F2A33] px-4 py-2 text-sm font-medium text-white hover:bg-[#17414f] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E8A8F]"
          >
            تصدير البيانات المعروضة (Excel)
          </button>
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
        onChange={(f, t) => {
          setFrom(f);
          setTo(t);
        }}
        shown={rows.length}
        total={surveys.length}
      />

      {rows.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">
          لا توجد ردود في الفترة المحددة.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label="NPS"
              value={npsText}
              valueClass={npsColor}
              hint={`من ${summary.npsCount} إجابة`}
              accent="#0F2A33"
            />
            <StatCard
              label="متوسط CSAT"
              value={summary.avgCsat === null ? "-" : summary.avgCsat.toFixed(2)}
              hint={`من 5، لعدد ${summary.csatCount} إجابة`}
              accent="#0E8A8F"
            />
            <StatCard
              label="غير الراضين"
              value={String(summary.dissatisfied)}
              hint={`${Math.round((summary.dissatisfied / summary.total) * 100)}% من الردود`}
              accent="#D6453D"
            />
            <StatCard
              label="تعليقات مفيدة"
              value={String(lists.usefulComments.length)}
              hint="بدون «لا» و«شكرًا» ونحوها"
              accent="#3B6EA8"
            />
            <StatCard
              label="بحاجة لمتابعة"
              value={String(lists.needFollowUp.length)}
              hint="غير راضٍ، بدون تعليق، رقمه صالح"
              accent="#E0A100"
            />
            <StatCard
              label="لا يمكن الاتصال بهم"
              value={String(lists.noContact.length)}
              hint="غير راضٍ ورقم الهاتف غير صالح"
              accent="#9AA5B1"
            />
          </div>

          <NpsCharts summary={summary} distribution={distribution} />

          <ComplaintSection breakdown={breakdown} scope={scope} onScopeChange={setScope} />

          {lists.needFollowUp.length > 0 && (
            <SurveyTable
              title="عملاء بحاجة لمكالمة متابعة"
              description="تقييم منخفض بدون تعليق مفيد، ورقم هاتفهم صالح. الأقل تقييمًا أولًا."
              rows={lists.needFollowUp}
              accent="#D6453D"
            />
          )}

          {lists.noContact.length > 0 && (
            <SurveyTable
              title="عملاء غير راضين برقم هاتف غير صالح"
              description="لا يمكن الاتصال بهم. الرقم المكتوب ظاهر كما أدخله العميل، وقد تجد وسيلة أخرى للتواصل في سجلات الخدمة."
              rows={lists.noContact}
              accent="#9AA5B1"
            />
          )}

          {lists.usefulComments.length > 0 && (
            <SurveyTable
              title="تعليقات العملاء"
              description="التعليقات التي تحتوي معلومة فعلية فقط. الأقل تقييمًا أولًا."
              rows={lists.usefulComments}
              accent="#3B6EA8"
            />
          )}
        </>
      )}
    </div>
  );
}
