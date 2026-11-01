import { NextResponse } from "next/server";
import { fail } from "@/lib/api-response";
import { readSurveyUpload } from "@/lib/read-survey-file";
import { getSupabase, NOT_CONFIGURED_MESSAGE } from "@/lib/supabase-server";
import type { SaveResult } from "@/lib/api-types";
import { surveyToDbRow } from "@/lib/survey-db";

export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH_SIZE = 500;

/**
 * POST /api/save-survey
 * Body: the same multipart/form-data as /api/process-survey.
 * The file is cleaned again here on the server (the browser's copy is never trusted),
 * then saved with the save_surveys SQL function. Uploading the same file twice is safe.
 */
export async function POST(request: Request) {
  try {
    const db = getSupabase();
    if (!db) return fail(503, NOT_CONFIGURED_MESSAGE, undefined, "not_configured");

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return fail(400, "أرسل الملف بصيغة multipart/form-data.");
    }

    const outcome = await readSurveyUpload(form);
    if (!outcome.ok) return fail(outcome.status, outcome.error, outcome.details);

    const rows = outcome.result.surveys.map(surveyToDbRow);
    let inserted = 0;
    let updated = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const { data, error } = await db.rpc("save_surveys", {
        p_surveys: rows.slice(i, i + BATCH_SIZE),
        p_source_file: outcome.fileName,
      });
      if (error) {
        console.error("[save-survey] rpc failed:", error);
        return fail(500, "تعذر حفظ البيانات في قاعدة البيانات. تأكد أنك نفّذت ملف 001_schema.sql.", error.message, "db_error");
      }
      inserted += Number((data as { inserted?: number } | null)?.inserted ?? 0);
      updated += Number((data as { updated?: number } | null)?.updated ?? 0);
    }

    return NextResponse.json<SaveResult>({ inserted, updated, total: rows.length });
  } catch (error) {
    console.error("[save-survey] unexpected error:", error);
    return fail(500, "حدث خطأ أثناء الحفظ. حاول مرة أخرى.");
  }
}
