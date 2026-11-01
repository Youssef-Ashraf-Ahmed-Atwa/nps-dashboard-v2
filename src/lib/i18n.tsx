"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { governorateLabel } from "./governorates";
import type { RootCause } from "./survey-cleaner";

export type Lang = "ar" | "en";
const STORAGE_KEY = "nps-dashboard-lang";

// ---------------------------------------------------------------------------
// Interface text. {name} placeholders are filled by t(key, { name: ... }).
// Survey answers typed by customers (comments, names) are data and stay as-is.
// ---------------------------------------------------------------------------

const ar = {
  // Upload page
  backHome: "العودة إلى الصفحة الرئيسية",
  uploadTitle: "رفع وتحليل تقارير NPS وCSAT الأسبوعية",
  uploadIntro:
    "يتم تنظيف الملف تلقائيًا: تُستبعد التعليقات التجريبية والصفوف بدون تقييم، ويُحتفظ بآخر إجابة لكل رقم هاتف. يمكنك مراجعة النتيجة قبل حفظ أي شيء.",

  // Upload panel
  removalDuplicatePhone: "مكررات بنفس رقم الهاتف",
  removalTestComment: "تعليقات تجريبية",
  removalNoScores: "بدون أي تقييم",
  removalInvalidDate: "تاريخ غير مقروء",
  removalBeforeStart: "ردود قبل 17 أغسطس 2026",
  removalJunk: "إدخالات عشوائية (رقم واسم غير صالحين)",
  removalHeader: "صف العناوين",
  removedNone: "لا شيء",
  errNotXlsx: "اختر ملف Excel بصيغة xlsx.",
  errTooBig: "حجم الملف أكبر من 4 ميجابايت. احذف الأعمدة غير المستخدمة أو قسّمه حسب الأسبوع.",
  errUnexpected: "رد الخادم غير متوقع ({status}).",
  errNetwork: "تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.",
  uploadingFile: "جارٍ تنظيف الملف {name}...",
  dropAnother: "لتحليل ملف آخر، اسحبه هنا أو اضغط للاختيار",
  dropHere: "اسحب ملف الاستبيان الأسبوعي هنا",
  uploadingHint: "يستغرق هذا عادةً بضع ثوانٍ.",
  pickHint: "أو اضغط للاختيار. ملف Excel بصيغة xlsx وبحد أقصى 4 ميجابايت.",
  cleanFailed: "لم يتم تنظيف الملف",
  tryAgain: "حاول مرة أخرى",
  cleaningSummaryAria: "ملخص التنظيف",
  cleanedTitle: "تم تنظيف {n} صف بنجاح",
  excludedLine: "تم استبعاد: {list}.",
  rawRowsLine: "عدد الصفوف في الملف: {n}",
  reviewTitle: "يرجى المراجعة",
  notSavedYet: "لم يتم حفظ أي شيء بعد. راجع النتيجة ثم اضغط «حفظ في قاعدة البيانات».",

  // Dashboard
  dashTitle: "نتائج CSAT وNPS",
  exportBtn: "تصدير البيانات المعروضة (Excel)",
  exportError: "تعذر إنشاء ملف Excel. حاول مرة أخرى.",
  reportBtn: "تقرير للمدير",
  noResponsesInRange: "لا توجد ردود في الفترة المحددة.",
  statNps: "NPS",
  statNpsHint: "من {n} إجابة",
  statCsat: "متوسط CSAT",
  statCsatHint: "من 5، لعدد {n} إجابة",
  statDissat: "غير الراضين",
  statDissatHint: "{p}% من الردود",
  statUseful: "تعليقات مفيدة",
  statUsefulHint: "بدون «لا» و«شكرًا» ونحوها",
  statFollow: "بحاجة لمتابعة",
  statFollowHint: "غير راضٍ، بدون تعليق، رقمه صالح",
  statNoContact: "لا يمكن الاتصال بهم",
  statNoContactHint: "غير راضٍ ورقم الهاتف غير صالح",
  tblFollowTitle: "عملاء بحاجة لمكالمة متابعة",
  tblFollowDesc: "تقييم منخفض بدون تعليق مفيد، ورقم هاتفهم صالح. الأقل تقييمًا أولًا.",
  tblNoContactTitle: "عملاء غير راضين برقم هاتف غير صالح",
  tblNoContactDesc:
    "لا يمكن الاتصال بهم. الرقم المكتوب ظاهر كما أدخله العميل، وقد تجد وسيلة أخرى للتواصل في سجلات الخدمة.",
  tblCommentsTitle: "تعليقات العملاء",
  tblCommentsDesc: "التعليقات التي تحتوي معلومة فعلية فقط. الأقل تقييمًا أولًا.",

  // Table / export columns
  colDate: "التاريخ",
  colName: "الاسم",
  colPhone: "رقم الهاتف",
  colPhoneValid: "الرقم صالح",
  colModel: "الموديل",
  colCategory: "مجال المشكلة",
  colDetail: "السبب التفصيلي",
  colComment: "التعليق",
  yes: "نعم",
  no: "لا",
  invalidBadge: "غير صالح",
  notSpecified: "غير محدد",
  noComment: "بدون تعليق",
  showFirst: "عرض أول 25 فقط",
  showAll: "عرض الكل ({n})",

  // Date filter
  dateFilterAria: "فلتر التاريخ",
  dateFrom: "من تاريخ",
  dateTo: "إلى تاريخ",
  presetAll: "كل الفترة",
  preset7: "آخر 7 أيام",
  preset30: "آخر 30 يومًا",
  rangeInvalid: "تاريخ البداية بعد تاريخ النهاية",
  showingRange: "يعرض {shown} من {total} رد، من {min} إلى {max} في الملف",

  // NPS charts
  npsTitle: "تصنيف العملاء (NPS)",
  npsSub: "من أجاب على سؤال NPS: {n} عميل.",
  promoters: "مروّجون (9-10)",
  passives: "محايدون (7-8)",
  detractors: "منتقدون (0-6)",
  tipCustomers: "{n} عميل",
  tipCount: "العدد",
  distTitle: "عدد التقييمات حسب الدرجة",
  distSub: "كل عمود يمثل درجة من 0 إلى 10، ولونه حسب التصنيف.",
  tipScore: "التقييم {n}",

  // Complaints
  catService: "خدمة الصيانة",
  catParts: "قطع الغيار",
  catProduct: "المنتج / الموتوسيكل نفسه",
  catOther: "أخرى",
  complaintsAria: "تحليل الشكاوى",
  whereTitle: "أين تتركز الشكاوى؟",
  whereDesc: "توزيع {n} شكوى على المجالات الثلاثة، بحسب إجابة العميل على سؤال «ما مجال المشكلة؟».",
  scopeLabel: "العملاء المحسوبون",
  scopeDissatisfied: "غير الراضين فقط (CSAT ≤ 3 أو NPS ≤ 6)",
  scopeAll: "كل من حدد مجال مشكلة",
  noCategorized: "لا توجد شكاوى مصنفة في الفترة المحددة.",
  unspecifiedNote: "{n} عميل غير راضٍ لم يحدد مجال المشكلة، ولذلك لا يظهر في الرسم.",
  categoryCount: "{n} شكوى، وهذه تفاصيلها:",
  noDetailInCategory: "لا توجد إجابات تفصيلية لهذه الفئة في الملف.",
  moreReasons: "+ {n} أسباب أخرى أقل تكرارًا.",
  withoutDetail: "{n} شكوى بدون سبب تفصيلي.",

  // Navigation, saving, saved data
  navUpload: "رفع وتحليل",
  navTickets: "متابعة العملاء",
  saveBtn: "حفظ في قاعدة البيانات",
  saving: "جارٍ الحفظ...",
  savedOk: "تم الحفظ: {inserted} جديد و{updated} محدّث، من {total} رد.",
  saveHint: "الحفظ آمن: رفع نفس الملف مرة أخرى لا يكرر الردود.",
  loadSavedBtn: "عرض كل البيانات المحفوظة",
  loadingSaved: "جارٍ تحميل البيانات المحفوظة...",
  dbSourceName: "كل البيانات المحفوظة",
  dbLoadedLine: "تم تحميل {n} رد من قاعدة البيانات.",
  dbEmpty: "لا توجد بيانات محفوظة بعد. ارفع ملفًا واحفظه أولًا.",
  errDbNotConfigured: "قاعدة البيانات غير مربوطة بعد. أضف مفاتيح Supabase في ملف .env.local وأعد تشغيل السيرفر.",

  // Groups
  colGovernorate: "المحافظة",
  colServiceCenter: "مركز الخدمة",
  groupGovernorateTitle: "النتائج حسب المحافظة",
  groupGovernorateDesc: "كل محافظة بعدد الردود ومتوسط CSAT وNPS. المحافظات ذات الردود القليلة استرشادية فقط.",
  groupCenterTitle: "النتائج حسب مركز الخدمة",
  groupCenterDesc: "كل مركز خدمة بعدد الردود ومتوسط CSAT وNPS. المراكز ذات الردود القليلة استرشادية فقط.",
  showMoreGroups: "عرض الكل ({n})",
  showFewerGroups: "عرض الأعلى فقط",

  // Weekly trend
  trendTitle: "الاتجاه الأسبوعي",
  trendDesc: "NPS ومتوسط CSAT لكل أسبوع (يبدأ الأسبوع يوم الاثنين). الأسابيع ذات الإجابات القليلة استرشادية.",
  trendNpsTitle: "NPS حسب الأسبوع",
  trendCsatTitle: "متوسط CSAT حسب الأسبوع",
  trendNeedMore: "يلزم أسبوعان على الأقل لعرض الاتجاه.",
  colWeek: "الأسبوع",
  colChange: "التغير في NPS",
  trendFew: "إجابات NPS قليلة",
  weekOf: "أسبوع {date}",

  // Tickets
  ticketsTitle: "متابعة العملاء غير الراضين",
  ticketsIntro: "كل عميل غير راضٍ برقم هاتف صالح تُفتح له تذكرة تلقائيًا، والمطلوب الاتصال به خلال 48 ساعة.",
  tkAll: "الكل",
  tkOpen: "مفتوحة",
  tkOverdue: "متأخرة",
  tkContacted: "تم الاتصال",
  tkResolved: "تم الحل",
  tkUnreachable: "لا يرد",
  tkDue: "الموعد: {date}",
  tkOverdueBy: "متأخرة {h} ساعة",
  tkLeft: "متبقي {h} ساعة",
  tkBtnContacted: "تم الاتصال",
  tkBtnResolved: "تم الحل",
  tkBtnUnreachable: "لا يرد",
  tkBtnReopen: "إعادة فتح",
  tkNotes: "ملاحظات",
  tkNotesPlaceholder: "ماذا حدث في المكالمة؟",
  tkSaveNotes: "حفظ الملاحظات",
  tkNone: "لا توجد تذاكر في هذا القسم.",
  tkLoading: "جارٍ التحميل...",
  tkRefresh: "تحديث",
  tkUpdateError: "تعذر تحديث التذكرة.",
  tkLoadError: "تعذر تحميل التذاكر.",
  tkSurveyDate: "تاريخ الاستبيان",
  warnUnknownGovernorate: "محافظات غير معروفة تم الاحتفاظ بها كما كُتبت: {values}.",

  // By model
  modelTitle: "النتائج حسب الموديل",
  modelDesc: "كل موديل بعدد الردود ومتوسط CSAT وNPS. الموديلات ذات الردود القليلة استرشادية فقط.",
  colResponses: "الردود",
  colCsatAvg: "متوسط CSAT",
  colNpsAnswers: "إجابات NPS",
  smallSampleBadge: "عينة صغيرة",

  // Cleaning warnings (shown on the upload page)
  warnMarkerRow:
    "الصف رقم 2 ليس صف «Response»، لذلك لم يتم تجاهل أي صف بحسب موضعه. تأكد من أن هذا هو الملف الصحيح.",
  warnMissingColumn: "العمود {column} غير موجود في الملف، وسيتم ترك بياناته فارغة.",
  warnBadScore: "{n} صف فيه قيمة CSAT أو NPS غير مفهومة (الصفوف: {rows})، وتم ترك هذا التقييم فارغًا.",
  warnSingleScore: "{n} صف محتفظ به يحتوي على تقييم واحد فقط (CSAT أو NPS).",
  warnBadPhone:
    "{n} صف برقم هاتف غير صالح (الصفوف: {rows}). تم الاحتفاظ بها في حسابات NPS وCSAT، لكن لا يمكن الاتصال بأصحابها ولا دمج المكرر منها.",
  warnBadDate: "{n} صف تم استبعاده لأن تاريخ الإنشاء غير مقروء (الصفوف: {rows}).",
  warnUnknownCategory: "قيم غير معروفة في عمود {column} تم تصنيفها «أخرى»: {values}.",

  // Manager report
  reportTitle: "تقرير رضا العملاء (NPS وCSAT)",
  reportPeriod: "الفترة: من {from} إلى {to}",
  reportSource: "المصدر: {file}",
  reportBack: "العودة للوحة التحكم",
  reportPrint: "طباعة / حفظ PDF",
  reportPrintHint: "من نافذة الطباعة اختر «حفظ كـ PDF».",
  reportKeyPoints: "أهم النقاط",
  kpiResponses: "عدد الردود",
  reportPointNps: "NPS = {nps} من {n} إجابة: {p}% مروّجون و{d}% منتقدون.",
  reportPointCsat: "متوسط CSAT {avg} من 5، و{p}% من الردود غير راضية ({n} عميل).",
  reportPointCategory: "أكثر مجال شكاوى: {cat} ({n} شكوى، {p}%).",
  reportPointReason: "أكثر سبب تفصيلي ذكرًا: {reason} ({n} مرة).",
  reportPointFollow: "عدد العملاء غير الراضين بحاجة لمتابعة: {a}. وهناك {b} عميل غير راضٍ لا يمكن الاتصال به.",
  reportSmallSample: "العينة صغيرة (أقل من 100 إجابة NPS)، فالأرقام استرشادية.",
  reportTopReasons: "أهم الأسباب",
  reportNpsNote: "NPS = نسبة المروّجين (9-10) ناقص نسبة المنتقدين (0-6).",
  reportCleaning: "تم تنظيف البيانات: استبعاد التجارب والإدخالات العشوائية، وآخر إجابة لكل رقم هاتف.",
};

export type MessageKey = keyof typeof ar;

const en: Record<MessageKey, string> = {
  backHome: "Back to home",
  uploadTitle: "Upload and analyze weekly NPS and CSAT reports",
  uploadIntro:
    "The file is cleaned automatically: test comments and rows without a rating are removed, and only the latest answer per phone number is kept. You can review the result before anything is saved.",

  removalDuplicatePhone: "Duplicates with the same phone number",
  removalTestComment: "Test comments",
  removalNoScores: "No rating at all",
  removalInvalidDate: "Unreadable date",
  removalBeforeStart: "Responses before 17 Aug 2026",
  removalJunk: "Random entries (invalid phone and name)",
  removalHeader: "Header row",
  removedNone: "nothing",
  errNotXlsx: "Choose an Excel file in .xlsx format.",
  errTooBig: "The file is larger than 4 MB. Delete unused columns or split it by week.",
  errUnexpected: "Unexpected server response ({status}).",
  errNetwork: "Could not reach the server. Check your internet and try again.",
  uploadingFile: "Cleaning {name}...",
  dropAnother: "To analyze another file, drop it here or click to choose",
  dropHere: "Drop the weekly survey file here",
  uploadingHint: "This usually takes a few seconds.",
  pickHint: "Or click to choose. Excel .xlsx file, up to 4 MB.",
  cleanFailed: "The file could not be cleaned",
  tryAgain: "Try again",
  cleaningSummaryAria: "Cleaning summary",
  cleanedTitle: "{n} rows cleaned successfully",
  excludedLine: "Excluded: {list}.",
  rawRowsLine: "Rows in the file: {n}",
  reviewTitle: "Please review",
  notSavedYet: "Nothing has been saved yet. Review the result, then press \"Save to database\".",

  dashTitle: "CSAT and NPS results",
  exportBtn: "Export shown data (Excel)",
  exportError: "Could not create the Excel file. Try again.",
  reportBtn: "Manager report",
  noResponsesInRange: "There are no responses in the selected period.",
  statNps: "NPS",
  statNpsHint: "from {n} answers",
  statCsat: "Average CSAT",
  statCsatHint: "out of 5, from {n} answers",
  statDissat: "Dissatisfied",
  statDissatHint: "{p}% of responses",
  statUseful: "Useful comments",
  statUsefulHint: "excluding \"no\", \"thanks\" and similar",
  statFollow: "Need follow-up",
  statFollowHint: "dissatisfied, no comment, valid phone",
  statNoContact: "Cannot be contacted",
  statNoContactHint: "dissatisfied with an invalid phone number",
  tblFollowTitle: "Customers needing a follow-up call",
  tblFollowDesc: "Low score without a useful comment, and a valid phone number. Lowest scores first.",
  tblNoContactTitle: "Dissatisfied customers with an invalid phone number",
  tblNoContactDesc:
    "They cannot be called. The number is shown as the customer typed it; you may find another way to reach them in the service records.",
  tblCommentsTitle: "Customer comments",
  tblCommentsDesc: "Only comments that contain real information. Lowest scores first.",

  colDate: "Date",
  colName: "Name",
  colPhone: "Phone",
  colPhoneValid: "Phone valid",
  colModel: "Model",
  colCategory: "Problem area",
  colDetail: "Detailed reason",
  colComment: "Comment",
  yes: "Yes",
  no: "No",
  invalidBadge: "Invalid",
  notSpecified: "Not specified",
  noComment: "No comment",
  showFirst: "Show first 25 only",
  showAll: "Show all ({n})",

  dateFilterAria: "Date filter",
  dateFrom: "From date",
  dateTo: "To date",
  presetAll: "All period",
  preset7: "Last 7 days",
  preset30: "Last 30 days",
  rangeInvalid: "The start date is after the end date",
  showingRange: "Showing {shown} of {total} responses, from {min} to {max} in the file",

  npsTitle: "Customer groups (NPS)",
  npsSub: "Customers who answered the NPS question: {n}.",
  promoters: "Promoters (9-10)",
  passives: "Passives (7-8)",
  detractors: "Detractors (0-6)",
  tipCustomers: "{n} customers",
  tipCount: "Count",
  distTitle: "Number of ratings per score",
  distSub: "Each bar is a score from 0 to 10, colored by group.",
  tipScore: "Score {n}",

  catService: "Maintenance service",
  catParts: "Spare parts",
  catProduct: "The product / motorcycle itself",
  catOther: "Other",
  complaintsAria: "Complaint analysis",
  whereTitle: "Where are the complaints concentrated?",
  whereDesc: "{n} complaints across the three areas, based on the customer's answer to \"What is the problem area?\".",
  scopeLabel: "Customers counted",
  scopeDissatisfied: "Dissatisfied only (CSAT ≤ 3 or NPS ≤ 6)",
  scopeAll: "Everyone who chose a problem area",
  noCategorized: "There are no categorized complaints in the selected period.",
  unspecifiedNote: "{n} dissatisfied customers did not choose a problem area, so they are not in the chart.",
  categoryCount: "{n} complaints. Details:",
  noDetailInCategory: "There are no detailed answers for this category in the file.",
  moreReasons: "+ {n} other, less frequent reasons.",
  withoutDetail: "{n} complaints without a detailed reason.",

  navUpload: "Upload and analyze",
  navTickets: "Customer follow-up",
  saveBtn: "Save to database",
  saving: "Saving...",
  savedOk: "Saved: {inserted} new and {updated} updated, out of {total} responses.",
  saveHint: "Saving is safe: uploading the same file again does not duplicate responses.",
  loadSavedBtn: "Show all saved data",
  loadingSaved: "Loading saved data...",
  dbSourceName: "All saved data",
  dbLoadedLine: "{n} responses loaded from the database.",
  dbEmpty: "There is no saved data yet. Upload a file and save it first.",
  errDbNotConfigured: "The database is not connected yet. Add the Supabase keys to the .env.local file and restart the server.",

  colGovernorate: "Governorate",
  colServiceCenter: "Service center",
  groupGovernorateTitle: "Results by governorate",
  groupGovernorateDesc: "Each governorate with its responses, average CSAT and NPS. Governorates with few responses are indicative only.",
  groupCenterTitle: "Results by service center",
  groupCenterDesc: "Each service center with its responses, average CSAT and NPS. Centers with few responses are indicative only.",
  showMoreGroups: "Show all ({n})",
  showFewerGroups: "Show top only",

  trendTitle: "Weekly trend",
  trendDesc: "NPS and average CSAT for each week (weeks start on Monday). Weeks with few answers are indicative only.",
  trendNpsTitle: "NPS by week",
  trendCsatTitle: "Average CSAT by week",
  trendNeedMore: "At least two weeks are needed to show a trend.",
  colWeek: "Week",
  colChange: "NPS change",
  trendFew: "few NPS answers",
  weekOf: "Week of {date}",

  ticketsTitle: "Follow-up of dissatisfied customers",
  ticketsIntro: "Every dissatisfied customer with a valid phone number gets a ticket automatically, and should be called within 48 hours.",
  tkAll: "All",
  tkOpen: "Open",
  tkOverdue: "Overdue",
  tkContacted: "Contacted",
  tkResolved: "Resolved",
  tkUnreachable: "No answer",
  tkDue: "Due: {date}",
  tkOverdueBy: "{h} h overdue",
  tkLeft: "{h} h left",
  tkBtnContacted: "Mark contacted",
  tkBtnResolved: "Mark resolved",
  tkBtnUnreachable: "No answer",
  tkBtnReopen: "Reopen",
  tkNotes: "Notes",
  tkNotesPlaceholder: "What happened on the call?",
  tkSaveNotes: "Save notes",
  tkNone: "There are no tickets in this section.",
  tkLoading: "Loading...",
  tkRefresh: "Refresh",
  tkUpdateError: "Could not update the ticket.",
  tkLoadError: "Could not load the tickets.",
  tkSurveyDate: "Survey date",
  warnUnknownGovernorate: "Unknown governorates were kept as typed: {values}.",

  modelTitle: "Results by model",
  modelDesc: "Each model with its responses, average CSAT and NPS. Models with few responses are indicative only.",
  colResponses: "Responses",
  colCsatAvg: "Average CSAT",
  colNpsAnswers: "NPS answers",
  smallSampleBadge: "small sample",

  warnMarkerRow:
    "Excel row 2 is not the \"Response\" row, so no row was skipped by position. Make sure this is the right file.",
  warnMissingColumn: "Column {column} is not in the file; its data will be left empty.",
  warnBadScore: "{n} rows have a CSAT or NPS value that could not be understood (rows: {rows}); that rating was left empty.",
  warnSingleScore: "{n} kept rows have only one rating (CSAT or NPS).",
  warnBadPhone:
    "{n} rows have an invalid phone number (rows: {rows}). They are kept in the NPS and CSAT figures, but the customers cannot be called and their duplicates cannot be merged.",
  warnBadDate: "{n} rows were excluded because the creation date could not be read (rows: {rows}).",
  warnUnknownCategory: "Unknown values in column {column} were classified as \"Other\": {values}.",

  reportTitle: "Customer satisfaction report (NPS and CSAT)",
  reportPeriod: "Period: {from} to {to}",
  reportSource: "Source: {file}",
  reportBack: "Back to dashboard",
  reportPrint: "Print / Save as PDF",
  reportPrintHint: "In the print window choose \"Save as PDF\".",
  reportKeyPoints: "Key points",
  kpiResponses: "Responses",
  reportPointNps: "NPS is {nps} from {n} answers: {p}% promoters and {d}% detractors.",
  reportPointCsat: "Average CSAT is {avg} out of 5, and {p}% of responses are dissatisfied ({n} customers).",
  reportPointCategory: "Largest complaint area: {cat} ({n} complaints, {p}%).",
  reportPointReason: "Most mentioned detailed reason: {reason} ({n} times).",
  reportPointFollow:
    "Dissatisfied customers needing a follow-up call: {a}. A further {b} dissatisfied customers cannot be contacted.",
  reportSmallSample: "The sample is small (under 100 NPS answers), so the figures are indicative only.",
  reportTopReasons: "Top reasons",
  reportNpsNote: "NPS = share of promoters (9-10) minus share of detractors (0-6).",
  reportCleaning: "Data was cleaned: test and random entries removed, latest answer kept per phone number.",
};

const MESSAGES: Record<Lang, Record<MessageKey, string>> = { ar, en };

export const CATEGORY_KEYS: Record<RootCause, MessageKey> = {
  service: "catService",
  parts: "catParts",
  product: "catProduct",
  other: "catOther",
};

// ---------------------------------------------------------------------------
// Detailed complaint reasons come from the survey as Arabic text. The survey
// has a fixed list of options, so they can be translated. Anything not in the
// list is shown unchanged.
// ---------------------------------------------------------------------------

const normalizeKey = (s: string): string =>
  s
    .replace(/[\u064B-\u065F\u0640]/g, "")
    .replace(/[\u0623\u0625\u0622]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .replace(/\s+/g, " ")
    .trim();

const REASONS_EN: Record<string, string> = {
  "الأداء": "Performance",
  "الموتور": "Engine",
  "الكهرباء": "Electrical",
  "الشاسيه": "Chassis",
  "الأمان": "Safety",
  "جودة الخدمة": "Service quality",
  "التعامل مع فريق الصيانة": "Handling by the maintenance team",
  "تكلفة الصيانة": "Maintenance cost",
  "إجراءات الصيانة": "Maintenance procedures",
  "وقت الصيانة": "Maintenance time",
  "الوصول لمركز الصيانة": "Reaching the service center",
  "خدمات وتسهيلات مركز الصيانة": "Service center facilities",
};

const REASONS_EN_NORMALIZED = new Map(
  Object.entries(REASONS_EN).map(([ar, en]) => [normalizeKey(ar), en]),
);

/** Translates one option or a comma-separated list of options. */
export function translateReason(text: string, lang: Lang): string {
  if (lang === "ar") return text;
  return text
    .split(/[,\u060C]\s*/)
    .map((part) => REASONS_EN_NORMALIZED.get(normalizeKey(part)) ?? part)
    .join(", ");
}

// ---------------------------------------------------------------------------
// Provider and hooks
// ---------------------------------------------------------------------------

type Params = Record<string, string | number>;

interface LangContextValue {
  lang: Lang;
  dir: "rtl" | "ltr";
  setLang: (lang: Lang) => void;
  t: (key: MessageKey, params?: Params) => string;
  reason: (text: string) => string;
  /** Governorate name in the current language (unknown spellings are shown as stored). */
  place: (value: string) => string;
}

const LangContext = createContext<LangContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  // Read the saved choice after the first render, so the server and the first
  // client render agree (both Arabic).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "ar" || saved === "en") setLangState(saved);
    } catch {
      /* storage can be blocked; Arabic stays */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<LangContextValue>(() => {
    const t = (key: MessageKey, params?: Params): string =>
      MESSAGES[lang][key].replace(/\{(\w+)\}/g, (_, name: string) => String(params?.[name] ?? ""));
    return {
      lang,
      dir: lang === "ar" ? "rtl" : "ltr",
      setLang,
      t,
      reason: (text: string) => translateReason(text, lang),
      place: (value: string) => governorateLabel(value, lang),
    };
  }, [lang, setLang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside <LanguageProvider>");
  return ctx;
}

export function LanguageToggle() {
  const { lang, setLang } = useLang();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === "ar" ? "en" : "ar")}
      aria-label={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E8A8F]"
    >
      {lang === "ar" ? "English" : "العربية"}
    </button>
  );
}
