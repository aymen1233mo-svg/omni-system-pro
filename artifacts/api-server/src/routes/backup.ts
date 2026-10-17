import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import multer from "multer";
import { getAuthUser } from "./auth";
import { db, getActiveDatabasePath, createDatabaseInstance, resetEntireDatabase } from "../lib/sqlite";

const router = Router();
const upload = multer({ dest: os.tmpdir() });

let customBackupDir = path.join(os.homedir(), "OmniSystem_Backups");
let autoBackupEnabled = true;
let autoBackupIntervalMinutes = 30;
let maxRetainedBackups = 50;
let lastAutoBackupTime: Date | null = null;
let autoBackupTimer: NodeJS.Timeout | null = null;

// Temporary inspection cache
const tempInspectedFiles = new Map<string, { path: string; name: string; expiresAt: number }>();

// Clean old temp files periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of tempInspectedFiles.entries()) {
    if (item.expiresAt < now) {
      try {
        if (fs.existsSync(item.path)) fs.unlinkSync(item.path);
      } catch (e) {}
      tempInspectedFiles.delete(key);
    }
  }
}, 10 * 60 * 1000);

function getBackupDir(): string {
  if (!fs.existsSync(customBackupDir)) {
    try {
      fs.mkdirSync(customBackupDir, { recursive: true });
    } catch (e) {
      console.error("Failed to create custom backup dir, falling back to default:", e);
      customBackupDir = path.join(os.homedir(), "OmniSystem_Backups");
      fs.mkdirSync(customBackupDir, { recursive: true });
    }
  }
  return customBackupDir;
}

getBackupDir();

function requireDeveloper(req: any, res: any) {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "غير مصرح. يرجى تسجيل الدخول أولاً" });
    return false;
  }
  const role = user.role;
  const username = user.username;
  if (role === "admin" || role === "manager" || role === "developer" || username === "admin" || username === "developer" || role === "مدير") {
    return true;
  }
  res.status(403).json({ error: "غير مصرح. هذه الصلاحية مقتصرة على مدراء النظام والمطورين." });
  return false;
}

export function performBackup(reason: string = "manual"): { success: boolean; path: string; name: string; size: number } {
  const dir = getBackupDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const prefix = reason === "auto" ? "pos_auto_backup" : "pos_instant_backup";
  const backupFileName = `${prefix}_${timestamp}.db`;
  const backupFilePath = path.join(dir, backupFileName);

  const actualDbPath = getActiveDatabasePath();

  if (!fs.existsSync(actualDbPath)) {
    throw new Error(`قاعدة البيانات غير موجودة في المسار: ${actualDbPath}`);
  }

  // Force checkpoint if WAL is used to sync data to disk
  try {
    db.pragma("wal_checkpoint(PASSIVE)");
  } catch (e) {
    // Ignore if not supported or busy
  }

  fs.copyFileSync(actualDbPath, backupFilePath);

  // Also copy WAL and SHM if they exist to ensure consistency
  if (fs.existsSync(actualDbPath + "-wal")) {
    try { fs.copyFileSync(actualDbPath + "-wal", backupFilePath + "-wal"); } catch (e) {}
  }
  if (fs.existsSync(actualDbPath + "-shm")) {
    try { fs.copyFileSync(actualDbPath + "-shm", backupFilePath + "-shm"); } catch (e) {}
  }

  // Prune older backups if exceeding max limit
  try {
    const allBackups = fs.readdirSync(dir)
      .filter(f => f.endsWith(".db"))
      .map(f => ({ name: f, fullPath: path.join(dir, f), time: fs.statSync(path.join(dir, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);

    if (allBackups.length > maxRetainedBackups) {
      const toDelete = allBackups.slice(maxRetainedBackups);
      for (const item of toDelete) {
        try { fs.unlinkSync(item.fullPath); } catch (e) {}
        try { if (fs.existsSync(item.fullPath + "-wal")) fs.unlinkSync(item.fullPath + "-wal"); } catch (e) {}
        try { if (fs.existsSync(item.fullPath + "-shm")) fs.unlinkSync(item.fullPath + "-shm"); } catch (e) {}
      }
    }
  } catch (e) {
    console.error("Error during backup rotation:", e);
  }

  lastAutoBackupTime = new Date();
  const stat = fs.statSync(backupFilePath);
  return { success: true, path: backupFilePath, name: backupFileName, size: stat.size };
}

function startAutoBackupEngine() {
  if (autoBackupTimer) {
    clearInterval(autoBackupTimer);
    autoBackupTimer = null;
  }

  if (!autoBackupEnabled) return;

  const intervalMs = Math.max(1, autoBackupIntervalMinutes) * 60 * 1000;
  autoBackupTimer = setInterval(() => {
    try {
      console.log(`[Auto-Backup] Running scheduled background backup (Interval: ${autoBackupIntervalMinutes}m)...`);
      const res = performBackup("auto");
      console.log(`[Auto-Backup] Saved snapshot successfully: ${res.name}`);
    } catch (err) {
      console.error("[Auto-Backup] Failed to take scheduled backup:", err);
    }
  }, intervalMs);

  if (autoBackupTimer && typeof (autoBackupTimer as any).unref === "function") {
    (autoBackupTimer as any).unref();
  }

  // Take an initial backup shortly after server boots if no backup exists yet
  const initTimer = setTimeout(() => {
    try {
      const dir = getBackupDir();
      const files = fs.readdirSync(dir).filter(f => f.endsWith(".db"));
      if (files.length === 0) {
        performBackup("auto");
      }
    } catch (e) {}
  }, 10000);

  if (initTimer && typeof (initTimer as any).unref === "function") {
    (initTimer as any).unref();
  }
}

startAutoBackupEngine();

// 1. Create a manual / instant backup now
router.post("/system/backup", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  try {
    const result = performBackup("manual");
    res.json({
      success: true,
      message: "تم إنشاء النسخة الاحتياطية اللحظية وحفظها بأمان على الجهاز بنجاح",
      path: result.path,
      name: result.name,
      size: result.size
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 2. Download a specific backup or latest database backup directly
router.get("/system/backup/download/:filename?", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  try {
    const dir = getBackupDir();
    let targetFile = "";
    
    if (req.params.filename && req.params.filename !== "latest") {
      const safeName = path.basename(req.params.filename);
      targetFile = path.join(dir, safeName);
    } else {
      // Create a fresh instant snapshot and download it
      const snap = performBackup("instant_download");
      targetFile = snap.path;
    }

    if (!fs.existsSync(targetFile)) {
      return res.status(404).json({ error: "ملف النسخة الاحتياطية غير موجود" });
    }

    res.download(targetFile, path.basename(targetFile));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 3. Delete a backup file
router.delete("/system/backup/:filename", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  try {
    const dir = getBackupDir();
    const safeName = path.basename(req.params.filename);
    const targetFile = path.join(dir, safeName);

    if (fs.existsSync(targetFile)) {
      fs.unlinkSync(targetFile);
      if (fs.existsSync(targetFile + "-wal")) {
        try { fs.unlinkSync(targetFile + "-wal"); } catch (e) {}
      }
      if (fs.existsSync(targetFile + "-shm")) {
        try { fs.unlinkSync(targetFile + "-shm"); } catch (e) {}
      }
      res.json({ success: true, message: "تم حذف النسخة الاحتياطية بنجاح" });
    } else {
      res.status(404).json({ error: "الملف غير موجود" });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 4. Get backup engine settings & status
router.get("/system/backup/settings", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  try {
    const activePath = getActiveDatabasePath();
    const stat = fs.existsSync(activePath) ? fs.statSync(activePath) : null;
    res.json({
      autoBackupEnabled,
      autoBackupIntervalMinutes,
      maxRetainedBackups,
      backupDir: getBackupDir(),
      activeDbPath: activePath,
      dbSize: stat ? stat.size : 0,
      lastAutoBackupTime: lastAutoBackupTime ? lastAutoBackupTime.toISOString() : null,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 5. Update backup engine settings
router.post("/system/backup/settings", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  try {
    const { enabled, intervalMinutes, maxBackups, customPath } = req.body;
    if (enabled !== undefined) autoBackupEnabled = Boolean(enabled);
    if (intervalMinutes && Number(intervalMinutes) >= 1) autoBackupIntervalMinutes = Number(intervalMinutes);
    if (maxBackups && Number(maxBackups) >= 5) maxRetainedBackups = Number(maxBackups);
    if (customPath && typeof customPath === "string" && customPath.trim()) {
      customBackupDir = customPath.trim();
      getBackupDir();
    }

    startAutoBackupEngine();

    res.json({
      success: true,
      message: "تم تحديث إعدادات محرك النسخ الاحتياطي التلقائي بنجاح",
      settings: {
        autoBackupEnabled,
        autoBackupIntervalMinutes,
        maxRetainedBackups,
        backupDir: getBackupDir(),
        lastAutoBackupTime: lastAutoBackupTime ? lastAutoBackupTime.toISOString() : null,
      }
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 6. List backups
router.get(["/system/backups", "/system/backup/list"], (req, res) => {
  if (!requireDeveloper(req, res)) return;
  try {
    const dir = getBackupDir();
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith(".db"))
      .map(f => {
        const stats = fs.statSync(path.join(dir, f));
        return { 
          name: f, 
          path: path.join(dir, f), 
          size: stats.size, 
          createdAt: stats.mtime,
          isAuto: f.includes("auto")
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    res.json(files);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Helper: Safely inspect a database file and extract statistics & samples tailored to Sales Management & ERP
function inspectDatabaseFile(targetDbPath: string, originalName: string) {
  const stat = fs.statSync(targetDbPath);
  let tempDb: any = null;
  try {
    tempDb = createDatabaseInstance(targetDbPath);
  } catch (e: any) {
    throw new Error(`تعذر قراءة ملف قاعدة البيانات: ${e.message}`);
  }

  const tablesRes = tempDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as any[];
  const tableNames: string[] = tablesRes.map(t => t.name);

  function getCount(tableName: string): number {
    if (!tableNames.includes(tableName)) return 0;
    try {
      return (tempDb.prepare(`SELECT COUNT(*) as c FROM "${tableName}"`).get() as any)?.c || 0;
    } catch {
      return 0;
    }
  }

  function getActiveCount(tableName: string): number {
    try {
      return (db.prepare(`SELECT COUNT(*) as c FROM "${tableName}"`).get() as any)?.c || 0;
    } catch {
      return 0;
    }
  }

  // Statistical summary tailored to Sales Management / POS / ERP
  const ordersCount = getCount("orders") || getCount("warehouse_sales_invoices");
  const productsCount = getCount("products");
  const customersCount = getCount("customers");
  const suppliersCount = getCount("suppliers");
  const vouchersCount = getCount("vouchers");
  const journalsCount = getCount("journal_entries");
  const categoriesCount = getCount("categories") || getCount("product_categories");
  const usersCount = getCount("users");
  const safesCount = getCount("safes");
  const licensesCount = getCount("licenses");

  // Sum total sales in incoming DB
  let totalSales = 0;
  if (tableNames.includes("orders")) {
    try {
      totalSales = (tempDb.prepare("SELECT SUM(total) as s FROM orders").get() as any)?.s || 0;
    } catch {}
  } else if (tableNames.includes("warehouse_sales_invoices")) {
    try {
      totalSales = (tempDb.prepare("SELECT SUM(grand_total) as s FROM warehouse_sales_invoices").get() as any)?.s || 0;
    } catch {}
  }

  let currentTotalSales = 0;
  try {
    currentTotalSales = (db.prepare("SELECT SUM(total) as s FROM orders").get() as any)?.s || 0;
  } catch {}

  // Current active DB stats for side-by-side comparison
  const currentStats = {
    orders: getActiveCount("orders"),
    totalSales: currentTotalSales,
    products: getActiveCount("products"),
    customers: getActiveCount("customers"),
    suppliers: getActiveCount("suppliers"),
    vouchers: getActiveCount("vouchers"),
    journals: getActiveCount("journal_entries"),
    categories: getActiveCount("categories") || getActiveCount("product_categories"),
    users: getActiveCount("users"),
    safes: getActiveCount("safes"),
    licenses: getActiveCount("licenses")
  };

  // Live Samples Preview tailored to Sales Management
  let sampleOrders: any[] = [];
  if (tableNames.includes("orders")) {
    try {
      sampleOrders = tempDb.prepare(`
        SELECT id, COALESCE(invoice_number, CAST(id AS TEXT)) as invoice_number, 
               COALESCE(customer_name, 'عميل عام') as customer_name, 
               COALESCE(total, 0) as total, 
               COALESCE(payment_method, 'cash') as payment_method, 
               COALESCE(status, 'completed') as status, 
               COALESCE(created_at, '') as created_at 
        FROM orders ORDER BY id DESC LIMIT 10
      `).all() as any[];
    } catch {}
  }

  let sampleProducts: any[] = [];
  if (tableNames.includes("products")) {
    try {
      sampleProducts = tempDb.prepare(`
        SELECT id, COALESCE(barcode, '') as barcode, name, 
               COALESCE(price, 0) as price, 
               COALESCE(cost, 0) as cost, 
               COALESCE(stock, 0) as stock, 
               COALESCE(active, 1) as active 
        FROM products ORDER BY id DESC LIMIT 10
      `).all() as any[];
    } catch {}
  }

  let sampleCustomers: any[] = [];
  if (tableNames.includes("customers")) {
    try {
      sampleCustomers = tempDb.prepare(`
        SELECT id, name, COALESCE(phone, '') as phone, 
               COALESCE(balance, 0) as balance, 
               COALESCE(customer_type, 'individual') as customer_type, 
               COALESCE(address, '') as address 
        FROM customers ORDER BY id DESC LIMIT 10
      `).all() as any[];
    } catch {}
  }

  let sampleSuppliers: any[] = [];
  if (tableNames.includes("suppliers")) {
    try {
      sampleSuppliers = tempDb.prepare(`
        SELECT id, name, COALESCE(phone, '') as phone, 
               COALESCE(balance, 0) as balance, 
               COALESCE(address, '') as address 
        FROM suppliers ORDER BY id DESC LIMIT 10
      `).all() as any[];
    } catch {}
  }

  let sampleVouchers: any[] = [];
  if (tableNames.includes("vouchers")) {
    try {
      sampleVouchers = tempDb.prepare(`
        SELECT id, COALESCE(type, 'receipt') as type, 
               COALESCE(amount, 0) as amount, 
               COALESCE(beneficiary, notes, '') as beneficiary, 
               COALESCE(payment_method, 'cash') as payment_method, 
               COALESCE(created_at, '') as created_at 
        FROM vouchers ORDER BY id DESC LIMIT 10
      `).all() as any[];
    } catch {}
  }

  let sampleJournals: any[] = [];
  if (tableNames.includes("journal_entries")) {
    try {
      sampleJournals = tempDb.prepare(`
        SELECT id, COALESCE(entry_number, CAST(id AS TEXT)) as entry_number, 
               COALESCE(date, '') as date, 
               COALESCE(description, '') as description, 
               COALESCE(total_debit, 0) as total_debit 
        FROM journal_entries ORDER BY id DESC LIMIT 10
      `).all() as any[];
    } catch {}
  }

  tempDb.close();

  return {
    fileInfo: {
      name: originalName,
      sizeBytes: stat.size,
      sizeFormatted: `${(stat.size / 1024).toFixed(1)} KB (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`,
      createdAt: stat.mtime
    },
    tables: tableNames,
    statistics: {
      orders: ordersCount,
      totalSales,
      products: productsCount,
      customers: customersCount,
      suppliers: suppliersCount,
      vouchers: vouchersCount,
      journals: journalsCount,
      categories: categoriesCount,
      users: usersCount,
      safes: safesCount,
      licenses: licensesCount
    },
    currentDatabaseStats: currentStats,
    samples: {
      orders: sampleOrders,
      products: sampleProducts,
      customers: sampleCustomers,
      suppliers: sampleSuppliers,
      vouchers: sampleVouchers,
      journals: sampleJournals
    }
  };
}

// 7. Inspect database before restore/merge (Upload or Local File)
router.post("/system/backup/inspect", upload.single("dbFile"), (req, res) => {
  if (!requireDeveloper(req, res)) return;
  try {
    let filePath = "";
    let originalName = "";

    if (req.file) {
      filePath = req.file.path;
      originalName = req.file.originalname || "uploaded_backup.db";
    } else if (req.body.filename) {
      const dir = getBackupDir();
      originalName = path.basename(req.body.filename);
      filePath = path.join(dir, originalName);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "ملف النسخة الاحتياطية غير موجود على الجهاز" });
      }
    } else {
      return res.status(400).json({ error: "يرجى تحديد أو رفع ملف قاعدة بيانات صالح" });
    }

    const inspection = inspectDatabaseFile(filePath, originalName);
    const tempKey = `insp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Store in temp cache for 30 minutes
    tempInspectedFiles.set(tempKey, {
      path: filePath,
      name: originalName,
      expiresAt: Date.now() + 30 * 60 * 1000
    });

    res.json({
      success: true,
      tempKey,
      ...inspection
    });
  } catch (e: any) {
    console.error("Database inspection error:", e);
    res.status(500).json({ error: e.message });
  }
});

// 8. Confirm Full Replace / Restore
router.post(["/system/restore", "/system/backup/confirm-restore"], upload.single("dbFile"), (req, res) => {
  if (!requireDeveloper(req, res)) return;
  try {
    let sourcePath = "";
    let originalName = "pos.db";

    if (req.file) {
      sourcePath = req.file.path;
      originalName = req.file.originalname;
    } else if (req.body.tempKey) {
      const item = tempInspectedFiles.get(req.body.tempKey);
      if (!item || !fs.existsSync(item.path)) {
        return res.status(400).json({ error: "انتهت صلاحية جلسة الفحص، يرجى إعادة اختيار الملف" });
      }
      sourcePath = item.path;
      originalName = item.name;
    } else if (req.body.filename) {
      const dir = getBackupDir();
      originalName = path.basename(req.body.filename);
      sourcePath = path.join(dir, originalName);
    } else {
      return res.status(400).json({ error: "لم يتم تحديد ملف قاعدة البيانات" });
    }

    if (!fs.existsSync(sourcePath)) {
      return res.status(404).json({ error: "ملف قاعدة البيانات المصدر غير موجود" });
    }

    // Create a safety backup of the current database before replacing!
    try {
      performBackup("pre_restore");
    } catch (e) {}

    const actualDbPath = getActiveDatabasePath();

    // 1. Close database to unlock file on the system (critical for Windows/Linux)
    try {
      db.close();
      console.log("Database connection closed for restore.");
    } catch (err) {
      console.error("Error closing database:", err);
    }

    // 2. Clear WAL/SHM so SQLite doesn't overwrite from old logs on boot
    if (fs.existsSync(actualDbPath + "-wal")) {
      try { fs.unlinkSync(actualDbPath + "-wal"); } catch (e) {}
    }
    if (fs.existsSync(actualDbPath + "-shm")) {
      try { fs.unlinkSync(actualDbPath + "-shm"); } catch (e) {}
    }

    // 3. Replace DB file
    fs.copyFileSync(sourcePath, actualDbPath);

    // Delete temporary upload if needed
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }

    res.json({ 
      success: true, 
      message: `تم استبدال واستعادة قاعدة البيانات بنجاح من (${originalName})! تم حفظ نسخة أمان لحظية من الحالة السابقة وإعادة تهيئة النظام.` 
    });

    // Clean exit so Electron or Node restarts fresh with new DB
    setTimeout(() => {
      process.exit(0);
    }, 1500);

  } catch (e: any) {
    console.error("Restore error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Universal Schema-Aware Smart Database Merge Engine
export function smartMergeDatabase(sourcePath: string, originalName: string = "source.db"): { success: boolean; message: string; statsMerged: Record<string, number> } {
  let sourceDb: any = null;
  try {
    sourceDb = createDatabaseInstance(sourcePath);
  } catch (e: any) {
    throw new Error(`تعذر فتح قاعدة البيانات المصدر للدمج: ${e.message}`);
  }

  const tablesRes = sourceDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as any[];
  const sourceTables: string[] = tablesRes.map(t => t.name);

  const stats: Record<string, number> = {
    orders: 0,
    order_items: 0,
    products: 0,
    categories: 0,
    customers: 0,
    suppliers: 0,
    vouchers: 0,
    safes: 0,
    accounts: 0,
    journals: 0,
    users: 0,
    licenses: 0,
    passengers: 0,
    travelGroups: 0
  };

  db.exec("PRAGMA foreign_keys = OFF;");

  // Helper for generic column matching and insertion
  function safeInsertRow(targetTable: string, row: any, matchColumn?: string, matchVal?: any): { success: boolean; lastInsertId?: number } {
    try {
      const targetColsInfo = db.prepare(`PRAGMA table_info("${targetTable}")`).all() as any[];
      const targetColNames = targetColsInfo.map(c => c.name);

      if (matchColumn && matchVal !== undefined && matchVal !== null && matchVal !== "") {
        const existing = db.prepare(`SELECT id FROM "${targetTable}" WHERE "${matchColumn}" = ?`).get(matchVal);
        if (existing) return { success: false };
      }

      const validKeys = Object.keys(row).filter(k => k !== "id" && targetColNames.includes(k) && row[k] !== undefined);
      if (validKeys.length === 0) return { success: false };

      const placeholders = validKeys.map(() => "?").join(", ");
      const columnsList = validKeys.map(k => `"${k}"`).join(", ");
      const values = validKeys.map(k => row[k]);

      const r = db.prepare(`INSERT INTO "${targetTable}" (${columnsList}) VALUES (${placeholders})`).run(...values);
      return { success: true, lastInsertId: Number(r.lastInsertRowid) };
    } catch (e) {
      return { success: false };
    }
  }

  // 1. Categories
  const catTable = sourceTables.includes("categories") ? "categories" : (sourceTables.includes("product_categories") ? "product_categories" : null);
  if (catTable) {
    try {
      const rows = sourceDb.prepare(`SELECT * FROM "${catTable}"`).all() as any[];
      for (const r of rows) {
        if (safeInsertRow("categories", r, "name", r.name).success) stats.categories++;
      }
    } catch {}
  }

  // 2. Products
  if (sourceTables.includes("products")) {
    try {
      const rows = sourceDb.prepare("SELECT * FROM products").all() as any[];
      for (const p of rows) {
        let exists = false;
        if (p.barcode && String(p.barcode).trim()) {
          exists = !!db.prepare("SELECT id FROM products WHERE barcode = ?").get(String(p.barcode).trim());
        }
        if (!exists && p.name) {
          exists = !!db.prepare("SELECT id FROM products WHERE name = ?").get(String(p.name).trim());
        }
        if (!exists) {
          if (safeInsertRow("products", p).success) stats.products++;
        }
      }
    } catch {}
  }

  // 3. Customers
  if (sourceTables.includes("customers")) {
    try {
      const rows = sourceDb.prepare("SELECT * FROM customers").all() as any[];
      for (const c of rows) {
        let exists = false;
        if (c.phone && String(c.phone).trim()) {
          exists = !!db.prepare("SELECT id FROM customers WHERE phone = ?").get(String(c.phone).trim());
        }
        if (!exists && c.name) {
          exists = !!db.prepare("SELECT id FROM customers WHERE name = ?").get(String(c.name).trim());
        }
        if (!exists) {
          if (safeInsertRow("customers", c).success) stats.customers++;
        }
      }
    } catch {}
  }

  // 4. Suppliers
  if (sourceTables.includes("suppliers")) {
    try {
      const rows = sourceDb.prepare("SELECT * FROM suppliers").all() as any[];
      for (const s of rows) {
        let exists = false;
        if (s.phone && String(s.phone).trim()) {
          exists = !!db.prepare("SELECT id FROM suppliers WHERE phone = ?").get(String(s.phone).trim());
        }
        if (!exists && s.name) {
          exists = !!db.prepare("SELECT id FROM suppliers WHERE name = ?").get(String(s.name).trim());
        }
        if (!exists) {
          if (safeInsertRow("suppliers", s).success) stats.suppliers++;
        }
      }
    } catch {}
  }

  // 5. Orders & Order Items
  if (sourceTables.includes("orders")) {
    try {
      const rows = sourceDb.prepare("SELECT * FROM orders").all() as any[];
      for (const ord of rows) {
        const invNum = ord.invoice_number || String(ord.id);
        const exists = db.prepare("SELECT id FROM orders WHERE invoice_number = ? OR (id = ? AND created_at = ?)").get(invNum, ord.id, ord.created_at);
        if (!exists) {
          const res = safeInsertRow("orders", ord);
          if (res.success && res.lastInsertId) {
            stats.orders++;
            const newOrderId = res.lastInsertId;
            if (sourceTables.includes("order_items")) {
              try {
                const items = sourceDb.prepare("SELECT * FROM order_items WHERE order_id = ?").all(ord.id) as any[];
                for (const it of items) {
                  const itClone = { ...it, order_id: newOrderId };
                  if (safeInsertRow("order_items", itClone).success) stats.order_items++;
                }
              } catch {}
            }
          }
        }
      }
    } catch {}
  }

  // 6. Safes
  if (sourceTables.includes("safes")) {
    try {
      const rows = sourceDb.prepare("SELECT * FROM safes").all() as any[];
      for (const r of rows) {
        if (safeInsertRow("safes", r, "name", r.name).success) stats.safes++;
      }
    } catch {}
  }

  // 7. Vouchers
  if (sourceTables.includes("vouchers")) {
    try {
      const rows = sourceDb.prepare("SELECT * FROM vouchers").all() as any[];
      for (const r of rows) {
        let exists = false;
        if (r.reference_no && String(r.reference_no).trim()) {
          exists = !!db.prepare("SELECT id FROM vouchers WHERE reference_no = ?").get(String(r.reference_no).trim());
        }
        if (!exists && r.amount && r.created_at) {
          exists = !!db.prepare("SELECT id FROM vouchers WHERE amount = ? AND created_at = ? AND type = ?").get(r.amount, r.created_at, r.type || 'receipt');
        }
        if (!exists) {
          if (safeInsertRow("vouchers", r).success) stats.vouchers++;
        }
      }
    } catch {}
  }

  // 8. Accounts
  if (sourceTables.includes("accounts")) {
    try {
      const rows = sourceDb.prepare("SELECT * FROM accounts").all() as any[];
      for (const r of rows) {
        if (safeInsertRow("accounts", r, "code", r.code).success) stats.accounts++;
      }
    } catch {}
  }

  // 9. Journal Entries
  if (sourceTables.includes("journal_entries")) {
    try {
      const rows = sourceDb.prepare("SELECT * FROM journal_entries").all() as any[];
      for (const j of rows) {
        const entNum = j.entry_number || String(j.id);
        const exists = db.prepare("SELECT id FROM journal_entries WHERE entry_number = ? OR (date = ? AND description = ?)").get(entNum, j.date, j.description);
        if (!exists) {
          const res = safeInsertRow("journal_entries", j);
          if (res.success && res.lastInsertId) {
            stats.journals++;
            const newJId = res.lastInsertId;
            if (sourceTables.includes("journal_entry_lines")) {
              try {
                const lines = sourceDb.prepare("SELECT * FROM journal_entry_lines WHERE journal_entry_id = ?").all(j.id) as any[];
                for (const line of lines) {
                  const lineClone = { ...line, journal_entry_id: newJId };
                  safeInsertRow("journal_entry_lines", lineClone);
                }
              } catch {}
            }
          }
        }
      }
    } catch {}
  }

  // 10. Users
  if (sourceTables.includes("users")) {
    try {
      const rows = sourceDb.prepare("SELECT * FROM users").all() as any[];
      for (const u of rows) {
        if (u.username === "developer" || u.username === "admin") continue;
        if (safeInsertRow("users", u, "username", u.username).success) stats.users++;
      }
    } catch {}
  }

  // 11. Licenses & Devices
  if (sourceTables.includes("licenses")) {
    try {
      const rows = sourceDb.prepare("SELECT * FROM licenses").all() as any[];
      for (const lic of rows) {
        const exists = db.prepare("SELECT id FROM licenses WHERE license_key = ?").get(lic.license_key) as any;
        if (!exists) {
          const res = safeInsertRow("licenses", lic);
          if (res.success && res.lastInsertId) {
            stats.licenses++;
            if (sourceTables.includes("license_devices")) {
              try {
                const devs = sourceDb.prepare("SELECT * FROM license_devices WHERE license_id = ?").all(lic.id) as any[];
                for (const dev of devs) {
                  const devClone = { ...dev, license_id: res.lastInsertId };
                  safeInsertRow("license_devices", devClone);
                }
              } catch {}
            }
          }
        }
      }
    } catch {}
  }

  // 12. Travel & Hajj/Umrah tables (if present in old database, preserve them seamlessly)
  if (sourceTables.includes("travel_groups")) {
    try {
      const rows = sourceDb.prepare("SELECT * FROM travel_groups").all() as any[];
      for (const g of rows) {
        if (safeInsertRow("travel_groups", g, "name", g.name).success) stats.travelGroups++;
      }
    } catch {}
  }
  if (sourceTables.includes("passengers")) {
    try {
      const rows = sourceDb.prepare("SELECT * FROM passengers").all() as any[];
      for (const p of rows) {
        if (safeInsertRow("passengers", p, "passport_number", p.passport_number).success) stats.passengers++;
      }
    } catch {}
  }

  db.exec("PRAGMA foreign_keys = ON;");
  sourceDb.close();

  const totalAdded = Object.values(stats).reduce((a, b) => a + b, 0);
  return {
    success: true,
    message: `تم دمج واستيعاب ${totalAdded} سجل بنجاح من (${originalName}) في قاعدة بيانات المبيعات الحديثة 2.0 دون أي تعارض مع الحفاظ الكامل على كافة السجلات والبيانات!`,
    statsMerged: stats
  };
}

// 9. Smart Merge: Merges data from uploaded DB into current active DB without wiping existing data
router.post("/system/backup/merge", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  try {
    const { tempKey, filename } = req.body;
    let sourcePath = "";
    let originalName = "merge_source.db";

    if (tempKey) {
      const item = tempInspectedFiles.get(tempKey);
      if (!item || !fs.existsSync(item.path)) {
        return res.status(400).json({ error: "جلسة الفحص منتهية، يرجى إعادة اختيار الملف للفحص أولاً" });
      }
      sourcePath = item.path;
      originalName = item.name;
    } else if (filename) {
      const dir = getBackupDir();
      originalName = path.basename(filename);
      sourcePath = path.join(dir, originalName);
    } else {
      return res.status(400).json({ error: "يرجى تحديد مصدر قاعدة البيانات للدمج" });
    }

    // Take safety snapshot before merge
    try {
      performBackup("pre_merge");
    } catch (e) {}

    const result = smartMergeDatabase(sourcePath, originalName);
    res.json(result);
  } catch (e: any) {
    console.error("Merge error:", e);
    res.status(500).json({ error: e.message });
  }
});

// 10. Factory Reset: Completely clears all transactional database tables with pre-backup
router.post("/system/reset-database", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  try {
    const { confirmText } = req.body;
    if (confirmText !== "تصفير" && confirmText !== "RESET" && confirmText !== "حذف_الكل") {
      return res.status(400).json({ error: 'لإتمام التصفير الأمني، يرجى كتابة كلمة "تصفير" للتأكيد.' });
    }

    // 1. Take a safe instant backup snapshot before wiping
    let preBackupPath = "";
    try {
      const b = performBackup("pre_factory_reset");
      preBackupPath = b.path;
    } catch (e) {}

    // 2. Perform database wipe
    const result = resetEntireDatabase();

    res.json({
      success: true,
      message: "تم تصفير ومحو كافة سجلات وبيانات قاعدة البيانات بنجاح، وتهيئة النظام كنسخة نظيفة وجديدة.",
      preBackupPath,
      deletedCounts: result.deletedCounts
    });

  } catch (e: any) {
    console.error("Database reset error:", e);
    res.status(500).json({ error: e.message });
  }
});

// 11. Restore local backup (direct from server-side folder)
router.post("/system/restore-local", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ error: "اسم ملف النسخة الاحتياطية مطلوب" });
    }

    const dir = getBackupDir();
    const safeFilename = path.basename(filename);
    const sourceFilePath = path.join(dir, safeFilename);

    if (!fs.existsSync(sourceFilePath)) {
      return res.status(404).json({ error: "ملف النسخة الاحتياطية غير موجود على الجهاز" });
    }

    // Create a safety backup first
    try {
      performBackup("pre_restore");
    } catch (e) {}

    const actualDbPath = getActiveDatabasePath();

    // 1. Close database to unlock file on the system
    try {
      db.close();
      console.log("Database connection closed for local restore.");
    } catch (err) {
      console.error("Error closing database:", err);
    }

    // 2. Clear WAL/SHM
    if (fs.existsSync(actualDbPath + "-wal")) {
      try { fs.unlinkSync(actualDbPath + "-wal"); } catch (e) {}
    }
    if (fs.existsSync(actualDbPath + "-shm")) {
      try { fs.unlinkSync(actualDbPath + "-shm"); } catch (e) {}
    }

    // 3. Force remove old DB file
    try {
      if (fs.existsSync(actualDbPath)) {
        fs.unlinkSync(actualDbPath);
      }
    } catch (e) {
      console.warn("Could not delete old DB file directly, overwriting...", e);
    }

    // 4. Copy the selected local backup file
    fs.copyFileSync(sourceFilePath, actualDbPath);

    res.json({ success: true, message: `تمت استعادة النسخة الاحتياطية (${safeFilename}) بنجاح. سيتم إعادة تشغيل الخادم والبرنامج الآن لتطبيق البيانات المستعادة.` });

    setTimeout(() => {
      process.exit(0);
    }, 1500);

  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
