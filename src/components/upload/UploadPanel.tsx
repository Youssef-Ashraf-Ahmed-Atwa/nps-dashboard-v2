"use client";

import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { SurveyDashboard } from "@/components/survey/SurveyDashboard";
import { useLang, type MessageKey } from "@/lib/i18n";
import type { ApiError, CleaningResult, RemovalReason } from "@/lib/survey-cleaner";

const MAX_BYTES = 4 * 1024 * 1024; // same limit as the API route (Vercel allows 4.5 MB)

const REMOVAL_KEYS: Record<RemovalReason, MessageKey> = {
  duplicate_phone: "removalDuplicatePhone",
  test_comment: "removalTestComment",
  no_scores: "removalNoScores",
  invalid_date: "removalInvalidDate",
  before_start_date: "removalBeforeStart",
  junk_entry: "removalJunk",
  response_header_row: "removalHeader",
};

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
  const { t, dir } = useLang();
  const inputRef = useRef<HTMLInputElement>(null);
  const runCounter = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<State>({ phase: "idle" });

  /** "Duplicates (5), test comments (2)" from the non-zero counts. */
  function describeRemoved(removed: CleaningResult["rows_removed"]): string {
    const parts = (Object.keys(REMOVAL_KEYS) as RemovalReason[])
      .filter((reason) => removed[reason] > 0)
      .map((reason) => `${t(REMOVAL_KEYS[reason])} (${removed[reason]})`);
    return parts.length > 0 ? parts.join(dir === "rtl" ? "، " : ", ") : t("removedNone");
  }

  async function processFile(file: File) {
    if (!/\.xlsx$/i.test(file.name)) {
      setState({ phase: "error", message: t("errNotXlsx") });
      return;
    }
    if (file.size > MAX_BYTES) {
      setState({ phase: "error", message: t("errTooBig") });
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
        // Messages sent by the server are in Arabic.
        const message =
          json && "error" in json ? json.error : t("errUnexpected", { status: response.status });
        setState({ phase: "error", message });
        return;
      }

      const result = json as CleaningResult;
      runCounter.current += 1;
      setState({ phase: "done", fileName: file.name, result, runId: runCounter.current });
      onCleaned?.(result, file.name);
    } catch {
      setState({ phase: "error", message: t("errNetwork") });
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
    <div dir={dir} className="space-y-6">
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
        className={`no-print flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E8A8F] ${
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
            ? t("uploadingFile", { name: state.fileName })
            : hasResult
              ? t("dropAnother")
              : t("dropHere")}
        </p>
        <p id="upload-hint" className="mt-1 text-sm text-slate-600">
          {busy ? t("uploadingHint") : t("pickHint")}
        </p>
      </div>

      {state.phase === "error" && (
        <div role="alert" className="no-print rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-medium">{t("cleanFailed")}</p>
          <p className="mt-1">{state.message}</p>
          <button type="button" onClick={reset} className="mt-2 text-sm underline underline-offset-2">
            {t("tryAgain")}
          </button>
        </div>
      )}

      {state.phase === "done" && (
        <>
          <section
            aria-label={t("cleaningSummaryAria")}
            className="no-print rounded-xl border border-slate-200 bg-white p-5"
          >
            <div role="status">
              <h2 className="text-lg font-semibold">
                {t("cleanedTitle", { n: state.result.rows_clean.toLocaleString("en-US") })}
              </h2>
              <p className="mt-1 text-sm text-slate-700">
                {t("excludedLine", { list: describeRemoved(state.result.rows_removed) })}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {t("rawRowsLine", { n: state.result.rows_raw.toLocaleString("en-US") })}
              </p>
            </div>

            {state.result.warnings.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-medium">{t("reviewTitle")}</p>
                {/* The warning texts come from the cleaner and are in Arabic. */}
                <ul className="mt-1 list-disc space-y-1 ps-5">
                  {state.result.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="mt-4 text-sm text-slate-600">{t("notSavedYet")}</p>
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
