"use client";

import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { SurveyDashboard } from "@/components/survey/SurveyDashboard";
import type { SaveResult, SavedSurveys } from "@/lib/api-types";
import { useLang, type MessageKey } from "@/lib/i18n";
import { useSurveySession } from "@/lib/survey-session";
import type { ApiError, CleaningResult, RemovalReason, WarningCode } from "@/lib/survey-cleaner";

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

const WARNING_KEYS: Record<WarningCode, MessageKey> = {
  markerRow: "warnMarkerRow",
  missingColumn: "warnMissingColumn",
  badScore: "warnBadScore",
  singleScore: "warnSingleScore",
  badPhone: "warnBadPhone",
  badDate: "warnBadDate",
  unknownCategory: "warnUnknownCategory",
  unknownGovernorate: "warnUnknownGovernorate",
};

interface Props {
  /** Called with the cleaned data of every uploaded file. */
  onCleaned?: (result: CleaningResult, fileName: string) => void;
}

const buttonClass =
  "rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E8A8F]";

export function UploadPanel({ onCleaned }: Props) {
  const { t, dir } = useLang();
  const inputRef = useRef<HTMLInputElement>(null);
  // The analysis lives in the session, so it survives a visit to the tickets page.
  const { state, setState, save, setSave, fileRef, runCounter } = useSurveySession();
  const [dragging, setDragging] = useState(false);

  /** "Duplicates (5), test comments (2)" from the non-zero counts. */
  function describeRemoved(removed: CleaningResult["rows_removed"]): string {
    const parts = (Object.keys(REMOVAL_KEYS) as RemovalReason[])
      .filter((reason) => removed[reason] > 0)
      .map((reason) => `${t(REMOVAL_KEYS[reason])} (${removed[reason]})`);
    return parts.length > 0 ? parts.join(dir === "rtl" ? "، " : ", ") : t("removedNone");
  }

  /** The text to show for a failed API call. Server texts are Arabic; known codes are translated. */
  function apiMessage(json: unknown, status: number): string {
    const err = json as Partial<ApiError> | null;
    if (err?.code === "not_configured") return t("errDbNotConfigured");
    if (err?.error) return err.error;
    return t("errUnexpected", { status });
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
    setSave({ status: "idle" });
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/process-survey", { method: "POST", body });

      // Platform errors (for example a 413 from Vercel) may not be JSON.
      const json = (await response.json().catch(() => null)) as CleaningResult | ApiError | null;

      if (!response.ok || !json) {
        setState({ phase: "error", message: apiMessage(json, response.status) });
        return;
      }

      const result = json as CleaningResult;
      fileRef.current = file;
      runCounter.current += 1;
      setState({
        phase: "done",
        source: { kind: "file", result },
        fileName: file.name,
        surveys: result.surveys,
        runId: runCounter.current,
      });
      onCleaned?.(result, file.name);
    } catch {
      setState({ phase: "error", message: t("errNetwork") });
    }
  }

  async function saveToDatabase() {
    const file = fileRef.current;
    if (!file) return;
    setSave({ status: "saving" });
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/save-survey", { method: "POST", body });
      const json = (await response.json().catch(() => null)) as SaveResult | ApiError | null;
      if (!response.ok || !json) {
        setSave({ status: "error", message: apiMessage(json, response.status) });
        return;
      }
      setSave({ status: "saved", result: json as SaveResult });
    } catch {
      setSave({ status: "error", message: t("errNetwork") });
    }
  }

  async function loadSaved() {
    setState({ phase: "loadingSaved" });
    setSave({ status: "idle" });
    try {
      const response = await fetch("/api/surveys", { cache: "no-store" });
      const json = (await response.json().catch(() => null)) as SavedSurveys | ApiError | null;
      if (!response.ok || !json) {
        setState({ phase: "error", message: apiMessage(json, response.status) });
        return;
      }
      const surveys = (json as SavedSurveys).surveys;
      if (surveys.length === 0) {
        setState({ phase: "error", message: t("dbEmpty") });
        return;
      }
      runCounter.current += 1;
      setState({ phase: "done", source: { kind: "database" }, fileName: t("dbSourceName"), surveys, runId: runCounter.current });
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

  const busy = state.phase === "uploading" || state.phase === "loadingSaved";
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
          {state.phase === "uploading"
            ? t("uploadingFile", { name: state.fileName })
            : state.phase === "loadingSaved"
              ? t("loadingSaved")
              : hasResult
                ? t("dropAnother")
                : t("dropHere")}
        </p>
        <p id="upload-hint" className="mt-1 text-sm text-slate-600">
          {busy ? t("uploadingHint") : t("pickHint")}
        </p>
      </div>

      <div className="no-print flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void loadSaved()} disabled={busy} className={buttonClass}>
          {t("loadSavedBtn")}
        </button>
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
          {state.source.kind === "file" ? (
            <section
              aria-label={t("cleaningSummaryAria")}
              className="no-print rounded-xl border border-slate-200 bg-white p-5"
            >
              <div role="status">
                <h2 className="text-lg font-semibold">
                  {t("cleanedTitle", { n: state.source.result.rows_clean.toLocaleString("en-US") })}
                </h2>
                <p className="mt-1 text-sm text-slate-700">
                  {t("excludedLine", { list: describeRemoved(state.source.result.rows_removed) })}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {t("rawRowsLine", { n: state.source.result.rows_raw.toLocaleString("en-US") })}
                </p>
              </div>

              {state.source.result.warning_items.length > 0 && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-medium">{t("reviewTitle")}</p>
                  <ul className="mt-1 list-disc space-y-1 ps-5">
                    {state.source.result.warning_items.map((w, i) => (
                      <li key={`${w.code}-${i}`}>{t(WARNING_KEYS[w.code], w.params)}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void saveToDatabase()}
                  disabled={save.status === "saving" || save.status === "saved"}
                  className="rounded-md bg-[#0F2A33] px-4 py-2 text-sm font-medium text-white hover:bg-[#17414f] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E8A8F]"
                >
                  {save.status === "saving" ? t("saving") : t("saveBtn")}
                </button>
                <p className="text-sm text-slate-600">
                  {save.status === "saved" ? "" : save.status === "saving" ? "" : t("saveHint")}
                </p>
              </div>
              {save.status === "saved" && (
                <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
                  {t("savedOk", { inserted: save.result.inserted, updated: save.result.updated, total: save.result.total })}
                </p>
              )}
              {save.status === "error" && (
                <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-900">
                  {save.message}
                </p>
              )}
              {save.status === "idle" && <p className="mt-3 text-sm text-slate-600">{t("notSavedYet")}</p>}
            </section>
          ) : (
            <section className="no-print rounded-xl border border-slate-200 bg-white p-5">
              <p role="status" className="text-sm text-slate-700">
                {t("dbLoadedLine", { n: state.surveys.length.toLocaleString("en-US") })}
              </p>
            </section>
          )}

          <SurveyDashboard key={state.runId} surveys={state.surveys} fileName={state.fileName} />
        </>
      )}
    </div>
  );
}
