/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Language, DatabaseType } from '../types';
import { HelpCircle, ChevronDown, ChevronUp, BookOpen, AlertCircle, Sparkles, FolderTree, Database, Cpu, Terminal } from 'lucide-react';

interface GuideSectionProps {
  language: Language;
  selectedDb: DatabaseType;
}

export const GuideSection: React.FC<GuideSectionProps> = ({ language, selectedDb }) => {
  const [openStep, setOpenStep] = useState<number | null>(1);

  const translations = {
    ar: {
      title: 'دليل الدمج وبناء التطبيق التنفيذي (EXE)',
      intro: 'هذا الدليل يوضح لك الخطوات التفصيلية لدمج كود Electron المولد في مشروعك المكون من مستودع متعدد (Monorepo) وتجميع السيرفر والواجهات في ملف exe واحد ذو كفاءة تشغيلية ممتازة.',
      step1: 'الخطوة 1: تهيئة هيكلية المجلدات بالمستودع',
      step2: 'الخطوة 2: تثبيت الحزم المطلوبة للدمج',
      step3: 'الخطوة 3: معضلة بناء الواجهات وتشغيلها Offline (هام جداً)',
      step4: 'الخطوة 4: إدارة قواعد البيانات المحلية والمحمول للأوفلاين',
      step5: 'الخطوة 5: تشغيل التطبيق محلياً وبنائه النهائي لـ Windows',
      prosTip: 'نصيحة المحترفين لحفظ البيانات:',
      prosTipDesc: 'لا تحفظ ملف قاعدة البيانات (مثل SQLite) داخل مجلد البرنامج الأساسي! لأن أنظمة تشغيل ويندوز تحمي المجلد C:\\Program Files ضد الكتابة، كما أن التحديثات القادمة للبرنامج ستمسح الملف. بدلاً من ذلك، استخدم الكود أدناه في السيرفر أو عبر Electron لتوجيه المسار لمجلد بيانات المستخدم الآمن:',
      sqlitePathCode: 'const dbPath = path.join(app.getPath(\'userData\'), \'pos-database.db\');',
      folderStructure: 'الهيكل المقترح للمستودع (Monorepo Folder Tree):',
      buildIntro: 'لتحقيق تشغيل مثالي، ننصحك باتباع الآتي:'
    },
    en: {
      title: 'Monorepo Integration & EXE Build Guide',
      intro: 'This guide details the step-by-step procedures to integrate the generated Electron code into your existing Monorepo POS, and bundle the backend and frontend into a single cohesive, highly optimized .exe installer.',
      step1: 'Step 1: Setting up the Monorepo Folder Structure',
      step2: 'Step 2: Installing the Packaging Dependencies',
      step3: 'Step 3: Frontend Compilation Paradigm (Crucial Offline Tip)',
      step4: 'Step 4: Handling Portable Database State',
      step5: 'Step 5: Testing locally & Bundling Windows Executable',
      prosTip: 'Pro-Tip for Data Storage:',
      prosTipDesc: 'Do NOT store your local database (e.g. SQLite) inside the application installation directory! Windows restricts writing to C:\\Program Files, and updating your app will wipe the database. Instead, resolve your DB path dynamically using Electron\'s safe user data path:',
      sqlitePathCode: 'const dbPath = path.join(app.getPath(\'userData\'), \'pos-database.db\');',
      folderStructure: 'Suggested Folder Tree (Monorepo Structure):',
      buildIntro: 'For pristine local desktop execution, follow these guidelines:'
    }
  };
  const t = translations[language];

  const steps = [
    {
      id: 1,
      titleAr: translations.ar.step1,
      titleEn: translations.en.step1,
      icon: FolderTree,
      contentAr: (
        <div className="space-y-4 text-right" dir="rtl">
          <p className="text-white/60 text-xs leading-relaxed">
            ننصحك بإنشاء مجلد مخصص يدعى <code className="bg-[#141414] border border-white/5 px-1.5 py-0.5 rounded text-[#f27d26] font-mono text-[11px]">electron</code> في جذر المستودع الخاص بك لجمع ملفات التشغيل والسبلاش بشكل منظم ومنفصل عن وحدات العمل الفرعية:
          </p>
          <div className="bg-[#080808] border border-white/5 text-[#e0d8d0]/80 p-4 rounded-2xl font-mono text-xs text-left" dir="ltr">
            {`my-pos-monorepo/
├── package.json (الجذر لتهيئة مونو ريبو)
├── electron/
│   ├── main.js        <- الصق كود main المولد هنا
│   ├── splash.html    <- الصق واجهة السبلاش هنا
│   └── icon.ico       <- أيقونة تطبيق سطح المكتب الخاصة بك
├── api-server/        <- مجلد الخادم الخلفي (Node.js Workspace)
│   ├── dist/
│   │   └── index.mjs  <- الملف البرمجي التنفيذي المجمع
│   └── package.json
└── pos-system/        <- مجلد الواجهات الأمامية (Vite Workspace)
    ├── dist/
    │   └── index.html <- ملف واجهات الويب الساكنة بعد البناء
    └── package.json`}
          </div>
        </div>
      ),
      contentEn: (
        <div className="space-y-4 text-left" dir="ltr">
          <p className="text-white/60 text-xs leading-relaxed">
            We recommend setting up a dedicated <code className="bg-[#141414] border border-white/5 px-1.5 py-0.5 rounded text-[#f27d26] font-mono text-[11px]">electron</code> directory in your project root to keep the launcher code tidy and separate from backend and frontend workspaces:
          </p>
          <div className="bg-[#080808] border border-white/5 text-[#e0d8d0]/80 p-4 rounded-2xl font-mono text-xs">
            {`my-pos-monorepo/
├── package.json (root workspace descriptor)
├── electron/
│   ├── main.js        <- Paste the generated main script here
│   ├── splash.html    <- Paste the custom splash HTML here
│   └── icon.ico       <- Put your logo icon here (Windows ICO format)
├── api-server/        <- Backend API Workspace
│   ├── dist/
│   │   └── index.mjs  <- Compiled backend file
│   └── package.json
└── pos-system/        <- Frontend Vite UI Workspace
    ├── dist/
    │   └── index.html <- Generated production build static files
    └── package.json`}
          </div>
        </div>
      )
    },
    {
      id: 2,
      titleAr: translations.ar.step2,
      titleEn: translations.en.step2,
      icon: Cpu,
      contentAr: (
        <div className="space-y-3 text-right" dir="rtl">
          <p className="text-white/60 text-xs leading-relaxed">
            قم بالدخول إلى جذر مشروعك وتثبيت حزمة <code className="bg-[#141414] border border-white/5 px-1 py-0.5 rounded text-[#f27d26] font-mono text-[11px]">electron</code> بالإضافة لأداة التجميع <code className="bg-[#141414] border border-white/5 px-1 py-0.5 rounded text-[#f27d26] font-mono text-[11px]">electron-builder</code> كإعتمادات تطوير:
          </p>
          <div className="bg-[#080808] border border-white/5 text-emerald-400 p-4 rounded-2xl font-mono text-xs text-left" dir="ltr">
            {`# إذا كنت تستخدم pnpm (كما في السجلات المرفقة):
pnpm add -D electron electron-builder wait-on -w

# أو إذا كنت تستخدم npm العادي:
npm install --save-dev electron electron-builder wait-on`}
          </div>
          <p className="text-white/40 text-[11px] leading-relaxed">
            ملاحظة: حزمة <code className="bg-[#141414] px-1 rounded text-white/60 font-mono text-[10px]">wait-on</code> اختيارية ومفيدة جداً في بيئة التطوير للانتظار لحين بدء منافذ الـ API قبل فتح واجهة مستخدم Electron.
          </p>
        </div>
      ),
      contentEn: (
        <div className="space-y-3 text-left" dir="ltr">
          <p className="text-white/60 text-xs leading-relaxed">
            Navigate to your monorepo workspace root directory and install <code className="bg-[#141414] border border-white/5 px-1 py-0.5 rounded text-[#f27d26] font-mono text-[11px]">electron</code> and <code className="bg-[#141414] border border-white/5 px-1 py-0.5 rounded text-[#f27d26] font-mono text-[11px]">electron-builder</code> as development dependencies:
          </p>
          <div className="bg-[#080808] border border-white/5 text-emerald-400 p-4 rounded-2xl font-mono text-xs">
            {`# If utilizing pnpm (as seen in your command logs):
pnpm add -D electron electron-builder wait-on -w

# Standard NPM command:
npm install --save-dev electron electron-builder wait-on`}
          </div>
          <p className="text-white/40 text-[11px] leading-relaxed">
            Note: The <code className="bg-[#141414] px-1 rounded text-white/60 font-mono text-[10px]">wait-on</code> package is optional but highly helpful during dev configurations to synchronize launching sequences.
          </p>
        </div>
      )
    },
    {
      id: 3,
      titleAr: translations.ar.step3,
      titleEn: translations.en.step3,
      icon: Sparkles,
      contentAr: (
        <div className="space-y-4 text-right" dir="rtl">
          <div className="p-3.5 bg-[#f27d26]/5 border border-[#f27d26]/20 rounded-xl flex items-start gap-2.5 text-xs text-white leading-relaxed">
            <AlertCircle className="w-5 h-5 text-[#f27d26] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white">القاعدة الذهبية لتطبيقات سطح المكتب المستقلة:</span>
              <p className="mt-1 text-white/70">
                تجنب تشغيل سيرفر الـ Vite التنموي (مثل <code className="bg-[#141414] px-1 rounded text-[#f27d26] font-mono text-[10px]">vite --host</code>) داخل التطبيق المجمع بالإنتاج النهائي للعملاء! تشغيل سيرفرين بالخلفية يهلك معالج العميل وموارده ويزيد حجم الـ EXE بشكل غير مبرر.
              </p>
            </div>
          </div>
          
          <h4 className="font-bold text-xs text-white/90">{translations.ar.buildIntro}</h4>
          <ol className="list-decimal list-inside text-xs text-white/60 space-y-2 leading-relaxed">
            <li>
              قم ببناء واجهة الـ Vite إلى ملفات ساكنة أولاً داخل مجلد الواجهات عن طريق تشغيل أمر:{' '}
              <code className="bg-[#141414] px-1.5 py-0.5 rounded text-[#f27d26] font-mono text-[11px]">pnpm build</code>. سينتج لك هذا الأمر مجلد <code className="bg-[#141414] px-1 rounded text-white/60 font-mono text-[10px]">dist</code> يحتوي على ملف <code className="bg-[#141414] px-1 rounded text-white/60 font-mono text-[10px]">index.html</code> وملفات أصول CSS/JS مبنية بالكامل ومضغوطة.
            </li>
            <li>
              داخل ملف كود Electron الرئيسي (<code className="bg-[#141414] px-1 rounded text-white/60 font-mono text-[10px]">main.js</code>)، وجّه التطبيق لتحميل الملف الساكن مباشرة عبر الدالة:{' '}
              <code className="bg-[#141414] px-1.5 py-0.5 rounded text-[#f27d26] font-mono text-[11px]">mainWindow.loadFile('path-to-dist/index.html')</code>.
            </li>
            <li>
              السيرفر الخلفي (API Server) فقط هو من يحتاج إلى تشغيل كخادم خلفي مستقل يستمع للمنفذ الخاص بك (مثلاً 8080) لخدمة الطلبات، وقواعد البيانات. والواجهة الساكنة المحملة داخل تطبيق Electron تقوم بمراسلة السيرفر المحلي بشكل طبيعي جداً عن طريق استدعاء <code className="bg-[#141414] px-1 rounded text-[#f27d26] font-mono text-[10px]">fetch('http://localhost:8080/api/...')</code>.
            </li>
          </ol>
        </div>
      ),
      contentEn: (
        <div className="space-y-4 text-left" dir="ltr">
          <div className="p-3.5 bg-[#f27d26]/5 border border-[#f27d26]/20 rounded-xl flex items-start gap-2.5 text-xs text-white leading-relaxed">
            <AlertCircle className="w-5 h-5 text-[#f27d26] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white">The Golden Rule of Standalone Desktop Apps:</span>
              <p className="mt-1 text-white/70">
                Do NOT run the Vite local dev server (e.g. <code className="bg-[#141414] px-1 rounded text-[#f27d26] font-mono text-[10px]">vite --host</code>) inside your production .exe bundle! Spawning two background node servers takes excessive RAM and crashes easily.
              </p>
            </div>
          </div>
          
          <h4 className="font-bold text-xs text-white/90">{translations.en.buildIntro}</h4>
          <ol className="list-decimal list-inside text-xs text-white/60 space-y-2 leading-relaxed">
            <li>
              Compile your Vite frontend into optimized static assets first inside the UI workspace using:{' '}
              <code className="bg-[#141414] px-1.5 py-0.5 rounded text-[#f27d26] font-mono text-[11px]">pnpm build</code>. This generates a clean, single-page <code className="bg-[#141414] px-1 rounded text-white/60 font-mono text-[10px]">dist/</code> directory containing optimized html, css, and js assets.
            </li>
            <li>
              In your Electron main script (<code className="bg-[#141414] px-1 rounded text-white/60 font-mono text-[10px]">main.js</code>), load the static html directly using:{' '}
              <code className="bg-[#141414] px-1.5 py-0.5 rounded text-[#f27d26] font-mono text-[11px]">mainWindow.loadFile('path/to/dist/index.html')</code>.
            </li>
            <li>
              Only the Node API server needs to run as a backend service listening on its port (e.g. 8080). The offline static HTML page running inside the Electron browser window sends HTTP fetch requests directly to <code className="bg-[#141414] px-1 rounded text-[#f27d26] font-mono text-[10px]">fetch('http://localhost:8080/api/...')</code> seamlessly!
            </li>
          </ol>
        </div>
      )
    },
    {
      id: 4,
      titleAr: translations.ar.step4,
      titleEn: translations.en.step4,
      icon: Database,
      contentAr: (
        <div className="space-y-4 text-right" dir="rtl">
          <p className="text-white/60 text-xs leading-relaxed">
            لجعل نظام نقاط البيع يعمل تماماً بدون اتصال انترنت (Offline-First)، يجب أن تكون قاعدة البيانات محمولة ومدمجة محلياً:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="bg-[#0d0d0d] border border-white/5 rounded-xl p-3">
              <span className="font-bold text-white block mb-1">الخيار 1: SQLite3 (موصى به جداً)</span>
              <p className="text-white/50 leading-relaxed text-[11px]">
                قاعدة بيانات علائقية كاملة مدمجة في ملف واحد. يمكنك استخدامها مع Drizzle ORM أو Knex. سريعة وتتحمل مئات الآلاف من المبيعات والمنتجات دون بطء.
              </p>
            </div>
            <div className="bg-[#0d0d0d] border border-white/5 rounded-xl p-3">
              <span className="font-bold text-white block mb-1">الخيار 2: LowDB / JSON File</span>
              <p className="text-white/50 leading-relaxed text-[11px]">
                قاعدة بيانات بسيطة للغاية تقوم بحفظ المخططات في ملف JSON. ممتازة للأنظمة الصغيرة للغاية ومفيدة للمطور لسهولة مراجعة الملف وقراءته.
              </p>
            </div>
          </div>

          <div className="p-4 bg-[#f27d26]/5 border border-[#f27d26]/20 rounded-2xl space-y-2">
            <h5 className="font-bold text-[#f27d26] text-xs flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-[#f27d26] shrink-0" />
              {translations.ar.prosTip}
            </h5>
            <p className="text-white/70 text-[11px] leading-relaxed">
              {translations.ar.prosTipDesc}
            </p>
            <div className="bg-[#080808] border border-white/5 text-[#f27d26] p-3 rounded-xl font-mono text-xs text-left" dir="ltr">
              {`// في السيرفر الخلفي (api-server/server.ts) عند تهيئة قاعدة البيانات:
import { app } from 'electron'; // إذا كنت تدمجه مباشرة
// أو مرر المسار من Electron للسيرفر عبر متغيرات البيئة (Environment Variables):
const dbDirectory = process.env.APPDATA_PATH || process.cwd();
const dbPath = path.join(dbDirectory, 'pos-database.db');`}
            </div>
          </div>
        </div>
      ),
      contentEn: (
        <div className="space-y-4 text-left" dir="ltr">
          <p className="text-white/60 text-xs leading-relaxed">
            To enable complete internet-free (offline-first) local execution, select an embedded database solution that packages directly alongside your app:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="bg-[#0d0d0d] border border-white/5 rounded-xl p-3">
              <span className="font-bold text-white block mb-1">Option 1: SQLite3 (Highly Recommended)</span>
              <p className="text-white/50 leading-relaxed text-[11px]">
                A full-fledged SQL database stored in a single file on disk. High-speed, robust transactional capabilities, compatible with Drizzle ORM.
              </p>
            </div>
            <div className="bg-[#0d0d0d] border border-white/5 rounded-xl p-3">
              <span className="font-bold text-white block mb-1">Option 2: LowDB / Embedded JSON</span>
              <p className="text-white/50 leading-relaxed text-[11px]">
                Extremely lightweight library saving key-value schemas inside simple, plain text JSON files. Simple to implement and inspect locally.
              </p>
            </div>
          </div>

          <div className="p-4 bg-[#f27d26]/5 border border-[#f27d26]/20 rounded-2xl space-y-2">
            <h5 className="font-bold text-[#f27d26] text-xs flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-[#f27d26] shrink-0" />
              {translations.en.prosTip}
            </h5>
            <p className="text-white/70 text-[11px] leading-relaxed">
              {translations.en.prosTipDesc}
            </p>
            <div className="bg-[#080808] border border-white/5 text-[#f27d26] p-3 rounded-xl font-mono text-xs">
              {`// Inside your API server (api-server/server.ts) database connector:
const dbDirectory = process.env.APPDATA_PATH || process.cwd();
const dbPath = path.join(dbDirectory, 'pos-database.db');`}
            </div>
          </div>
        </div>
      )
    },
    {
      id: 5,
      titleAr: translations.ar.step5,
      titleEn: translations.en.step5,
      icon: Terminal,
      contentAr: (
        <div className="space-y-3 text-right" dir="rtl">
          <p className="text-white/60 text-xs leading-relaxed">
            الآن بعد إعداد الملفات، استخدم الأوامر التالية لتجربتها وبناء ملف الـ <code className="bg-[#141414] border border-white/5 px-1.5 py-0.5 rounded text-[#f27d26] font-mono text-[11px]">exe</code> النهائي:
          </p>

          <div className="space-y-3">
            <div>
              <span className="text-[11px] font-semibold text-white/40 block mb-1">أولاً: تشغيل البرنامج محلياً للتأكد من خلوه من الأخطاء:</span>
              <div className="bg-[#080808] border border-white/5 text-emerald-400 p-3 rounded-xl font-mono text-xs text-left" dir="ltr">
                pnpm start
              </div>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-white/40 block mb-1">ثانياً: بناء الواجهات وتجميع النظام كاملاً بملف EXE واحد مستقل:</span>
              <div className="bg-[#080808] border border-white/5 text-emerald-400 p-3 rounded-xl font-mono text-xs text-left" dir="ltr">
                {`# بناء الواجهات إلى ملفات ساكنة أولاً
pnpm build:client

# بناء السيرفر الخلفي
pnpm build:server

# تجميع الملف التنفيذي النهائي لويندوز
pnpm dist:win`}
              </div>
            </div>
          </div>

          <p className="text-white/40 text-[11px] leading-relaxed mt-2">
            سيقوم <code className="bg-[#141414] px-1 rounded text-white/50 font-mono text-[10px]">electron-builder</code> بتجميع الكود بالكامل ووضع ملف الـ EXE النهائي داخل مجلد يدعى <code className="bg-[#141414] px-1 rounded text-[#f27d26] font-mono text-[10px]">dist-desktop/</code> في جذر المستودع. ستجد هناك نسخة تثبيت تقليدية (Installer) ونسخة محمولة (Portable) مجهزة لتعطيها لعملائك لتعمل بنقرة زر واحدة!
          </p>
        </div>
      ),
      contentEn: (
        <div className="space-y-3 text-left" dir="ltr">
          <p className="text-white/60 text-xs leading-relaxed">
            With configuration files prepared, execute the following commands in sequence to test and pack the standalone binary:
          </p>

          <div className="space-y-3">
            <div>
              <span className="text-[11px] font-semibold text-white/40 block mb-1">First: Launch the app in local development workspace:</span>
              <div className="bg-[#080808] border border-white/5 text-emerald-400 p-3 rounded-xl font-mono text-xs">
                pnpm start
              </div>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-white/40 block mb-1">Second: Build frontend static bundles & package binary EXE:</span>
              <div className="bg-[#080808] border border-white/5 text-emerald-400 p-3 rounded-xl font-mono text-xs">
                {`# Compile Vite frontend code into static assets
pnpm build:client

# Compile backend express server
pnpm build:server

# Package everything into a standalone executable installer
pnpm dist:win`}
              </div>
            </div>
          </div>

          <p className="text-white/40 text-[11px] leading-relaxed mt-2">
            The output packaged applications will be written directly inside the <code className="bg-[#141414] px-1 rounded text-[#f27d26] font-mono text-[10px]">dist-desktop/</code> folder. You will find standard setups along with portable builds ready for deployment on any offline Windows system!
          </p>
        </div>
      )
    }
  ];

  return (
    <div className="bg-[#141414] rounded-2xl border border-white/5 p-6 shadow-2xl space-y-6 text-right">
      <div className="flex items-center gap-3 pb-4 border-b border-white/5 justify-end">
        <div className="text-right">
          <h2 className="text-lg font-bold text-white font-serif tracking-tight">{t.title}</h2>
          <p className="text-xs text-white/40 mt-1">{language === 'ar' ? 'بناء وتصدير الواجهات والخوادم' : 'Desktop build guides & strategies'}</p>
        </div>
        <div className="bg-white/5 text-[#f27d26] border border-white/5 p-2 rounded-xl">
          <BookOpen className="w-5 h-5" />
        </div>
      </div>

      <p className="text-xs text-white/50 leading-relaxed text-right" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        {t.intro}
      </p>

      {/* Accordion Steps */}
      <div className="space-y-3">
        {steps.map((step) => {
          const StepIcon = step.icon;
          const isOpen = openStep === step.id;

          return (
            <div key={step.id} className="border border-white/5 bg-[#0d0d0d] rounded-2xl overflow-hidden transition-all duration-300">
              <button
                onClick={() => setOpenStep(isOpen ? null : step.id)}
                className={`w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 transition-colors select-none cursor-pointer ${
                  isOpen ? 'bg-[#f27d26]/5 text-[#f27d26]' : 'text-white/80'
                }`}
              >
                <div className={`flex items-center gap-3 ${language === 'ar' ? 'flex-row' : 'flex-row-reverse'}`}>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                </div>

                <div className={`flex items-center gap-3 ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`p-1.5 rounded-lg shrink-0 ${isOpen ? 'bg-[#f27d26]/10 text-[#f27d26]' : 'bg-white/5 text-white/40'}`}>
                    <StepIcon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold font-sans">
                    {language === 'ar' ? step.titleAr : step.titleEn}
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-2 bg-[#0d0d0d] border-t border-white/5">
                  {language === 'ar' ? step.contentAr : step.contentEn}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
