import { NextResponse } from "next/server";
import { fail } from "@/lib/api-response";
import { readSurveyUpload } from "@/lib/read-survey-file";
import type { CleaningResult } from "@/lib/survey-cleaner";

// xlsx needs Node APIs, so this route cannot run on the Edge runtime.
export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/process-survey
 * Body: multipart/form-data with one field named "file" (.xlsx).
 * Success: 200 with the CleaningResult as JSON. Nothing is saved.
 * Failure: 4xx/5xx with { error, details? }.
 */
export async function POST(request: Request) {
  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return fail(400, "أرسل الملف بصيغة multipart/form-data.");
    }

    const outcome = await readSurveyUpload(form);
    if (!outcome.ok) return fail(outcome.status, outcome.error, outcome.details);
    return NextResponse.json<CleaningResult>(outcome.result);
  } catch (error) {
    // Anything else is a bug on our side: log it, but do not leak internals.
    console.error("[process-survey] unexpected error:", error);
    return fail(500, "حدث خطأ أثناء تنظيف الملف. حاول مرة أخرى.");
  }
}
