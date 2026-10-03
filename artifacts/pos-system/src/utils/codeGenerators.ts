/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppConfig } from '../types';

export const getThemeColors = (theme: AppConfig['splashTheme']) => {
  switch (theme) {
    case 'midnight':
      return {
        bg: 'from-slate-900 to-indigo-950',
        cardBg: 'bg-slate-900/80',
        text: 'text-white',
        subtext: 'text-slate-300',
        accent: 'bg-indigo-500',
        accentText: 'text-indigo-400',
        border: 'border-indigo-500/30',
        hexBg: '#0f172a',
        hexAccent: '#6366f1',
        hexText: '#ffffff',
        hexSubtext: '#cbd5e1'
      };
    case 'emerald':
      return {
        bg: 'from-zinc-950 to-emerald-950',
        cardBg: 'bg-emerald-950/80',
        text: 'text-white',
        subtext: 'text-emerald-100',
        accent: 'bg-emerald-500',
        accentText: 'text-emerald-400',
        border: 'border-emerald-500/30',
        hexBg: '#09090b',
        hexAccent: '#10b981',
        hexText: '#ffffff',
        hexSubtext: '#d1fae5'
      };
    case 'charcoal':
      return {
        bg: 'from-neutral-900 to-neutral-950',
        cardBg: 'bg-neutral-900/80',
        text: 'text-white',
        subtext: 'text-neutral-400',
        accent: 'bg-sky-500',
        accentText: 'text-sky-400',
        border: 'border-neutral-700/50',
        hexBg: '#171717',
        hexAccent: '#0ea5e9',
        hexText: '#ffffff',
        hexSubtext: '#a3a3a3'
      };
    case 'purple':
      return {
        bg: 'from-slate-950 to-purple-950',
        cardBg: 'bg-purple-950/80',
        text: 'text-white',
        subtext: 'text-purple-200',
        accent: 'bg-purple-500',
        accentText: 'text-purple-400',
        border: 'border-purple-500/30',
        hexBg: '#020617',
        hexAccent: '#a855f7',
        hexText: '#ffffff',
        hexSubtext: '#e9d5ff'
      };
    case 'amber':
      return {
        bg: 'from-zinc-950 to-amber-950',
        cardBg: 'bg-amber-950/80',
        text: 'text-amber-50',
        subtext: 'text-amber-200/80',
        accent: 'bg-amber-500',
        accentText: 'text-amber-400',
        border: 'border-amber-500/30',
        hexBg: '#09090b',
        hexAccent: '#f59e0b',
        hexText: '#fffbeb',
        hexSubtext: '#fde68a'
      };
    default:
      return {
        bg: 'from-slate-900 to-indigo-950',
        cardBg: 'bg-slate-900/80',
        text: 'text-white',
        subtext: 'text-slate-300',
        accent: 'bg-indigo-500',
        accentText: 'text-indigo-400',
        border: 'border-indigo-500/30',
        hexBg: '#0f172a',
        hexAccent: '#6366f1',
        hexText: '#ffffff',
        hexSubtext: '#cbd5e1'
      };
  }
};

export const generateElectronMain = (config: AppConfig): string => {
  const isLocal = config.clientType === 'local';

  return `/**
 * main.js - ملف التشغيل الرئيسي لـ Electron لربط واجهة المستخدم بالخلفية
 * ----------------------------------------------------------------------
 * هذا الملف يقوم بـ:
 * 1. تشغيل الخادم الخلفي (Node API Server) في الخلفية كعملية فرعية (Subprocess).
 * 2. إظهار شاشة الانتظار (Splash Screen) المنبثقة فوراً.
 * 3. التحقق المتكرر من تشغيل الخادم بنجاح على المنفذ ${config.apiPort}.
 * 4. إغلاق شاشة الانتظار وفتح واجهة المستخدم الأساسية (نظام نقاط البيع) فور تفعيل السيرفر.
 * 5. إنهاء عملية الخادم الخلفي تلقائياً عند إغلاق التطبيق لضمان عدم بقاء منافذ معلقة.
 */

const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow = null;
let splashWindow = null;
let backendProcess = null;
let isQuitting = false;

// دالة لفحص جاهزية الخادم الخلفي بطلب HTTP GET بسيط
function checkServerReady(callback) {
  const options = {
    hostname: 'localhost',
    port: ${config.apiPort},
    path: '/api/health', // أو أي مسار اختبار بسيط في السيرفر الخاص بك
    method: 'GET',
    timeout: 1000
  };

  const req = http.request(options, (res) => {
    if (res.statusCode === 200 || res.statusCode === 404) {
      callback(true); // الخادم جاهز ويستجيب
    } else {
      callback(false);
    }
  });

  req.on('error', () => {
    callback(false); // الخادم غير جاهز بعد
  });

  req.on('timeout', () => {
    req.destroy();
    callback(false);
  });

  req.end();
}

// دالة لتشغيل الخادم الخلفي كعملية فرعية
function startBackendServer() {
  console.log('جاري تشغيل الخادم الخلفي...');
  
  // نحدد مسار ملف الخادم التنفيذي.
  // في بيئة الإنتاج بعد التجميع، غالباً ما يتم وضع الخادم في مجلد مخصص داخل الموارد.
  const isPackaged = app.isPackaged;
  
  let serverPath;
  let command = 'node';
  let args = [];

  if (isPackaged) {
    // بعد تجميع التطبيق، يتم سحب الملفات التنفيذية من مجلد resources (app.asar.unpacked)
    // لتجنب مشاكل تشغيل السيرفر من داخل ملف asar مضغوط مباشرة.
    serverPath = path.join(process.resourcesPath, 'api-server', 'dist', 'index.mjs');
    args = [serverPath];
  } else {
    // في بيئة التطوير المحلية
    serverPath = path.join(__dirname, '..', 'api-server', 'dist', 'index.mjs');
    args = [serverPath];
  }

  try {
    backendProcess = spawn(command, args, {
      env: {
        ...process.env,
        NODE_ENV: isQuitting ? 'development' : 'production',
        PORT: ${config.apiPort}
      },
      shell: true
    });

    backendProcess.stdout.on('data', (data) => {
      console.log(\`[Backend Server]: \${data.toString().trim()}\`);
    });

    backendProcess.stderr.on('data', (data) => {
      console.error(\`[Backend Error]: \${data.toString().trim()}\`);
    });

    backendProcess.on('close', (code) => {
      console.log(\`انتهت عملية السيرفر برمز الخروج: \${code}\`);
      if (!isQuitting && isPackaged) {
        dialog.showErrorBox(
          'خطأ في النظام الخلفي',
          'لقد توقف الخادم الخلفي بشكل مفاجئ. يرجى إعادة تشغيل التطبيق.'
        );
        app.quit();
      }
    });
  } catch (error) {
    console.error('فشل في بدء تشغيل الخادم الخلفي:', error);
    dialog.showErrorBox(
      'فشل بدء الخادم',
      'لم نتمكن من تشغيل الخادم الخلفي للبيانات. التفاصيل: ' + error.message
    );
  }
}

// إنشاء شاشة الانتظار (Splash Window)
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 600,
    height: 400,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    center: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));

  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

// إنشاء النافذة الرئيسية (Main Application Window)
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false, // لا تظهرها فوراً، انتظر حتى يغلق الـ splash
    title: '${config.appName}',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js') // اختياري لربط دوال النظام بصفحة الويب
    }
  });

  // إخفاء القائمة العلوية الافتراضية لمنح التطبيق مظهر احترافي لسطح المكتب
  mainWindow.setMenuBarVisibility(false);

  ${
    isLocal
      ? `// الطريقة الاحترافية للأنظمة المغلقة: تحميل واجهات النظام محلياً كملفات ساكنة
  // يتم بناء واجهات نظام الـ Vite أولاً (npm run build) وينتج مجلد dist داخل pos-system
  // نقوم بنسخه أو الإشارة إليه، وتحميله مباشرة من القرص الصلب.
  const indexPath = path.join(__dirname, '..', 'pos-system', 'dist', 'index.html');
  mainWindow.loadFile(indexPath).catch(err => {
    console.error('فشل تحميل ملف الواجهات المحلي:', err);
    mainWindow.loadURL('http://localhost:${config.clientPort}'); // خيار احتياطي
  });`
      : `// تشغيل الواجهة من خلال سيرفر محلي (للتطوير أو الربط البعيد)
  mainWindow.loadURL('http://localhost:${config.clientPort}');`
  }

  // انتظر حتى يكتمل تحميل صفحة الواجهة ثم اعرضها وأغلق شاشة الانتظار
  mainWindow.once('ready-to-show', () => {
    if (splashWindow) {
      splashWindow.close();
    }
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// دالة تكرارية لفحص جاهزية السيرفر وبدء تشغيل التطبيق الرئيسي
function pollServerAndStart() {
  let attempts = 0;
  const maxAttempts = ${Math.ceil((config.maxTimeout * 1000) / config.checkInterval)};
  const intervalTime = ${config.checkInterval};

  const interval = setInterval(() => {
    attempts++;
    checkServerReady((isReady) => {
      if (isReady) {
        clearInterval(interval);
        console.log('تم التحقق من تشغيل الخادم بنجاح! جاري فتح الواجهة الرئيسية...');
        createMainWindow();
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        console.error('انتهت مهلة الانتظار. السيرفر الخلفي لا يستجيب.');
        dialog.showMessageBoxSync({
          type: 'error',
          title: 'خطأ في الاتصال بالخادم',
          message: 'فشل التطبيق في الاتصال بالخادم الخلفي للبيانات في الوقت المحدد.\\n\\nيرجى التأكد من عدم استخدام المنفذ ${config.apiPort} من قبل برنامج آخر والمحاولة مجدداً.'
        });
        if (splashWindow) splashWindow.close();
        app.quit();
      } else {
        console.log(\`جاري التحقق من الخادم الخلفي... المحاولة (\${attempts}/\${maxAttempts})\`);
      }
    });
  }, intervalTime);
}

// عند جاهزية Electron، نبدأ تشغيل التطبيق
app.whenReady().then(() => {
  createSplashWindow();
  startBackendServer();
  pollServerAndStart();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSplashWindow();
    }
  });
});

// عند إغلاق كافة النوافذ، نخرج من البرنامج
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// تنظيف العمليات عند الخروج للتأكد من إنهاء السيرفر الخلفي وعدم بقائه عالقاً بالذاكرة
app.on('will-quit', () => {
  isQuitting = true;
  console.log('جاري إغلاق التطبيق وإنهاء العمليات الفرعية...');
  if (backendProcess) {
    // في نظام ويندوز، قتل العملية يتطلب استخدام taskkill لإنهاء شجرة العمليات بالكامل
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', backendProcess.pid, '/f', '/t']);
    } else {
      backendProcess.kill('SIGINT');
    }
  }
});
`;
};

export const generateSplashHtml = (config: AppConfig): string => {
  const colors = getThemeColors(config.splashTheme);
  const isRtl = true; // defaulting splash screen to show nice centered layout

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Loading...</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    
    body {
      background: linear-gradient(135deg, ${colors.hexBg}, #1e1b4b);
      color: ${colors.hexText};
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
      border-radius: 12px; /* يعطي زوايا منحنية إذا تم تمكين شفافية النافذة */
    }

    .splash-container {
      text-align: center;
      padding: 40px;
      width: 100%;
      max-width: 500px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    /* أيقونة متحركة */
    .logo-container {
      margin-bottom: 25px;
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .pulse-glow {
      position: absolute;
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: ${colors.hexAccent};
      opacity: 0.15;
      animation: pulse 2s infinite ease-in-out;
    }

    .logo-icon {
      background: rgba(255, 255, 255, 0.05);
      border: 2px solid ${colors.hexAccent};
      color: ${colors.hexText};
      width: 70px;
      height: 70px;
      border-radius: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 32px;
      font-weight: bold;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      z-index: 2;
    }

    h1 {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 10px;
      letter-spacing: -0.5px;
      background: linear-gradient(to left, #ffffff, ${colors.hexAccent});
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    p {
      color: ${colors.hexSubtext};
      font-size: 14px;
      margin-bottom: 30px;
      font-weight: 300;
      line-height: 1.6;
    }

    /* نمط شريط التحميل */
    ${config.loaderType === 'bar' ? `
    .loader-bar-container {
      width: 100%;
      height: 6px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 15px;
      box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);
    }

    .loader-bar-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(to left, ${colors.hexAccent}, #ffffff);
      border-radius: 10px;
      box-shadow: 0 0 10px ${colors.hexAccent};
      animation: fillProgress 4s cubic-bezier(0.1, 0.8, 0.1, 1) forwards;
    }
    ` : ''}

    /* نمط حلقة الدوران */
    ${config.loaderType === 'spinner' ? `
    .loader-spinner {
      border: 4px solid rgba(255, 255, 255, 0.08);
      border-top: 4px solid ${colors.hexAccent};
      border-radius: 50%;
      width: 45px;
      height: 45px;
      animation: spin 1s linear infinite;
      margin-bottom: 25px;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
    }
    ` : ''}

    /* نمط نبض الموجة */
    ${config.loaderType === 'pulse' ? `
    .loader-pulse-container {
      display: flex;
      justify-content: center;
      gap: 6px;
      margin-bottom: 25px;
      height: 30px;
      align-items: center;
    }

    .loader-pulse-bubble {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: ${colors.hexAccent};
      animation: pulseBubble 1.2s infinite ease-in-out;
    }

    .loader-pulse-bubble:nth-child(2) { animation-delay: 0.2s; }
    .loader-pulse-bubble:nth-child(3) { animation-delay: 0.4s; }
    ` : ''}

    .status-text {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.4);
      font-weight: 400;
      letter-spacing: 0.5px;
    }

    /* حركات الأنيميشن */
    @keyframes pulse {
      0% { transform: scale(0.85); opacity: 0.15; }
      50% { transform: scale(1.2); opacity: 0.35; }
      100% { transform: scale(0.85); opacity: 0.15; }
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    @keyframes pulseBubble {
      0%, 100% { transform: scale(0.6); opacity: 0.4; }
      50% { transform: scale(1.2); opacity: 1; }
    }

    @keyframes fillProgress {
      0% { width: 0%; }
      20% { width: 15%; }
      40% { width: 45%; }
      60% { width: 75%; }
      85% { width: 90%; }
      100% { width: 98%; } /* ندعها تقف عند 98% حتى تغلق النافذة فعلياً من الكود الرئيسي */
    }
  </style>
</head>
<body>

  <div class="splash-container">
    <div class="logo-container">
      <div class="pulse-glow"></div>
      <div class="logo-icon">POS</div>
    </div>

    <h1>${config.splashTitle}</h1>
    <p>${config.splashSubtitle}</p>

    ${config.loaderType === 'bar' ? `
    <div class="loader-bar-container">
      <div class="loader-bar-fill"></div>
    </div>
    ` : ''}

    ${config.loaderType === 'spinner' ? `
    <div class="loader-spinner"></div>
    ` : ''}

    ${config.loaderType === 'pulse' ? `
    <div class="loader-pulse-container">
      <div class="loader-pulse-bubble"></div>
      <div class="loader-pulse-bubble"></div>
      <div class="loader-pulse-bubble"></div>
    </div>
    ` : ''}

    <div class="status-text" id="statusLabel">جاري تهيئة خادم البيانات...</div>
  </div>

  <script>
    // تغيير نصوص حالة التشغيل بمرور الوقت لمحاكاة تقدم الاتصال والتحميل
    const labelsAr = [
      "جاري تشغيل محرك الخادم الخلفي (Node.js)...",
      "جاري فتح الاتصال بقواعد البيانات...",
      "جاري فحص المنفذ ${config.apiPort} للتأكد من جاهزية السيرفر...",
      "جاري الاتصال بنظام المبيعات والخدمات...",
      "اكتمل الاتصال بالنجاح! جاري تحويلك الآن..."
    ];
    
    let index = 0;
    const labelEl = document.getElementById("statusLabel");
    
    const interval = setInterval(() => {
      if (index < labelsAr.length - 1) {
        labelEl.innerText = labelsAr[index];
        index++;
      } else {
        clearInterval(interval);
      }
    }, 1200);
  </script>
</body>
</html>
`;
};

export const generatePackageJson = (config: AppConfig): string => {
  return `{
  "name": "${config.appName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-app",
  "version": "1.0.0",
  "description": "Desktop Application for ${config.appName}",
  "main": "electron/main.js",
  "scripts": {
    "start": "electron .",
    "build:client": "pnpm --filter @workspace/pos-system run build",
    "build:server": "pnpm --filter @workspace/api-server run dev",
    "pack:win": "electron-builder --win --dir",
    "dist:win": "electron-builder --win -c.asar=true",
    "package-all": "pnpm build:client && electron-builder --win"
  },
  "dependencies": {},
  "devDependencies": {
    "electron": "^31.0.0",
    "electron-builder": "^24.13.3"
  },
  "build": {
    "appId": "com.pos.${config.appName.toLowerCase().replace(/[^a-z0-9]/g, '-')}",
    "productName": "${config.appName}",
    "directories": {
      "output": "dist-desktop"
    },
    "win": {
      "target": [
        "nsis",
        "portable"
      ],
      "icon": "electron/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "${config.appName}"
    },
    "files": [
      "electron/**/*",
      "pos-system/dist/**/*",
      "api-server/dist/**/*",
      "node_modules/**/*",
      "package.json"
    ],
    "extraResources": [
      {
        "from": "api-server/dist",
        "to": "api-server/dist",
        "filter": ["**/*"]
      }
    ]
  }
}`;
};

export const generateElectronBuilderYml = (config: AppConfig): string => {
  return `# تكوين تجميع تطبيق الـ Windows ليكون ملف exe أحادي
appId: com.pos.${config.appName.toLowerCase().replace(/[^a-z0-9]/g, '-')}
productName: "${config.appName}"
copyright: "Copyright © 2026 ${config.appName}"

directories:
  output: dist-desktop # المجلد الذي سيوضع فيه ملف الـ exe النهائي

files:
  - "electron/**/*"
  - "pos-system/dist/**/*"
  - "api-server/dist/**/*"
  - "package.json"

extraResources:
  - from: "api-server/dist"
    to: "api-server/dist"

win:
  target:
    - target: nsis # معالج التثبيت التقليدي
      arch:
        - x64
    - target: portable # نسخة محمولة تعمل بمجرد الضغط عليها دون تثبيت!
      arch:
        - x64
  icon: electron/icon.ico # مسار أيقونة البرنامج بتنسيق ico

nsis:
  oneClick: false # التثبيت غير التلقائي لمنح المستخدم خيارات التثبيت
  allowToChangeInstallationDirectory: true # السماح للمستخدم بتغيير مكان التثبيت
  createDesktopShortcut: true # إنشاء اختصار على سطح المكتب تلقائياً
  createStartMenuShortcut: true # إنشاء اختصار في قائمة ابدأ
  shortcutName: "${config.appName}"
  installerIcon: electron/icon.ico
  uninstallerIcon: electron/icon.ico
  uninstallDisplayName: "حذف تثبيت ${config.appName}"
`;
};
