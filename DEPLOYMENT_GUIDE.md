# دليل نشر نظام إدارة المطعم
## Laravel + MySQL + Frontend

---

## 📋 نظرة عامة

تم تحويل النظام من:
- **قبل**: Frontend فقط (HTML + JS + IndexedDB)
- **بعد**: نظام متكامل مع Laravel Backend + MySQL + Frontend

---

## 🛠 المتطلبات الأساسية

### على الخادم المحلي (localhost):

1. **PHP** - إصدار 8.1 أو أحدث
2. **Composer** - لإدارة حزم PHP
3. **MySQL** - إصدار 5.7 أو أحدث
4. **Apache/Nginx** - خادم ويب
5. **Node.js & NPM** (اختياري للتطوير)

### التحقق من التثبيت:

```bash
php -v          # يجب أن يظهر 8.1+
composer -v     # يجب أن يظهر Composer
mysql --version # يجب أن يظهر MySQL
```

---

## 📦 هيكل المشروع الجديد

```
project/
├── backend/                    # Laravel Backend
│   ├── app/
│   │   ├── Http/Controllers/  # المتحكمات
│   │   └── Models/            # النماذج
│   ├── database/
│   │   └── migrations/        # ملفات Migration
│   ├── routes/
│   │   └── api.php           # مسارات API
│   ├── config/               # ملفات الإعدادات
│   ├── public/               # المجلد العام
│   ├── .env                  # متغيرات البيئة
│   └── composer.json         # اعتماديات PHP
├── js/                       # Frontend JavaScript
│   ├── api.js               # طبقة API الجديدة
│   ├── db_laravel.js        # Database Manager الجديد
│   └── modules/             # وحدات النظام
├── styles.css               # التصميم
└── index.html              # الواجهة الأمامية
```

---

## 🚀 خطوات التثبيت والنشر

### الخطوة 1: إعداد قاعدة البيانات

#### 1.1 إنشاء قاعدة البيانات

```bash
# افتح MySQL
mysql -u root -p

# أنشئ قاعدة البيانات
CREATE DATABASE restaurant_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# أنشئ مستخدم (اختياري)
CREATE USER 'restaurant_user'@'localhost' IDENTIFIED BY 'password123';
GRANT ALL PRIVILEGES ON restaurant_db.* TO 'restaurant_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### الخطوة 2: إعداد Laravel Backend

#### 2.1 الانتقال لمجلد Backend

```bash
cd /path/to/project/backend
```

#### 2.2 تثبيت اعتماديات PHP

```bash
composer install
```

#### 2.3 إعداد ملف البيئة

```bash
# انسخ ملف البيئة النموذجي
cp .env.example .env

# افتح .env وعدل الإعدادات:
```

محتوى ملف `.env`:

```env
APP_NAME="Restaurant Management System"
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=http://localhost:8000

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=restaurant_db
DB_USERNAME=root
DB_PASSWORD=your_password_here

CACHE_DRIVER=file
QUEUE_CONNECTION=sync
SESSION_DRIVER=file
```

#### 2.4 توليد مفتاح التطبيق

```bash
php artisan key:generate
```

#### 2.5 تشغيل Migrations

```bash
php artisan migrate
```

هذا الأمر سينشئ جميع الجداول في قاعدة البيانات:
- inventory_items
- inventory_movements
- employees
- suppliers
- revenues
- expenses
- pos_orders
- employee_meals
- notifications

### الخطوة 3: تشغيل الخادم

#### على localhost (للتطوير):

```bash
# من داخل مجلد backend
php artisan serve

# سيعمل على: http://localhost:8000
```

#### للإنتاج (Production):

استخدم Apache أو Nginx. مثال إعداد Apache:

```apache
<VirtualHost *:80>
    ServerName restaurant.local
    DocumentRoot /path/to/project/backend/public

    <Directory /path/to/project/backend/public>
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog ${APACHE_LOG_DIR}/restaurant-error.log
    CustomLog ${APACHE_LOG_DIR}/restaurant-access.log combined
</VirtualHost>
```

### الخطوة 4: إعداد Frontend

#### 4.1 تحديث عنوان API

افتح ملف `js/api.js` وتأكد من عنوان API:

```javascript
const API_BASE_URL = 'http://localhost:8000/api/v1';
```

**مهم**: عند النشر على خادم حقيقي، غير العنوان إلى:
```javascript
const API_BASE_URL = 'https://yourdomain.com/api/v1';
```

#### 4.2 فتح Frontend

افتح ملف `index.html` في المتصفح:

**على localhost:**
```bash
# استخدم خادم محلي بسيط
python3 -m http.server 5000
# ثم افتح: http://localhost:5000
```

**أو** ضعه في مجلد خادم الويب:
```bash
# انسخ الملفات إلى مجلد Apache
cp -r index.html styles.css js/ /var/www/html/restaurant/
# افتح: http://localhost/restaurant
```

---

## 🔧 الإعدادات الإضافية

### تفعيل CORS (مهم جداً)

إذا كان Frontend والBackend على نطاقات مختلفة، فعّل CORS:

#### في Laravel (ملف `config/cors.php`):

```php
return [
    'paths' => ['api/*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => ['*'],  // للتطوير فقط
    // للإنتاج استخدم:
    // 'allowed_origins' => ['https://yourdomain.com'],
    'allowed_headers' => ['*'],
    'supports_credentials' => false,
];
```

#### تثبيت حزمة CORS:

```bash
composer require fruitcake/laravel-cors
```

### تحسين الأداء (Production)

```bash
# تحسين الأداء
php artisan config:cache
php artisan route:cache
php artisan view:cache

# تشغيل Optimize
php artisan optimize
```

---

## 🌐 النشر على خادم حقيقي

### باستخدام Shared Hosting:

1. **رفع الملفات:**
   - ارفع مجلد `backend` إلى الجذر
   - ارفع الملفات الأمامية (index.html, styles.css, js/) إلى `public_html`

2. **إعداد .htaccess:**
   تأكد من وجود ملف `.htaccess` في `backend/public`

3. **إعداد قاعدة البيانات:**
   - أنشئ قاعدة بيانات من cPanel
   - استورد الجداول باستخدام migrations

### باستخدام VPS/Cloud:

#### على Ubuntu:

```bash
# تثبيت المتطلبات
sudo apt update
sudo apt install php8.1 php8.1-mysql php8.1-mbstring php8.1-xml composer mysql-server

# رفع المشروع
cd /var/www
git clone your-repo restaurant

# إعداد Backend
cd restaurant/backend
composer install --no-dev
cp .env.example .env
# عدل .env

php artisan key:generate
php artisan migrate

# إعداد Apache
sudo nano /etc/apache2/sites-available/restaurant.conf
# أضف إعداد VirtualHost

sudo a2ensite restaurant
sudo systemctl reload apache2
```

---

## 📊 إدارة قاعدة البيانات

### نسخ احتياطي للبيانات:

```bash
# تصدير قاعدة البيانات
mysqldump -u root -p restaurant_db > backup_$(date +%Y%m%d).sql
```

### استعادة البيانات:

```bash
mysql -u root -p restaurant_db < backup_20240101.sql
```

### إعادة تعيين قاعدة البيانات:

```bash
php artisan migrate:fresh    # احذر: يحذف جميع البيانات
```

---

## 🔐 الأمان

### قبل النشر، تأكد من:

1. **تعطيل Debug Mode:**
   ```env
   APP_DEBUG=false
   ```

2. **تأمين .env:**
   ```bash
   chmod 600 .env
   ```

3. **إخفاء معلومات الأخطاء:**
   عدل `APP_ENV=production`

4. **استخدام HTTPS:**
   استخدم شهادة SSL (Let's Encrypt مجاناً)

5. **تحديث Composer:**
   ```bash
   composer update
   ```

---

## 🧪 الاختبار

### اختبار API:

```bash
# اختبار Dashboard
curl http://localhost:8000/api/v1/dashboard/stats

# اختبار المخزون
curl http://localhost:8000/api/v1/inventory

# اختبار إضافة عنصر
curl -X POST http://localhost:8000/api/v1/inventory \
  -H "Content-Type: application/json" \
  -d '{"name":"test","category":"test","unit":"kg","quantity":10,"purchase_price":5,"sell_price":10}'
```

### اختبار Frontend:

1. افتح `index.html`
2. افتح Developer Tools (F12)
3. تحقق من Console للتأكد من عدم وجود أخطاء
4. جرب إضافة/تعديل/حذف البيانات

---

## 🐛 حل المشاكل الشائعة

### مشكلة: "Connection refused"

**الحل:**
- تأكد من تشغيل Laravel: `php artisan serve`
- تأكد من عنوان API في `js/api.js`

### مشكلة: "CORS Error"

**الحل:**
- ثبت حزمة CORS
- فعّل CORS في `config/cors.php`

### مشكلة: "Database connection failed"

**الحل:**
- تحقق من بيانات الاتصال في `.env`
- تأكد من تشغيل MySQL
- تأكد من وجود قاعدة البيانات

### مشكلة: "500 Internal Server Error"

**الحل:**
```bash
# تحقق من السجلات
tail -f storage/logs/laravel.log

# تأكد من الصلاحيات
chmod -R 775 storage bootstrap/cache
```

---

## 📝 ملاحظات مهمة

1. **البيانات التجريبية:**
   - لم يعد النظام ينشئ بيانات تجريبية تلقائياً
   - ستحتاج لإدخال البيانات يدوياً

2. **الأداء:**
   - استخدم Redis للـ Cache في الإنتاج
   - فعّل Queue للعمليات الثقيلة

3. **النسخ الاحتياطي:**
   - احفظ نسخة احتياطية يومية من قاعدة البيانات
   - احفظ نسخة من ملف `.env`

4. **التحديثات:**
   - راقب تحديثات Laravel الأمنية
   - حدّث الاعتماديات بانتظام

---

## 📞 الدعم

للمشاكل التقنية:
- راجع السجلات: `storage/logs/laravel.log`
- تحقق من Console المتصفح (F12)
- استخدم `php artisan tinker` للاختبار

---

## ✅ قائمة التحقق النهائية

قبل النشر، تأكد من:

- [ ] قاعدة البيانات منشأة ومتصلة
- [ ] Migrations مشغلة بنجاح
- [ ] ملف .env معدّل بشكل صحيح
- [ ] Laravel يعمل بدون أخطاء
- [ ] Frontend متصل بـ API بنجاح
- [ ] CORS مفعّل إذا لزم
- [ ] Debug mode معطّل (production)
- [ ] الصلاحيات صحيحة على المجلدات
- [ ] النسخ الاحتياطي معدّ
- [ ] HTTPS مفعّل (للإنتاج)

---

**تم إنشاء هذا الدليل لمساعدتك في نشر النظام بنجاح**
**التاريخ: 2024**
