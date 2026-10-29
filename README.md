# 📒 دفتر الملاحظات الخاص | Private Notes

مشروع الورشة الثالثة: تطبيق ويب يعتمد على **قاعدة بيانات Supabase** مع **تفعيل RLS**
لضمان أن كل مستخدم يرى ملاحظاته الخاصة فقط ولا يستطيع أي مستخدم آخر الدخول عليها.

## ✨ وظيفة المشروع

- تسجيل الدخول / إنشاء حساب عبر **Supabase Auth**.
- إضافة / تعديل / حذف / بحث في الملاحظات (عنوان + تصنيف + نص).
- **عزل تام بين المستخدمين** عبر سياسات RLS:
  `auth.uid() = user_id` — أي أن المستخدم لا يستطيع قراءة أو تعديل أو حذف ملاحظات غيره،
  حتى لو حاول يدويًا من لوحة المطورين أو عبر استعلام مباشر.

## 🛠️ خطوات التشغيل

### 1) إنشاء مشروع Supabase
1. ادخل إلى [supabase.com/dashboard](https://supabase.com/dashboard) وأنشئ مشروعًا جديدًا.
2. من **Project Settings ← API** انسخ:
   - `Project URL`
   - `anon public` key

### 2) تنفيذ ملف قاعدة البيانات (الجداول + RLS)
1. من الواجهة افتح **SQL Editor**.
2. افتح ملف [`supabase-schema.sql`](./supabase-schema.sql) وانسخ محتواه كاملاً ثم اضغط **Run**.
3. تأكد من ظهور جدول `notes` ومن أن الرسائل تشير إلى نجاح إنشاء السياسات (policies).

> للاستعلام: `select * from pg_policies where tablename = 'notes';`
> يجب أن تظهر 4 سياسات: select / insert / update / delete.

### 3) ضبط الإعدادات (طريقان)
**الطريقة أ — من داخل التطبيق (أسهل):** افتح الموقع واضغط
**⚙️ إعدادات**، الصق `Project URL` و`anon public` key، ثم اضغط «حفظ وربط».
تُحفظ القيم في متصفحك تلقائيًا (localStorage).

**الطريقة ب — من الملفات:** افتح ملف `config.js` وضع بدل القيم التجريبية:

```js
const SUPABASE_URL = "https://xxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

> الأولوية دائمًا لقيم `config.js` إن كانت حقيقية، وإلا تُستخدم القيم المحفوظة من زر الإعدادات.

> إعدادات Authentication من **Authentication ← Providers**: تأكد أن مزوّد **Email** مفعّل.
> يمكنك تفعيل «Confirm email» أو إطفاؤه للتجربة السريعة، وكذلك من
> **Authentication ← Settings** أضف `http://localhost:XXXX` ورابط GitHub Pages في
> **Site URL / Redirect URLs**.

### 4) التشغيل محليًا (ويندوز)
داخل مجلد المشروع نفّذ في PowerShell:

```powershell
cd private-notes
powershell -ExecutionPolicy Bypass -File .\local-server.ps1
# ثم افتح http://localhost:8080
```

أو بأي خادم ثابت آخر مثل: `npx serve .` — تذكّر إضافة رابط `http://localhost:8080`
في Supabase ← **Authentication ← URL Configuration ← Redirect URLs** أثناء التجربة المحلية.

### 5) إنشاء مستخدمَين والتجربة (مطلوب في المهمة)
1. من تبويب **إنشاء حساب جديد** سجّل أول مستخدم: `user1@example.com` + كلمة مرور.
2. أضف ملاحظة مثلاً «ملاحظات المستخدم الأول».
3. سجّل الخروج، ثم أنشئ حسابًا ثانيًا: `user2@example.com`.
4. أضف ملاحظة للمستخدم الثاني.
5. **النتيجة المتوقعة:** كل مستخدم يرى ملاحظاته فقط. لو فتح المستخدم الثاني لوحة
   المطورين (F12) واستعلم بنفس الجلسة، فلن تظهر له ملاحظات المستخدم الأول إطلاقًا —
   لأن RLS يُلغي الصفوف غير المملوكة على مستوى قاعدة البيانات نفسها.

لإثبات نجاح التجربة: سجّل الدخول كـ `user1` → انسخ معرف (`id`) ملاحظة من ملاحظات
`user2` → من لوحة المطورين نفّذ:

```js
await supabase.from('notes').update({ title: 'اختراق' }).eq('id', 'معرّف ملاحظة user2')
```

ستظهر رسالة خطأ أو لن يتم تعديل أي صف، لأن السياسة `using (auth.uid() = user_id)` تمنعه.

## 🌐 النشر على GitHub Pages

1. أنشئ مستودعًا جديدًا وارفع محتويات مجلد `private-notes`.
2. من **Settings ← Pages** اختر الفرع `main` والمجلد الجذر `/`.
3. انتظر دقائق حتى يعمل الرابط: `https://<username>.github.io/<repo>/`.
4. لا تنسَ إضافة رابط الموقع نفسه في Supabase:
   **Authentication ← URL Configuration ← Redirect URLs** (و Site URL).

> ملف `config.js` يحوي المفتاح العام `anon` فقط، وهذا مُصرّح به نشره علنًا لأنه
> محمي بسياسات RLS. **لا تضع أبدًا مفتاح `service_role`** ولا كلمة مرور.

## 📂 ملفات المشروع

| الملف | الوظيفة |
|---|---|
| `index.html` | واجهة التطبيق (تسجيل الدخول + إدارة الملاحظات) |
| `style.css` | التنسيقات العربية RTL |
| `app.js` | منطق التطبيق مع supabase-js (Auth + CRUD) |
| `config.js` | رابط المشروع ومفتاح anon |
| `supabase-schema.sql` | الجدول + تفعيل RLS + السياسات الأربع |

## ✅ قائمة تحقق المهمة

- [x] مشروع يعتمد على قواعد البيانات مع تسجيل دخول المستخدمين
- [x] كل مستخدم له محتوى خاص لا يراه غيره
- [x] استخدام Supabase Database
- [x] تفعيل RLS بأربع سياسات (select/insert/update/delete)
- [x] إنشاء مستخدمين اثنين على الأقل واختبار العزل بينهم
