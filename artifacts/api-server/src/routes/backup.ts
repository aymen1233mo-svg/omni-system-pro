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

// Helper: Safely inspect a database file and extract statistics & samples
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
      return (tempDb.prepare(`SELECT COUNT(*) as c FROM ${tableName}`).get() as any)?.c || 0;
    } catch {
      return 0;
    }
  }

  function getActiveCount(tableName: string): number {
    try {
      return (db.prepare(`SELECT COUNT(*) as c FROM ${tableName}`).get() as any)?.c || 0;
    } catch {
      return 0;
    }
  }

  function getSamples(tableName: string, limit: number = 8): any[] {
    if (!tableNames.includes(tableName)) return [];
    try {
      return tempDb.prepare(`SELECT * FROM ${tableName} ORDER BY id DESC LIMIT ${limit}`).all() as any[];
    } catch {
      return [];
    }
  }

  // Statistical summary
  const passengersCount = getCount("passengers");
  const travelGroupsCount = getCount("travel_groups");
  const customersCount = getCount("customers");
  const ordersCount = getCount("orders");
  const vouchersCount = getCount("vouchers");
  const journalsCount = getCount("journal_entries");
  const suppliersCount = getCount("suppliers");
  const productsCount = getCount("products");
  const usersCount = getCount("users");
  const visasCount = getCount("travel_visas");
  const busBookingsCount = getCount("travel_bus_bookings");
  const hotelBookingsCount = getCount("travel_hotel_bookings");
  const accountsCount = getCount("accounts");

  // Sum total sales in incoming DB
  let totalSales = 0;
  if (tableNames.includes("orders")) {
    try {
      totalSales = (tempDb.prepare("SELECT SUM(total) as s FROM orders").get() as any)?.s || 0;
    } catch {}
  }

  // Current active DB stats for side-by-side comparison
  const currentStats = {
    passengers: getActiveCount("passengers"),
    travelGroups: getActiveCount("travel_groups"),
    customers: getActiveCount("customers"),
    orders: getActiveCount("orders"),
    vouchers: getActiveCount("vouchers"),
    journals: getActiveCount("journal_entries"),
    suppliers: getActiveCount("suppliers"),
    products: getActiveCount("products"),
    users: getActiveCount("users"),
    visas: getActiveCount("travel_visas"),
    busBookings: getActiveCount("travel_bus_bookings"),
    hotelBookings: getActiveCount("travel_hotel_bookings"),
    accounts: getActiveCount("accounts")
  };

  // Samples for preview
  const samplePassengers = getSamples("passengers");
  const sampleCustomers = getSamples("customers");
  const sampleOrders = getSamples("orders");
  const sampleVouchers = getSamples("vouchers");
  const sampleJournals = getSamples("journal_entries");

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
      passengers: passengersCount,
      travelGroups: travelGroupsCount,
      customers: customersCount,
      orders: ordersCount,
      totalSales,
      vouchers: vouchersCount,
      journals: journalsCount,
      suppliers: suppliersCount,
      products: productsCount,
      users: usersCount,
      visas: visasCount,
      busBookings: busBookingsCount,
      hotelBookings: hotelBookingsCount,
      accounts: accountsCount
    },
    currentDatabaseStats: currentStats,
    samples: {
      passengers: samplePassengers,
      customers: sampleCustomers,
      orders: sampleOrders,
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

// 9. Smart Merge: Merges data from uploaded DB into current active DB without wiping existing data
router.post("/system/backup/merge", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  try {
    const { tempKey, filename, options } = req.body;
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

    let sourceDb: any = null;
    try {
      sourceDb = createDatabaseInstance(sourcePath);
    } catch (e: any) {
      return res.status(400).json({ error: `تعذر فتح قاعدة البيانات المصدر للدمج: ${e.message}` });
    }

    const tablesRes = sourceDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as any[];
    const sourceTables: string[] = tablesRes.map(t => t.name);

    const stats = {
      customers: 0,
      passengers: 0,
      suppliers: 0,
      products: 0,
      travelGroups: 0,
      vouchers: 0,
      journalEntries: 0
    };

    db.exec("PRAGMA foreign_keys = OFF;");

    // 1. Merge Customers (match by phone or name)
    if (sourceTables.includes("customers")) {
      const srcCusts = sourceDb.prepare("SELECT * FROM customers").all() as any[];
      for (const c of srcCusts) {
        const exists = db.prepare("SELECT id FROM customers WHERE (phone IS NOT NULL AND phone != '' AND phone = ?) OR name = ?").get(c.phone, c.name);
        if (!exists) {
          try {
            db.prepare(`
              INSERT INTO customers (name, phone, email, address, balance, points, notes, national_id, passport_number, nationality, country, dob, gender, name_en, alternate_phone, employer, customer_type)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              c.name, c.phone || "", c.email || "", c.address || "", c.balance || 0, c.points || 0, c.notes || "",
              c.national_id || null, c.passport_number || null, c.nationality || null, c.country || null, c.dob || null, c.gender || null,
              c.name_en || null, c.alternate_phone || null, c.employer || null, c.customer_type || "individual"
            );
            stats.customers++;
          } catch (e) {}
        }
      }
    }

    // 2. Merge Travel Groups
    if (sourceTables.includes("travel_groups")) {
      const srcGroups = sourceDb.prepare("SELECT * FROM travel_groups").all() as any[];
      for (const g of srcGroups) {
        const exists = db.prepare("SELECT id FROM travel_groups WHERE code = ? OR name = ?").get(g.code, g.name);
        if (!exists) {
          try {
            db.prepare(`
              INSERT INTO travel_groups (name, code, group_type, leader_name, leader_phone, destination, start_date, end_date, total_seats, status, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              g.name, g.code, g.group_type || "umrah", g.leader_name || "", g.leader_phone || "", g.destination || "",
              g.start_date || "", g.end_date || "", g.total_seats || 50, g.status || "active", g.notes || ""
            );
            stats.travelGroups++;
          } catch (e) {}
        }
      }
    }

    // 3. Merge Passengers (match by passport_number or name + group)
    if (sourceTables.includes("passengers")) {
      const srcPass = sourceDb.prepare("SELECT * FROM passengers").all() as any[];
      for (const p of srcPass) {
        const exists = db.prepare("SELECT id FROM passengers WHERE (passport_number IS NOT NULL AND passport_number != '' AND passport_number = ?) OR (name = ? AND travel_date = ?)").get(p.passport_number, p.name, p.travel_date);
        if (!exists) {
          try {
            db.prepare(`
              INSERT INTO passengers (
                name, passport_number, nationality, travel_date, visa_number, phone, status, hotel_name, group_id, notes,
                border_number, sponsor_name, transport_company, entry_port, trip_type, seat_number, room_number,
                gender, birth_date, passport_issue_date, passport_expiry_date, national_id, city, country,
                package_name, departure_date, relative_name, relative_phone, relative_relation, custom_trip_duration
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              p.name, p.passport_number, p.nationality || "يمني", p.travel_date || null, p.visa_number || "", p.phone || "", p.status || "نشط",
              p.hotel_name || "", p.group_id || null, p.notes || "", p.border_number || "", p.sponsor_name || "", p.transport_company || "",
              p.entry_port || "", p.trip_type || "بر", p.seat_number || "", p.room_number || "", p.gender || "ذكر", p.birth_date || "",
              p.passport_issue_date || "", p.passport_expiry_date || "", p.national_id || "", p.city || "مكة المكرمة", p.country || "اليمن",
              p.package_name || "", p.departure_date || "", p.relative_name || "", p.relative_phone || "", p.relative_relation || "", p.custom_trip_duration || null
            );
            stats.passengers++;
          } catch (e) {}
        }
      }
    }

    // 4. Merge Suppliers (match by name or phone)
    if (sourceTables.includes("suppliers")) {
      const srcSupp = sourceDb.prepare("SELECT * FROM suppliers").all() as any[];
      for (const s of srcSupp) {
        const exists = db.prepare("SELECT id FROM suppliers WHERE name = ? OR (phone IS NOT NULL AND phone != '' AND phone = ?)").get(s.name, s.phone);
        if (!exists) {
          try {
            db.prepare(`
              INSERT INTO suppliers (name, phone, email, address, balance, contact_person, notes, tax_number, commercial_register)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(s.name, s.phone || "", s.email || "", s.address || "", s.balance || 0, s.contact_person || "", s.notes || "", s.tax_number || "", s.commercial_register || "");
            stats.suppliers++;
          } catch (e) {}
        }
      }
    }

    // 5. Merge Products / Services (match by barcode or name)
    if (sourceTables.includes("products")) {
      const srcProds = sourceDb.prepare("SELECT * FROM products").all() as any[];
      for (const p of srcProds) {
        const exists = db.prepare("SELECT id FROM products WHERE (barcode IS NOT NULL AND barcode != '' AND barcode = ?) OR name = ?").get(p.barcode, p.name);
        if (!exists) {
          try {
            db.prepare(`
              INSERT INTO products (name, barcode, cost_price, sale_price, stock, category_id, min_stock, active)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(p.name, p.barcode || "", p.cost_price || 0, p.sale_price || 0, p.stock || 0, p.category_id || 1, p.min_stock || 0, p.active !== 0 ? 1 : 0);
            stats.products++;
          } catch (e) {}
        }
      }
    }

    db.exec("PRAGMA foreign_keys = ON;");
    sourceDb.close();

    res.json({
      success: true,
      message: `تم دمج واستيراد السجلات بنجاح من (${originalName})! تم إضافة السجلات الفريدة مع الحفاظ التام على بياناتك الحالية.`,
      statsMerged: stats
    });

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
