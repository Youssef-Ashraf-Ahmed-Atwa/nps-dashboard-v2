import { NextResponse } from "next/server";
import { fail } from "@/lib/api-response";
import type { SavedSurveys } from "@/lib/api-types";
import { getSupabase, NOT_CONFIGURED_MESSAGE } from "@/lib/supabase-server";
import { dbRecordToSurvey, type SurveyDbRecord } from "@/lib/survey-db";
import type { CleanedSurvey } from "@/lib/survey-cleaner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE = 1000; // Supabase returns at most 1000 rows per request

/** GET /api/surveys: every saved answer, oldest first, for the dashboard's "saved data" view. */
export async function GET() {
  try {
    const db = getSupabase();
    if (!db) return fail(503, NOT_CONFIGURED_MESSAGE, undefined, "not_configured");

    const surveys: CleanedSurvey[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from("surveys")
        .select(
          "raw_phone, survey_date, csat, nps, comment, vehicle_model, governorate, service_center, root_cause, root_cause_detail, customers(phone, full_name)",
        )
        .order("survey_date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) {
        console.error("[surveys] query failed:", error);
        return fail(500, "تعذر قراءة البيانات المحفوظة. تأكد أنك نفّذت ملف 001_schema.sql.", error.message, "db_error");
      }
      const batch = (data ?? []) as unknown as SurveyDbRecord[];
      surveys.push(...batch.map(dbRecordToSurvey));
      if (batch.length < PAGE) break;
    }

    return NextResponse.json<SavedSurveys>({ surveys });
  } catch (error) {
    console.error("[surveys] unexpected error:", error);
    return fail(500, "حدث خطأ أثناء قراءة البيانات.");
  }
}
