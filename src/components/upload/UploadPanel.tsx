"use client";

import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { SurveyDashboard } from "@/components/survey/SurveyDashboard";
import type { ApiError, CleaningResult, RemovalReason } from "@/lib/survey-cleaner";

const MAX_BYTES = 4 * 1024 * 1024; // same limit as the API route (Vercel allows 4.5 MB)

const REMOVAL_LABELS: Record<RemovalReason, string> = {
  duplicate_phone: "مكررات بنفس رقم الهاتف",
  test_comment: "تعليقات تجريبية",
  no_scores: "بدون أي تقييم",
  invalid_date: "تاريخ غير مقروء",
  before_start_date: "ردود قبل 17 أغسطس 2026",
  junk_entry: "إدخالات عشوائية (رقم واسم غير صالحين)",
  response_header_row: "صف العناوين",
};

/** "مكررات بنفس رقم الهاتف (5)، تعليقات تجريبية (2)" from the non-zero counts. */
function describeRemoved(removed: CleaningResult["rows_removed"]): string {
  const parts = (Object.keys(REMOVAL_LABELS) as RemovalReason[])
    .filter((reason) => removed[reason] > 0)
    .map((reason) => `${REMOVAL_LABELS[reason]} (${removed[reason]})`);
  return parts.length > 0 ? parts.join("، ") : "لا شيء";
}

type State =
  | { phase: "idle" }
  | { phase: "uploading"; fileName: string }
  | { phase: "done"; fileName: string; result: CleaningResult; runId: number }
  | { phase: "error"; message: string };

interface Props {
  /** Called with the cleaned data. The next step uses it to save to Supabase. */
  onCleaned?: (result: CleaningResult, fileName: string) => void;
}

export function UploadPanel({ onCleaned }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const runCounter = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<State>({ phase: "idle" });

  async function processFile(file: File) {
    if (!/\.xlsx$/i.test(file.name)) {
      setState({ phase: "error", message: "اختر ملف Excel بصيغة xlsx." });
      return;
    }
    if (file.size > MAX_BYTES) {
      setState({ phase: "error", message: "حجم الملف أكبر من 4 ميجابايت. احذف الأعمدة غير المستخدمة أو قسّمه حسب الأسبوع." });
      return;
    }

    setState({ phase: "uploading", fileName: file.name });
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/process-survey", { method: "POST", body });

      // Platform errors (for example a 413 from Vercel) may not be JSON.
      const json = (await response.json().catch(() => null)) as CleaningResult | ApiError | null;

      if (!response.ok || !json) {
        const message =
          json && "error" in json ? json.error : `رد الخادم غير متوقع (${response.status}).`;
        setState({ phase: "error", message });
        return;
      }

      const result = json as CleaningResult;
      runCounter.current += 1;
      setState({ phase: "done", fileName: file.name, result, runId: runCounter.current });
      onCleaned?.(result, file.name);
    } catch {
      setState({ phase: "error", message: "تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى." });
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void processFile(file);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      inputRef.current?.click();
    }
  }

  function reset() {
    setState({ phase: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  }

  const busy = state.phase === "uploading";
  const hasResult = state.phase === "done";

  return (
    <div dir="rtl" className="space-y-6">
      {/* The drop zone stays visible so a new file can replace the current one. */}
      <div
        role="button"
        tabIndex={0}
        aria-busy={busy}
        aria-describedby="upload-hint"
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={onKeyDown}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E8A8F] ${
          hasResult ? "py-6" : "py-14"
        } ${dragging ? "border-[#0E8A8F] bg-[#E6F4F4]" : "border-slate-300 bg-white hover:border-slate-400"}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="sr-only"
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void processFile(file);
            e.target.value = ""; // lets the same file be chosen again
          }}
        />
        <p className="text-lg font-semibold">
          {busy
            ? `جارٍ تنظيف الملف ${state.fileName}...`
            : hasResult
              ? "لتحليل ملف آخر، اسحبه هنا أو اضغط للاختيار"
              : "اسحب ملف الاستبيان الأسبوعي هنا"}
        </p>
        <p id="upload-hint" className="mt-1 text-sm text-slate-600">
          {busy ? "يستغرق هذا عادةً بضع ثوانٍ." : "أو اضغط للاختيار. ملف Excel بصيغة xlsx وبحد أقصى 4 ميجابايت."}
        </p>
      </div>

      {state.phase === "error" && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-medium">لم يتم تنظيف الملف</p>
          <p className="mt-1">{state.message}</p>
          <button type="button" onClick={reset} className="mt-2 text-sm underline underline-offset-2">
            حاول مرة أخرى
          </button>
        </div>
      )}

      {state.phase === "done" && (
        <>
          <section aria-label="ملخص التنظيف" className="rounded-xl border border-slate-200 bg-white p-5">
            <div role="status">
              <h2 className="text-lg font-semibold">
                تم تنظيف {state.result.rows_clean.toLocaleString("en-US")} صف بنجاح
              </h2>
              <p className="mt-1 text-sm text-slate-700">
                تم استبعاد: {describeRemoved(state.result.rows_removed)}.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                عدد الصفوف في الملف: {state.result.rows_raw.toLocaleString("en-US")}
              </p>
            </div>

            {state.result.warnings.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-medium">يرجى المراجعة</p>
                <ul className="mt-1 list-disc space-y-1 ps-5">
                  {state.result.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="mt-4 text-sm text-slate-600">لم يتم حفظ أي شيء بعد. الحفظ في قاعدة البيانات هو الخطوة التالية.</p>
          </section>

          <SurveyDashboard
            key={state.runId}
            surveys={state.result.surveys}
            fileName={state.fileName}
          />
        </>
      )}
    </div>
  );
}