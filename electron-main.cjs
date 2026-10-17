// artifacts/pos-system/src/main/main.js
var { app, BrowserWindow, ipcMain, shell, dialog, utilityProcess } = require("electron");
var path = require("path");
var fs = require("fs");
var http = require("http");
var net = require("net");
var { spawn } = require("child_process");
var backendProcess = null;
app.on("before-quit", () => {
  try {
    const { session } = require("electron");
    if (session && session.defaultSession) {
      session.defaultSession.clearStorageData({
        storages: ["cookies", "sessionstorage"]
      }).catch(() => {
      });
    }
  } catch (e) {
  }
  if (backendProcess) {
    try {
      if (typeof backendProcess.kill === "function") {
        backendProcess.kill();
      }
    } catch (e) {
    }
  }
});
process.on("uncaughtException", (err) => {
  console.error("Non-fatal Uncaught Exception in Electron Main:", err);
});
process.on("unhandledRejection", (reason) => {
  console.warn("Unhandled Rejection in Electron Main (Recovered):", reason);
});
var mainWindow = null;
var mainPort = 3e3;
var gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  runApp();
}
function setupDatabase() {
  try {
    const userDataPath = app.getPath("userData");
    const dbDir = path.join(userDataPath, "omnisystem_v2_data");
    const dbPath = path.join(dbDir, "omnisystem_pro_v2.db");
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    let isFreshInstall = false;
    if (!fs.existsSync(dbPath) || fs.existsSync(dbPath) && fs.statSync(dbPath).size === 0) {
      isFreshInstall = true;
      const appRoot = typeof app.getAppPath === "function" ? app.getAppPath() : __dirname;
      const unpackedAppRoot = appRoot.includes(".asar") ? appRoot.replace(/\.asar([\\/]?)/, ".asar.unpacked$1") : appRoot;
      const resPath = process.resourcesPath || "";
      const execDir = path.dirname(process.execPath || "");
      const seedCandidates = [
        path.join(unpackedAppRoot, "artifacts", "api-server", "data", "omnisystem_pro_v2.db"),
        path.join(appRoot, "artifacts", "api-server", "data", "omnisystem_pro_v2.db"),
        path.join(unpackedAppRoot, "data", "omnisystem_pro_v2.db"),
        path.join(appRoot, "data", "omnisystem_pro_v2.db"),
        path.join(resPath, "app.asar.unpacked", "artifacts", "api-server", "data", "omnisystem_pro_v2.db"),
        path.join(resPath, "artifacts", "api-server", "data", "omnisystem_pro_v2.db"),
        path.join(execDir, "resources", "artifacts", "api-server", "data", "omnisystem_pro_v2.db"),
        path.join(__dirname, "artifacts", "api-server", "data", "omnisystem_pro_v2.db"),
        path.join(__dirname, "data", "omnisystem_pro_v2.db"),
        path.join(process.cwd(), "artifacts", "api-server", "data", "omnisystem_pro_v2.db"),
        path.join(process.cwd(), "data", "omnisystem_pro_v2.db"),
        path.join(unpackedAppRoot, "artifacts", "api-server", "data", "pos.db"),
        path.join(appRoot, "artifacts", "api-server", "data", "pos.db"),
        path.join(unpackedAppRoot, "data", "pos.db"),
        path.join(appRoot, "data", "pos.db"),
        path.join(resPath, "app.asar.unpacked", "artifacts", "api-server", "data", "pos.db"),
        path.join(resPath, "artifacts", "api-server", "data", "pos.db"),
        path.join(process.cwd(), "artifacts", "api-server", "data", "pos.db"),
        path.join(process.cwd(), "data", "pos.db")
      ];
      const seedDbPath = seedCandidates.find((p) => {
        try {
          return fs.existsSync(p) && fs.statSync(p).size > 0;
        } catch (e) {
          return false;
        }
      });
      if (seedDbPath) {
        fs.copyFileSync(seedDbPath, dbPath);
        console.log("Database successfully seeded from:", seedDbPath);
      } else {
        console.warn("Seed database not found in candidate paths. Initializing fresh database.");
      }
    }
    if (isFreshInstall) {
      const legacyCandidates = [
        path.join(userDataPath, "data", "pos.db"),
        path.join(userDataPath, "pos.db"),
        path.join(process.cwd(), "data", "pos.db"),
        path.join(process.cwd(), "pos.db")
      ];
      const legacyDb = legacyCandidates.find((p) => {
        try {
          return fs.existsSync(p) && fs.statSync(p).size > 1e4 && p !== dbPath;
        } catch {
          return false;
        }
      });
      if (legacyDb) {
        console.log("[Auto-Migration] Legacy database detected at:", legacyDb);
        process.env.LEGACY_MIGRATE_DB_PATH = legacyDb;
      }
    }
    process.env.DB_PATH = dbPath;
    process.env.OMNISYSTEM_DB_PATH = dbPath;
  } catch (err) {
    console.error("Error setting up database path:", err);
  }
}
function findFreePort(startPort) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(startPort, "127.0.0.1", () => {
      srv.close(() => {
        resolve(startPort);
      });
    });
    srv.on("error", () => {
      resolve(findFreePort(startPort + 1));
    });
  });
}
function startBackend(callback) {
  setupDatabase();
  const appRoot = typeof app.getAppPath === "function" ? app.getAppPath() : __dirname;
  const unpackedAppRoot = appRoot.includes(".asar") ? appRoot.replace(/\.asar([\\/]?)/, ".asar.unpacked$1") : appRoot;
  const resPath = process.resourcesPath || "";
  const execDir = path.dirname(process.execPath || "");
  const serverCandidates = [
    path.join(unpackedAppRoot, "dist", "server.cjs"),
    path.join(appRoot, "dist", "server.cjs"),
    path.join(__dirname, "dist", "server.cjs"),
    path.join(unpackedAppRoot, "server.cjs"),
    path.join(appRoot, "server.cjs"),
    path.join(__dirname, "server.cjs"),
    path.join(resPath, "app.asar.unpacked", "dist", "server.cjs"),
    path.join(resPath, "app", "dist", "server.cjs"),
    path.join(resPath, "dist", "server.cjs"),
    path.join(execDir, "resources", "app.asar.unpacked", "dist", "server.cjs"),
    path.join(execDir, "resources", "app", "dist", "server.cjs"),
    path.join(execDir, "dist", "server.cjs"),
    path.join(process.cwd(), "dist", "server.cjs"),
    path.join(process.cwd(), "server.cjs")
  ];
  const serverScript = serverCandidates.find((p) => {
    try {
      return fs.existsSync(p);
    } catch (e) {
      return false;
    }
  });
  if (!serverScript) {
    console.error("server.cjs not found in any candidate path:", serverCandidates);
    dialog.showErrorBox(
      "Omni System Pro ERP - Critical Error",
      `Could not find the server.cjs backend file in the application package.

Checked Paths:
${serverCandidates.slice(0, 6).join("\n")}`
    );
    app.quit();
    return;
  }
  console.log("Starting backend server from:", serverScript);
  findFreePort(3e3).then((freePort) => {
    process.env.NODE_ENV = "production";
    process.env.APP_ROOT = appRoot;
    process.env.HOST = "127.0.0.1";
    process.env.ELECTRON_WORKER_PORT = String(freePort);
    process.env.PORT = String(freePort);
    process.env.NO_SERVER_AUTOSTART = "true";
    let inProcessStarted = false;
    try {
      const serverModule = require(serverScript);
      if (serverModule && typeof serverModule.startServer === "function") {
        serverModule.startServer(freePort).then(({ port }) => {
          console.log("Local backend started in-process on port:", port);
          mainPort = port;
          inProcessStarted = true;
          callback(port);
        }).catch((err) => {
          console.warn("In-process startServer error, falling back to background process:", err.message);
          spawnBackendProcess(serverScript, freePort, callback);
        });
        return;
      }
    } catch (loadErr) {
      console.warn("Direct require of server.cjs failed, falling back to background process:", loadErr.message);
    }
    if (!inProcessStarted) {
      spawnBackendProcess(serverScript, freePort, callback);
    }
  }).catch((err) => {
    console.error("Failed to find a free port:", err);
    dialog.showErrorBox("Omni System Pro ERP - Critical Error", `\u0641\u0634\u0644 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0645\u0646\u0641\u0630 \u0634\u0628\u0643\u0629 \u0645\u062A\u0627\u062D:
${err.message}`);
    app.quit();
  });
}
function spawnBackendProcess(serverScript, port, callback) {
  const env = {
    ...process.env,
    NODE_ENV: "production",
    HOST: "127.0.0.1",
    ELECTRON_WORKER_PORT: String(port),
    PORT: String(port),
    NO_SERVER_AUTOSTART: "false",
    ELECTRON_RUN_AS_NODE: "1"
  };
  try {
    const nodeEnv = { ...env };
    delete nodeEnv.ELECTRON_RUN_AS_NODE;
    const nodeProc = spawn("node", [serverScript], {
      env: nodeEnv,
      stdio: "pipe",
      windowsHide: true
    });
    let nodeFailed = false;
    nodeProc.on("error", () => {
      nodeFailed = true;
    });
    if (nodeProc.stdout) {
      nodeProc.stdout.on("data", (d) => console.log(`[Backend Node]: ${d}`));
    }
    if (nodeProc.stderr) {
      nodeProc.stderr.on("data", (d) => console.error(`[Backend Node Error]: ${d}`));
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
  } catch (e) {
  }
  spawnElectronFallback(serverScript, port, env, callback);
}
function spawnElectronFallback(serverScript, port, env, callback) {
  if (utilityProcess && typeof utilityProcess.fork === "function") {
    try {
      console.log("Starting backend via Electron utilityProcess...");
      backendProcess = utilityProcess.fork(serverScript, [], { env, stdio: "pipe" });
      if (backendProcess.stdout) {
        backendProcess.stdout.on("data", (d) => console.log(`[Backend Server]: ${d}`));
      }
      if (backendProcess.stderr) {
        backendProcess.stderr.on("data", (d) => console.error(`[Backend Server Error]: ${d}`));
      }
      backendProcess.on("error", (err) => {
        console.error("utilityProcess error:", err);
      });
      backendProcess.on("exit", (code) => {
        console.warn("utilityProcess exited with code:", code);
      });
      mainPort = port;
      callback(port);
      return;
    } catch (uErr) {
      console.warn("utilityProcess.fork failed, trying standalone process.execPath:", uErr.message);
    }
  }
  try {
    console.log("Starting backend via Electron process.execPath fallback...");
    backendProcess = spawn(process.execPath, [serverScript], {
      env,
      stdio: "pipe",
      windowsHide: true
    });
    if (backendProcess.stdout) {
      backendProcess.stdout.on("data", (d) => console.log(`[Backend Server]: ${d}`));
    }
    if (backendProcess.stderr) {
      backendProcess.stderr.on("data", (d) => console.error(`[Backend Server Error]: ${d}`));
    }
    backendProcess.on("error", (spawnErr) => {
      console.error("Failed to spawn backend process:", spawnErr);
      dialog.showErrorBox(
        "Omni System Pro ERP - Critical Error",
        `\u0641\u0634\u0644 \u062A\u0634\u063A\u064A\u0644 \u062E\u0627\u062F\u0645 \u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u0645\u062D\u0644\u064A:
${spawnErr.message}`
      );
      app.quit();
    });
    mainPort = port;
    callback(port);
  } catch (err) {
    console.error("All backend startup strategies failed:", err);
    dialog.showErrorBox("Omni System Pro ERP - Critical Error", `\u062A\u0639\u0630\u0631 \u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u062E\u0627\u062F\u0645 \u0627\u0644\u062F\u0627\u062E\u0644\u064A \u0644\u0644\u062A\u0637\u0628\u064A\u0642:
${err.message}`);
    app.quit();
  }
}
function checkServerReady(url, callback, attempts = 0) {
  if (attempts > 75) {
    dialog.showErrorBox("Omni System Pro ERP - Critical Error", "The application local backend server took too long to start (timeout after 15 seconds).");
    app.quit();
    return;
  }
  http.get(url, (res) => {
    if (res.statusCode >= 200 && res.statusCode < 500) {
      callback();
    } else {
      setTimeout(() => checkServerReady(url, callback, attempts + 1), 200);
    }
  }).on("error", () => {
    setTimeout(() => checkServerReady(url, callback, attempts + 1), 200);
  });
}
function createWindow() {
  const appRoot = typeof app.getAppPath === "function" ? app.getAppPath() : __dirname;
  const preloadCandidates = [
    path.join(__dirname, "preload.cjs"),
    path.join(appRoot, "preload.cjs"),
    path.join(process.resourcesPath || "", "app", "preload.cjs"),
    path.join(process.resourcesPath || "", "preload.cjs"),
    path.join(process.cwd(), "preload.cjs")
  ];
  const preloadPath = preloadCandidates.find((p) => fs.existsSync(p)) || path.join(__dirname, "preload.cjs");
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "Omni System Pro ERP \u2014 \u0646\u0638\u0627\u0645 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u062E\u0627\u0632\u0646 \u0648\u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A \u0648\u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u0645\u062A\u0643\u0627\u0645\u0644",
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    show: false,
    autoHideMenuBar: true
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
    if (!app.isPackaged) {
      mainWindow.webContents.openDevTools();
    }
  });
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12" || input.control && input.shift && input.key.toLowerCase() === "i") {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    } else if (input.key === "F5" || input.control && input.key.toLowerCase() === "r") {
      mainWindow.webContents.reload();
      event.preventDefault();
    }
  });
  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    console.error(`Page load failed: ${validatedURL} with error ${errorCode} (${errorDescription})`);
    if (errorCode === -102 || errorCode === -105 || errorCode === -106) {
      setTimeout(() => {
        if (mainWindow) {
          mainWindow.loadURL(validatedURL);
        }
      }, 1e3);
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes("127.0.0.1") || url.includes("localhost") || url.startsWith("/") || url.includes("/pos")) {
      mainWindow.webContents.executeJavaScript(`
        localStorage.getItem("pos_token") || sessionStorage.getItem("pos_token") || ""
      `).then((tok) => {
        createPosWindow(tok);
      }).catch(() => {
        createPosWindow("");
      });
      return { action: "deny" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.on("close", () => {
    try {
      mainWindow.webContents.executeJavaScript(`
        try {
          sessionStorage.clear();
          localStorage.removeItem("pos_token");
          localStorage.removeItem("token");
        } catch(e) {}
      `).catch(() => {
      });
    } catch (e) {
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
var childWindows = /* @__PURE__ */ new Set();
function createPosWindow(token) {
  const appRoot = typeof app.getAppPath === "function" ? app.getAppPath() : __dirname;
  const preloadCandidates = [
    path.join(__dirname, "preload.cjs"),
    path.join(appRoot, "preload.cjs"),
    path.join(process.resourcesPath || "", "app", "preload.cjs"),
    path.join(process.resourcesPath || "", "preload.cjs"),
    path.join(process.cwd(), "preload.cjs")
  ];
  const preloadPath = preloadCandidates.find((p) => fs.existsSync(p)) || path.join(__dirname, "preload.cjs");
  const posWin = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 700,
    title: "Omni System Pro ERP \u2014 \u0646\u0642\u0637\u0629 \u0627\u0644\u0628\u064A\u0639 (\u0634\u0627\u0634\u0629 \u0643\u0627\u0634\u064A\u0631 \u0645\u0633\u062A\u0642\u0644\u0629)",
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    show: false,
    autoHideMenuBar: true
  });
  childWindows.add(posWin);
  const cleanToken = token ? String(token).trim() : "";
  const targetUrl = cleanToken ? `http://127.0.0.1:${mainPort}/pos?auth_token=${encodeURIComponent(cleanToken)}` : `http://127.0.0.1:${mainPort}/pos`;
  posWin.webContents.on("did-finish-load", () => {
    if (cleanToken) {
      posWin.webContents.executeJavaScript(`
        try {
          localStorage.setItem("pos_token", ${JSON.stringify(cleanToken)});
          sessionStorage.setItem("pos_token", ${JSON.stringify(cleanToken)});
        } catch(e) {}
      `).catch(() => {
      });
    }
  });
  posWin.once("ready-to-show", () => {
    posWin.maximize();
    posWin.show();
  });
  posWin.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12" || input.control && input.shift && input.key.toLowerCase() === "i") {
      posWin.webContents.toggleDevTools();
      event.preventDefault();
    } else if (input.key === "F5" || input.control && input.key.toLowerCase() === "r") {
      posWin.webContents.reload();
      event.preventDefault();
    }
  });
  posWin.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes("127.0.0.1") || url.includes("localhost") || url.startsWith("/") || url.includes("/pos")) {
      createPosWindow(cleanToken);
      return { action: "deny" };
    }
    shell.openExternal(url);
    return { action: "deny" };
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
  } catch (err) {
    console.error("Failed to open POS window:", err);
    return { success: false, error: err.message };
  }
});
ipcMain.handle("open-window", async (event, { url, title, token } = {}) => {
  try {
    if (!url || url.includes("pos")) {
      return await ipcMain.emit("open-pos-window", event, { token });
    }
    const fullUrl = url.startsWith("http") ? url : `http://127.0.0.1:${mainPort}${url.startsWith("/") ? "" : "/"}${url}`;
    const win = new BrowserWindow({
      width: 1280,
      height: 800,
      title: title || "Omni System Pro ERP",
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.cjs")
      }
    });
    childWindows.add(win);
    win.loadURL(fullUrl);
    win.on("closed", () => childWindows.delete(win));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
ipcMain.handle("save-pdf", async (event, { html, title, defaultFileName, pageSize = "A4", landscape = false }) => {
  try {
    const parentWin = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const cleanDefaultName = (defaultFileName || title || "OmniSystem_Document").replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_") + ".pdf";
    const defaultDir = app.getPath("documents") || app.getPath("downloads");
    const { canceled, filePath } = await dialog.showSaveDialog(parentWin, {
      title: "\u062D\u0641\u0638 \u0645\u0633\u062A\u0646\u062F PDF - \u062A\u062D\u062F\u064A\u062F \u0645\u0633\u0627\u0631 \u0648\u0627\u0633\u0645 \u0627\u0644\u0645\u0644\u0641",
      defaultPath: path.join(defaultDir, cleanDefaultName),
      filters: [
        { name: "\u0645\u0644\u0641\u0627\u062A PDF (*.pdf)", extensions: ["pdf"] },
        { name: "\u062C\u0645\u064A\u0639 \u0627\u0644\u0645\u0644\u0641\u0627\u062A (*.*)", extensions: ["*"] }
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
  <title>${title || "\u0645\u0633\u062A\u0646\u062F PDF"}</title>
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
    await new Promise((r) => setTimeout(r, 450));
    const pdfData = await printWin.webContents.printToPDF({
      pageSize,
      landscape,
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
    console.error("save-pdf error in main process:", err);
    return {
      success: false,
      error: err.message || "\u0641\u0634\u0644 \u062D\u0641\u0638 \u0645\u0644\u0641 \u0627\u0644\u0640 PDF"
    };
  }
});
ipcMain.handle("open-path", async (event, targetPath) => {
  if (!targetPath) return { success: false, error: "\u0627\u0644\u0645\u0633\u0627\u0631 \u063A\u064A\u0631 \u0645\u062D\u062F\u062F" };
  try {
    const res = await shell.openPath(targetPath);
    return { success: !res, error: res };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
ipcMain.handle("show-item-in-folder", async (event, targetPath) => {
  if (!targetPath) return { success: false };
  try {
    shell.showItemInFolder(targetPath);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
ipcMain.handle("open-external", async (event, url) => {
  if (!url) return { success: false };
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
ipcMain.handle("print-silent", async (event, printerName) => {
  const webContents = event.sender;
  return new Promise((resolve) => {
    webContents.print(
      {
        silent: true,
        printBackground: true,
        deviceName: printerName ? printerName.trim() : ""
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
      const { session } = require("electron");
      if (session && session.defaultSession) {
        await session.defaultSession.clearStorageData({
          storages: ["cookies", "serviceworkers", "cachestorage"]
        });
      }
    } catch (e) {
    }
    startBackend((port) => {
      checkServerReady(`http://127.0.0.1:${port}/api/health`, () => {
        createWindow();
        if (mainWindow) {
          mainWindow.loadURL(`http://127.0.0.1:${port}/login`);
        }
      });
    });
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
        if (mainWindow) {
          mainWindow.loadURL(`http://127.0.0.1:${mainPort}/login`);
        }
      }
    });
  });
  app.on("before-quit", async () => {
    try {
      const { session } = require("electron");
      if (session && session.defaultSession) {
        await session.defaultSession.clearStorageData({
          storages: ["cookies", "sessionstorage"]
        });
      }
    } catch (e) {
    }
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
