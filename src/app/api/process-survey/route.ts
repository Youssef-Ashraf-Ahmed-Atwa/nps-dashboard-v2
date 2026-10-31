import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import {
  cleanSurveyRows,
  MissingColumnsError,
  type ApiError,
  type CleaningResult,
  type RawRow,
} from "@/lib/survey-cleaner";

// xlsx needs Node APIs, so this route cannot run on the Edge runtime.
export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Vercel rejects request bodies over 4.5 MB before our code runs,
 * so we stop at 4 MB and return a readable message instead.
 */
const MAX_FILE_BYTES = 4 * 1024 * 1024;

const fail = (status: number, error: string, details?: unknown) =>
  NextResponse.json<ApiError>({ error, details }, { status });

/**
 * POST /api/process-survey
 * Body: multipart/form-data with one field named "file" (.xlsx).
 * Success: 200 with the CleaningResult as JSON. Nothing is saved yet.
 * Failure: 4xx/5xx with { error, details? }.
 */
export async function POST(request: Request) {
  try {
    // TODO(auth): once Supabase Auth is wired in, reject requests without a
    // signed-in user here, before reading the file.

    // ---- 1. Read and validate the upload ----------------------------------
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return fail(400, "أرسل الملف بصيغة multipart/form-data.");
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return fail(400, 'لم يتم استلام ملف. أرسله في حقل باسم "file".');
    }
    if (!/\.xlsx$/i.test(file.name)) {
      return fail(415, "الملفات المدعومة هي xlsx فقط. احفظ الملف بصيغة Excel Workbook (.xlsx) وحاول مرة أخرى.");
    }
    if (file.size === 0) {
      return fail(400, "الملف فارغ.");
    }
    if (file.size > MAX_FILE_BYTES) {
      return fail(413, "حجم الملف أكبر من 4 ميجابايت. احذف الأعمدة غير المستخدمة أو قسّمه حسب الأسبوع.");
    }

    // ---- 2. xlsx.read + sheet_to_json -------------------------------------
    let rows: RawRow[];
    try {
      const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), {
        type: "array",
        // Keep date cells as Excel serial numbers; the cleaner converts them in
        // UTC, so results do not depend on the server's timezone.
        cellDates: false,
      });

      const sheetName = workbook.SheetNames[0];
      if (!sheetName) return fail(422, "الملف لا يحتوي على أي شيت.");

      // Sheet row 1 becomes the keys. The "Response" marker row is then
      // rows[0], which cleanSurveyRows drops.
      rows = XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[sheetName], {
        defval: null, // keep empty cells as null so every row has every key
        raw: true,
      });
    } catch (error) {
      console.error("[process-survey] workbook parse failed:", error);
      return fail(422, "تعذرت قراءة الملف. تأكد أنه ملف xlsx سليم وغير محمي بكلمة مرور.");
    }

    if (rows.length === 0) {
      return fail(422, "الشيت الأول لا يحتوي على صفوف بيانات.");
    }

    // ---- 3. Clean and return the CleaningResult ---------------------------
    const result = cleanSurveyRows(rows);

    if (result.rows_clean === 0) {
      return fail(422, "لم يتبق أي صف صالح بعد التنظيف.", {
        rows_raw: result.rows_raw,
        rows_removed: result.rows_removed,
      });
    }

    return NextResponse.json<CleaningResult>(result);
  } catch (error) {
    if (error instanceof MissingColumnsError) {
      return fail(422, error.message, {
        missing: error.missing,
        found: error.found,
        hint: "تأكد أن صف العناوين هو أول صف في الشيت الأول.",
      });
    }
    // Anything else is a bug on our side: log it, but do not leak internals.
    console.error("[process-survey] unexpected error:", error);
    return fail(500, "حدث خطأ أثناء تنظيف الملف. حاول مرة أخرى.");
  }
}
