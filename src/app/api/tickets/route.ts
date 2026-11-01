import { NextResponse } from "next/server";
import { fail } from "@/lib/api-response";
import type { TicketStatus, TicketView } from "@/lib/api-types";
import { getSupabase, NOT_CONFIGURED_MESSAGE } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: TicketStatus[] = ["open", "contacted", "resolved", "unreachable"];

interface TicketRow {
  id: string;
  status: TicketStatus;
  due_at: string;
  created_at: string;
  contacted_at: string | null;
  resolved_at: string | null;
  notes: string | null;
  customers: { phone: string; full_name: string | null } | { phone: string; full_name: string | null }[] | null;
  surveys: Record<string, unknown> | Record<string, unknown>[] | null;
}

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/** GET /api/tickets: all tickets, the ones due first on top. */
export async function GET() {
  try {
    const db = getSupabase();
    if (!db) return fail(503, NOT_CONFIGURED_MESSAGE, undefined, "not_configured");

    const { data, error } = await db
      .from("action_tickets")
      .select(
        "id, status, due_at, created_at, contacted_at, resolved_at, notes, customers(phone, full_name), surveys(survey_date, csat, nps, comment, vehicle_model, governorate, service_center, root_cause, root_cause_detail)",
      )
      .order("due_at", { ascending: true })
      .limit(1000);
    if (error) {
      console.error("[tickets] query failed:", error);
      return fail(500, "تعذر قراءة التذاكر. تأكد أنك نفّذت ملف 001_schema.sql.", error.message, "db_error");
    }

    const tickets: TicketView[] = ((data ?? []) as unknown as TicketRow[]).map((t) => {
      const c = one(t.customers);
      const s = one(t.surveys) ?? {};
      const str = (k: string) => (typeof s[k] === "string" ? (s[k] as string) : null);
      const num = (k: string) => (typeof s[k] === "number" ? (s[k] as number) : null);
      return {
        id: t.id,
        status: t.status,
        due_at: t.due_at,
        created_at: t.created_at,
        contacted_at: t.contacted_at,
        resolved_at: t.resolved_at,
        notes: t.notes,
        phone: c?.phone ?? null,
        customer_name: c?.full_name ?? null,
        survey_date: str("survey_date"),
        csat: num("csat"),
        nps: num("nps"),
        comment: str("comment"),
        vehicle_model: str("vehicle_model"),
        governorate: str("governorate"),
        service_center: str("service_center"),
        root_cause: str("root_cause"),
        root_cause_detail: str("root_cause_detail"),
      };
    });
    return NextResponse.json({ tickets });
  } catch (error) {
    console.error("[tickets] unexpected error:", error);
    return fail(500, "حدث خطأ أثناء قراءة التذاكر.");
  }
}

/** PATCH /api/tickets  body: { id, status?, notes? } */
export async function PATCH(request: Request) {
  try {
    const db = getSupabase();
    if (!db) return fail(503, NOT_CONFIGURED_MESSAGE, undefined, "not_configured");

    const body = (await request.json().catch(() => null)) as { id?: unknown; status?: unknown; notes?: unknown } | null;
    if (!body || typeof body.id !== "string") return fail(400, "رقم التذكرة مفقود.");

    const patch: Record<string, unknown> = {};
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status as TicketStatus)) return fail(400, "حالة غير معروفة.");
      patch.status = body.status;
      const now = new Date().toISOString();
      if (body.status === "contacted") patch.contacted_at = now;
      if (body.status === "resolved") patch.resolved_at = now;
      if (body.status === "open") {
        patch.contacted_at = null;
        patch.resolved_at = null;
      }
    }
    if (body.notes !== undefined) {
      if (body.notes !== null && typeof body.notes !== "string") return fail(400, "الملاحظات غير صالحة.");
      patch.notes = typeof body.notes === "string" ? body.notes.slice(0, 2000) : null;
    }
    if (Object.keys(patch).length === 0) return fail(400, "لا يوجد ما يتم تحديثه.");

    const { error } = await db.from("action_tickets").update(patch).eq("id", body.id);
    if (error) {
      console.error("[tickets] update failed:", error);
      return fail(500, "تعذر تحديث التذكرة.", error.message, "db_error");
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[tickets] unexpected error:", error);
    return fail(500, "حدث خطأ أثناء تحديث التذكرة.");
  }
}
