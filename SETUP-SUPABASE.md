# ربط Supabase (مرة واحدة)

## 1) أنشئ المشروع
1. ادخل على supabase.com وسجّل بحساب GitHub.
2. New project: اكتب اسمًا (مثلًا nps-dashboard)، وكلمة سر لقاعدة البيانات (احتفظ بها)، واختر أقرب Region.
3. استنى دقيقة أو اتنين لحد ما المشروع يجهز.

## 2) أنشئ الجداول
1. من القايمة الشمال: **SQL Editor** ← **New query**.
2. افتح ملف `supabase/001_schema.sql` من الـ Codespace، انسخ كل محتواه والصقه، واضغط **Run**.
3. لازم تظهر رسالة Success. بعدها في **Table Editor** هتلاقي: customers و surveys و action_tickets.

> نفّذ ملف 001 ده بس. ملف 003 القديم ما تنفّذوش، لأن كل اللي فيه موجود في 001.

## 3) انسخ المفاتيح
من **Project Settings ← API** (أو API Keys):
- **Project URL** (بيبدأ بـ https:// وينتهي بـ supabase.co)
- **service_role key** (أو Secret key). ده سري جدًا: ما تبعتوش لحد وما تحطوش في GitHub.

## 4) ضعهم في المشروع
في الـ Terminal:
```bash
npm install @supabase/supabase-js
cp .env.local.example .env.local
```
افتح `.env.local` واكتب الـ URL والمفتاح، وسيب `APP_PASSWORD` فاضي وانت بتطوّر. بعدين أعد تشغيل السيرفر:
```bash
pkill -f next
npm run dev
```
ملف `.env.local` مستثنى من GitHub تلقائيًا.

## 5) جرّب
1. افتح `/upload` وارفع ملف الـ xlsx، واضغط **حفظ في قاعدة البيانات**.
2. في Supabase ← Table Editor ← surveys: المفروض تلاقي الردود.
3. افتح `/tickets`: هتلاقي تذكرة لكل عميل غير راضٍ برقم صالح.
4. ارفع نفس الملف تاني واضغط حفظ: الردود ما بتتكررش.

## عند النشر على Vercel
أضف نفس المتغيرات الثلاثة في Vercel ← Settings ← Environment Variables، و**APP_PASSWORD إجباري** (من غيره الموقع بيرفض يفتح).
