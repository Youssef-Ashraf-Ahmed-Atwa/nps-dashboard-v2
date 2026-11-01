/**
 * Egyptian governorates, with Arabic and English names and the spellings
 * people actually type. The stored value is the English `key`, so the same
 * governorate is always one group no matter how the customer wrote it, and the
 * interface can show it in either language.
 */

export interface Governorate {
  key: string; // English name, stored in the database
  ar: string;
  en: string;
  aliases: string[]; // extra spellings
}

const g = (en: string, ar: string, ...aliases: string[]): Governorate => ({ key: en, ar, en, aliases });

export const GOVERNORATES: Governorate[] = [
  g("Cairo", "القاهرة", "Qahira"),
  g("Giza", "الجيزة", "Gizeh"),
  g("Alexandria", "الإسكندرية", "Alex", "اسكندرية"),
  g("Qalyubia", "القليوبية", "Qalyubiyya", "Kalyubia", "Qaliubiya", "Qalubia"),
  g("Sharqia", "الشرقية", "Sharkia", "Sharqiyya"),
  g("Dakahlia", "الدقهلية", "Dakahliya", "Daqahliyya"),
  g("Gharbia", "الغربية", "Gharbiyya"),
  g("Menoufia", "المنوفية", "Monufia", "Menofia", "Minufiyya"),
  g("Beheira", "البحيرة", "Behera", "Buhayra"),
  g("Kafr El Sheikh", "كفر الشيخ", "Kafr Elsheikh", "Kafr Alsheikh"),
  g("Damietta", "دمياط", "Dumyat"),
  g("Port Said", "بورسعيد", "Portsaid"),
  g("Ismailia", "الإسماعيلية", "Ismailiya"),
  g("Suez", "السويس"),
  g("North Sinai", "شمال سيناء"),
  g("South Sinai", "جنوب سيناء"),
  g("Red Sea", "البحر الأحمر"),
  g("Fayoum", "الفيوم", "Faiyum", "Fayyum"),
  g("Beni Suef", "بني سويف", "Bani Suef", "Beni Sweif", "Beni Suweif"),
  g("Minya", "المنيا", "Minia", "Menia"),
  g("Asyut", "أسيوط", "Assiut", "Asiut"),
  g("Sohag", "سوهاج", "Suhag"),
  g("Qena", "قنا", "Qina"),
  g("Luxor", "الأقصر"),
  g("Aswan", "أسوان", "Assuan"),
  g("New Valley", "الوادي الجديد", "El Wadi El Gedid", "Wadi Gedid"),
  g("Matrouh", "مطروح", "Matruh", "Marsa Matruh"),
];

/** Lower case, Arabic letter variants merged, everything except letters and digits removed. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/محافظة|governorate/g, " ")
    .replace(/[\u064B-\u065F\u0640]/g, "")
    .replace(/[\u0623\u0625\u0622]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .replace(/[^a-z0-9\u0621-\u064a]/g, "");
}

/** Same, without the Arabic "ال" in front ("الجيزة" and "جيزة" match). */
const stripAl = (k: string): string => k.replace(/^\u0627\u0644/, "");

const INDEX = new Map<string, string>();
for (const gov of GOVERNORATES) {
  for (const name of [gov.en, gov.ar, ...gov.aliases]) {
    const k = norm(name);
    INDEX.set(k, gov.key);
    INDEX.set(stripAl(k), gov.key);
  }
}

function lookup(piece: string): string | null {
  const k = norm(piece);
  if (!k) return null;
  return INDEX.get(k) ?? INDEX.get(stripAl(k)) ?? null;
}

/**
 * Finds the governorate in what the customer or the sheet wrote:
 * "Cairo", "القاهره", "Cairo - القاهرة", "محافظة الجيزة". Null when unknown.
 */
export function matchGovernorate(raw: string): string | null {
  const whole = lookup(raw);
  if (whole) return whole;
  for (const piece of raw.split(/[-\u2013\u2014/|,\u060C]/)) {
    const hit = lookup(piece);
    if (hit) return hit;
  }
  return null;
}

/** Name to show for a stored value. Unknown values (new spellings) are shown as stored. */
export function governorateLabel(value: string, lang: "ar" | "en"): string {
  const gov = GOVERNORATES.find((x) => x.key === value);
  return gov ? gov[lang] : value;
}
