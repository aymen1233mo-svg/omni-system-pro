import { app as electronApp, BrowserWindow, ipcMain, dialog, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import expressApp from "./artifacts/api-server/src/app";

// Handle print-silent IPC invocation
ipcMain.handle("print-silent", async (event, printerName: string) => {
  const webContents = event.sender;
  return new Promise((resolve) => {
    webContents.print(
      {
        silent: true,
        printBackground: true,
        deviceName: printerName ? printerName.trim() : "",
      },
      (success, failureReason) => {
        if (!success) {
          console.error("Silent printing failed in main process:", failureReason);
        }
        resolve({ success, failureReason });
      }
    );
  });
});

ipcMain.handle("save-pdf", async (event, { html, title, defaultFileName, pageSize = "A4", landscape = false }) => {
  try {
    const parentWin = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const cleanDefaultName = (defaultFileName || title || "OmniSystem_Document")
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, "_") + ".pdf";

    const defaultDir = electronApp.getPath("documents") || electronApp.getPath("downloads");
    const { canceled, filePath } = await dialog.showSaveDialog(parentWin || undefined as any, {
      title: "حفظ مستند PDF - تحديد مسار واسم الملف",
      defaultPath: path.join(defaultDir, cleanDefaultName),
      filters: [
        { name: "ملفات PDF (*.pdf)", extensions: ["pdf"] },
        { name: "جميع الملفات (*.*)", extensions: ["*"] }
      ],
      properties: ["showOverwriteConfirmation", "createDirectory"]
    });

    if (canceled || !filePath) {
      return { canceled: true };
    }

    const targetFilePath = filePath.toLowerCase().endsWith(".pdf") ? filePath : `${filePath}.pdf`;

    const printWin = new BrowserWindow({
      show: false,
      width: 1200,
      height: 900,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const fullHtml = html.includes("<!DOCTYPE html>") ? html : `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>${title || "مستند PDF"}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap');
    @page {
      size: ${pageSize} ${landscape ? "landscape" : "portrait"};
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
  } catch (err: any) {
    console.error("save-pdf error in main process:", err);
    return {
      success: false,
      error: err.message || "فشل حفظ ملف الـ PDF"
    };
  }
});

ipcMain.handle("open-path", async (event, targetPath: string) => {
  if (!targetPath) return { success: false, error: "المسار غير محدد" };
  try {
    const res = await shell.openPath(targetPath);
    return { success: !res, error: res };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("print-html", async (event, { html, title = "طباعة مستند", silent = false, deviceName = "" }) => {
  let printWin: BrowserWindow | null = null;
  try {
    if (!html) return { success: false, error: "لا يوجد محتوى للطباعة" };
    printWin = new BrowserWindow({
      show: false,
      width: 1100,
      height: 850,
      title: title,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await new Promise(r => setTimeout(r, 450));

    return await new Promise((resolve) => {
      if (!printWin || printWin.isDestroyed()) {
        return resolve({ success: false, error: "تم إغلاق نافذة الطباعة" });
      }
      printWin.webContents.print(
        {
          silent: Boolean(silent),
          printBackground: true,
          deviceName: deviceName ? String(deviceName).trim() : ""
        },
        (success, failureReason) => {
          try {
            if (printWin && !printWin.isDestroyed()) {
              printWin.close();
            }
          } catch {}
          resolve({ success, failureReason });
        }
      );
    });
  } catch (err: any) {
    try {
      if (printWin && !printWin.isDestroyed()) printWin.close();
    } catch {}
    return { success: false, error: err.message };
  }
});

ipcMain.handle("show-item-in-folder", async (event, targetPath: string) => {
  if (!targetPath) return { success: false };
  try {
    shell.showItemInFolder(targetPath);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("open-external", async (event, url: string) => {
  if (!url) return { success: false };
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

// In production, set the environment variables before initializing the database
const userDataPath = electronApp.getPath("userData");
const dbPath = path.join(userDataPath, "pos.db");
process.env.DB_PATH = dbPath;

// Set FRONTEND_DIST to the path where Vite builds the frontend
const isDev = process.env.NODE_ENV === "development";
const frontendDistPath = isDev
  ? path.resolve(process.cwd(), "artifacts/pos-system/dist/public")
  : path.join(electronApp.getAppPath(), "artifacts/pos-system/dist/public");

process.env.FRONTEND_DIST = frontendDistPath;

let mainWindow: BrowserWindow | null = null;
let server: any = null;
const childWindows = new Set<BrowserWindow>();

function createPosWindow(token?: string) {
  const posWin = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 700,
    title: "Omni System Pro ERP — نقطة البيع (شاشة كاشير مستقلة)",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  childWindows.add(posWin);

  const cleanToken = token ? String(token).trim() : "";
  const targetUrl = cleanToken
    ? `http://127.0.0.1:3000/pos?auth_token=${encodeURIComponent(cleanToken)}`
    : `http://127.0.0.1:3000/pos`;

  posWin.webContents.on("did-finish-load", () => {
    if (cleanToken) {
      posWin.webContents.executeJavaScript(`
        try {
          localStorage.setItem("pos_token", ${JSON.stringify(cleanToken)});
          sessionStorage.setItem("pos_token", ${JSON.stringify(cleanToken)});
        } catch(e) {}
      `).catch(() => {});
    }
  });

  posWin.on("closed", () => {
    childWindows.delete(posWin);
  });

  posWin.loadURL(targetUrl);
  return posWin;
}

ipcMain.handle("open-pos-window", async (event, { token } = {}) => {
  try {
    const activeToken = token || (mainWindow ? await mainWindow.webContents.executeJavaScript(`localStorage.getItem("pos_token") || sessionStorage.getItem("pos_token") || ""`).catch(() => "") : "");
    createPosWindow(activeToken);
    return { success: true };
  } catch (err: any) {
    console.error("Failed to open POS window in Electron:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("open-window", async (event, { url, title, token }: any = {}) => {
  try {
    if (!url || url.includes("pos")) {
      createPosWindow(token);
      return { success: true };
    }
    const fullUrl = url.startsWith("http") ? url : `http://127.0.0.1:3000${url.startsWith("/") ? "" : "/"}${url}`;
    const win = new BrowserWindow({
      width: 1280,
      height: 800,
      title: title || "Omni System Pro ERP",
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.cjs"),
      },
    });
    childWindows.add(win);
    win.loadURL(fullUrl);
    win.on("closed", () => childWindows.delete(win));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

function startServer(port: number) {
  return new Promise<void>((resolve, reject) => {
    server = expressApp.listen(port, "127.0.0.1", () => {
      console.log(`Server started internally on port ${port}`);
      resolve();
    });
    server.on("error", (err: any) => {
      reject(err);
    });
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Omni System Pro ERP — نظام إدارة المخازن والمبيعات والحسابات المتكامل",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  const appUrl = "http://127.0.0.1:3000/login";

  await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>جاري إقلاع النظام...</title>
      <style>
        body { font-family: Tahoma, Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: #fff; margin: 0; }
        .spinner { width: 50px; height: 50px; border: 5px solid rgba(255,255,255,0.2); border-top-color: #f59e0b; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        h2 { margin-top: 20px; font-size: 18px; color: #f8fafc; }
        p { color: #94a3b8; font-size: 13px; margin-top: 5px; }
      </style>
    </head>
    <body>
      <div class="spinner"></div>
      <h2>جاري إقلاع وتشغيل نظام OmniSystem Pro ERP...</h2>
      <p>يرجى الانتظار لحظات ريثما يتم تجهيز الخادم وقاعدة البيانات المحلية</p>
    </body>
    </html>
  `)}`);

  const checkServerAndLoad = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    
    http.get("http://127.0.0.1:3000/api/health", (res) => {
      if (res.statusCode === 200) {
        mainWindow?.loadURL(appUrl).catch(() => {
          setTimeout(checkServerAndLoad, 800);
        });
      } else {
        setTimeout(checkServerAndLoad, 800);
      }
    }).on("error", () => {
      setTimeout(checkServerAndLoad, 800);
    });
  };

  setTimeout(checkServerAndLoad, 400);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

electronApp.whenReady().then(async () => {
  const port = 3000;
  
  try {
    await startServer(port);
  } catch (err) {
    console.error("Failed to start server:", err);
  }

  createWindow();

  electronApp.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

electronApp.on("window-all-closed", () => {
  if (server) {
    server.close();
  }
  electronApp.quit();
});
