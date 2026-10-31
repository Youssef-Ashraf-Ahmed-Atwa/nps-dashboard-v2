import Link from "next/link";
import { UploadPanel } from "@/components/upload/UploadPanel";

export const metadata = { title: "رفع وتحليل ملف الاستبيان الأسبوعي" };

export default function UploadPage() {
  return (
    <main dir="rtl" className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header>
        <Link href="/" className="text-sm text-slate-600 underline-offset-2 hover:underline">
          العودة إلى الصفحة الرئيسية
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">رفع وتحليل تقارير NPS وCSAT الأسبوعية</h1>
        <p className="mt-1 max-w-prose text-sm text-slate-600">
          يتم تنظيف الملف تلقائيًا: تُستبعد التعليقات التجريبية والصفوف بدون تقييم، ويُحتفظ بآخر إجابة لكل رقم هاتف.
          يمكنك مراجعة النتيجة قبل حفظ أي شيء.
        </p>
      </header>

      <UploadPanel />
    </main>
  );
}
