/**
 * Cleaning logic for the weekly survey export (v2).
 *
 * Pure module: no file access and no `xlsx` import. It takes the rows that
 * `xlsx` produced (one object per spreadsheet row, keyed by header) and returns
 * data shaped for the `customers` and `surveys` tables.
 *
 * Changes from v1:
 *  - rows with an unusable phone number are KEPT (their scores are real), and
 *    flagged with `phone: null`; they are never merged by the duplicate rule
 *  - CC7 is read as the complaint category (service / parts / product)
 *  - SS1 / DP1 are read as the detailed reason inside that category
 *  - `isUsefulComment` separates real feedback from "لا", "No", "Hh", ...
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RootCause = "product" | "service" | "parts" | "other";

export type RemovalReason =
  | "response_header_row" // the "Response" marker row
  | "test_comment" // comment is "test"
  | "no_scores" // both CSAT and NPS are empty or unreadable
  | "invalid_date" // no readable Date Created (survey_date is required)
  | "before_start_date" // answered before SURVEY_START_DATE (pilot / test batches)
  | "duplicate_phone"; // an older answer from a phone that answered again

/** One row from the sheet: header text -> cell value. */
export type RawRow = Record<string, unknown>;

/** Matches the `customers` table. Only customers with a usable phone exist. */
export interface CleanedCustomer {
  phone: string;
  full_name: string | null;
}

/**
 * Matches the `surveys` table, plus two display-only helpers
 * (`raw_phone`, `customer_name`). `phone` is the join key to `customers`
 * and is null when the phone cell has no usable number.
 */
export interface CleanedSurvey {
  phone: string | null;
  raw_phone: string | null; // exactly what was typed, to show next to the "invalid" badge
  customer_name: string | null; // display only
  survey_date: string; // YYYY-MM-DD
  csat: number | null; // 1-5
  nps: number | null; // 0-10
  comment: string | null;
  vehicle_model: string | null;
  service_center: string | null; // not in the weekly file, filled in later
  root_cause: RootCause | null; // from CC7
  root_cause_detail: string | null; // from SS1 / DP1
}

export interface CleaningResult {
  week_start: string | null;
  rows_raw: number;
  rows_clean: number;
  rows_removed: Record<RemovalReason, number>;
  customers: CleanedCustomer[];
  surveys: CleanedSurvey[];
  warnings: string[];
}

/** Body of every non-2xx response from /api/process-survey. */
export interface ApiError {
  error: string;
  details?: unknown;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Columns the file must contain, or we cannot clean it. */
export const REQUIRED_COLUMNS = ["Date Created", "AD2", "BOS6", "SSP6"] as const;

/** Columns we use when they exist. A missing one only produces a warning. */
export const OPTIONAL_COLUMNS = ["AD1", "AD4", "Z-Comment", "CC7", "SS1", "DP1"] as const;

/** CC7 holds the complaint category itself (maintenance service / spare parts / the product). */
const CATEGORY_COLUMN = "CC7";

/**
 * ASSUMPTION, PLEASE CONFIRM: SS1 and DP1 hold the detailed reason inside the
 * category. The survey branches, so normally only one of them is filled per
 * row; the first non-empty one wins. Add a column name here if spare parts has its own.
 */
const SUB_REASON_COLUMNS = ["SS1", "DP1"] as const;

/** Comments that mark internal test submissions (compared after trimming, ignoring case). */
const TEST_COMMENT = /^test$/i;

const MAX_DETAIL_LENGTH = 500;

/**
 * Answers dated before this day are ignored (the early pilot batches from
 * June are not real survey data). Format YYYY-MM-DD. To change it, edit this
 * line only; set it to "" to keep every row.
 */
export const SURVEY_START_DATE = "2026-08-17";

export class MissingColumnsError extends Error {
  readonly missing: string[];
  readonly found: string[];
  constructor(missing: string[], found: string[]) {
    super(`أعمدة مطلوبة غير موجودة في الملف: ${missing.join("، ")}`);
    this.name = "MissingColumnsError";
    this.missing = missing;
    this.found = found;
  }
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

/** Converts Arabic-Indic and Persian digits to 0-9 so regexes see one alphabet. */
export function toAsciiDigits(input: string): string {
  return input.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (ch) => {
    const code = ch.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

/** Any cell -> trimmed single-line string ("" when empty). */
function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  return String(value).replace(/\s+/g, " ").trim();
}

/**
 * Makes Arabic text comparable: lower-case, ASCII digits, no diacritics or
 * tatweel, and the common spelling variants unified (أ إ آ -> ا, ى -> ي, ة -> ه).
 */
function normalizeArabic(input: string): string {
  return toAsciiDigits(input)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0640]/g, "")
    .replace(/[\u0623\u0625\u0622]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Complaint category and comment quality
// ---------------------------------------------------------------------------

/**
 * Maps the CC7 answer to a category by its wording, so it keeps working if the
 * exact label text changes slightly. Empty cell -> null; unknown wording -> "other".
 */
export function classifyCategory(value: unknown): RootCause | null {
  const t = normalizeArabic(text(value));
  if (!t) return null;
  if (/قطع|غيار|spare|part/.test(t)) return "parts";
  if (/منتج|موتوسيكل|موتوسكل|دراجه|product|motor|bike|vehicle/.test(t)) return "product";
  if (/صيان|خدم|service|maint/.test(t)) return "service";
  return "other";
}

/** Comments that carry no information ("no", "none", "thanks", "ok", ...). Edit freely. */
const EMPTY_COMMENT =
  /^(لا+|لا يوجد|لايوجد|لا شي[ءئ]?|مفيش|مافيش|لا شكرا|لا شكرا لكم|شكرا|شكرا لكم|تمام|no|none|nothing|nope|na|n a|nil|ok|okay|thanks|thank you|thx)$/;

/**
 * True when the comment says something. False for empty text, one or two
 * characters, the "no / thanks" family, and keyboard mashing such as "hhhh".
 * It is a heuristic: a mash with three or more different letters still passes.
 */
export function isUsefulComment(comment: string | null | undefined): boolean {
  if (!comment) return false;
  const flat = normalizeArabic(comment)
    .replace(/[^a-z0-9\u0621-\u064a\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (flat.length < 3) return false;
  if (EMPTY_COMMENT.test(flat)) return false;
  if (new Set(flat.replace(/\s/g, "")).size <= 2) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Score, phone, date, model parsing
// ---------------------------------------------------------------------------

/**
 * Pulls the leading integer out of strings like '5=راضي جدا', '10=هرشحها بالتأكيد' or '8'.
 * - empty cell                      -> { value: null, invalid: false }
 * - text without digits / off-scale -> { value: null, invalid: true }
 */
function extractScore(
  cell: unknown,
  min: number,
  max: number,
): { value: number | null; invalid: boolean } {
  const raw = toAsciiDigits(text(cell));
  if (!raw) return { value: null, invalid: false };
  const match = raw.match(/\d+/);
  if (!match) return { value: null, invalid: true };
  const n = Number.parseInt(match[0], 10);
  return n >= min && n <= max ? { value: n, invalid: false } : { value: null, invalid: true };
}

/**
 * Turns the AD2 cell into a clean phone number (digits only), or null.
 * - Finds the first phone-like run of digits, so "01012345678 (واتس)" works.
 * - Handles +20 / 0020 prefixes and Excel dropping the leading zero.
 * - The length check matches the `customers.phone` constraint (8 to 15 digits).
 */
export function normalizePhone(cell: unknown): string | null {
  const raw = toAsciiDigits(text(cell));
  const run = raw.match(/\+?\d[\d\s().-]{6,}\d/);
  if (!run) return null;

  let digits = run[0].replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("20") && digits.length === 12) digits = `0${digits.slice(2)}`;
  else if (digits.length === 10 && digits.startsWith("1")) digits = `0${digits}`;

  // Egyptian mobiles are 11 digits starting with 0; anything longer than 11 that
  // starts with 01 is a typo (an extra digit), so it is treated as unusable.
  if (/^01\d{9}$/.test(digits)) return digits;
  if (digits.startsWith("01")) return null;
  return /^[0-9]{8,15}$/.test(digits) ? digits : null;
}

/** Builds a UTC timestamp, rejecting impossible dates such as 31/02. */
function utcTimestamp(y: number, mo: number, d: number, h = 0, mi = 0, s = 0): number | null {
  if (h > 23 || mi > 59 || s > 59) return null;
  const ts = Date.UTC(y, mo - 1, d, h, mi, s);
  const check = new Date(ts);
  const ok = check.getUTCFullYear() === y && check.getUTCMonth() === mo - 1 && check.getUTCDate() === d;
  return ok ? ts : null;
}

/**
 * Reads "Date Created" into a UTC timestamp (wall-clock time, no timezone shift).
 * Accepts Excel serial numbers, "2026-10-27 14:33:12", and the export's own
 * format "10/27/2026 01:06 PM" (MONTH first, 12-hour clock with AM/PM).
 */
export function parseSurveyDate(cell: unknown): number | null {
  if (cell instanceof Date) return Number.isNaN(cell.getTime()) ? null : cell.getTime();

  if (typeof cell === "number") {
    if (cell < 30000 || cell > 80000) return null; // not plausible as an Excel date
    return Date.UTC(1899, 11, 30) + Math.round(cell * 86400) * 1000;
  }

  const s = toAsciiDigits(text(cell));
  if (!s) return null;

  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (iso) return utcTimestamp(+iso[1], +iso[2], +iso[3], +(iso[4] ?? 0), +(iso[5] ?? 0), +(iso[6] ?? 0));

  // "MM/DD/YYYY hh:mm AM|PM" (or 24-hour without AM/PM).
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp])?[Mm]?)?/);
  if (!m) return null;

  let a = +m[1]; // first number
  let b = +m[2]; // second number
  // Month-first is this export's format. Only if the first number cannot be a
  // month (> 12) while the second can, treat the date as day-first instead.
  if (a > 12 && b <= 12) [a, b] = [b, a];

  let hour = +(m[4] ?? 0);
  const meridiem = m[7]?.toLowerCase();
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (meridiem === "p" ? 12 : 0);
  }
  return utcTimestamp(+m[3], a, b, hour, +(m[5] ?? 0), +(m[6] ?? 0));
}

const toIsoDate = (ts: number): string => new Date(ts).toISOString().slice(0, 10);

/** Monday of the week containing `isoDate`; matches Postgres date_trunc('week'). */
function mondayOf(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/**
 * 'Boxer S - بوكسر إس' -> 'Boxer S'. Only a trailing Arabic part after a dash is
 * removed, so models that merely contain a hyphen keep their full name.
 */
function cleanModel(cell: unknown): string | null {
  const t = text(cell);
  if (!t) return null;
  const latin = t.replace(/\s*[-\u2013\u2014]\s*[\u0600-\u06FF][\s\S]*$/, "").trim();
  return latin || t;
}

const normalizeHeader = (h: string): string => h.replace(/^\uFEFF/, "").trim().toLowerCase();

/** The sheet's "Response" marker row: every non-empty cell says "Response". */
function isResponseMarkerRow(row: RawRow): boolean {
  const values = Object.values(row).map(text).filter(Boolean);
  return values.length > 0 && values.every((v) => v.toLowerCase() === "response");
}

const sampleRows = (rows: number[]): string =>
  rows.slice(0, 5).join("، ") + (rows.length > 5 ? "، ..." : "");

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

interface Candidate {
  timestamp: number;
  phone: string | null;
  rawPhone: string | null;
  name: string | null;
  csat: number | null;
  nps: number | null;
  comment: string | null;
  model: string | null;
  rootCause: RootCause | null;
  detail: string | null;
}

/**
 * Cleans the parsed sheet. Order of rules:
 *  1. drop the "Response" marker row
 *  2. drop test comments
 *  3. extract CSAT / NPS and drop rows where both are empty
 *  4. read the date (rows without a readable date, or before SURVEY_START_DATE, are dropped)
 *  5. normalise the phone; an unusable phone does NOT drop the row
 *  6. keep only the latest answer per usable phone
 *
 * Throws MissingColumnsError when a required column is absent.
 * `rows[i]` is Excel row i + 2 (row 1 holds the headers), used in warnings.
 */
export function cleanSurveyRows(rows: RawRow[]): CleaningResult {
  // Map normalised header -> the real key used in the sheet.
  const headerIndex = new Map<string, string>();
  for (const key of Object.keys(rows[0] ?? {})) headerIndex.set(normalizeHeader(key), key);

  const missing = REQUIRED_COLUMNS.filter((c) => !headerIndex.has(normalizeHeader(c)));
  if (missing.length > 0) throw new MissingColumnsError([...missing], [...headerIndex.values()]);

  const cell = (row: RawRow, column: string): unknown => {
    const key = headerIndex.get(normalizeHeader(column));
    return key === undefined ? undefined : row[key];
  };

  const removed: Record<RemovalReason, number> = {
    response_header_row: 0,
    test_comment: 0,
    no_scores: 0,
    invalid_date: 0,
    before_start_date: 0,
    duplicate_phone: 0,
  };
  const warnings: string[] = [];
  const badScoreRows: number[] = [];
  const badPhoneRows: number[] = [];
  const badDateRows: number[] = [];
  const unknownCategories = new Set<string>();
  let singleScoreRows = 0;
  const candidates: Candidate[] = [];

  rows.forEach((row, i) => {
    const excelRow = i + 2;

    if (isResponseMarkerRow(row)) {
      removed.response_header_row++;
      return;
    }

    const comment = text(cell(row, "Z-Comment"));
    if (TEST_COMMENT.test(comment)) {
      removed.test_comment++;
      return;
    }

    const csat = extractScore(cell(row, "BOS6"), 1, 5);
    const nps = extractScore(cell(row, "SSP6"), 0, 10);
    if (csat.invalid || nps.invalid) badScoreRows.push(excelRow);
    if (csat.value === null && nps.value === null) {
      removed.no_scores++;
      return;
    }

    const timestamp = parseSurveyDate(cell(row, "Date Created"));
    if (timestamp === null) {
      removed.invalid_date++;
      badDateRows.push(excelRow);
      return;
    }

    if (SURVEY_START_DATE && toIsoDate(timestamp) < SURVEY_START_DATE) {
      removed.before_start_date++;
      return;
    }

    // An unusable phone keeps the row: the scores are real feedback.
    const phone = normalizePhone(cell(row, "AD2"));
    if (!phone) badPhoneRows.push(excelRow);

    if (csat.value === null || nps.value === null) singleScoreRows++;

    // CC7 = complaint category; SS1 / DP1 = detailed reason (first non-empty wins).
    const categoryCell = text(cell(row, CATEGORY_COLUMN));
    const rootCause = classifyCategory(categoryCell);
    if (rootCause === "other") unknownCategories.add(categoryCell);

    let detail: string | null = null;
    for (const column of SUB_REASON_COLUMNS) {
      const value = text(cell(row, column));
      if (value) {
        detail = value.slice(0, MAX_DETAIL_LENGTH);
        break;
      }
    }

    candidates.push({
      timestamp,
      phone,
      rawPhone: text(cell(row, "AD2")).slice(0, 40) || null,
      name: text(cell(row, "AD1")) || null,
      csat: csat.value,
      nps: nps.value,
      comment: comment || null,
      model: cleanModel(cell(row, "AD4")),
      rootCause,
      detail,
    });
  });

  // Keep the latest answer per usable phone. On identical timestamps the row
  // that appears later in the file wins. Rows without a usable phone are never merged.
  const latest = new Map<string, Candidate>();
  const withoutPhone: Candidate[] = [];
  let withPhoneCount = 0;
  for (const c of candidates) {
    if (c.phone === null) {
      withoutPhone.push(c);
      continue;
    }
    withPhoneCount++;
    const previous = latest.get(c.phone);
    if (!previous || c.timestamp >= previous.timestamp) latest.set(c.phone, c);
  }
  removed.duplicate_phone = withPhoneCount - latest.size;

  const kept = [...latest.values(), ...withoutPhone].sort((a, b) => a.timestamp - b.timestamp);

  const surveys: CleanedSurvey[] = kept.map((c) => ({
    phone: c.phone,
    raw_phone: c.rawPhone,
    customer_name: c.name,
    survey_date: toIsoDate(c.timestamp),
    csat: c.csat,
    nps: c.nps,
    comment: c.comment,
    vehicle_model: c.model,
    service_center: null,
    root_cause: c.rootCause,
    root_cause_detail: c.detail,
  }));

  const customers: CleanedCustomer[] = kept
    .filter((c): c is Candidate & { phone: string } => c.phone !== null)
    .map((c) => ({ phone: c.phone, full_name: c.name }));

  // ---- Warnings: counts and Excel row numbers only, never customer data ----
  if (!isResponseMarkerRow(rows[0] ?? {})) {
    warnings.push(
      'الصف رقم 2 ليس صف «Response»، لذلك لم يتم تجاهل أي صف بحسب موضعه. تأكد من أن هذا هو الملف الصحيح.',
    );
  }
  for (const column of OPTIONAL_COLUMNS) {
    if (!headerIndex.has(normalizeHeader(column))) {
      warnings.push(`العمود ${column} غير موجود في الملف، وسيتم ترك بياناته فارغة.`);
    }
  }
  if (badScoreRows.length > 0) {
    warnings.push(
      `${badScoreRows.length} صف فيه قيمة CSAT أو NPS غير مفهومة (الصفوف: ${sampleRows(badScoreRows)})، وتم ترك هذا التقييم فارغًا.`,
    );
  }
  if (singleScoreRows > 0) {
    warnings.push(`${singleScoreRows} صف محتفظ به يحتوي على تقييم واحد فقط (CSAT أو NPS).`);
  }
  if (badPhoneRows.length > 0) {
    warnings.push(
      `${badPhoneRows.length} صف برقم هاتف غير صالح (الصفوف: ${sampleRows(badPhoneRows)}). تم الاحتفاظ بها في حسابات NPS وCSAT، لكن لا يمكن الاتصال بأصحابها ولا دمج المكرر منها.`,
    );
  }
  if (badDateRows.length > 0) {
    warnings.push(
      `${badDateRows.length} صف تم استبعاده لأن تاريخ الإنشاء غير مقروء (الصفوف: ${sampleRows(badDateRows)}).`,
    );
  }
  if (unknownCategories.size > 0) {
    warnings.push(
      `قيم غير معروفة في عمود ${CATEGORY_COLUMN} تم تصنيفها «أخرى»: ${[...unknownCategories].slice(0, 5).join("، ")}.`,
    );
  }

  return {
    week_start: surveys.length > 0 ? mondayOf(surveys[surveys.length - 1].survey_date) : null,
    rows_raw: rows.length,
    rows_clean: surveys.length,
    rows_removed: removed,
    customers,
    surveys,
    warnings,
  };
}