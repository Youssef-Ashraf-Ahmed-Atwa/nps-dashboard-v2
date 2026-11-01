import * as XLSX from "xlsx";
import { cleanSurveyRows, MissingColumnsError, type CleaningResult, type RawRow } from "./survey-cleaner";

/**
 * Vercel rejects request bodies over 4.5 MB before our code runs,
 * so we stop at 4 MB and return a readable message instead.
 */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;

export type UploadOutcome =
  | { ok: true; fileName: string; result: CleaningResult }
  | { ok: false; status: number; error: string; details?: unknown };

const bad = (status: number, error: string, details?: unknown): UploadOutcome => ({ ok: false, status, error, details });

/** Validates the uploaded .xlsx, reads the first sheet and cleans it. Used by "process" and "save". */
export async function readSurveyUpload(form: FormData): Promise<UploadOutcome> {
  const file = form.get("file");
  if (!(file instanceof File)) return bad(400, 'لم يتم استلام ملف. أرسله في حقل باسم "file".');
  if (!/\.xlsx$/i.test(file.name)) {
    return bad(415, "الملفات المدعومة هي xlsx فقط. احفظ الملف بصيغة Excel Workbook (.xlsx) وحاول مرة أخرى.");
  }
  if (file.size === 0) return bad(400, "الملف فارغ.");
  if (file.size > MAX_FILE_BYTES) {
    return bad(413, "حجم الملف أكبر من 4 ميجابايت. احذف الأعمدة غير المستخدمة أو قسّمه حسب الأسبوع.");
  }

  let rows: RawRow[];
  try {
    const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), {
      type: "array",
      // Keep date cells as they are; the cleaner converts them in UTC.
      cellDates: false,
    });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return bad(422, "الملف لا يحتوي على أي شيت.");
    // Sheet row 1 becomes the keys. The "Response" marker row is then rows[0].
    rows = XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[sheetName], { defval: null, raw: true });
  } catch (error) {
    console.error("[read-survey-file] workbook parse failed:", error);
    return bad(422, "تعذرت قراءة الملف. تأكد أنه ملف xlsx سليم وغير محمي بكلمة مرور.");
  }
  if (rows.length === 0) return bad(422, "الشيت الأول لا يحتوي على صفوف بيانات.");

  try {
    const result = cleanSurveyRows(rows);
    if (result.rows_clean === 0) {
      return bad(422, "لم يتبق أي صف صالح بعد التنظيف.", {
        rows_raw: result.rows_raw,
        rows_removed: result.rows_removed,
      });
    }
    return { ok: true, fileName: file.name, result };
  } catch (error) {
    if (error instanceof MissingColumnsError) {
      return bad(422, error.message, {
        missing: error.missing,
        found: error.found,
        hint: "تأكد أن صف العناوين هو أول صف في الشيت الأول.",
      });
    }
    throw error;
  }
}
