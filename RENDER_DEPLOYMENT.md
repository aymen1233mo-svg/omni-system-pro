# دليل رفع وتشغيل النظام وقاعدة البيانات السحابية على موقع Render

يوضح هذا الدليل الخطوات البسيطة لنشر وتحديث نظام **OmniFly Pro** مع قاعدة البيانات السحابية المستدامة على منصة **Render.com**.

---

## 🛠️ الطرق المتاحة للنشر على Render

### الطريقة الأولى: باستخدام ملف Blueprint (`render.yaml`) - (الأسهل والأسرع)

1. سجل الدخول إلى حسابك في [Render.com](https://render.com).
2. من اللوحة الرئيسية، اضغط على **New +** ثم اختر **Blueprint**.
3. قم بربط مستودع جيت هب الخاص بك (`proaymen941-netizen/omnifly-pro`).
4. سيقرأ Render تلقائياً ملف `render.yaml` الموجود في الجذر وسيقوم بإعداد:
   - **Web Service** بالاسم `omnifly-pro`.
   - **Persistent Disk** باسم `omnifly-data` ومثبت بالمسار `/var/data` لحفظ قاعدة البيانات بشكل دائم وأمن أثناء التحديثات وإعادة التشغيل.
5. اضغط **Apply** وسيبدأ Render بالبناء والتشغيل فوراً!

---

### الطريقة الثانية: إنشاء Web Service يدوياً

إذا أردت إنشاء الخدمة يدوياً عبر واجهة Render:

1. اختر **New +** -> **Web Service**.
2. اربط مستودع GitHub الخاط بك (`proaymen941-netizen/omnifly-pro`).
3. اضبط الإعدادات التالية:
   - **Name**: `omnifly-pro`
   - **Runtime**: `Node` (أو `Docker` إذا اخترت استخدام الـ Dockerfile)
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. في قسم **Environment Variables**:
   - `NODE_ENV` = `production`
   - `PORT` = `3000`
   - `DB_PATH` = `/var/data/pos.db`
5. في قسم **Disks** (أو **Persistent Disk**):
   - اضغط **Add Disk**.
   - **Name**: `omnifly-data`
   - **Mount Path**: `/var/data`
   - **Size**: 1 GB (أو أكثر حسب الحاجة)
6. اضغط **Create Web Service**.

---

## ⚡ المميزات والآلية السحابية لقاعدة البيانات
- **الاستدامة والنسخ التلقائي**: عند تشغيل النظام للمرة الأولى على Render، يقوم النظام تلقائياً بإنشاء قاعدة البيانات ورسخ البيانات الأولية والتكوينات (مثل المستخدمين والافتراضيات) داخل القرص السحابي `/var/data/pos.db`.
- **الحفظ التلقائي**: جميع العمليات والحجوزات والمستخدمين المضافين يتم حفظها فورياً في السحابة.
- **النسخ الاحتياطي والسلامة**: الملفات لن تضيع عند عمل Restart أو Deploy لإصدارات جديدة.
