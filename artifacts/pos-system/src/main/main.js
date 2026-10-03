const { app, BrowserWindow, ipcMain, shell, dialog, utilityProcess } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');

let backendProcess = null;

app.on('before-quit', () => {
  try {
    const { session } = require('electron');
    if (session && session.defaultSession) {
      session.defaultSession.clearStorageData({
        storages: ['cookies', 'sessionstorage']
      }).catch(() => {});
    }
  } catch (e) {}

  if (backendProcess) {
    try {
      if (typeof backendProcess.kill === 'function') {
        backendProcess.kill();
      }
    } catch (e) {}
  }
});

// 1. تأمين وحماية التطبيق من الانهيار الصامت (Global Exception Handlers)
process.on('uncaughtException', (err) => {
  try {
    console.error('Uncaught Exception:', err);
    dialog.showErrorBox('Omni System Pro ERP - Uncaught Exception', err.stack || err.message || String(err));
  } catch (e) {
    console.error('Failed to show error dialog:', e);
  }
  app.quit();
});

process.on('unhandledRejection', (reason) => {
  try {
    console.error('Unhandled Rejection:', reason);
    const msg = reason instanceof Error ? reason.stack || reason.message : String(reason);
    dialog.showErrorBox('Omni System Pro ERP - Unhandled Rejection', msg);
  } catch (e) {
    console.error('Failed to show rejection dialog:', e);
  }
  app.quit();
});

let mainWindow = null;
let mainPort = 3000;

// 2. منع تشغيل أكثر من نسخة في نفس الوقت لحماية قاعدة البيانات من القفل (Single Instance Lock)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  runApp();
}

function setupDatabase() {
  try {
    const userDataPath = app.getPath('userData');
    const dbDir = path.join(userDataPath, 'data');
    const dbPath = path.join(dbDir, 'pos.db');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    if (!fs.existsSync(dbPath) || (fs.existsSync(dbPath) && fs.statSync(dbPath).size === 0)) {
      const appRoot = typeof app.getAppPath === 'function' ? app.getAppPath() : __dirname;
      const unpackedAppRoot = appRoot.includes('.asar') ? appRoot.replace(/\.asar([\\/]?)/, '.asar.unpacked$1') : appRoot;
      const resPath = process.resourcesPath || '';
      const execDir = path.dirname(process.execPath || '');

      const seedCandidates = [
        path.join(unpackedAppRoot, 'artifacts', 'api-server', 'data', 'pos.db'),
        path.join(appRoot, 'artifacts', 'api-server', 'data', 'pos.db'),
        path.join(unpackedAppRoot, 'data', 'pos.db'),
        path.join(appRoot, 'data', 'pos.db'),
        path.join(resPath, 'app.asar.unpacked', 'artifacts', 'api-server', 'data', 'pos.db'),
        path.join(resPath, 'app', 'artifacts', 'api-server', 'data', 'pos.db'),
        path.join(resPath, 'artifacts', 'api-server', 'data', 'pos.db'),
        path.join(execDir, 'resources', 'app.asar.unpacked', 'artifacts', 'api-server', 'data', 'pos.db'),
        path.join(execDir, 'resources', 'app', 'artifacts', 'api-server', 'data', 'pos.db'),
        path.join(__dirname, 'artifacts', 'api-server', 'data', 'pos.db'),
        path.join(__dirname, 'data', 'pos.db'),
        path.join(process.cwd(), 'artifacts', 'api-server', 'data', 'pos.db'),
        path.join(process.cwd(), 'data', 'pos.db')
      ];

      const seedDbPath = seedCandidates.find(p => {
        try {
          return fs.existsSync(p) && fs.statSync(p).size > 0;
        } catch (e) {
          return false;
        }
      });

      if (seedDbPath) {
        fs.copyFileSync(seedDbPath, dbPath);
        console.log('Database successfully seeded from:', seedDbPath);
      } else {
        console.warn('Seed database pos.db not found in candidate paths. Creating fresh database.');
      }
    }
    process.env.DB_PATH = dbPath;
    process.env.OMNISYSTEM_DB_PATH = dbPath;
  } catch (err) {
    console.error('Error setting up database path:', err);
  }
}

function findFreePort(startPort) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(startPort, '127.0.0.1', () => {
      srv.close(() => {
        resolve(startPort);
      });
    });
    srv.on('error', () => {
      resolve(findFreePort(startPort + 1));
    });
  });
}

function startBackend(callback) {
  setupDatabase();
  const appRoot = typeof app.getAppPath === 'function' ? app.getAppPath() : __dirname;
  const unpackedAppRoot = appRoot.includes('.asar') ? appRoot.replace(/\.asar([\\/]?)/, '.asar.unpacked$1') : appRoot;
  const resPath = process.resourcesPath || '';
  const execDir = path.dirname(process.execPath || '');

  const serverCandidates = [
    path.join(unpackedAppRoot, 'dist', 'server.cjs'),
    path.join(appRoot, 'dist', 'server.cjs'),
    path.join(__dirname, 'dist', 'server.cjs'),
    path.join(unpackedAppRoot, 'server.cjs'),
    path.join(appRoot, 'server.cjs'),
    path.join(__dirname, 'server.cjs'),
    path.join(resPath, 'app.asar.unpacked', 'dist', 'server.cjs'),
    path.join(resPath, 'app', 'dist', 'server.cjs'),
    path.join(resPath, 'dist', 'server.cjs'),
    path.join(execDir, 'resources', 'app.asar.unpacked', 'dist', 'server.cjs'),
    path.join(execDir, 'resources', 'app', 'dist', 'server.cjs'),
    path.join(execDir, 'dist', 'server.cjs'),
    path.join(process.cwd(), 'dist', 'server.cjs'),
    path.join(process.cwd(), 'server.cjs')
  ];

  const serverScript = serverCandidates.find(p => {
    try {
      return fs.existsSync(p);
    } catch (e) {
      return false;
    }
  });

  if (!serverScript) {
    console.error('server.cjs not found in any candidate path:', serverCandidates);
    dialog.showErrorBox(
      'Omni System Pro ERP - Critical Error',
      `Could not find the server.cjs backend file in the application package.\n\nChecked Paths:\n${serverCandidates.slice(0, 6).join('\n')}`
    );
    app.quit();
    return;
  }

  console.log('Starting backend server from:', serverScript);

  findFreePort(3000).then((freePort) => {
    process.env.NODE_ENV = 'production';
    process.env.APP_ROOT = appRoot;
    process.env.HOST = '127.0.0.1';
    process.env.ELECTRON_WORKER_PORT = String(freePort);
    process.env.PORT = String(freePort);
    process.env.NO_SERVER_AUTOSTART = 'true';

    // Strategy 1: Direct In-Process require & execution
    let inProcessStarted = false;
    try {
      const serverModule = require(serverScript);
      if (serverModule && typeof serverModule.startServer === 'function') {
        serverModule.startServer(freePort)
          .then(({ port }) => {
            console.log('Local backend started in-process on port:', port);
            mainPort = port;
            inProcessStarted = true;
            callback(port);
          })
          .catch((err) => {
            console.warn('In-process startServer error, falling back to background process:', err.message);
            spawnBackendProcess(serverScript, freePort, callback);
          });
        return;
      }
    } catch (loadErr) {
      console.warn('Direct require of server.cjs failed, falling back to background process:', loadErr.message);
    }

    if (!inProcessStarted) {
      spawnBackendProcess(serverScript, freePort, callback);
    }
  }).catch((err) => {
    console.error('Failed to find a free port:', err);
    dialog.showErrorBox('Omni System Pro ERP - Critical Error', `فشل العثور على منفذ شبكة متاح:\n${err.message}`);
    app.quit();
  });
}

function spawnBackendProcess(serverScript, port, callback) {
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    ELECTRON_WORKER_PORT: String(port),
    PORT: String(port),
    NO_SERVER_AUTOSTART: 'false',
    ELECTRON_RUN_AS_NODE: '1'
  };

  // 1. Try system Node first if available (handles native modules built for system Node ABI)
  try {
    const nodeEnv = { ...env };
    delete nodeEnv.ELECTRON_RUN_AS_NODE;
    const nodeProc = spawn('node', [serverScript], {
      env: nodeEnv,
      stdio: 'pipe',
      windowsHide: true
    });
    let nodeFailed = false;
    nodeProc.on('error', () => {
      nodeFailed = true;
    });
    if (nodeProc.stdout) {
      nodeProc.stdout.on('data', (d) => console.log(`[Backend Node]: ${d}`));
    }
    if (nodeProc.stderr) {
      nodeProc.stderr.on('data', (d) => console.error(`[Backend Node Error]: ${d}`));
    }
    setTimeout(() => {
      if (!nodeFailed && nodeProc.exitCode === null) {
        backendProcess = nodeProc;
        mainPort = port;
        callback(port);
      } else {
        spawnElectronFallback(serverScript, port, env, callback);
      }
    }, 350);
    return;
  } catch (e) {}

  spawnElectronFallback(serverScript, port, env, callback);
}

function spawnElectronFallback(serverScript, port, env, callback) {

  // 1. Try modern Electron utilityProcess (available in Electron 22+)
  if (utilityProcess && typeof utilityProcess.fork === 'function') {
    try {
      console.log('Starting backend via Electron utilityProcess...');
      backendProcess = utilityProcess.fork(serverScript, [], { env, stdio: 'pipe' });
      
      if (backendProcess.stdout) {
        backendProcess.stdout.on('data', (d) => console.log(`[Backend Server]: ${d}`));
      }
      if (backendProcess.stderr) {
        backendProcess.stderr.on('data', (d) => console.error(`[Backend Server Error]: ${d}`));
      }
      backendProcess.on('error', (err) => {
        console.error('utilityProcess error:', err);
      });
      backendProcess.on('exit', (code) => {
        console.warn('utilityProcess exited with code:', code);
      });

      mainPort = port;
      callback(port);
      return;
    } catch (uErr) {
      console.warn('utilityProcess.fork failed, trying standalone process.execPath:', uErr.message);
    }
  }

  // 2. Try spawning process.execPath with ELECTRON_RUN_AS_NODE=1 (Uses Electron's built-in Node runtime, never fails with spawn node ENOENT!)
  try {
    console.log('Starting backend via Electron process.execPath fallback...');
    backendProcess = spawn(process.execPath, [serverScript], {
      env,
      stdio: 'pipe',
      windowsHide: true
    });

    if (backendProcess.stdout) {
      backendProcess.stdout.on('data', (d) => console.log(`[Backend Server]: ${d}`));
    }
    if (backendProcess.stderr) {
      backendProcess.stderr.on('data', (d) => console.error(`[Backend Server Error]: ${d}`));
    }
    backendProcess.on('error', (spawnErr) => {
      console.error('Failed to spawn backend process:', spawnErr);
      dialog.showErrorBox(
        'Omni System Pro ERP - Critical Error',
        `فشل تشغيل خادم النظام المحلي:\n${spawnErr.message}`
      );
      app.quit();
    });

    mainPort = port;
    callback(port);
  } catch (err) {
    console.error('All backend startup strategies failed:', err);
    dialog.showErrorBox('Omni System Pro ERP - Critical Error', `تعذر تشغيل الخادم الداخلي للتطبيق:\n${err.message}`);
    app.quit();
  }
}

function checkServerReady(url, callback, attempts = 0) {
  if (attempts > 75) { // 15 seconds
    dialog.showErrorBox('Omni System Pro ERP - Critical Error', 'The application local backend server took too long to start (timeout after 15 seconds).');
    app.quit();
    return;
  }
  http.get(url, (res) => {
    if (res.statusCode >= 200 && res.statusCode < 500) {
      callback();
    } else {
      setTimeout(() => checkServerReady(url, callback, attempts + 1), 200);
    }
  }).on('error', () => {
    setTimeout(() => checkServerReady(url, callback, attempts + 1), 200);
  });
}

function createWindow() {
  const appRoot = typeof app.getAppPath === 'function' ? app.getAppPath() : __dirname;
  const preloadCandidates = [
    path.join(__dirname, 'preload.cjs'),
    path.join(appRoot, 'preload.cjs'),
    path.join(process.resourcesPath || '', 'app', 'preload.cjs'),
    path.join(process.resourcesPath || '', 'preload.cjs'),
    path.join(process.cwd(), 'preload.cjs')
  ];
  const preloadPath = preloadCandidates.find(p => fs.existsSync(p)) || path.join(__dirname, 'preload.cjs');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Omni System Pro ERP — نظام إدارة المخازن والمبيعات والحسابات المتكامل',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    show: false,
    autoHideMenuBar: true
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
    
    // افتح أدوات المطورين تلقائياً في بيئة التطوير لتسهيل استكشاف الأخطاء
    if (!app.isPackaged) {
      mainWindow.webContents.openDevTools();
    }
  });

  // إضافة اختصار F12 و Ctrl+Shift+I لفتح أدوات المطورين، و F5 / Ctrl+R للتحديث
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    } else if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
      mainWindow.webContents.reload();
      event.preventDefault();
    }
  });

  // التقاط وطباعة أخطاء تحميل الصفحة داخل التطبيق
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`Page load failed: ${validatedURL} with error ${errorCode} (${errorDescription})`);
    if (errorCode === -102 || errorCode === -105 || errorCode === -106) {
      setTimeout(() => {
        if (mainWindow) {
          mainWindow.loadURL(validatedURL);
        }
      }, 1000);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', () => {
    try {
      mainWindow.webContents.executeJavaScript(`
        try {
          sessionStorage.clear();
          localStorage.removeItem("pos_token");
          localStorage.removeItem("token");
        } catch(e) {}
      `).catch(() => {});
    } catch (e) {}
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// IPC HANDLERS: PDF FILE SAVING & SYSTEM INTEGRATION
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('save-pdf', async (event, { html, title, defaultFileName, pageSize = 'A4', landscape = false }) => {
  try {
    const parentWin = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const cleanDefaultName = (defaultFileName || title || 'OmniSystem_Document')
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, '_') + '.pdf';

    const defaultDir = app.getPath('documents') || app.getPath('downloads');
    const { canceled, filePath } = await dialog.showSaveDialog(parentWin, {
      title: 'حفظ مستند PDF - تحديد مسار واسم الملف',
      defaultPath: path.join(defaultDir, cleanDefaultName),
      filters: [
        { name: 'ملفات PDF (*.pdf)', extensions: ['pdf'] },
        { name: 'جميع الملفات (*.*)', extensions: ['*'] }
      ],
      properties: ['showOverwriteConfirmation', 'createDirectory']
    });

    if (canceled || !filePath) {
      return { canceled: true };
    }

    // Ensure .pdf extension
    const targetFilePath = filePath.toLowerCase().endsWith('.pdf') ? filePath : `${filePath}.pdf`;

    // Create a hidden offscreen window to render the HTML into clean, high-resolution PDF
    const printWin = new BrowserWindow({
      show: false,
      width: 1200,
      height: 900,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const fullHtml = html.includes('<!DOCTYPE html>') ? html : `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>${title || 'مستند PDF'}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap');
    @page {
      size: ${pageSize} ${landscape ? 'landscape' : 'portrait'};
      margin: 10mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Tajawal', 'Cairo', 'Segoe UI', Tahoma, sans-serif;
      color: #0f172a;
      background: #ffffff !important;
      margin: 0;
      padding: 10px;
      font-size: 10pt;
      line-height: 1.4;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .no-print { display: none !important; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th, td { border: 1px solid #94a3b8 !important; padding: 6px 8px !important; text-align: right !important; }
    th { background-color: #f1f5f9 !important; font-weight: bold !important; color: #0f172a !important; }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;

    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);
    // Allow brief time for fonts and layouts to settle
    await new Promise(r => setTimeout(r, 450));

    const pdfData = await printWin.webContents.printToPDF({
      pageSize: pageSize,
      landscape: landscape,
      printBackground: true,
      margins: {
        top: 0.4,
        bottom: 0.4,
        left: 0.4,
        right: 0.4
      }
    });

    fs.writeFileSync(targetFilePath, pdfData);
    printWin.close();

    return {
      success: true,
      filePath: targetFilePath,
      fileName: path.basename(targetFilePath)
    };
  } catch (err) {
    console.error('save-pdf error in main process:', err);
    return {
      success: false,
      error: err.message || 'فشل حفظ ملف الـ PDF'
    };
  }
});

ipcMain.handle('open-path', async (event, targetPath) => {
  if (!targetPath) return { success: false, error: 'المسار غير محدد' };
  try {
    const res = await shell.openPath(targetPath);
    return { success: !res, error: res };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('show-item-in-folder', async (event, targetPath) => {
  if (!targetPath) return { success: false };
  try {
    shell.showItemInFolder(targetPath);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('open-external', async (event, url) => {
  if (!url) return { success: false };
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('print-silent', async (event, printerName) => {
  const webContents = event.sender;
  return new Promise((resolve) => {
    webContents.print(
      {
        silent: true,
        printBackground: true,
        deviceName: printerName ? printerName.trim() : '',
      },
      (success, failureReason) => {
        resolve({ success, failureReason });
      }
    );
  });
});

function runApp() {
  app.whenReady().then(async () => {
    try {
      const { session } = require('electron');
      if (session && session.defaultSession) {
        await session.defaultSession.clearStorageData({
          storages: ['cookies', 'serviceworkers', 'cachestorage']
        });
      }
    } catch (e) {}

    // 1. ابدأ تشغيل السيرفر وقاعدة البيانات في الخلفية أولاً
    startBackend((port) => {
      // 2. انتظر حتى يستجيب السيرفر وقاعدة البيانات عبر /api/health ثم افتح نافذة التطبيق مباشرة على صفحة تسجيل الدخول
      checkServerReady(`http://127.0.0.1:${port}/api/health`, () => {
        createWindow();
        if (mainWindow) {
          mainWindow.loadURL(`http://127.0.0.1:${port}/login`);
        }
      });
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
        if (mainWindow) {
          mainWindow.loadURL(`http://127.0.0.1:${mainPort}/login`);
        }
      }
    });
  });

  app.on('before-quit', async () => {
    try {
      const { session } = require('electron');
      if (session && session.defaultSession) {
        await session.defaultSession.clearStorageData({
          storages: ['cookies', 'sessionstorage']
        });
      }
    } catch (e) {}
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
