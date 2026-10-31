/**
 * Pure analytics over the cleaned survey rows. Everything the dashboard shows
 * is computed here, so it can be tested without React.
 */
import { isUsefulComment, type CleanedSurvey, type RootCause } from "./survey-cleaner";

// ---------------------------------------------------------------------------
// Labels and colours
// ---------------------------------------------------------------------------

export const CATEGORY_LABELS: Record<RootCause, string> = {
  service: "خدمة الصيانة",
  parts: "قطع الغيار",
  product: "المنتج / الموتوسيكل نفسه",
  other: "أخرى",
};

export const CATEGORY_COLORS: Record<RootCause, string> = {
  service: "#D9822B",
  parts: "#7A5BA6",
  product: "#3B6EA8",
  other: "#9AA5B1",
};

export const CATEGORY_ORDER: RootCause[] = ["service", "parts", "product", "other"];

export const NPS_COLORS = {
  promoter: "#1F9D6B",
  passive: "#E0A100",
  detractor: "#D6453D",
} as const;

export const NO_DETAIL_LABEL = "لم يحدد السبب التفصيلي";

// ---------------------------------------------------------------------------
// Basic classification
// ---------------------------------------------------------------------------

export type NpsGroup = "promoter" | "passive" | "detractor";

export const npsGroup = (nps: number | null): NpsGroup | null =>
  nps === null ? null : nps >= 9 ? "promoter" : nps >= 7 ? "passive" : "detractor";

/** Dissatisfied = CSAT 3 or lower, or an NPS detractor (0-6). */
export const isDissatisfied = (s: CleanedSurvey): boolean =>
  (s.csat !== null && s.csat <= 3) || (s.nps !== null && s.nps <= 6);

/** Colour group for a row: NPS first, CSAT as the fallback when there is no NPS. */
export function rowGroup(s: CleanedSurvey): NpsGroup | null {
  const byNps = npsGroup(s.nps);
  if (byNps) return byNps;
  if (s.csat === null) return null;
  return s.csat <= 3 ? "detractor" : s.csat === 4 ? "passive" : "promoter";
}

// ---------------------------------------------------------------------------
// Date filter
// ---------------------------------------------------------------------------

export function dateBounds(rows: CleanedSurvey[]): { min: string; max: string } | null {
  if (rows.length === 0) return null;
  let min = rows[0].survey_date;
  let max = min;
  for (const r of rows) {
    if (r.survey_date < min) min = r.survey_date;
    if (r.survey_date > max) max = r.survey_date;
  }
  return { min, max };
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Inclusive range on survey_date. An empty bound means "no limit". ISO dates compare as strings. */
export function filterByDate(rows: CleanedSurvey[], from: string, to: string): CleanedSurvey[] {
  return rows.filter((r) => (!from || r.survey_date >= from) && (!to || r.survey_date <= to));
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

export interface Summary {
  total: number; // all rows in range
  npsCount: number; // rows that have an NPS score
  promoters: number;
  passives: number;
  detractors: number;
  promoterPct: number;
  passivePct: number;
  detractorPct: number;
  nps: number | null; // -100..100, null when no NPS answers
  csatCount: number;
  avgCsat: number | null;
  dissatisfied: number;
}

const pct = (part: number, whole: number): number => (whole ? (part / whole) * 100 : 0);

export function summarize(rows: CleanedSurvey[]): Summary {
  let promoters = 0;
  let passives = 0;
  let detractors = 0;
  let csatSum = 0;
  let csatCount = 0;
  let dissatisfied = 0;

  for (const r of rows) {
    const g = npsGroup(r.nps);
    if (g === "promoter") promoters++;
    else if (g === "passive") passives++;
    else if (g === "detractor") detractors++;
    if (r.csat !== null) {
      csatSum += r.csat;
      csatCount++;
    }
    if (isDissatisfied(r)) dissatisfied++;
  }

  const npsCount = promoters + passives + detractors;
  return {
    total: rows.length,
    npsCount,
    promoters,
    passives,
    detractors,
    promoterPct: pct(promoters, npsCount),
    passivePct: pct(passives, npsCount),
    detractorPct: pct(detractors, npsCount),
    nps: npsCount ? Math.round(pct(promoters - detractors, npsCount)) : null,
    csatCount,
    avgCsat: csatCount ? csatSum / csatCount : null,
    dissatisfied,
  };
}

/** Number of answers for each NPS score 0..10. */
export function scoreDistribution(rows: CleanedSurvey[]): { score: number; count: number; group: NpsGroup }[] {
  const counts = new Array<number>(11).fill(0);
  for (const r of rows) if (r.nps !== null) counts[r.nps]++;
  return counts.map((count, score) => ({ score, count, group: npsGroup(score) as NpsGroup }));
}

// ---------------------------------------------------------------------------
// Complaint breakdown (category, then the detailed reason inside it)
// ---------------------------------------------------------------------------

/** Which responses feed the complaint charts. */
export type ComplaintScope = "dissatisfied" | "all_with_category";

export interface ComplaintBreakdown {
  total: number; // responses counted in the charts
  unspecified: number; // dissatisfied customers who picked no category (dissatisfied scope only)
  categories: { category: RootCause; count: number }[]; // largest first, zero counts removed
  subReasons: Record<RootCause, { reason: string; count: number }[]>; // largest first
}

export function complaintBreakdown(rows: CleanedSurvey[], scope: ComplaintScope): ComplaintBreakdown {
  const pool = scope === "dissatisfied" ? rows.filter(isDissatisfied) : rows;

  const counts: Record<RootCause, number> = { service: 0, parts: 0, product: 0, other: 0 };
  const reasons: Record<RootCause, Map<string, number>> = {
    service: new Map(),
    parts: new Map(),
    product: new Map(),
    other: new Map(),
  };
  let unspecified = 0;
  let total = 0;

  for (const r of pool) {
    if (r.root_cause === null) {
      unspecified++;
      continue;
    }
    total++;
    counts[r.root_cause]++;
    const reason = r.root_cause_detail ?? NO_DETAIL_LABEL;
    reasons[r.root_cause].set(reason, (reasons[r.root_cause].get(reason) ?? 0) + 1);
  }

  const sortDesc = <T extends { count: number }>(list: T[]) => list.sort((a, b) => b.count - a.count);

  const subReasons = {} as ComplaintBreakdown["subReasons"];
  for (const c of CATEGORY_ORDER) {
    subReasons[c] = sortDesc([...reasons[c]].map(([reason, count]) => ({ reason, count })));
  }

  return {
    total,
    unspecified: scope === "dissatisfied" ? unspecified : 0,
    categories: sortDesc(
      CATEGORY_ORDER.filter((c) => counts[c] > 0).map((category) => ({ category, count: counts[category] })),
    ),
    subReasons,
  };
}

// ---------------------------------------------------------------------------
// Lists the team works from
// ---------------------------------------------------------------------------

export interface SurveyLists {
  /** Real comments (any score), lowest scores first. */
  usefulComments: CleanedSurvey[];
  /** Dissatisfied, no real comment, phone is usable: call these customers. */
  needFollowUp: CleanedSurvey[];
  /** Dissatisfied but the phone is unusable: cannot be called. */
  noContact: CleanedSurvey[];
}

/** Lowest NPS first (rows without NPS last), then newest date first. */
const bySeverity = (a: CleanedSurvey, b: CleanedSurvey): number =>
  (a.nps ?? 11) - (b.nps ?? 11) || b.survey_date.localeCompare(a.survey_date);

export function buildLists(rows: CleanedSurvey[]): SurveyLists {
  const dissatisfied = rows.filter(isDissatisfied);
  return {
    usefulComments: rows.filter((r) => isUsefulComment(r.comment)).sort(bySeverity),
    needFollowUp: dissatisfied.filter((r) => r.phone !== null && !isUsefulComment(r.comment)).sort(bySeverity),
    noContact: dissatisfied.filter((r) => r.phone === null).sort(bySeverity),
  };
}
