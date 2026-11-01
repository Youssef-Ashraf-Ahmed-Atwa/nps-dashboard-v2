import { createHash } from "node:crypto";
import { mondayOf, type CleanedSurvey, type RootCause } from "./survey-cleaner";

/** One row as sent to the save_surveys SQL function. */
export interface SurveyDbRow {
  phone: string | null;
  raw_phone: string | null;
  customer_name: string | null;
  survey_date: string;
  week_start: string;
  csat: number | null;
  nps: number | null;
  comment: string | null;
  vehicle_model: string | null;
  governorate: string | null;
  service_center: string | null;
  root_cause: RootCause | null;
  root_cause_detail: string | null;
  source_key: string;
}

/**
 * Fingerprint of an answer. The same answer uploaded twice gets the same key,
 * so answers without a phone number are not saved twice.
 */
function sourceKey(s: CleanedSurvey): string {
  const parts = [s.survey_date, s.phone ?? `raw:${s.raw_phone ?? ""}`, s.csat, s.nps, s.customer_name, s.comment];
  return createHash("sha1").update(parts.map((p) => String(p ?? "")).join("|")).digest("hex");
}

export function surveyToDbRow(s: CleanedSurvey): SurveyDbRow {
  return {
    phone: s.phone,
    raw_phone: s.raw_phone,
    customer_name: s.customer_name,
    survey_date: s.survey_date,
    week_start: mondayOf(s.survey_date),
    csat: s.csat,
    nps: s.nps,
    comment: s.comment,
    vehicle_model: s.vehicle_model,
    governorate: s.governorate,
    service_center: s.service_center,
    root_cause: s.root_cause,
    root_cause_detail: s.root_cause_detail,
    source_key: sourceKey(s),
  };
}

/** A row read back from the surveys table (with the customer joined in). */
export interface SurveyDbRecord {
  raw_phone: string | null;
  survey_date: string;
  csat: number | null;
  nps: number | null;
  comment: string | null;
  vehicle_model: string | null;
  governorate: string | null;
  service_center: string | null;
  root_cause: RootCause | null;
  root_cause_detail: string | null;
  customers: { phone: string; full_name: string | null } | { phone: string; full_name: string | null }[] | null;
}

export function dbRecordToSurvey(r: SurveyDbRecord): CleanedSurvey {
  const customer = Array.isArray(r.customers) ? (r.customers[0] ?? null) : r.customers;
  return {
    phone: customer?.phone ?? null,
    raw_phone: r.raw_phone,
    customer_name: customer?.full_name ?? null,
    survey_date: r.survey_date,
    csat: r.csat,
    nps: r.nps,
    comment: r.comment,
    vehicle_model: r.vehicle_model,
    governorate: r.governorate,
    service_center: r.service_center,
    root_cause: r.root_cause,
    root_cause_detail: r.root_cause_detail,
  };
}
