/** Shapes shared by the API routes and the screens that call them. */
import type { CleanedSurvey } from "./survey-cleaner";

export interface SaveResult {
  inserted: number; // new answers
  updated: number; // answers replaced by a newer one from the same customer in the same week
  total: number; // answers in the file after cleaning
}

export interface SavedSurveys {
  surveys: CleanedSurvey[];
}

export type TicketStatus = "open" | "contacted" | "resolved" | "unreachable";

export interface TicketView {
  id: string;
  status: TicketStatus;
  due_at: string;
  created_at: string;
  contacted_at: string | null;
  resolved_at: string | null;
  notes: string | null;
  phone: string | null;
  customer_name: string | null;
  survey_date: string | null;
  csat: number | null;
  nps: number | null;
  comment: string | null;
  vehicle_model: string | null;
  governorate: string | null;
  service_center: string | null;
  root_cause: string | null;
  root_cause_detail: string | null;
}
