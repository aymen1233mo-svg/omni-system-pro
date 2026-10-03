import path from "node:path";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, renameSync, existsSync, unlinkSync, copyFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runErpAccountingSync } from "./erp-accounting-sync";

const moduleDir = typeof __dirname !== "undefined"
  ? __dirname
  : process.cwd();

const requireTarget = typeof __filename !== "undefined" 
  ? __filename 
  : (typeof process !== "undefined" ? path.join(process.cwd(), "index.js") : "./index.js");

// Use global require if available (CommonJS production build), otherwise fallback to createRequire
const localRequire = typeof require !== "undefined" 
  ? require 
  : createRequire(requireTarget);

let DatabaseSyncClass: any;
try {
  DatabaseSyncClass = localRequire("node:sqlite").DatabaseSync;
} catch {
  try {
    DatabaseSyncClass = localRequire("better-sqlite3");
  } catch (err) {
    console.error("Neither node:sqlite nor better-sqlite3 could be loaded:", err);
  }
}

class StatementWrapper {
  private stmt: any;

  constructor(stmt: any) {
    this.stmt = stmt;
  }

  private cleanParams(params: any[]): any[] {
    return params.map(p => {
      if (p === undefined) return null;
      if (typeof p === "object" && p !== null && !(p instanceof Uint8Array) && !(p instanceof Buffer)) {
        // If it's a plain object, clone and sanitize keys
        const cleaned: Record<string, any> = {};
        for (const [k, v] of Object.entries(p)) {
          cleaned[k] = v === undefined ? null : v;
        }
        return cleaned;
      }
      return p;
    });
  }

  all(...params: any[]): any[] {
    return this.stmt.all(...this.cleanParams(params));
  }

  get(...params: any[]): any {
    return this.stmt.get(...this.cleanParams(params));
  }

  run(...params: any[]): { changes: number; lastInsertRowid: number } {
    const result = this.stmt.run(...this.cleanParams(params));
    return {
      changes: result.changes ?? 0,
      lastInsertRowid: Number(result.lastInsertRowid ?? 0)
    };
  }
}

class DatabaseWrapper {
  private db: any;

  constructor(filename: string) {
    if (!DatabaseSyncClass) {
      throw new Error("لم يتم العثور على محرك قاعدة البيانات SQLite (node:sqlite أو better-sqlite3). يرجى استخدام Node.js v22.5.0+ أو تثبيت better-sqlite3.");
    }
    this.db = new DatabaseSyncClass(filename);
  }

  prepare(sql: string) {
    const stmt = this.db.prepare(sql);
    return new StatementWrapper(stmt);
  }

  exec(sql: string) {
    return this.db.exec(sql);
  }

  pragma(sql: string) {
    return this.db.exec(`PRAGMA ${sql}`);
  }

  transaction(fn: (...args: any[]) => any) {
    return (...args: any[]) => {
      this.db.exec("BEGIN TRANSACTION");
      try {
        const result = fn(...args);
        this.db.exec("COMMIT");
        return result;
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    };
  }

  close() {
    this.db.close();
  }
}

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

function parseDatabaseUrl(rawUrl: string): string {
  let cleaned = rawUrl.trim();
  if (cleaned.startsWith("file://")) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith("file:")) cleaned = cleaned.slice(5);
  else if (cleaned.startsWith("sqlite://")) cleaned = cleaned.slice(9);
  else if (cleaned.startsWith("sqlite:")) cleaned = cleaned.slice(7);
  return path.resolve(cleaned);
}

function isPathWritable(targetPath: string): boolean {
  try {
    const dir = path.dirname(targetPath);
    mkdirSync(dir, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

function resolveDatabasePath(): string {
  let customPath: string | null = null;

  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) {
    customPath = parseDatabaseUrl(process.env.DATABASE_URL);
  } else if (process.env.DATABASE_PATH && process.env.DATABASE_PATH.trim()) {
    customPath = path.resolve(process.env.DATABASE_PATH);
  } else if (process.env.OMNISYSTEM_DB_PATH && process.env.OMNISYSTEM_DB_PATH.trim()) {
    customPath = path.resolve(process.env.OMNISYSTEM_DB_PATH);
  } else if (process.env.DB_PATH && process.env.DB_PATH.trim()) {
    customPath = path.resolve(process.env.DB_PATH);
  }

  const candidatePaths = [
    path.resolve(workspaceRoot, "artifacts/api-server/data/pos.db"),
    path.resolve(process.cwd(), "artifacts/api-server/data/pos.db"),
    path.resolve(process.cwd(), "data/pos.db"),
    path.resolve(moduleDir, "data/pos.db"),
    path.resolve(moduleDir, "../data/pos.db"),
    path.resolve(moduleDir, "../../artifacts/api-server/data/pos.db"),
    path.resolve(moduleDir, "../../../artifacts/api-server/data/pos.db"),
    path.resolve(moduleDir, "artifacts/api-server/data/pos.db")
  ];

  if (customPath) {
    if (isPathWritable(customPath)) {
      if (!existsSync(customPath)) {
        // Find an existing seed file to initialize the custom cloud path
        const seedCandidate = candidatePaths.find(p => existsSync(p));
        if (seedCandidate) {
          try {
            copyFileSync(seedCandidate, customPath);
            console.log(`[Database Cloud Setup] Seeded initial database from ${seedCandidate} to custom location ${customPath}`);
          } catch (copyErr) {
            console.warn(`[Database Cloud Setup] Could not copy seed database:`, copyErr);
          }
        }
      }
      return customPath;
    } else {
      console.warn(`[Database Cloud Setup] Warning: Custom path "${customPath}" is not writable (EACCES permission denied). Falling back to project data path.`);
    }
  }

  for (const candidate of candidatePaths) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return path.resolve(workspaceRoot, "artifacts/api-server/data/pos.db");
}

let dbPath = resolveDatabasePath();

try {
  mkdirSync(path.dirname(dbPath), { recursive: true });
} catch (mkdirErr: any) {
  console.warn(`[Database Setup] Cannot create directory for ${dbPath}: ${mkdirErr?.message}. Falling back to ./data/pos.db`);
  dbPath = path.resolve(process.cwd(), "data/pos.db");
  try {
    mkdirSync(path.dirname(dbPath), { recursive: true });
  } catch (err) {
    console.error("[Database Setup] Critical: Failed to create fallback directory:", err);
  }
}

console.log(`[Database] Connected to SQLite database at: ${dbPath}`);

let dbInstance: DatabaseWrapper;
try {
  dbInstance = new DatabaseWrapper(dbPath);
  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("foreign_keys = ON");
  const integrity = dbInstance.prepare("PRAGMA integrity_check").get() as any;
  const resVal = integrity ? Object.values(integrity)[0] : "ok";
  if (resVal !== "ok") {
    throw new Error("Database integrity check failed: " + JSON.stringify(integrity));
  }
} catch (err: any) {
  console.error("Database connection/corruption error:", err);
  if (
    err?.message?.includes("malformed") ||
    err?.code === "SQLITE_CORRUPT" ||
    err?.message?.includes("corrupt") ||
    err?.message?.includes("integrity check")
  ) {
    if (dbInstance) {
      try {
        dbInstance.close();
      } catch (closeErr) {
        console.error("Failed to close corrupted database:", closeErr);
      }
    }

    const timestamp = Date.now();
    const backupPath = `${dbPath}.corrupt.${timestamp}`;
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    const walBackupPath = `${walPath}.corrupt.${timestamp}`;
    const shmBackupPath = `${shmPath}.corrupt.${timestamp}`;

    try {
      if (existsSync(dbPath)) {
        try {
          renameSync(dbPath, backupPath);
          console.warn(`Backed up corrupted database to ${backupPath}`);
        } catch (renameErr) {
          console.warn("Could not rename locked DB file. Attempting to delete instead.");
          unlinkSync(dbPath);
        }
      }
      if (existsSync(walPath)) {
        try {
          renameSync(walPath, walBackupPath);
        } catch {
          try { unlinkSync(walPath); } catch {}
        }
      }
      if (existsSync(shmPath)) {
        try {
          renameSync(shmPath, shmBackupPath);
        } catch {
          try { unlinkSync(shmPath); } catch {}
        }
      }
      console.warn("Cleared corrupted database files. Creating fresh database.");
    } catch (e) {
      console.error("Failed to backup/clear corrupted db:", e);
    }
  }
  dbInstance = new DatabaseWrapper(dbPath);
  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("foreign_keys = ON");
}

export const db = dbInstance;
export const activeDatabasePath = dbPath;
export function getActiveDatabasePath(): string {
  return dbPath;
}
export function createDatabaseInstance(filepath: string): DatabaseWrapper {
  return new DatabaseWrapper(filepath);
}

export function resetEntireDatabase(): { success: boolean; message: string; deletedCounts: Record<string, number> } {
  const tablesToClear = [
    "order_items", "orders", "return_items", "returns",
    "sales_installments", "pos_draft_items", "pos_drafts",
    "quote_items", "quotes", "table_order_items", "table_orders", "reservations",
    "purchase_items", "purchase_invoices", "purchase_return_items", "purchase_returns", "purchase_order_items", "purchase_orders",
    "vouchers", "journal_entry_lines", "journal_entries",
    "expenses", "cash_drawer_logs", "cash_transfers", "bank_reconciliations", "shifts",
    "passengers", "travel_groups", "travel_visas", "travel_bus_bookings", "travel_hotel_bookings", "travel_flight_tickets",
    "travel_invoice_items", "travel_invoices", "travel_quotation_items", "travel_quotations", "travel_tasks", "travel_suppliers",
    "travel_insurance", "travel_transport", "travel_documents", "travel_approvals", "travel_bsp_reconciliation",
    "products", "product_categories", "product_units", "product_batches", "stock_adjustments", "stocktake_records", "price_tiers",
    "customers", "suppliers", "customer_points", "point_transactions",
    "notifications", "whatsapp_logs", "audit_logs", "activity_logs", "chat_messages"
  ];

  const deletedCounts: Record<string, number> = {};

  db.exec("PRAGMA foreign_keys = OFF;");
  
  for (const table of tablesToClear) {
    try {
      const count = (db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as any)?.c || 0;
      db.exec(`DELETE FROM ${table};`);
      deletedCounts[table] = count;
      try {
        db.exec(`DELETE FROM sqlite_sequence WHERE name='${table}';`);
      } catch (e) {}
    } catch (e) {
      // Table might not exist in some versions, ignore
    }
  }

  // Reset safes balance to zero
  try {
    db.exec("UPDATE safes SET balance = 0;");
  } catch (e) {}

  // Reseed clean default products, categories and basic settings if empty
  try {
    const catCheck = (db.prepare("SELECT COUNT(*) as c FROM product_categories").get() as any)?.c || 0;
    if (catCheck === 0) {
      db.prepare("INSERT INTO product_categories (name, icon) VALUES ('خدمات السفر والسياحة', 'Plane')").run();
      db.prepare("INSERT INTO product_categories (name, icon) VALUES ('خدمات الحج والعمرة', 'Building')").run();
      db.prepare("INSERT INTO product_categories (name, icon) VALUES ('تأشيرات وإقامات', 'FileText')").run();
    }
  } catch (e) {}

  // Ensure developer & admin users remain with full access
  try {
    const devHash = hashPassword("dev123");
    const adminHash = hashPassword("admin123");
    db.prepare(`INSERT OR REPLACE INTO users (id, username, password_hash, name, role, active, can_discount, perm_create_invoice, perm_edit_invoice, perm_cancel_invoice, perm_return, perm_view_prices, perm_view_profits, perm_edit_stock, perm_stocktake, perm_edit_entries, perm_close_periods, perm_view_salaries) 
      VALUES (1, 'admin', ?, 'مدير عام الشركة', 'admin', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1)`).run(adminHash);
    db.prepare(`INSERT OR REPLACE INTO users (id, username, password_hash, name, role, active, can_discount, perm_create_invoice, perm_edit_invoice, perm_cancel_invoice, perm_return, perm_view_prices, perm_view_profits, perm_edit_stock, perm_stocktake, perm_edit_entries, perm_close_periods, perm_view_salaries) 
      VALUES (2, 'developer', ?, 'مطور النظام', 'developer', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1)`).run(devHash);
  } catch (e) {}

  db.exec("PRAGMA foreign_keys = ON;");

  return {
    success: true,
    message: "تم تصفير ومحو كافة بيانات وسجلات قاعدة البيانات بنجاح، وتهيئة النظام كنسخة جديدة ونظيفة بالكامل.",
    deletedCounts
  };
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!password || !stored) return false;
  if (!stored.includes(":")) {
    return password === stored;
  }
  try {
    const [salt, storedHash] = stored.split(":");
    if (!salt || !storedHash) return password === stored;
    const hash = scryptSync(password, salt, 64);
    const storedBuf = Buffer.from(storedHash, "hex");
    if (hash.length !== storedBuf.length) return false;
    return timingSafeEqual(hash, storedBuf);
  } catch (e) {
    return password === stored;
  }
}

export const sessions = new Map<string, number>();

export function createSession(userId: number): string {
  const token = randomBytes(32).toString("hex");
  sessions.set(token, userId);
  try {
    db.prepare("INSERT OR REPLACE INTO user_tokens (token, user_id, created_at) VALUES (?, ?, datetime('now'))").run(token, userId);
  } catch (e) {}
  return token;
}

export function getSessionUser(token: string): number | undefined {
  if (sessions.has(token)) return sessions.get(token);
  try {
    const row = db.prepare("SELECT user_id FROM user_tokens WHERE token = ?").get(token) as { user_id: number } | undefined;
    if (row && row.user_id) {
      sessions.set(token, row.user_id);
      return row.user_id;
    }
  } catch (e) {}
  return undefined;
}

export function deleteSession(token: string): void {
  sessions.delete(token);
  try {
    db.prepare("DELETE FROM user_tokens WHERE token = ?").run(token);
  } catch (e) {}
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS erp_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      device_name TEXT,
      login_time DATETIME,
      logout_time DATETIME,
      status TEXT DEFAULT 'نشط',
      branch_id INTEGER DEFAULT 1,
      language TEXT DEFAULT 'عربي'
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'cashier',
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT,
      cost REAL DEFAULT 0.0,
      revenue REAL DEFAULT 0.0
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      cost REAL,
      barcode TEXT,
      category_id INTEGER REFERENCES categories(id),
      active INTEGER NOT NULL DEFAULT 1,
      stock INTEGER,
      is_sellable INTEGER NOT NULL DEFAULT 1,
      show_in_pos INTEGER NOT NULL DEFAULT 1,
      item_type TEXT NOT NULL DEFAULT 'sellable'
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      cash_amount REAL,
      card_amount REAL,
      customer_id INTEGER REFERENCES customers(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      note TEXT,
      order_type TEXT NOT NULL DEFAULT 'dine-in',
      table_number TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total REAL NOT NULL,
      category_id INTEGER REFERENCES categories(id),
      category_name TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS receipt_copy_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      copy_number INTEGER NOT NULL,
      label TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS department_print_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
      printer_name TEXT,
      copies INTEGER NOT NULL DEFAULT 1,
      enabled INTEGER NOT NULL DEFAULT 1,
      print_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS print_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      invoice_number TEXT NOT NULL,
      receipt_type TEXT NOT NULL,
      department_name TEXT,
      printer_name TEXT,
      printed_at TEXT NOT NULL DEFAULT (datetime('now')),
      user_id INTEGER NOT NULL,
      user_name TEXT,
      copies INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'success',
      reprint_reason TEXT,
      reprint_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS printer_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      paper_width INTEGER NOT NULL DEFAULT 80,
      left_margin REAL NOT NULL DEFAULT 1.5,
      right_margin REAL NOT NULL DEFAULT 1.5,
      top_margin REAL NOT NULL DEFAULT 1,
      bottom_margin REAL NOT NULL DEFAULT 1,
      font_size INTEGER NOT NULL DEFAULT 10,
      line_spacing REAL NOT NULL DEFAULT 2,
      characters_per_line INTEGER NOT NULL DEFAULT 48
    );

    CREATE TABLE IF NOT EXISTS document_print_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      company_name TEXT DEFAULT 'OmniSystem Pro',
      company_subtitle TEXT DEFAULT 'نظام نقاط البيع وإدارة الموارد',
      logo_url TEXT DEFAULT '/omnisystem-logo.png',
      customer_header_text TEXT DEFAULT 'كشف حساب عميل معتمد',
      customer_footer_text TEXT DEFAULT 'شكراً لتعاملكم معنا - يُرجى مراجعة الحسابات خلال 15 يوماً',
      employee_header_text TEXT DEFAULT 'كشف حساب ومسير رواتب موظف',
      employee_footer_text TEXT DEFAULT 'إدارة الموارد البشرية - التوقيع والاعتماد',
      voucher_receipt_title TEXT DEFAULT 'سند قبض',
      voucher_payment_title TEXT DEFAULT 'سند صرف',
      voucher_footer_text TEXT DEFAULT 'المحاسب _______ المدير _______ المستلم _______',
      report_header_text TEXT DEFAULT 'تقرير عام شامل',
      report_footer_text TEXT DEFAULT 'طبع بواسطة نظام OmniSystem Pro',
      accent_color TEXT DEFAULT '#2563eb'
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      type TEXT NOT NULL, -- 'in', 'out', 'adjustment'
      quantity REAL NOT NULL,
      previous_stock REAL NOT NULL,
      new_stock REAL NOT NULL,
      reason TEXT,
      reference_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      user_id INTEGER,
      user_name TEXT
    );

    CREATE TABLE IF NOT EXISTS hr_departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      budget REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS hr_employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_number TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      position TEXT,
      department_id INTEGER REFERENCES hr_departments(id),
      basic_salary REAL NOT NULL DEFAULT 0,
      balance REAL DEFAULT 0,
      credit_limit REAL DEFAULT 20000,
      allow_exceed_balance INTEGER DEFAULT 0,
      block_insufficient_balance INTEGER DEFAULT 1,
      hire_date TEXT,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS hr_salaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      basic_salary REAL NOT NULL DEFAULT 0,
      bonuses REAL NOT NULL DEFAULT 0,
      deductions REAL NOT NULL DEFAULT 0,
      net_salary REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      payment_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hr_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      check_in TEXT,
      check_out TEXT,
      status TEXT NOT NULL DEFAULT 'present',
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS hr_loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      amount REAL NOT NULL DEFAULT 0,
      type TEXT NOT NULL DEFAULT 'loan', -- 'loan' or 'temporary'
      request_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
      repayment_terms TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS hr_tools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      serial_number TEXT UNIQUE,
      quantity INTEGER NOT NULL DEFAULT 1,
      available_qty INTEGER NOT NULL DEFAULT 1,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS hr_tools_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tool_id INTEGER NOT NULL REFERENCES hr_tools(id) ON DELETE CASCADE,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      type TEXT NOT NULL, -- 'out' or 'in'
      quantity INTEGER NOT NULL DEFAULT 1,
      date TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS hr_entitlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      type TEXT NOT NULL, -- 'daily' or 'monthly'
      amount REAL NOT NULL DEFAULT 0,
      date TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS hr_leaves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      type TEXT NOT NULL, -- 'sick', 'annual', 'unpaid'
      status TEXT NOT NULL DEFAULT 'approved',
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS hr_custodies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      item_name TEXT NOT NULL,
      received_date TEXT NOT NULL,
      returned_date TEXT,
      status TEXT NOT NULL DEFAULT 'held', -- 'held' or 'returned'
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS hr_penalties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      violation_name TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      date TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS hr_overtime (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      hours REAL NOT NULL DEFAULT 0,
      rate REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      date TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS hr_temp_employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      position TEXT,
      daily_rate REAL NOT NULL DEFAULT 0,
      hire_date TEXT,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS hr_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_id INTEGER REFERENCES hr_departments(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      content TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_number TEXT UNIQUE NOT NULL,
      invoice_number TEXT NOT NULL,
      order_id INTEGER,
      reason TEXT,
      total_refund REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      customer_id INTEGER REFERENCES customers(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meal_deductions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id),
      employee_name TEXT NOT NULL,
      employee_number TEXT NOT NULL,
      order_id INTEGER REFERENCES orders(id),
      invoice_number TEXT,
      amount REAL NOT NULL DEFAULT 0,
      cashier_id INTEGER NOT NULL REFERENCES users(id),
      cashier_name TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voucher_number TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL, -- 'receipt' or 'payment'
      party_type TEXT NOT NULL, -- 'employee' or 'customer'
      party_id INTEGER NOT NULL,
      party_name TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'دينار',
      received_from TEXT,
      payment_against TEXT,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      amount_text TEXT,
      notes TEXT,
      header_title TEXT DEFAULT 'مخابز الشام للخبز العربي',
      header_subtitle TEXT DEFAULT 'Maamil Al Sham',
      logo_url TEXT DEFAULT '/omnisystem-logo.png',
      accent_color TEXT DEFAULT '#ef4444',
      bottom_text TEXT DEFAULT 'جودة الخبز ... سر ثقة عملائنا',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS manual_ledger_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      party_type TEXT NOT NULL, -- 'employee' or 'customer'
      party_id INTEGER NOT NULL,
      entry_date TEXT NOT NULL,
      description TEXT NOT NULL,
      debit REAL NOT NULL DEFAULT 0,
      credit REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      location TEXT,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS warehouse_stocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      stock REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      rating INTEGER NOT NULL DEFAULT 5,
      balance REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number TEXT UNIQUE NOT NULL,
      supplier_id INTEGER REFERENCES suppliers(id),
      status TEXT NOT NULL DEFAULT 'pending', -- pending, received, cancelled
      total REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      total REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cash_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      user_name TEXT NOT NULL,
      start_time TEXT NOT NULL DEFAULT (datetime('now')),
      end_time TEXT,
      starting_cash REAL NOT NULL DEFAULT 0,
      cash_sales REAL NOT NULL DEFAULT 0,
      card_sales REAL NOT NULL DEFAULT 0,
      withdrawals REAL NOT NULL DEFAULT 0,
      deposits REAL NOT NULL DEFAULT 0,
      actual_cash REAL,
      difference REAL,
      status TEXT NOT NULL DEFAULT 'open', -- open, closed
      safe_id INTEGER REFERENCES safes(id),
      branch_id INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS restaurant_tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_number TEXT UNIQUE NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 4,
      status TEXT NOT NULL DEFAULT 'available', -- available, occupied, reserved
      section TEXT DEFAULT 'الرئيسية',
      current_order_id INTEGER REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS product_recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      ingredient_name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      unit TEXT NOT NULL DEFAULT 'جم'
    );

    CREATE TABLE IF NOT EXISTS product_modifiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL, -- كهرباء، ماء، إيجار، مرتبات، تشغيل
      amount REAL NOT NULL,
      expense_date TEXT NOT NULL DEFAULT (date('now')),
      notes TEXT,
      user_id INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_key TEXT UNIQUE NOT NULL,
      client_name TEXT NOT NULL,
      devices_limit INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS license_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_id INTEGER REFERENCES licenses(id) ON DELETE CASCADE,
      device_id TEXT NOT NULL,
      device_name TEXT,
      authorized_by TEXT DEFAULT 'مطور النظام',
      status TEXT DEFAULT 'authorized',
      registered_at TEXT,
      last_active TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(license_id, device_id)
    );

    CREATE TABLE IF NOT EXISTS safes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'ريال',
      notes TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      user_name TEXT,
      action TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- DOUBLE ENTRY ACCOUNTING TABLES
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL, -- 'asset', 'liability', 'equity', 'revenue', 'expense', 'cogs', 'wastage'
      parent_code TEXT,
      balance REAL NOT NULL DEFAULT 0.0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_number TEXT UNIQUE NOT NULL,
      entry_date TEXT NOT NULL DEFAULT (date('now')),
      description TEXT NOT NULL,
      source_type TEXT, -- 'sale', 'return', 'purchase', 'expense', 'voucher', 'shift_difference'
      source_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS journal_entry_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      journal_entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      debit REAL NOT NULL DEFAULT 0.0,
      credit REAL NOT NULL DEFAULT 0.0,
      description TEXT
    );
    -- PROCUREMENT & PURCHASING SYSTEM TABLES
    CREATE TABLE IF NOT EXISTS purchase_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pr_number TEXT UNIQUE NOT NULL,
      requester_name TEXT NOT NULL,
      department TEXT,
      branch_id INTEGER DEFAULT 1,
      warehouse_id INTEGER DEFAULT 1,
      request_date TEXT NOT NULL,
      need_date TEXT,
      priority TEXT DEFAULT 'عادي', -- 'عادي', 'عالي', 'عاجل جداً'
      reason TEXT,
      status TEXT DEFAULT 'pending_approval', -- 'draft', 'review', 'pending_approval', 'approved', 'rejected', 'converted_to_po', 'completed', 'cancelled'
      approved_by TEXT,
      approval_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS purchase_request_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pr_id INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      product_name TEXT NOT NULL,
      unit TEXT DEFAULT 'كجم',
      requested_qty REAL NOT NULL,
      need_date TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS purchase_rfqs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rfq_number TEXT UNIQUE NOT NULL,
      pr_id INTEGER REFERENCES purchase_requests(id),
      item_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT DEFAULT 'كجم',
      supplier_id INTEGER REFERENCES suppliers(id),
      supplier_name TEXT NOT NULL,
      unit_price REAL NOT NULL,
      lead_time_days INTEGER DEFAULT 1,
      total_price REAL NOT NULL,
      quality_rating REAL DEFAULT 5.0,
      payment_terms TEXT DEFAULT 'نقداً',
      min_order_qty REAL DEFAULT 1,
      return_rate_percent REAL DEFAULT 0,
      on_time_delivery_percent REAL DEFAULT 100,
      status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS goods_receipt_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grn_number TEXT UNIQUE NOT NULL,
      po_id INTEGER REFERENCES purchase_orders(id),
      supplier_id INTEGER REFERENCES suppliers(id),
      supplier_name TEXT NOT NULL,
      branch_id INTEGER DEFAULT 1,
      warehouse_id INTEGER DEFAULT 1,
      received_date TEXT NOT NULL,
      delivery_note_ref TEXT,
      received_by TEXT NOT NULL,
      qc_passed INTEGER DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS goods_receipt_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grn_id INTEGER NOT NULL REFERENCES goods_receipt_notes(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      product_name TEXT NOT NULL,
      ordered_qty REAL NOT NULL,
      received_qty REAL NOT NULL,
      accepted_qty REAL NOT NULL,
      rejected_qty REAL DEFAULT 0,
      rejection_reason TEXT,
      temperature REAL,
      expiry_date TEXT,
      batch_number TEXT,
      quality_status TEXT DEFAULT 'مطابق'
    );

    CREATE TABLE IF NOT EXISTS purchase_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      supplier_invoice_ref TEXT,
      po_id INTEGER REFERENCES purchase_orders(id),
      grn_id INTEGER REFERENCES goods_receipt_notes(id),
      supplier_id INTEGER REFERENCES suppliers(id),
      supplier_name TEXT NOT NULL,
      branch_id INTEGER DEFAULT 1,
      warehouse_id INTEGER DEFAULT 1,
      invoice_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      shipping_cost REAL DEFAULT 0,
      additional_expenses REAL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      paid_amount REAL DEFAULT 0,
      remaining_amount REAL DEFAULT 0,
      payment_status TEXT DEFAULT 'unpaid', -- 'unpaid', 'partially_paid', 'paid'
      payment_method TEXT DEFAULT 'credit',
      is_direct_purchase INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS purchase_invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      product_name TEXT NOT NULL,
      unit TEXT DEFAULT 'كجم',
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      discount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS supplier_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_number TEXT UNIQUE NOT NULL,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      supplier_name TEXT NOT NULL,
      invoice_id INTEGER REFERENCES purchase_invoices(id),
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cash', -- 'cash', 'bank_transfer', 'check', 'earned_discount', 'settlement'
      check_number TEXT,
      bank_name TEXT,
      reference_number TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS supplier_contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_number TEXT UNIQUE NOT NULL,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      supplier_name TEXT NOT NULL,
      title TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      agreed_amount REAL DEFAULT 0,
      payment_terms TEXT,
      status TEXT DEFAULT 'active', -- 'active', 'expired', 'terminated'
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS supplier_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      supplier_name TEXT NOT NULL,
      evaluation_date TEXT NOT NULL,
      price_score REAL DEFAULT 5,
      quality_score REAL DEFAULT 5,
      delivery_score REAL DEFAULT 5,
      return_score REAL DEFAULT 5,
      overall_rating REAL DEFAULT 5,
      evaluator_name TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS procurement_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      tier1_limit REAL DEFAULT 500000, -- Manager branch
      tier2_limit REAL DEFAULT 2000000, -- System Manager
      auto_reorder_enabled INTEGER DEFAULT 1,
      default_tax_rate REAL DEFAULT 15,
      default_payment_terms TEXT DEFAULT '30 يوم'
    );

    CREATE TABLE IF NOT EXISTS stock_waste_records (
      id TEXT PRIMARY KEY,
      waste_number TEXT UNIQUE NOT NULL,
      warehouse_name TEXT DEFAULT 'المخزن الرئيسي',
      product_name TEXT NOT NULL,
      product_id INTEGER REFERENCES products(id),
      quantity REAL NOT NULL DEFAULT 1,
      unit TEXT DEFAULT 'حبة',
      unit_cost REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      reason TEXT,
      notes TEXT,
      waste_date TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      user_id INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      status TEXT DEFAULT 'approved',
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancel_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS stock_issue_vouchers (
      id TEXT PRIMARY KEY,
      voucher_number TEXT UNIQUE NOT NULL,
      warehouse_name TEXT DEFAULT 'المخزن الرئيسي',
      issue_type TEXT,
      recipient TEXT,
      notes TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      status TEXT DEFAULT 'approved',
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancel_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS stock_return_vouchers (
      id TEXT PRIMARY KEY,
      voucher_number TEXT UNIQUE NOT NULL,
      warehouse_name TEXT DEFAULT 'المخزن الرئيسي',
      return_type TEXT,
      supplier_name TEXT,
      reason TEXT,
      notes TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      status TEXT DEFAULT 'approved',
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancel_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS stock_transfers (
      id TEXT PRIMARY KEY,
      transfer_number TEXT UNIQUE NOT NULL,
      from_warehouse TEXT,
      to_warehouse TEXT,
      notes TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      status TEXT DEFAULT 'approved',
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancel_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS stocktakes (
      id TEXT PRIMARY KEY,
      stocktake_number TEXT UNIQUE NOT NULL,
      warehouse_name TEXT DEFAULT 'المخزن الرئيسي',
      notes TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      status TEXT DEFAULT 'approved',
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancel_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS stock_receipt_vouchers (
      id TEXT PRIMARY KEY,
      voucher_number TEXT UNIQUE NOT NULL,
      warehouse_name TEXT DEFAULT 'المخزن الرئيسي',
      receipt_type TEXT,
      supplier_name TEXT,
      notes TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      status TEXT DEFAULT 'approved',
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancel_reason TEXT
    );
  `);
}

export function logAudit(
  userId: number,
  userName: string,
  action: string,
  details: string,
  device?: string,
  ip?: string,
  oldData?: string,
  newData?: string,
  reason?: string
) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, action, details, device, ip, old_data, new_data, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId ?? null,
      userName ?? "system",
      action,
      details,
      device ?? null,
      ip ?? null,
      oldData ?? null,
      newData ?? null,
      reason ?? null
    );
  } catch (err) {
    try {
      db.prepare("INSERT INTO audit_logs (user_id, user_name, action, details) VALUES (?,?,?,?)")
        .run(userId ?? null, userName ?? "system", action, details);
    } catch {}
  }
}

function runMigrations() {
  // Audit log columns
  try { db.exec("ALTER TABLE audit_logs ADD COLUMN device TEXT"); } catch {}
  try { db.exec("ALTER TABLE audit_logs ADD COLUMN ip TEXT"); } catch {}
  try { db.exec("ALTER TABLE audit_logs ADD COLUMN old_data TEXT"); } catch {}
  try { db.exec("ALTER TABLE audit_logs ADD COLUMN new_data TEXT"); } catch {}
  try { db.exec("ALTER TABLE audit_logs ADD COLUMN reason TEXT"); } catch {}

  // User details and granular permissions columns
  try { db.exec("ALTER TABLE users ADD COLUMN employee_id INTEGER REFERENCES hr_employees(id)"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN branch_id INTEGER REFERENCES branches(id)"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN perm_create_invoice INTEGER NOT NULL DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN perm_edit_invoice INTEGER NOT NULL DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN perm_cancel_invoice INTEGER NOT NULL DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN perm_return INTEGER NOT NULL DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN perm_view_prices INTEGER NOT NULL DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN perm_view_profits INTEGER NOT NULL DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN perm_edit_stock INTEGER NOT NULL DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN perm_stocktake INTEGER NOT NULL DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN perm_edit_entries INTEGER NOT NULL DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN perm_close_periods INTEGER NOT NULL DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN perm_view_salaries INTEGER NOT NULL DEFAULT 1"); } catch {}

  // Standardize printer settings table (Default 8mm left margin for 80mm thermal printers to prevent edge clipping)
  try {
    db.exec(`INSERT OR IGNORE INTO printer_settings (id, paper_width, left_margin, right_margin, top_margin, bottom_margin, font_size, line_spacing, characters_per_line)
             VALUES (1, 80, 8, 4, 2, 2, 11, 2, 48)`);
  } catch {}

  // Journal entries & lines multi-currency and Onyx voucher metadata columns
  try { db.exec("ALTER TABLE journal_entries ADD COLUMN currency TEXT DEFAULT 'YER'"); } catch {}
  try { db.exec("ALTER TABLE journal_entries ADD COLUMN currency_rate REAL DEFAULT 1.0"); } catch {}
  try { db.exec("ALTER TABLE journal_entries ADD COLUMN reference_no TEXT"); } catch {}
  try { db.exec("ALTER TABLE journal_entries ADD COLUMN doc_type TEXT DEFAULT 'قيد عادي'"); } catch {}
  try { db.exec("ALTER TABLE journal_entries ADD COLUMN cost_center_id INTEGER"); } catch {}
  try { db.exec("ALTER TABLE journal_entries ADD COLUMN entry_class TEXT DEFAULT 'عام'"); } catch {}
  try { db.exec("ALTER TABLE journal_entries ADD COLUMN tx_code TEXT"); } catch {}
  try { db.exec("ALTER TABLE journal_entries ADD COLUMN attachments TEXT"); } catch {}
  try { db.exec("ALTER TABLE journal_entries ADD COLUMN is_reversed INTEGER DEFAULT 0"); } catch {}

  // Travel Passengers Umrah & Stay Monitoring columns
  try { db.exec("ALTER TABLE travel_passengers ADD COLUMN visa_type TEXT DEFAULT 'تأشيرة عمره'"); } catch {}
  try { db.exec("ALTER TABLE travel_passengers ADD COLUMN travel_date TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_passengers ADD COLUMN program_duration_days INTEGER DEFAULT 90"); } catch {}
  try { db.exec("ALTER TABLE travel_passengers ADD COLUMN expected_exit_date TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_passengers ADD COLUMN remaining_days INTEGER"); } catch {}
  try { db.exec("ALTER TABLE travel_passengers ADD COLUMN travel_status TEXT DEFAULT 'داخل مكة'"); } catch {}

  try { db.exec("ALTER TABLE journal_entry_lines ADD COLUMN currency TEXT DEFAULT 'YER'"); } catch {}
  try { db.exec("ALTER TABLE journal_entry_lines ADD COLUMN exchange_rate REAL DEFAULT 1.0"); } catch {}
  try { db.exec("ALTER TABLE journal_entry_lines ADD COLUMN foreign_amount REAL DEFAULT 0.0"); } catch {}
  try { db.exec("ALTER TABLE journal_entry_lines ADD COLUMN cost_center_id INTEGER"); } catch {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS stock_receipt_vouchers (
        id TEXT PRIMARY KEY,
        voucher_number TEXT UNIQUE NOT NULL,
        warehouse_name TEXT DEFAULT 'المخزن الرئيسي',
        receipt_type TEXT,
        supplier_name TEXT,
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        status TEXT DEFAULT 'approved',
        cancelled_at TEXT,
        cancelled_by TEXT,
        cancel_reason TEXT
      );
    `);
  } catch (e) {}

  // categories table cost/revenue migrations
  try { db.exec("ALTER TABLE categories ADD COLUMN cost REAL DEFAULT 0.0"); } catch {}
  try { db.exec("ALTER TABLE categories ADD COLUMN revenue REAL DEFAULT 0.0"); } catch {}

  // orders table migrations
  try { db.exec("ALTER TABLE order_items ADD COLUMN category_id INTEGER REFERENCES categories(id)"); } catch {}
  try { db.exec("ALTER TABLE order_items ADD COLUMN category_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE orders ADD COLUMN order_type TEXT NOT NULL DEFAULT 'dine-in'"); } catch {}
  try { db.exec("ALTER TABLE orders ADD COLUMN table_number TEXT"); } catch {}
  try { db.exec("ALTER TABLE orders ADD COLUMN supplier_id INTEGER"); } catch {}
  try { db.exec("ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'completed'"); } catch {}
  try { db.exec("ALTER TABLE customers ADD COLUMN balance REAL DEFAULT 0.0"); } catch {}
  try { db.exec("ALTER TABLE customers ADD COLUMN customer_number TEXT"); } catch {}
  try { db.exec("ALTER TABLE suppliers ADD COLUMN mobile_number TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_suppliers ADD COLUMN mobile_number TEXT"); } catch {}
  try {
    const checkBank = db.prepare("SELECT * FROM accounts WHERE code = '11102'").get();
    if (!checkBank) {
      db.prepare("INSERT INTO accounts (code, name, type, parent_code, balance, currency, auto_add, level) VALUES ('11102', 'الحسابات البنكية والمصارف (Bank Accounts)', 'asset', '11000', 0, 'YER', 1, 2)").run();
    }
  } catch {}
  try { db.exec("ALTER TABLE printer_settings ADD COLUMN main_printer_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN allow_meal_deduction INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN can_discount INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("UPDATE users SET can_discount = 1 WHERE role IN ('admin', 'developer', 'accountant')"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN perm_pos_only INTEGER DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN perm_pos_discount INTEGER DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN perm_pos_employee_invoice INTEGER DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN perm_pos_delivery INTEGER DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN perm_pos_dinein INTEGER DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN perm_pos_takeaway INTEGER DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN perm_pos_credit INTEGER DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN perm_pos_cash INTEGER DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN perm_pos_card INTEGER DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN perm_pos_mixed INTEGER DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN perm_last_invoice_reprint TEXT DEFAULT 'all'"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN default_screen TEXT DEFAULT 'dashboard'"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN email TEXT"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN phone TEXT"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN default_branch_id INTEGER DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN language TEXT DEFAULT 'عربي'"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'GMT+3'"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'نشط'"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN full_name TEXT"); } catch {}

  // Ensure quotations, quotation_items, sales_returns, and sales_return_items tables exist
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS quotations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quotation_number TEXT UNIQUE NOT NULL,
        customer_id INTEGER REFERENCES customers(id),
        customer_name TEXT,
        customer_phone TEXT,
        quotation_date TEXT NOT NULL DEFAULT (date('now')),
        expiry_date TEXT,
        total_amount REAL NOT NULL DEFAULT 0,
        discount REAL DEFAULT 0,
        tax REAL DEFAULT 0,
        net_amount REAL NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        user_id INTEGER,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS quotation_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
        product_id INTEGER,
        product_name TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL DEFAULT 0,
        discount REAL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS sales_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_no TEXT UNIQUE,
        invoice_id INTEGER,
        invoice_no TEXT,
        customer_id INTEGER REFERENCES customers(id),
        customer_name TEXT,
        return_date TEXT NOT NULL DEFAULT (date('now')),
        warehouse_id INTEGER DEFAULT 1,
        total_amount REAL NOT NULL DEFAULT 0,
        paid_amount REAL NOT NULL DEFAULT 0,
        remaining_amount REAL NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'posted',
        notes TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS sales_return_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_id INTEGER NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
        product_id INTEGER,
        item_code TEXT,
        item_name TEXT NOT NULL,
        unit TEXT DEFAULT 'حبة',
        quantity REAL NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0
      );
    `);
  } catch (e) {
    console.error("Error creating quotations/sales_returns tables:", e);
  }
  try { db.exec("ALTER TABLE orders ADD COLUMN is_employee_meal INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE orders ADD COLUMN employee_id INTEGER"); } catch {}
  try { db.exec("ALTER TABLE orders ADD COLUMN safe_id INTEGER REFERENCES safes(id)"); } catch {}
  try { db.exec("ALTER TABLE cash_shifts ADD COLUMN safe_id INTEGER REFERENCES safes(id)"); } catch {}
  try { db.exec("ALTER TABLE cash_shifts ADD COLUMN branch_id INTEGER DEFAULT 1"); } catch {}
  
  // Safe box migrations and seeding
  try { db.exec("ALTER TABLE safes ADD COLUMN opening_balance REAL DEFAULT 0.0"); } catch {}
  try { db.exec("ALTER TABLE safes ADD COLUMN actual_balance REAL DEFAULT 0.0"); } catch {}
  try { db.exec("ALTER TABLE safes ADD COLUMN difference REAL DEFAULT 0.0"); } catch {}
  try { db.exec("ALTER TABLE safes ADD COLUMN status TEXT DEFAULT 'open'"); } catch {}
  try { db.exec("ALTER TABLE safes ADD COLUMN branch_id INTEGER"); } catch {}
  try { db.exec("ALTER TABLE safes ADD COLUMN cashier_id INTEGER"); } catch {}
  try { db.exec("ALTER TABLE safes ADD COLUMN last_closing_date TEXT"); } catch {}
  try { db.exec("ALTER TABLE safes ADD COLUMN reconciliation_reason TEXT"); } catch {}

  try { db.exec("ALTER TABLE returns ADD COLUMN approved_by INTEGER REFERENCES users(id)"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN approved_at TEXT"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN status TEXT DEFAULT 'approved'"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN branch_id INTEGER DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN warehouse_id INTEGER DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN return_type TEXT DEFAULT 'مردود مبيعات نقدي'"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN safe_id INTEGER REFERENCES safes(id)"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN currency TEXT DEFAULT 'ريال'"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN exchange_rate REAL DEFAULT 1.0"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN cost_center TEXT DEFAULT '101'"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN delegate_id TEXT"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN driver_id TEXT"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN region_id TEXT"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN reference_number TEXT"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN commission_rate REAL DEFAULT 0.0"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN attachments_count INTEGER DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN is_suspended INTEGER DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN is_posted INTEGER DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN subtotal REAL DEFAULT 0.0"); } catch {}
  try {
    db.exec(`
      UPDATE products 
      SET barcode = '6281000000' || printf('%02d', id) 
      WHERE barcode IS NULL OR barcode = '' OR TRIM(barcode) = '';
    `);
  } catch (e) {}
  try { db.exec("ALTER TABLE returns ADD COLUMN tax REAL DEFAULT 0.0"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN additional_charges REAL DEFAULT 0.0"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN entry_device TEXT DEFAULT 'WORKSTATION-01'"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN print_count INTEGER DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN edit_count INTEGER DEFAULT 0"); } catch {}

  try { db.exec("ALTER TABLE return_items ADD COLUMN item_code TEXT"); } catch {}
  try { db.exec("ALTER TABLE return_items ADD COLUMN unit TEXT DEFAULT 'حبة'"); } catch {}
  try { db.exec("ALTER TABLE return_items ADD COLUMN invoice_number TEXT"); } catch {}
  try { db.exec("ALTER TABLE return_items ADD COLUMN original_quantity INTEGER DEFAULT 1"); } catch {}

  // Convert old invoice numbers to clean plain integers (1, 2, 3...)
  try {
    db.exec(`
      UPDATE orders 
      SET invoice_number = CAST(id AS TEXT);
    `);
    db.exec(`
      UPDATE returns 
      SET invoice_number = CAST(COALESCE(order_id, 1) AS TEXT);
    `);
  } catch (e) {
    console.error("Migration error updating invoice numbers:", e);
  }

  try { db.exec("ALTER TABLE users ADD COLUMN perm_last_invoice_reprint TEXT DEFAULT 'all'"); } catch {}
  try { db.exec("ALTER TABLE expenses ADD COLUMN safe_id INTEGER REFERENCES safes(id)"); } catch {}
  try { db.exec("ALTER TABLE vouchers ADD COLUMN safe_id INTEGER REFERENCES safes(id)"); } catch {}
  try { db.exec("ALTER TABLE licenses ADD COLUMN status TEXT DEFAULT 'active'"); } catch {}
  try { db.exec("ALTER TABLE licenses ADD COLUMN target_version TEXT DEFAULT '1.1.0'"); } catch {}
  try { db.exec("ALTER TABLE licenses ADD COLUMN license_type TEXT DEFAULT 'cloud'"); } catch {}
  try { db.exec("ALTER TABLE licenses ADD COLUMN notes TEXT"); } catch {}
  try { db.exec("ALTER TABLE license_devices ADD COLUMN authorized_by TEXT DEFAULT 'مطور النظام'"); } catch {}
  try { db.exec("ALTER TABLE license_devices ADD COLUMN status TEXT DEFAULT 'authorized'"); } catch {}
  try { db.exec("ALTER TABLE license_devices ADD COLUMN registered_at TEXT"); } catch {}
  try { db.exec("UPDATE license_devices SET registered_at = COALESCE(registered_at, last_active, datetime('now', 'localtime')) WHERE registered_at IS NULL"); } catch {}
  try {
    const safeCount = (db.prepare("SELECT COUNT(*) as c FROM safes").get() as { c: number }).c;
    if (safeCount === 0) {
      db.prepare("INSERT INTO safes (name, balance, currency, notes, active) VALUES (?, ?, ?, ?, 1)")
        .run("الصندوق الرئيسي", 1000000, "ريال", "الصندوق الافتراضي للنظام");
    }
  } catch (e) {
    console.error("Error seeding default safe:", e);
  }
  // Ensure developer and admin users exist and have correct roles & full permissions
  try {
    const devHash = hashPassword("dev123");
    const adminHash = hashPassword("admin123");
    const cashierHash = hashPassword("cashier123");
    const accountantHash = hashPassword("accountant123");

    const devUser = db.prepare("SELECT id FROM users WHERE username='developer'").get() as any;
    if (!devUser) {
      db.prepare(`INSERT INTO users (username, password_hash, name, role, active, is_suspended, can_discount, perm_create_invoice, perm_edit_invoice, perm_cancel_invoice, perm_return, perm_view_prices, perm_view_profits, perm_edit_stock, perm_stocktake, perm_edit_entries, perm_close_periods, perm_view_salaries, is_system_admin) VALUES (?,?,?,?,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1)`)
        .run("developer", devHash, "مطور النظام", "developer");
    } else {
      db.prepare("UPDATE users SET role = 'developer', active = 1, is_suspended = 0, can_discount = 1 WHERE username = 'developer'").run();
    }

    const adminUser = db.prepare("SELECT id FROM users WHERE username='admin'").get() as any;
    if (!adminUser) {
      db.prepare(`INSERT INTO users (username, password_hash, name, role, active, is_suspended, can_discount, perm_create_invoice, perm_edit_invoice, perm_cancel_invoice, perm_return, perm_view_prices, perm_view_profits, perm_edit_stock, perm_stocktake, perm_edit_entries, perm_close_periods, perm_view_salaries, is_system_admin) VALUES (?,?,?,?,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1)`)
        .run("admin", adminHash, "مدير عام الشركة", "admin");
    } else {
      db.prepare("UPDATE users SET role = 'admin', active = 1, is_suspended = 0, can_discount = 1 WHERE username = 'admin'").run();
    }

    const cashierUser = db.prepare("SELECT id FROM users WHERE username='cashier'").get() as any;
    if (!cashierUser) {
      db.prepare(`INSERT INTO users (username, password_hash, name, role, active, is_suspended, perm_pos_only, can_discount, default_screen) VALUES (?,?,?,?,1,0,1,1,'pos')`)
        .run("cashier", cashierHash, "كاشير نقطة البيع", "cashier");
    }

    const accountantUser = db.prepare("SELECT id FROM users WHERE username='accountant'").get() as any;
    if (!accountantUser) {
      db.prepare(`INSERT INTO users (username, password_hash, name, role, active, is_suspended, can_discount, default_screen) VALUES (?,?,?,?,1,0,1,'dashboard')`)
        .run("accountant", accountantHash, "المحاسب المالي", "accountant");
    }

    // Upgrade all admin/general manager accounts to full permission flags
    db.prepare(`
      UPDATE users 
      SET 
        perm_create_invoice = 1,
        perm_edit_invoice = 1,
        perm_cancel_invoice = 1,
        perm_return = 1,
        perm_view_prices = 1,
        perm_view_profits = 1,
        perm_edit_stock = 1,
        perm_stocktake = 1,
        perm_edit_entries = 1,
        perm_close_periods = 1,
        perm_view_salaries = 1,
        can_discount = 1,
        active = 1,
        is_suspended = 0
      WHERE role IN ('admin', 'developer', 'general_manager', 'مدير', 'مدير عام', 'مدير عام الشركة') OR username IN ('admin', 'developer')
    `).run();
  } catch (e) {
    console.error("Error ensuring admin/developer users:", e);
  }
  // printer_settings default row (never overwrite existing user-saved settings on startup)
  try {
    db.exec(`INSERT OR IGNORE INTO printer_settings (id, paper_width, left_margin, right_margin, top_margin, bottom_margin, font_size, line_spacing, characters_per_line)
             VALUES (1, 80, 1, 1, 1, 1, 11, 2, 48)`);
    const migFlag = db.prepare("SELECT value FROM settings WHERE key = 'printer_1mm_calibrated_v1'").get() as { value: string } | undefined;
    if (!migFlag) {
      db.exec(`UPDATE printer_settings SET left_margin = 1, right_margin = 1, top_margin = 1, bottom_margin = 1 WHERE id = 1`);
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('printer_1mm_calibrated_v1', 'true')").run();
    }
  } catch {}

  try { db.exec("ALTER TABLE purchase_returns ADD COLUMN invoice_id INTEGER"); } catch {}
  try { db.exec("ALTER TABLE purchase_returns ADD COLUMN return_date TEXT"); } catch {}
  try { db.exec("ALTER TABLE suppliers ADD COLUMN tax_number TEXT"); } catch {}
  try { db.exec("ALTER TABLE suppliers ADD COLUMN commercial_register TEXT"); } catch {}
  try { db.exec("ALTER TABLE suppliers ADD COLUMN payment_terms TEXT DEFAULT '30 يوم'"); } catch {}
  try { db.exec("ALTER TABLE suppliers ADD COLUMN contact_person TEXT"); } catch {}
  try { db.exec("ALTER TABLE suppliers ADD COLUMN bank_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE suppliers ADD COLUMN bank_account TEXT"); } catch {}
  try { db.exec("ALTER TABLE suppliers ADD COLUMN notes TEXT"); } catch {}

  // ────────────────────────────────────────────────────────
  // TRAVEL & TOURISM ERP TABLES & MIGRATIONS
  // ────────────────────────────────────────────────────────
  try { db.exec("ALTER TABLE customers ADD COLUMN name_en TEXT"); } catch {}
  try { db.exec("ALTER TABLE customers ADD COLUMN alternate_phone TEXT"); } catch {}
  try { db.exec("ALTER TABLE customers ADD COLUMN nationality TEXT"); } catch {}
  try { db.exec("ALTER TABLE customers ADD COLUMN country TEXT"); } catch {}
  try { db.exec("ALTER TABLE customers ADD COLUMN dob TEXT"); } catch {}
  try { db.exec("ALTER TABLE customers ADD COLUMN gender TEXT"); } catch {}
  try { db.exec("ALTER TABLE customers ADD COLUMN national_id TEXT"); } catch {}
  try { db.exec("ALTER TABLE customers ADD COLUMN passport_number TEXT"); } catch {}
  try { db.exec("ALTER TABLE customers ADD COLUMN passport_issue_date TEXT"); } catch {}
  try { db.exec("ALTER TABLE customers ADD COLUMN passport_expiry_date TEXT"); } catch {}
  try { db.exec("ALTER TABLE customers ADD COLUMN employer TEXT"); } catch {}
  try { db.exec("ALTER TABLE customers ADD COLUMN notes TEXT"); } catch {}
  try { db.exec("ALTER TABLE customers ADD COLUMN customer_type TEXT DEFAULT 'individual'"); } catch {}

  // travel_hotels two-party system & multi-currency migrations
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN voucher_number TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN hotel_db_id INTEGER REFERENCES travel_hotels_db(id)"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN country TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN city TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN customer_days INTEGER DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN supplier_days INTEGER DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN customer_currency TEXT DEFAULT 'SAR'"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN supplier_currency TEXT DEFAULT 'SAR'"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN commission_currency TEXT DEFAULT 'SAR'"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN customer_statement TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN supplier_statement TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN commission_statement TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN commission REAL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN profit REAL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN rooms_count INTEGER DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN guests_count INTEGER DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN meal_plan TEXT DEFAULT 'إفطار شامل (Bed & Breakfast)'"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN payment_method TEXT DEFAULT 'cash'"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN payment_status TEXT DEFAULT 'paid'"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN paid_amount REAL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN remaining_balance REAL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN supplier_payment_method TEXT DEFAULT 'credit'"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN supplier_payment_status TEXT DEFAULT 'unpaid'"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN supplier_paid_amount REAL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN supplier_remaining_balance REAL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN guest_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN guest_phone TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN guest_passport TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN confirmation_number TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN issue_date TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN customer_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN supplier_office_id INTEGER REFERENCES travel_partner_offices(id)"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN supplier_office_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN supplier_id INTEGER"); } catch {}
  try { db.exec("ALTER TABLE travel_hotels ADD COLUMN supplier_name TEXT"); } catch {}

  // travel_bus_bookings two-party system & supplier payment migrations
  try { db.exec("ALTER TABLE travel_bus_bookings ADD COLUMN supplier_payment_method TEXT DEFAULT 'credit'"); } catch {}
  try { db.exec("ALTER TABLE travel_bus_bookings ADD COLUMN supplier_payment_status TEXT DEFAULT 'unpaid'"); } catch {}
  try { db.exec("ALTER TABLE travel_bus_bookings ADD COLUMN supplier_paid_amount REAL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_bus_bookings ADD COLUMN supplier_remaining_balance REAL DEFAULT 0"); } catch {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS travel_passengers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
        name_ar TEXT NOT NULL,
        name_en TEXT NOT NULL,
        title TEXT DEFAULT 'Mr',
        dob TEXT,
        gender TEXT,
        nationality TEXT,
        passport_number TEXT,
        passport_issue_date TEXT,
        passport_expiry_date TEXT,
        passport_issue_place TEXT,
        passport_type TEXT DEFAULT 'عادي',
        national_id TEXT,
        phone TEXT,
        email TEXT,
        visa_type TEXT DEFAULT 'تأشيرة عمره',
        travel_date TEXT,
        program_duration_days INTEGER DEFAULT 90,
        expected_exit_date TEXT,
        remaining_days INTEGER,
        travel_status TEXT DEFAULT 'داخل مكة',
        special_notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_number TEXT UNIQUE NOT NULL,
        service_type TEXT NOT NULL DEFAULT 'flight',
        customer_id INTEGER REFERENCES customers(id),
        passenger_id INTEGER REFERENCES travel_passengers(id),
        airline_supplier TEXT,
        flight_number TEXT,
        origin_city TEXT,
        destination_city TEXT,
        departure_date TEXT,
        return_date TEXT,
        ticket_number TEXT,
        pnr TEXT,
        status TEXT DEFAULT 'confirmed',
        issue_date TEXT,
        cost_price REAL DEFAULT 0,
        selling_price REAL DEFAULT 0,
        commission REAL DEFAULT 0,
        paid_amount REAL DEFAULT 0,
        remaining_balance REAL DEFAULT 0,
        payment_status TEXT DEFAULT 'paid',
        payment_method TEXT DEFAULT 'cash',
        branch_id INTEGER DEFAULT 1,
        user_id INTEGER REFERENCES users(id),
        user_name TEXT,
        notes TEXT,
        missing_docs TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_visas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visa_number TEXT UNIQUE,
        customer_id INTEGER REFERENCES customers(id),
        passenger_id INTEGER REFERENCES travel_passengers(id),
        country TEXT NOT NULL,
        visa_type TEXT DEFAULT 'سياحية',
        status TEXT DEFAULT 'under_process',
        application_date TEXT,
        expiry_date TEXT,
        cost_price REAL DEFAULT 0,
        selling_price REAL DEFAULT 0,
        missing_docs TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_hotels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_ref TEXT UNIQUE,
        voucher_number TEXT,
        confirmation_number TEXT,
        customer_id INTEGER REFERENCES customers(id),
        customer_name TEXT,
        passenger_id INTEGER REFERENCES travel_passengers(id),
        guest_name TEXT,
        guest_phone TEXT,
        guest_passport TEXT,
        hotel_db_id INTEGER REFERENCES travel_hotels_db(id),
        hotel_name TEXT NOT NULL,
        country TEXT,
        city TEXT,
        city_country TEXT,
        check_in TEXT,
        check_out TEXT,
        room_type TEXT DEFAULT 'مزدوجة',
        nights INTEGER DEFAULT 1,
        customer_days INTEGER DEFAULT 1,
        supplier_days INTEGER DEFAULT 1,
        rooms_count INTEGER DEFAULT 1,
        guests_count INTEGER DEFAULT 1,
        meal_plan TEXT DEFAULT 'إفطار شامل (Bed & Breakfast)',
        cost_price REAL DEFAULT 0,
        selling_price REAL DEFAULT 0,
        commission REAL DEFAULT 0,
        profit REAL DEFAULT 0,
        customer_currency TEXT DEFAULT 'SAR',
        supplier_currency TEXT DEFAULT 'SAR',
        commission_currency TEXT DEFAULT 'SAR',
        customer_statement TEXT,
        supplier_statement TEXT,
        commission_statement TEXT,
        payment_method TEXT DEFAULT 'cash',
        payment_status TEXT DEFAULT 'paid',
        paid_amount REAL DEFAULT 0,
        remaining_balance REAL DEFAULT 0,
        supplier_payment_method TEXT DEFAULT 'credit',
        supplier_payment_status TEXT DEFAULT 'unpaid',
        supplier_paid_amount REAL DEFAULT 0,
        supplier_remaining_balance REAL DEFAULT 0,
        supplier_office_id INTEGER REFERENCES travel_partner_offices(id),
        supplier_office_name TEXT,
        supplier_id INTEGER,
        supplier_name TEXT,
        status TEXT DEFAULT 'confirmed',
        issue_date TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_contact_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        contact_date TEXT DEFAULT (datetime('now', 'localtime')),
        contact_type TEXT DEFAULT 'اتصال',
        summary TEXT NOT NULL,
        user_name TEXT
      );

      CREATE TABLE IF NOT EXISTS travel_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_type TEXT NOT NULL DEFAULT 'جواز السفر',
        title TEXT NOT NULL,
        file_url TEXT,
        file_name TEXT,
        file_size INTEGER DEFAULT 0,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        passenger_id INTEGER REFERENCES travel_passengers(id) ON DELETE SET NULL,
        booking_id INTEGER REFERENCES travel_bookings(id) ON DELETE SET NULL,
        visa_id INTEGER REFERENCES travel_visas(id) ON DELETE SET NULL,
        expiry_date TEXT,
        notify_before_days INTEGER DEFAULT 30,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_airlines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name_ar TEXT NOT NULL,
        name_en TEXT,
        iata_code TEXT NOT NULL,
        icao_code TEXT,
        country TEXT,
        phone TEXT,
        email TEXT,
        agent_name TEXT,
        default_commission_percent REAL DEFAULT 0,
        booking_conditions TEXT,
        notes TEXT,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_airports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        country TEXT NOT NULL,
        city TEXT NOT NULL,
        airport_name_ar TEXT NOT NULL,
        airport_name_en TEXT,
        iata_code TEXT NOT NULL UNIQUE,
        icao_code TEXT,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_hotels_db (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name_ar TEXT NOT NULL,
        name_en TEXT,
        country TEXT NOT NULL,
        city TEXT NOT NULL,
        star_rating INTEGER DEFAULT 4,
        address TEXT,
        phone TEXT,
        email TEXT,
        supplier_name TEXT,
        default_commission_percent REAL DEFAULT 0,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_ticket_refunds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        refund_number TEXT UNIQUE NOT NULL,
        booking_id INTEGER REFERENCES travel_bookings(id),
        ticket_number TEXT,
        pnr TEXT,
        customer_id INTEGER REFERENCES customers(id),
        passenger_id INTEGER REFERENCES travel_passengers(id),
        original_ticket_price REAL DEFAULT 0,
        original_selling_price REAL DEFAULT 0,
        airline_penalty REAL DEFAULT 0,
        office_refund_fee REAL DEFAULT 0,
        refunded_commission REAL DEFAULT 0,
        net_refund_to_customer REAL DEFAULT 0,
        office_net_profit_loss REAL DEFAULT 0,
        refund_reason TEXT,
        payment_method TEXT DEFAULT 'cash',
        safe_id INTEGER REFERENCES safes(id),
        user_id INTEGER REFERENCES users(id),
        user_name TEXT,
        refund_date TEXT DEFAULT (date('now')),
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_booking_modifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_id INTEGER REFERENCES travel_bookings(id),
        pnr TEXT,
        modification_type TEXT DEFAULT 'تغيير رحلة',
        old_flight_details TEXT,
        new_flight_details TEXT,
        fare_difference REAL DEFAULT 0,
        airline_reissue_fee REAL DEFAULT 0,
        office_modification_fee REAL DEFAULT 0,
        total_additional_cost REAL DEFAULT 0,
        total_additional_charge_to_customer REAL DEFAULT 0,
        notes TEXT,
        user_id INTEGER REFERENCES users(id),
        user_name TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );
    `);
  } catch (e) {
    console.error("Error running travel migrations:", e);
  }

  // Alter existing travel_bookings with additional fields
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN airline_id INTEGER"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN airline_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN origin_airport_code TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN destination_airport_code TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN routing_details TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN departure_time TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN arrival_date TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN arrival_time TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN travel_class TEXT DEFAULT 'اقتصادية'"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN fare_basis TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN baggage_weight REAL DEFAULT 30"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN baggage_pieces INTEGER DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN ticket_price REAL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN taxes REAL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN service_fee REAL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN discount REAL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN profit REAL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN issued_by_user_id INTEGER"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN issued_by_user_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN issue_time TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN supplier_id INTEGER"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN supplier_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN paid_amount REAL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN remaining_balance REAL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN supplier_currency TEXT DEFAULT 'SAR'"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN customer_currency TEXT DEFAULT 'SAR'"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN currency TEXT DEFAULT 'SAR'"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN booking_code TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN booking_type TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN customer_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN passenger_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN traveler_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN passport_number TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN destination TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN service_details TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN sell_price REAL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN airline TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN customer_statement TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN supplier_statement TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_bookings ADD COLUMN supplier_payment_method TEXT DEFAULT 'credit'"); } catch {}

  // travel_passengers
  try { db.exec("ALTER TABLE travel_passengers ADD COLUMN full_name_ar TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_passengers ADD COLUMN full_name_en TEXT"); } catch {}

  // travel_commissions
  try { db.exec("ALTER TABLE travel_commissions ADD COLUMN source_type TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_commissions ADD COLUMN source_id INTEGER"); } catch {}
  try { db.exec("ALTER TABLE travel_commissions ADD COLUMN customer_id INTEGER"); } catch {}
  try { db.exec("ALTER TABLE travel_commissions ADD COLUMN supplier_id INTEGER"); } catch {}
  try { db.exec("ALTER TABLE travel_commissions ADD COLUMN supplier_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_commissions ADD COLUMN service_description TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_commissions ADD COLUMN cost_amount REAL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_commissions ADD COLUMN sell_amount REAL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_commissions ADD COLUMN sale_amount REAL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_commissions ADD COLUMN commission_amount REAL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_commissions ADD COLUMN commission_rate REAL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_commissions ADD COLUMN earned_date TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_commissions ADD COLUMN agent_user_id INTEGER"); } catch {}
  try { db.exec("ALTER TABLE travel_commissions ADD COLUMN agent_user_name TEXT"); } catch {}

  // travel_notifications
  try { db.exec("ALTER TABLE travel_notifications ADD COLUMN channel TEXT DEFAULT 'whatsapp'"); } catch {}
  try { db.exec("ALTER TABLE travel_notifications ADD COLUMN recipient TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_notifications ADD COLUMN message_body TEXT"); } catch {}

  // travel_invoices
  try { db.exec("ALTER TABLE travel_invoices ADD COLUMN statement TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_invoices ADD COLUMN grand_total REAL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_invoices ADD COLUMN issue_date TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_invoices ADD COLUMN status TEXT DEFAULT 'confirmed'"); } catch {}

  // fiscal_periods
  try { db.exec("ALTER TABLE fiscal_periods ADD COLUMN fiscal_year TEXT DEFAULT '2026'"); } catch {}

  // purchase_order_items
  try { db.exec("ALTER TABLE purchase_order_items ADD COLUMN received_qty REAL DEFAULT 0"); } catch {}

  // returns
  try { db.exec("ALTER TABLE returns ADD COLUMN discount REAL DEFAULT 0"); } catch {}

  // journal_entries
  try { db.exec("ALTER TABLE journal_entries ADD COLUMN reference_number TEXT"); } catch {}
  try { db.exec("ALTER TABLE journal_entry_lines ADD COLUMN account_code TEXT"); } catch {}

  // inventory
  try { db.exec("ALTER TABLE stock_return_vouchers ADD COLUMN reference_number TEXT"); } catch {}
  try { db.exec("ALTER TABLE stock_transfers ADD COLUMN from_warehouse_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE stock_transfers ADD COLUMN to_warehouse_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE stocktakes ADD COLUMN type TEXT DEFAULT 'full'"); } catch {}
  try { db.exec("ALTER TABLE stocktakes ADD COLUMN performed_by TEXT"); } catch {}

  // Alter travel_visas
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN application_number TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN expected_travel_date TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN duration_days INTEGER DEFAULT 30"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN office_fees REAL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN paid_amount REAL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN remaining_balance REAL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN responsible_employee TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN embassy_entity TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN supplier_agent TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN checklist_passport INTEGER DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN checklist_photos INTEGER DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN checklist_hotel INTEGER DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN checklist_ticket INTEGER DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN checklist_bank INTEGER DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN checklist_job_letter INTEGER DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN checklist_insurance INTEGER DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN checklist_extra INTEGER DEFAULT 0"); } catch {}

  // Visa Action and Status tracking columns (مؤشرة، مرفوضة، مسلمة للعميل، سبب الرفض، المستلم)
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN issued_visa_number TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN issue_date TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN rejection_reason TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN rejection_date TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN delivered_to TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN delivery_date TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN delivery_method TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN delivery_notes TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN border_number TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN service_voucher_no TEXT"); } catch {}

  // Two-party (Customer & Delegated Supplier Office) and Multi-currency fields
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN supplier_office_id INTEGER REFERENCES travel_partner_offices(id)"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN supplier_office_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN customer_currency TEXT DEFAULT 'SAR'"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN customer_statement TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN supplier_currency TEXT DEFAULT 'SAR'"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN supplier_statement TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN agency_commission REAL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN commission_currency TEXT DEFAULT 'SAR'"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN exchange_rate REAL DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN account_entry_id INTEGER"); } catch {}
  
  // Visa step-by-step workflow tracking columns
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN outward_date TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN batch_number TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN outward_voucher_no TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN inward_date TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN inward_note TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN inward_status TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN department TEXT DEFAULT 'عام'"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN delivery_type TEXT DEFAULT 'باليد'"); } catch {}

  // Payment method and invoicing for transactions/visas
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN payment_method TEXT DEFAULT 'cash'"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN payment_status TEXT DEFAULT 'paid'"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN invoice_number TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_visas ADD COLUMN tax_amount REAL DEFAULT 0"); } catch {}

  // Universal Service Returns & Refunds Table (فواتير مردود الخدمات ومردود المعاملات)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS travel_service_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_number TEXT UNIQUE,
        original_service_ref TEXT,
        service_type TEXT NOT NULL,
        service_category_name TEXT DEFAULT 'مردود معاملات',
        service_item_id INTEGER,
        customer_id INTEGER REFERENCES customers(id),
        customer_name TEXT,
        passenger_name TEXT,
        statement TEXT,
        return_date TEXT,
        currency TEXT DEFAULT 'SAR',
        exchange_rate REAL DEFAULT 1.0,
        original_amount REAL DEFAULT 0,
        penalty_amount REAL DEFAULT 0,
        agency_refund_fee REAL DEFAULT 0,
        net_refund_amount REAL DEFAULT 0,
        supplier_penalty REAL DEFAULT 0,
        supplier_refund_amount REAL DEFAULT 0,
        supplier_id INTEGER,
        supplier_name TEXT,
        supplier_type TEXT,
        refund_method TEXT DEFAULT 'credit_balance',
        debit_account_code TEXT DEFAULT '41020',
        credit_account_code TEXT DEFAULT '11100',
        reason TEXT,
        notes TEXT,
        journal_entry_id INTEGER,
        created_by_user_id INTEGER,
        created_by_user_name TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      )
    `);
  } catch (e) {}

  // Centralized Sales & Invoices Multi-Service, Two-Party & Accounting Impact Fields
  try { db.exec("ALTER TABLE travel_invoices ADD COLUMN customer_statement TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_invoices ADD COLUMN currency TEXT DEFAULT 'SAR'"); } catch {}
  try { db.exec("ALTER TABLE travel_invoices ADD COLUMN exchange_rate REAL DEFAULT 1.0"); } catch {}
  try { db.exec("ALTER TABLE travel_invoices ADD COLUMN debit_account_code TEXT DEFAULT '11100'"); } catch {}
  try { db.exec("ALTER TABLE travel_invoices ADD COLUMN credit_account_code TEXT DEFAULT '41000'"); } catch {}
  try { db.exec("ALTER TABLE travel_invoices ADD COLUMN commission_account_code TEXT DEFAULT '45000'"); } catch {}
  try { db.exec("ALTER TABLE travel_invoices ADD COLUMN supplier_account_code TEXT DEFAULT '21100'"); } catch {}
  try { db.exec("ALTER TABLE travel_invoices ADD COLUMN total_commission REAL DEFAULT 0"); } catch {}

  try { db.exec("ALTER TABLE travel_invoice_items ADD COLUMN supplier_type TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_invoice_items ADD COLUMN supplier_id INTEGER"); } catch {}
  try { db.exec("ALTER TABLE travel_invoice_items ADD COLUMN supplier_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_invoice_items ADD COLUMN statement TEXT"); } catch {}
  try { db.exec("ALTER TABLE travel_invoice_items ADD COLUMN agency_commission REAL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE travel_invoice_items ADD COLUMN accounting_impact_account TEXT DEFAULT '41000'"); } catch {}

  // Alter customers for office affiliation
  try { db.exec("ALTER TABLE customers ADD COLUMN affiliation_type TEXT DEFAULT 'direct'"); } catch {}
  try { db.exec("ALTER TABLE customers ADD COLUMN office_id INTEGER"); } catch {}
  try { db.exec("ALTER TABLE customers ADD COLUMN office_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE customers ADD COLUMN office_phone TEXT"); } catch {}

  // Create travel_partner_offices
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS travel_partner_offices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_en TEXT,
        office_type TEXT DEFAULT 'partner_agency',
        city TEXT,
        phone TEXT,
        email TEXT,
        contact_person TEXT,
        commission_rate REAL DEFAULT 0,
        active INTEGER DEFAULT 1,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      )
    `);

    const countOffices = (db.prepare("SELECT COUNT(*) as c FROM travel_partner_offices").get() as { c: number })?.c || 0;
    if (countOffices === 0) {
      const stmt = db.prepare(`
        INSERT INTO travel_partner_offices (name, name_en, office_type, city, phone, contact_person, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run("المركز الرئيسي - الإدارة العامة للمبيعات", "Main Sales HQ", "main_office", "صنعاء / الرياض", "+967 1 200300", "الإدارة العامة", "المركز الرئيسي المباشر للشركة");
      stmt.run("فرع صنعاء - شارع حدة", "Sana'a Branch - Hadda", "branch", "صنعاء", "+967 1 450600", "الأستاذ أحمد الشامي", "فرع مبيعات معتمد");
      stmt.run("فرع عدن - خور مكسر", "Aden Branch - Khor Maksar", "branch", "عدن", "+967 2 230400", "الأستاذ محمد باوزير", "فرع مبيعات معتمد");
      stmt.run("فرع تعز - شارع جمال", "Taiz Branch - Jamal St", "branch", "تعز", "+967 4 210500", "الأستاذ فؤاد العريقي", "فرع مبيعات معتمد");
      stmt.run("مؤسسة القابلي للتجارة والتوزيع", "Al-Qabili Trading & Distribution", "partner_agency", "صنعاء", "+967 777 123456", "أ. عبدالسلام القابلي", "موزع ووكيل مبيعات معتمد");
      stmt.run("شركة الأفق الدولية للتوريدات التجارية", "Al-Ofoq Int'l Trading", "partner_agency", "الرياض", "+966 50 9876543", "أ. منصور العتيبي", "وكيل وموزع جملة معتمد");
      stmt.run("مؤسسة النخبة للتوريدات وتجارة الجملة", "Elite Wholesale & Supply", "b2b_office", "جدة", "+966 55 4321098", "أ. سامي الحربي", "موزع جملة وتوريدات مخزنية");
    }
  } catch (e) {
    console.error("Error setting up travel_partner_offices:", e);
  }

  // Seed default Airlines
  try {
    const countAirlines = (db.prepare("SELECT COUNT(*) as c FROM travel_airlines").get() as { c: number }).c;
    if (countAirlines === 0) {
      const stmt = db.prepare(`
        INSERT INTO travel_airlines (name_ar, name_en, iata_code, icao_code, country, phone, email, agent_name, default_commission_percent, booking_conditions)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run("الخطوط الجوية اليمنية", "Yemenia", "IY", "IYE", "اليمن", "+967 1 234567", "info@yemenia.com", "الوكيل الرئيسي", 5, "إرجاع واستبدال حسب فئة التذكرة");
      stmt.run("الخطوط الجوية السعودية", "Saudia", "SV", "SVA", "السعودية", "+966 920022222", "info@saudia.com", "السعودية للطيران", 6, "تأكيد الحجز قبل 24 ساعة");
      stmt.run("طيران الإمارات", "Emirates", "EK", "UAE", "الإمارات", "+971 600555555", "info@emirates.com", "طيران الإمارات", 7, "تطبق شروط الأمتعة حسب الدرجة");
      stmt.run("الخطوط الجوية القطرية", "Qatar Airways", "QR", "QTR", "قطر", "+974 40226000", "support@qatarairways.com", "القطرية", 6, "إصدار فوري");
      stmt.run("مصر للطيران", "EgyptAir", "MS", "MSR", "مصر", "+20 2 26966666", "info@egyptair.com", "مصر للطيران", 5, "تأكيدات المجموعات قبل أسبوعين");
      stmt.run("طيران الاتحاد", "Etihad", "EY", "ETD", "الإمارات", "+971 600555554", "info@etihad.com", "الاتحاد", 6, "شروط الجواز ساري 6 أشهر");
      stmt.run("فلاي دبي", "flydubai", "FZ", "FDB", "الإمارات", "+971 600544445", "info@flydubai.com", "فلاي دبي", 4, "طيران اقتصادي بدون أمتعة مجانية للفئة العادية");
      stmt.run("طيران ناس", "Flynas", "XY", "KNE", "السعودية", "+966 920001234", "info@flynas.com", "طيران ناس", 4, "تأكيدات وتعديل إلكتروني");
    }
  } catch (e) {
    console.error("Error seeding travel airlines:", e);
  }

  // Seed default Airports
  try {
    const countAirports = (db.prepare("SELECT COUNT(*) as c FROM travel_airports").get() as { c: number }).c;
    if (countAirports === 0) {
      const stmt = db.prepare(`
        INSERT INTO travel_airports (country, city, airport_name_ar, airport_name_en, iata_code, icao_code)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run("اليمن", "صنعاء", "مطار صنعاء الدولي", "Sana'a International Airport", "SAH", "OYSN");
      stmt.run("اليمن", "عدن", "مطار عدن الدولي", "Aden International Airport", "ADE", "OYAA");
      stmt.run("اليمن", "سيئون", "مطار سيئون الدولي", "Seiyun International Airport", "GXF", "OYSY");
      stmt.run("اليمن", "الريان", "مطار الريان الدولي", "Riyan International Airport", "RIY", "OYRN");
      stmt.run("السعودية", "جدة", "مطار الملك عبد العزيز الدولي", "King Abdulaziz Int'l Airport", "JED", "OEJN");
      stmt.run("السعودية", "الرياض", "مطار الملك خالد الدولي", "King Khalid Int'l Airport", "RUH", "OERK");
      stmt.run("السعودية", "المدينة المنورة", "مطار الأمير محمد بن عبد العزيز", "Prince Mohammad bin Abdulaziz Airport", "MED", "OEMA");
      stmt.run("مصر", "القاهرة", "مطار القاهرة الدولي", "Cairo International Airport", "CAI", "HECA");
      stmt.run("الإمارات", "دبي", "مطار دبي الدولي", "Dubai International Airport", "DXB", "OMDB");
      stmt.run("قطر", "الدوحة", "مطار حمد الدولي", "Hamad International Airport", "DOH", "OTHH");
      stmt.run("الأردن", "عمان", "مطار الملكة علياء الدولي", "Queen Alia Int'l Airport", "AMM", "OJAI");
      stmt.run("تركيا", "إسطنبول", "مطار إسطنبول الدولي", "Istanbul International Airport", "IST", "LTFM");
    }
  } catch (e) {
    console.error("Error seeding travel airports:", e);
  }

  // Seed default Hotels DB
  try {
    const countHotels = (db.prepare("SELECT COUNT(*) as c FROM travel_hotels_db").get() as { c: number }).c;
    if (countHotels === 0) {
      const stmt = db.prepare(`
        INSERT INTO travel_hotels_db (name_ar, name_en, country, city, star_rating, address, phone, email, supplier_name, default_commission_percent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run("فندق أبراج الساعة مكة", "Makkah Clock Royal Tower", "السعودية", "مكة المكرمة", 5, "وقف الملك عبد العزيز، مكة", "+966 12 5717888", "makkah@fairmont.com", "مورد العمرة المباشر", 10);
      stmt.run("فندق دار الإيمان إنتركونتيننتال", "Dar Al Iman InterContinental", "السعودية", "المدينة المنورة", 5, "المنطقة المركزية الشمالية", "+966 14 8206666", "madinah@ihg.com", "حجوزات المدينة", 10);
      stmt.run("فندق ماريوت القاهرة", "Cairo Marriott Hotel", "مصر", "القاهرة", 5, "الزمالك، القاهرة", "+20 2 27283000", "cairo@marriott.com", "وكالة مصر للسياحة", 8);
      stmt.run("فندق أتلانتس النخلة دبي", "Atlantis The Palm", "الإمارات", "دبي", 5, "نخلة جميرا، دبي", "+971 4 4262000", "dubaievents@atlantis.com", "مورد دبي للرحلات", 12);
      stmt.run("فندق موفنبيك مكة", "Movenpick Hotel Makkah", "السعودية", "مكة المكرمة", 5, "مجمع أبراچ البيت", "+966 12 5717111", "makkah.movenpick@accor.com", "حجوزات الفنادق المباشرة", 8);
    }
  } catch (e) {
    console.error("Error seeding travel hotels db:", e);
  }

  // ────────────────────────────────────────────────────────
  // MODULES 15 - 21: TRAVEL MODULES EXTENSION SCHEMA
  // ────────────────────────────────────────────────────────
  try {
    db.exec(`
      -- Module 15: Tour Packages & Itinerary
      CREATE TABLE IF NOT EXISTS travel_packages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        package_code TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        destination TEXT NOT NULL,
        days_count INTEGER DEFAULT 1,
        nights_count INTEGER DEFAULT 0,
        hotels_info TEXT,
        trips_info TEXT,
        transport_info TEXT,
        meals_info TEXT,
        activities_info TEXT,
        tour_guide TEXT,
        insurance_info TEXT,
        cost_price REAL DEFAULT 0,
        selling_price REAL DEFAULT 0,
        commission REAL DEFAULT 0,
        profit REAL DEFAULT 0,
        status TEXT DEFAULT 'active',
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_package_itinerary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        package_id INTEGER REFERENCES travel_packages(id) ON DELETE CASCADE,
        day_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        activity_time TEXT,
        location TEXT,
        notes TEXT
      );

      -- Module 16: Transportation & Logistics
      CREATE TABLE IF NOT EXISTS travel_vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        vehicle_type TEXT DEFAULT 'سيارة',
        plate_number TEXT,
        model_year TEXT,
        capacity INTEGER DEFAULT 4,
        company_id INTEGER,
        company_name TEXT,
        status TEXT DEFAULT 'available',
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_drivers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        license_number TEXT,
        nationality TEXT,
        company_id INTEGER,
        company_name TEXT,
        status TEXT DEFAULT 'available',
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_transport_companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        contact_person TEXT,
        address TEXT,
        balance REAL DEFAULT 0,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_transports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transport_number TEXT UNIQUE NOT NULL,
        service_type TEXT DEFAULT 'استقبال مطار',
        customer_id INTEGER REFERENCES customers(id),
        passenger_id INTEGER REFERENCES travel_passengers(id),
        vehicle_id INTEGER REFERENCES travel_vehicles(id),
        driver_id INTEGER REFERENCES travel_drivers(id),
        company_id INTEGER REFERENCES travel_transport_companies(id),
        pickup_location TEXT,
        dropoff_location TEXT,
        pickup_datetime TEXT,
        flight_number TEXT,
        cost_price REAL DEFAULT 0,
        selling_price REAL DEFAULT 0,
        commission REAL DEFAULT 0,
        profit REAL DEFAULT 0,
        status TEXT DEFAULT 'scheduled',
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      -- Module: Land Transport & Bus Tickets (حجوزات تذاكر النقل البري ونظام الطرفين)
      CREATE TABLE IF NOT EXISTS travel_bus_bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_number TEXT UNIQUE NOT NULL,
        ticket_number TEXT,
        pnr_number TEXT,
        trip_type TEXT DEFAULT 'one_way',
        bus_type TEXT DEFAULT 'حافلة VIP فاخرة',
        bus_number TEXT,
        seat_number TEXT,
        
        -- الطرف الأول: العميل
        customer_id INTEGER REFERENCES customers(id),
        customer_name TEXT,
        passenger_id INTEGER REFERENCES travel_passengers(id),
        passenger_name TEXT,
        passenger_phone TEXT,
        passenger_national_id TEXT,
        selling_price REAL DEFAULT 0,
        customer_currency TEXT DEFAULT 'SAR',
        customer_statement TEXT,
        
        -- الطرف الثاني: شركة النقل البري
        company_id INTEGER REFERENCES travel_transport_companies(id),
        company_name TEXT,
        cost_price REAL DEFAULT 0,
        supplier_currency TEXT DEFAULT 'SAR',
        supplier_statement TEXT,
        
        -- عمولة المكتب والربح
        agency_commission REAL DEFAULT 0,
        commission_currency TEXT DEFAULT 'SAR',
        commission_statement TEXT,
        exchange_rate REAL DEFAULT 1,
        
        -- مسار الرحلة والمحطات
        origin_city TEXT,
        origin_station TEXT,
        destination_city TEXT,
        destination_station TEXT,
        departure_date TEXT,
        departure_time TEXT,
        boarding_time TEXT,
        arrival_date TEXT,
        arrival_time TEXT,
        return_departure_date TEXT,
        luggage_weight REAL DEFAULT 30,
        luggage_pieces INTEGER DEFAULT 2,
        
        -- الدفع والحالة
        payment_method TEXT DEFAULT 'cash',
        payment_status TEXT DEFAULT 'paid',
        paid_amount REAL DEFAULT 0,
        remaining_balance REAL DEFAULT 0,
        status TEXT DEFAULT 'confirmed',
        issue_date TEXT,
        issued_by TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      -- Module 17: Travel Insurance
      CREATE TABLE IF NOT EXISTS travel_insurances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        policy_number TEXT UNIQUE NOT NULL,
        insurance_company TEXT NOT NULL,
        customer_id INTEGER REFERENCES customers(id),
        passenger_id INTEGER REFERENCES travel_passengers(id),
        passenger_name TEXT,
        passport_number TEXT,
        start_date TEXT,
        end_date TEXT,
        duration_days INTEGER DEFAULT 30,
        coverage_type TEXT DEFAULT 'تأمين طبي وسياحي شامل',
        destination_country TEXT,
        cost_price REAL DEFAULT 0,
        selling_price REAL DEFAULT 0,
        commission REAL DEFAULT 0,
        profit REAL DEFAULT 0,
        status TEXT DEFAULT 'active',
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      -- Module 18: Suppliers & Agents Management
      CREATE TABLE IF NOT EXISTS travel_suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        supplier_type TEXT DEFAULT 'شركة طيران',
        contact_person TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        country TEXT,
        currency TEXT DEFAULT 'ريال',
        current_balance REAL DEFAULT 0,
        bank_details TEXT,
        notes TEXT,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_supplier_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voucher_number TEXT UNIQUE NOT NULL,
        supplier_id INTEGER NOT NULL REFERENCES travel_suppliers(id),
        voucher_date TEXT NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT DEFAULT 'cash',
        safe_id INTEGER REFERENCES safes(id),
        bank_account_id INTEGER REFERENCES bank_accounts(id),
        journal_entry_id INTEGER REFERENCES journal_entries(id),
        notes TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      -- Module 19: Centralized Sales & Invoicing System
      CREATE TABLE IF NOT EXISTS travel_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT UNIQUE NOT NULL,
        invoice_date TEXT NOT NULL,
        customer_id INTEGER REFERENCES customers(id),
        customer_name TEXT NOT NULL,
        payment_method TEXT DEFAULT 'cash',
        payment_status TEXT DEFAULT 'paid',
        cost_subtotal REAL DEFAULT 0,
        fees_subtotal REAL DEFAULT 0,
        selling_subtotal REAL DEFAULT 0,
        discount REAL DEFAULT 0,
        net_selling REAL DEFAULT 0,
        net_profit REAL DEFAULT 0,
        paid_amount REAL DEFAULT 0,
        remaining_amount REAL DEFAULT 0,
        journal_entry_id INTEGER REFERENCES journal_entries(id),
        branch_id INTEGER DEFAULT 1,
        user_id INTEGER REFERENCES users(id),
        user_name TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL REFERENCES travel_invoices(id) ON DELETE CASCADE,
        service_type TEXT NOT NULL,
        service_ref_id INTEGER,
        description TEXT NOT NULL,
        passenger_name TEXT,
        cost_price REAL DEFAULT 0,
        service_fees REAL DEFAULT 0,
        selling_price REAL DEFAULT 0,
        profit REAL DEFAULT 0
      );

      -- Module 20: Quotations System
      CREATE TABLE IF NOT EXISTS travel_quotations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quotation_number TEXT UNIQUE NOT NULL,
        quotation_date TEXT NOT NULL,
        valid_until TEXT NOT NULL,
        customer_id INTEGER REFERENCES customers(id),
        customer_name TEXT NOT NULL,
        status TEXT DEFAULT 'draft',
        total_cost REAL DEFAULT 0,
        total_fees REAL DEFAULT 0,
        total_selling REAL DEFAULT 0,
        total_profit REAL DEFAULT 0,
        terms_conditions TEXT,
        user_name TEXT,
        converted_invoice_id INTEGER REFERENCES travel_invoices(id),
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_quotation_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quotation_id INTEGER NOT NULL REFERENCES travel_quotations(id) ON DELETE CASCADE,
        service_type TEXT NOT NULL,
        description TEXT NOT NULL,
        cost_price REAL DEFAULT 0,
        service_fees REAL DEFAULT 0,
        selling_price REAL DEFAULT 0,
        profit REAL DEFAULT 0
      );

      -- Module 21: Procurement System
      CREATE TABLE IF NOT EXISTS travel_procurement_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_number TEXT UNIQUE NOT NULL,
        po_date TEXT NOT NULL,
        supplier_id INTEGER REFERENCES travel_suppliers(id),
        supplier_name TEXT NOT NULL,
        service_category TEXT DEFAULT 'تذاكر طيران',
        status TEXT DEFAULT 'approved',
        total_cost REAL DEFAULT 0,
        expected_selling_price REAL DEFAULT 0,
        expected_profit REAL DEFAULT 0,
        notes TEXT,
        user_name TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_procurement_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pi_number TEXT UNIQUE NOT NULL,
        pi_date TEXT NOT NULL,
        po_id INTEGER REFERENCES travel_procurement_orders(id),
        supplier_id INTEGER REFERENCES travel_suppliers(id),
        supplier_name TEXT NOT NULL,
        supplier_invoice_ref TEXT,
        cost_subtotal REAL DEFAULT 0,
        fees_subtotal REAL DEFAULT 0,
        selling_subtotal REAL DEFAULT 0,
        net_profit REAL DEFAULT 0,
        payment_status TEXT DEFAULT 'paid',
        payment_method TEXT DEFAULT 'bank',
        journal_entry_id INTEGER REFERENCES journal_entries(id),
        notes TEXT,
        user_name TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_procurement_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        procurement_invoice_id INTEGER NOT NULL REFERENCES travel_procurement_invoices(id) ON DELETE CASCADE,
        service_type TEXT NOT NULL,
        description TEXT NOT NULL,
        cost_price REAL DEFAULT 0,
        fees REAL DEFAULT 0,
        selling_price REAL DEFAULT 0,
        profit REAL DEFAULT 0
      );

      -- Document Auto-Numbering Config Table
      CREATE TABLE IF NOT EXISTS document_numbering_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        branch_id INTEGER DEFAULT 1,
        doc_type TEXT NOT NULL,
        prefix TEXT NOT NULL,
        use_year INTEGER DEFAULT 1,
        seq_length INTEGER DEFAULT 5,
        current_seq INTEGER DEFAULT 1,
        suffix TEXT DEFAULT '',
        UNIQUE(branch_id, doc_type)
      );

      -- Travel System Notifications & Reminders
      CREATE TABLE IF NOT EXISTS travel_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        branch_id INTEGER DEFAULT 1,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        entity_type TEXT,
        entity_id INTEGER,
        customer_name TEXT,
        passenger_name TEXT,
        due_date TEXT,
        status TEXT DEFAULT 'unread',
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      -- Travel Operations File Attachments
      CREATE TABLE IF NOT EXISTS travel_attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        file_name TEXT NOT NULL,
        file_type TEXT,
        file_size INTEGER DEFAULT 0,
        file_data TEXT,
        category TEXT DEFAULT 'مستند عام',
        created_by TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      -- Module 48: Travel Tasks & Follow-ups Management
      CREATE TABLE IF NOT EXISTS travel_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_code TEXT UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        task_type TEXT DEFAULT 'general', -- 'visa_followup', 'ticket_reissue', 'quotation_followup', 'passport_expiry', 'debt_collection', 'hotel_confirm', 'general'
        priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
        status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled', 'overdue'
        assigned_to_user_id INTEGER REFERENCES users(id),
        assigned_to_name TEXT,
        related_entity_type TEXT, -- 'customer', 'booking', 'visa', 'invoice', 'quotation', 'passenger'
        related_entity_id INTEGER,
        related_entity_title TEXT,
        due_date TEXT,
        reminder_date TEXT,
        notes TEXT,
        created_by TEXT,
        completed_at TEXT,
        branch_id INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      -- Module 44/45: Travel Visa Types and Document Requirements
      CREATE TABLE IF NOT EXISTS travel_visa_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        country TEXT NOT NULL,
        country_en TEXT,
        name TEXT NOT NULL,
        visa_code TEXT UNIQUE,
        visa_category TEXT DEFAULT 'سياحة', -- 'سياحة', 'عمل', 'دراسة', 'عمرة/حج', 'علاج', 'ترانزيت'
        standard_fee REAL DEFAULT 0,
        embassy_fee REAL DEFAULT 0,
        processing_days INTEGER DEFAULT 10,
        validity_days INTEGER DEFAULT 90,
        stay_days INTEGER DEFAULT 30,
        entry_type TEXT DEFAULT 'سفرة واحدة', -- 'سفرة واحدة', 'متعددة'
        required_documents TEXT, -- JSON array of requirements e.g. ["جواز ساري 6 أشهر", "صور شخصية خلفية بيضاء", "كشف حساب بنكي 6 أشهر", "حجز طيران مبدئي", "حجز فندق مؤكد", "تأمين سفر", "خطاب تعريف بالراتب"]
        notes TEXT,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      -- Module 44: Comprehensive Travel System Settings
      CREATE TABLE IF NOT EXISTS travel_system_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        company_name_ar TEXT DEFAULT 'شركة العالمية للرحلات والسياحة',
        company_name_en TEXT DEFAULT 'Al-Alamiya Travel & Tourism Co.',
        iata_code TEXT DEFAULT 'IATA-7291823',
        license_number TEXT DEFAULT 'LIC-TRV-2026-99',
        tax_number TEXT DEFAULT '300998877600003',
        commercial_reg TEXT DEFAULT '1010889977',
        phone_primary TEXT DEFAULT '+966 11 456 7890',
        phone_secondary TEXT DEFAULT '+966 50 123 4567',
        email TEXT DEFAULT 'info@alamiya-travel.com',
        website TEXT DEFAULT 'www.alamiya-travel.com',
        address TEXT DEFAULT 'الرياض - طريق الملك فهد - برج الأعمال - الطابق 4',
        default_currency TEXT DEFAULT 'ريال',
        vat_percentage REAL DEFAULT 15.0,
        allow_selling_below_cost INTEGER DEFAULT 0,
        require_customer_for_tickets INTEGER DEFAULT 1,
        enforce_visa_document_checklist INTEGER DEFAULT 1,
        auto_generate_invoice_on_booking INTEGER DEFAULT 1,
        auto_register_commission INTEGER DEFAULT 1,
        strict_financial_deletion_prevention INTEGER DEFAULT 1,
        ticket_refund_penalty_default REAL DEFAULT 100.0,
        ticket_refund_office_fee_default REAL DEFAULT 50.0,
        invoice_header_text TEXT DEFAULT 'فاتورة مبيعات خدمات سياحية وتذاكر طيران معتمدة',
        invoice_footer_terms TEXT DEFAULT '1. التذاكر المصدرة تخضع لشروط وأنظمة شركات الطيران وهيئة الطيران المدني.\n2. يلزم التأكد من سريان الجواز وتأشيرات الدخول قبل موعد السفر.\n3. سياسات الاسترجاع والتعديل تطبق حسب فئة الحجز وموافقة الناقل الجوي.',
        ticket_header_text TEXT DEFAULT 'إشعار حجز وتذكرة إلكترونية معتمدة',
        ticket_footer_terms TEXT DEFAULT 'يرجى التواجد في المطار قبل 3 ساعات من موعد إقلاع الرحلات الدولية وساعتين للرحلات الداخلية.',
        visa_footer_terms TEXT DEFAULT 'الموافقة على منح التأشيرة خاضعة حصراً لتقدير السفارات والقنصليات المختصة، الرسوم الإدارية غير مستردة.',
        logo_url TEXT DEFAULT '/omnisystem-logo.png',
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );
    `);
  } catch (e) {
    console.error("Error creating Travel Extended Tables:", e);
  }

  // Alter audit_logs to support advanced tracking & diffs (Rule 30 & 49)
  try { db.exec("ALTER TABLE audit_logs ADD COLUMN entity_type TEXT"); } catch {}
  try { db.exec("ALTER TABLE audit_logs ADD COLUMN entity_id INTEGER"); } catch {}
  try { db.exec("ALTER TABLE audit_logs ADD COLUMN device_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE audit_logs ADD COLUMN ip_address TEXT"); } catch {}
  try { db.exec("ALTER TABLE audit_logs ADD COLUMN old_data TEXT"); } catch {}
  try { db.exec("ALTER TABLE audit_logs ADD COLUMN new_data TEXT"); } catch {}
  try { db.exec("ALTER TABLE audit_logs ADD COLUMN branch_id INTEGER DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE audit_logs ADD COLUMN action_type TEXT DEFAULT 'update'"); } catch {}

  // Seed default travel_system_settings if empty
  try {
    const tsCount = (db.prepare("SELECT COUNT(*) as c FROM travel_system_settings").get() as { c: number }).c;
    if (tsCount === 0) {
      db.prepare(`
        INSERT INTO travel_system_settings (id, company_name_ar, company_name_en, iata_code, license_number, tax_number, commercial_reg, phone_primary, phone_secondary, email, website, address, default_currency, vat_percentage)
        VALUES (1, 'شركة العالمية للرحلات والسياحة', 'Al-Alamiya Travel & Tourism Co.', 'IATA-7291823', 'LIC-TRV-2026-99', '300998877600003', '1010889977', '+966 11 456 7890', '+966 50 123 4567', 'info@alamiya-travel.com', 'www.alamiya-travel.com', 'الرياض - طريق الملك فهد - برج الأعمال', 'ريال', 15.0)
      `).run();
    }
  } catch (e) {}

  // Seed default travel_visa_types if empty
  try {
    const vtCount = (db.prepare("SELECT COUNT(*) as c FROM travel_visa_types").get() as { c: number }).c;
    if (vtCount === 0) {
      const insVt = db.prepare(`
        INSERT INTO travel_visa_types (country, country_en, name, visa_code, visa_category, standard_fee, embassy_fee, processing_days, validity_days, stay_days, entry_type, required_documents, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insVt.run(
        "فرنسا (شنغن)", "France (Schengen)", "تأشيرة شنغن سياحية", "VSA-FR-SCH", "سياحة", 650, 450, 15, 90, 30, "متعددة",
        JSON.stringify(["أصل جواز السفر ساري 6 أشهر على الأقل", "صورتان شخصيتان حديثتان خلفية بيضاء 3.5×4.5", "كشف حساب بنكي لآخر 6 أشهر مختوم", "خطاب تعريف بالراتب مصدق", "حجز طيران مبدئي مؤكد", "حجز فندقي مؤكد", "وثيقة تأمين سفر طبي معتمدة تغطي 30,000 يورو", "حضور موعد البصمة"]),
        "تشمل استخراج الموعد وتجهيز الملف والتأمين"
      );
      insVt.run(
        "بريطانيا", "United Kingdom", "تأشيرة زيارة إلكترونية وسياحية (ETA/Standard)", "VSA-UK-STD", "سياحة", 850, 550, 10, 180, 180, "متعددة",
        JSON.stringify(["أصل جواز السفر ساري", "كشف حساب بنكي لآخر 6 أشهر باللغة الإنجليزية", "تعريف راتب باللغة الإنجليزية", "حجز طيران وفندق", "صورة شخصية"]),
        "متاح التقديم على تصريح السفر الإلكتروني ETA للمواطنين المؤهلين"
      );
      insVt.run(
        "الإمارات العربية المتحدة", "United Arab Emirates", "تأشيرة سياحية إلكترونية 30/60 يوم", "VSA-UAE-EVSA", "سياحة", 350, 200, 2, 60, 30, "سفرة واحدة",
        JSON.stringify(["صورة جواز السفر واضحة بالألوان", "صورة شخصية حديثة"]),
        "إصدار إلكتروني فوري خلال 24-48 ساعة"
      );
      insVt.run(
        "مصر", "Egypt", "تأشيرة دخول إلكترونية / مسبقة", "VSA-EGY-EVSA", "سياحة", 250, 150, 3, 90, 30, "سفرة واحدة",
        JSON.stringify(["صورة الجواز ساري المفعول", "صورة شخصية", "تذكرة سفر ذهاب وعودة"]),
        "متاحة إلكترونياً أو عند الوصول حسب الجنسية"
      );
      insVt.run(
        "تركيا", "Turkey", "تأشيرة إلكترونية سياحية E-Visa", "VSA-TR-EVSA", "سياحة", 300, 180, 1, 180, 90, "متعددة",
        JSON.stringify(["صورة جواز السفر", "تأشيرة شنغن/أمريكا سارية إن وجدت لبعض الجنسيات"]),
        "إصدار فوري أونلاين خلال دقائق"
      );
      insVt.run(
        "المملكة العربية السعودية", "Saudi Arabia", "تأشيرة عمرة / زيارة شخصية", "VSA-KSA-UMRAH", "عمرة/حج", 450, 300, 3, 90, 30, "سفرة واحدة",
        JSON.stringify(["جواز السفر ساري 6 أشهر", "صورة شخصية", "تأمين طبي معتمد داخل المملكة", "حجز طيران وفندق بمكة/المدينة"]),
        "تأشيرة عمرة إلكترونية عبر منصة نسك"
      );
    }
  } catch (e) {}

  // Seed sample travel_tasks if empty
  try {
    const taskCount = (db.prepare("SELECT COUNT(*) as c FROM travel_tasks").get() as { c: number }).c;
    if (taskCount === 0) {
      const insTask = db.prepare(`
        INSERT INTO travel_tasks (task_code, title, description, task_type, priority, status, assigned_to_name, related_entity_type, related_entity_id, related_entity_title, due_date, reminder_date, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insTask.run(
        "TSK-2026-001", "متابعة موعد بصمة تأشيرة شنغن فرنسا", "التواصل مع العميلة فاطمة الزهراني لتأكيد حضور موعد البصمة بمركز VFS غداً صباحاً",
        "visa_followup", "urgent", "pending", "موظف التأشيرات", "visa", 1, "تأشيرة شنغن فرنسا (فاطمة الزهراني)", "2026-08-25", "2026-08-24", "الملف مكتمل مع كشف الحساب", "مدير النظام"
      );
      insTask.run(
        "TSK-2026-002", "إعادة إصدار تذكرة رحلة باريس بعد تعديل التاريخ", "تعديل موعد رحلة باريس بناء على طلب العميل وحساب فارق السعر",
        "ticket_reissue", "high", "in_progress", "قاطع التذاكر الأول", "booking", 4, "تذكرة طيران AF-521 باريس", "2026-08-23", "2026-08-23", "مطلوب تحصيل فارق 350 ريال", "مدير الفرع"
      );
      insTask.run(
        "TSK-2026-003", "تحصيل الدفعة المتبقية لفاتورة رحلة دبي", "متابعة سداد مبلغ 2000 ريال متبقي على حساب شركة الأفق",
        "debt_collection", "medium", "pending", "المحاسب", "invoice", 1, "فاتورة INV-TRV-2026-001", "2026-08-28", "2026-08-27", "إرسال كشف حساب ومطالبة عبر الواتساب", "مدير النظام"
      );
      insTask.run(
        "TSK-2026-004", "تنبيه قرب انتهاء جواز سفر المسافر", "جواز سفر المسافرة فاطمة الزهراني ينتهي خلال 6 أشهر، إبلاغ العميل بتجديده قبل الرحلات القادمة",
        "passport_expiry", "low", "pending", "خدمة العملاء", "passenger", 4, "المسافرة: فاطمة علي الزهراني", "2026-09-01", "2026-08-30", "رقم الجواز B98765432", "النظام التلقائي"
      );
    }
  } catch (e) {}

  // Seed default Document Numbering configurations if empty
  try {
    const numCount = (db.prepare("SELECT COUNT(*) as c FROM document_numbering_config").get() as { c: number }).c;
    if (numCount === 0) {
      const insConfig = db.prepare(`
        INSERT INTO document_numbering_config (branch_id, doc_type, prefix, use_year, seq_length, current_seq)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      insConfig.run(1, "invoice", "INV", 1, 5, 10);
      insConfig.run(1, "ticket", "TKT", 1, 5, 10);
      insConfig.run(1, "booking", "RES", 1, 5, 10);
      insConfig.run(1, "visa", "VISA", 1, 5, 10);
      insConfig.run(1, "receipt_voucher", "REC", 1, 5, 10);
      insConfig.run(1, "payment_voucher", "PAY", 1, 5, 10);
      insConfig.run(1, "expense", "EXP", 1, 5, 10);
      insConfig.run(1, "hotel_voucher", "HTL", 1, 5, 10);
      insConfig.run(1, "quotation", "QUO", 1, 5, 10);
      insConfig.run(1, "package", "PKG", 1, 5, 10);
    }
  } catch (e) {
    console.error("Error seeding document numbering config:", e);
  }

  // Seed default customers if empty so foreign keys referencing customer_id=1 succeed
  try {
    const custCount = (db.prepare("SELECT COUNT(*) as c FROM customers").get() as { c: number }).c;
    if (custCount === 0) {
      const insCust = db.prepare("INSERT INTO customers (id, name, phone, email, address) VALUES (?, ?, ?, ?, ?)");
      insCust.run(1, "عبدالله محمد العتيبي", "0501234567", "abdullah@example.com", "الرياض - المملكة العربية السعودية");
      insCust.run(2, "سارة أحمد الشمري", "0559876543", "sara@example.com", "جدة - المملكة العربية السعودية");
      insCust.run(3, "فاطمة علي الزهراني", "0561112233", "fatima@example.com", "الدمام - المملكة العربية السعودية");
    }
  } catch (e) {
    console.error("Error seeding default customers:", e);
  }

  // Seed sample data for Travel Extended Modules
  try {
    const pkgCount = (db.prepare("SELECT COUNT(*) as c FROM travel_packages").get() as { c: number }).c;
    if (pkgCount === 0) {
      // Seed Tour Packages
      const insPkg = db.prepare(`
        INSERT INTO travel_packages (package_code, title, destination, days_count, nights_count, hotels_info, trips_info, transport_info, meals_info, activities_info, tour_guide, insurance_info, cost_price, selling_price, commission, profit, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const p1 = insPkg.run("PKG-DXB-01", "برنامج دبي الذهبي العائلي", "دبي - الإمارات", 6, 5, "فندق أتلانتس النخيل (5 نجوم)", "جولة دبي مول، برج خليفة، سفاري الصحراء", "سيارة VIP خاصة مع سائق", "إفطار + عشاء فاخر", "تذاكر حديقة وايلد وادي وركوب التلفريك", "مرشد سياحي يتحدث العربية والإنجليزية", "تأمين سفر طبي وسياحي شامل", 5000, 6800, 1800, 1800, "برنامج عالي الإقبال للعلائلات");
      const p2 = insPkg.run("PKG-CAI-02", "رحلة أهرامات ومعالم القاهرة الكبرى", "القاهرة - مصر", 5, 4, "فندق ماريوت القاهرة الزمالك", "زيارة الأهرامات، خان الخليلي، المتحف المصري الكبير", "باص سياحي حديث مكيف", "إفطار يومي + غداء على النيل", "جولة نيلية وفلكلور الشعبي", "مرشد سياحي متخصص في الآثار", "تأمين سفر مغطى", 3200, 4200, 1000, 1000, "رحلة ثفافية وترفيهية ممتازة");

      const pkg1Id = Number(p1.lastInsertRowid);
      const pkg2Id = Number(p2.lastInsertRowid);

      // Seed Package Itinerary
      const insItin = db.prepare(`
        INSERT INTO travel_package_itinerary (package_id, day_number, title, description, activity_time, location)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      insItin.run(pkg1Id, 1, "الوصول والاستقبال", "الوصول لمطار دبي الدولي، الاستقبال VIP والنقل للفندق وتراخيص الغرف", "14:00", "مطار دبي وفندق أتلانتس");
      insItin.run(pkg1Id, 2, "جولة دبي مول وبرج خليفة", "الانطلاق صباحاً لدبي مول وشاهدة عروض النافورة الراقصة وصعود قمة برج خليفة", "10:00 - 18:00", "دبي مول - برج خليفة");
      insItin.run(pkg1Id, 3, "رحلة سفاري الصحراء", "الانطلاق عصراً بسيارات فورويل للدفع الرباعي للصحراء مع عشاء بوب شواء وحفل بدوي", "15:30 - 21:30", "صحراء دبي");

      insItin.run(pkg2Id, 1, "الوصول والتسجيل بالفندق", "الاستقبال بمطار القاهرة والنقل إلى فندق ماريوت الزمالك", "15:00", "مطار القاهرة - الزمالك");
      insItin.run(pkg2Id, 2, "زيارة الأهرامات وأبو الهول", "جولة إرشادية حول أهرامات الجيزة ومجمعات الفراعنة مع غداء نيلوني", "09:00 - 16:00", "الجيزة - النيل");

      // Seed Transport Fleet
      db.prepare(`INSERT INTO travel_vehicles (name, vehicle_type, plate_number, model_year, capacity, company_name) VALUES (?,?,?,?,?,?)`)
        .run("تويوتا جرانفيا VIP", "فان VIP", "د ب ي 554", "2025", 7, "شركة الأفق للنقل السياحي");
      db.prepare(`INSERT INTO travel_vehicles (name, vehicle_type, plate_number, model_year, capacity, company_name) VALUES (?,?,?,?,?,?)`)
        .run("مرسيدس باص توريزمو", "باص سياحي", "ر ي ض 102", "2024", 45, "شركة الراحة للنقل الجماعي");

      db.prepare(`INSERT INTO travel_drivers (name, phone, license_number, nationality, company_name) VALUES (?,?,?,?,?)`)
        .run("عمر خالد باوزير", "0504433221", "DL-998811", "سعودي", "شركة الأفق للنقل السياحي");
      db.prepare(`INSERT INTO travel_drivers (name, phone, license_number, nationality, company_name) VALUES (?,?,?,?,?)`)
        .run("محمد أحمد مصطفى", "0556677889", "DL-445566", "مصري", "شركة الراحة للنقل الجماعي");

      db.prepare(`INSERT INTO travel_transport_companies (name, phone, email, contact_person, address) VALUES (?,?,?,?,?)`)
        .run("شركة الأفق للنقل السياحي", "0112233445", "transport@horizon.sa", "سعيد باحويرث", "الرياض - طريق المطار");
      db.prepare(`INSERT INTO travel_transport_companies (name, phone, email, contact_person, address) VALUES (?,?,?,?,?)`)
        .run("الشركة السعودية للنقل الجماعي (سابتكو SAPTCO)", "920000877", "b2b@saptco.com.sa", "خدمة كبار العملاء والوكلاء", "الرياض - الدائري الشمالي");
      db.prepare(`INSERT INTO travel_transport_companies (name, phone, email, contact_person, address) VALUES (?,?,?,?,?)`)
        .run("شركة النور للنقل الدولي والبري", "0554433221", "info@alnoor-transport.com", "م. سالم الكندي", "جدة - شارع فلسطين");
      db.prepare(`INSERT INTO travel_transport_companies (name, phone, email, contact_person, address) VALUES (?,?,?,?,?)`)
        .run("شركة الرويشان للنقل والسفريات", "0501234567", "contact@alruwaishan.com", "أحمد الرويشان", "صنعاء / الرياض");
      db.prepare(`INSERT INTO travel_transport_companies (name, phone, email, contact_person, address) VALUES (?,?,?,?,?)`)
        .run("شركة البراق للنقل الجماعي VIP", "0549988776", "vip@alburaq-bus.sa", "فهد الشمري", "الدمام - طريق الملك فهد");
      db.prepare(`INSERT INTO travel_transport_companies (name, phone, email, contact_person, address) VALUES (?,?,?,?,?)`)
        .run("شركة راحة للنقل الدولي", "0567788990", "booking@raha-transport.com", "عصام المقطري", "الرياض - محطة النقل الدولية");
      db.prepare(`INSERT INTO travel_transport_companies (name, phone, email, contact_person, address) VALUES (?,?,?,?,?)`)
        .run("شركة بن معمر للنقل البري", "0533344455", "info@binmoammar.com", "عبدالعزيز بن معمر", "مكة المكرمة - العزيزية");

      db.prepare(`
        INSERT INTO travel_transports (transport_number, service_type, customer_id, pickup_location, dropoff_location, pickup_datetime, cost_price, selling_price, commission, profit, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run("TRN-2026-001", "استقبال مطار", 1, "مطار دبي الدولي T3", "فندق أتلانتس النخيل", "2026-09-10 14:00", 250, 400, 150, 150, "scheduled", "استقبال بيافطة اسم العميل");

      // Seed Initial Bus Bookings
      try {
        const busCount = (db.prepare("SELECT COUNT(*) as count FROM travel_bus_bookings").get() as any)?.count || 0;
        if (busCount === 0) {
          const insertBus = db.prepare(`
            INSERT INTO travel_bus_bookings (
              booking_number, ticket_number, pnr_number, trip_type, bus_type, bus_number, seat_number,
              customer_id, customer_name, passenger_name, passenger_phone, passenger_national_id,
              selling_price, customer_currency, customer_statement,
              company_id, company_name, cost_price, supplier_currency, supplier_statement,
              agency_commission, commission_currency, commission_statement, exchange_rate,
              origin_city, origin_station, destination_city, destination_station,
              departure_date, departure_time, boarding_time, arrival_date, arrival_time,
              luggage_weight, luggage_pieces,
              payment_method, payment_status, paid_amount, remaining_balance,
              status, issue_date, issued_by, notes
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, ?
            )
          `);

          insertBus.run(
            "BUS-2026-1001", "TKT-SAP-98214", "PNR-LND-7710", "one_way", "حافلة VIP فاخرة", "BUS-901", "12A",
            1, "عبدالله محمد العتيبي", "عبدالله محمد العتيبي", "0501234567", "1087654321",
            350, "SAR", "قيمة تذكرة نقل بري VIP من الرياض إلى مكة المكرمة",
            2, "الشركة السعودية للنقل الجماعي (سابتكو SAPTCO)", 280, "SAR", "تكلفة حجز مقعد سابتكو VIP مع وجبة وضيافة",
            70, "SAR", "عمولة مكتب السعادة للسياحة على تذكرة نقل بري", 1,
            "الرياض", "محطة العزيزية الرئيسية", "مكة المكرمة", "محطة أجياد للحافلات",
            "2026-09-12", "07:30", "07:00", "2026-09-12", "16:30",
            40, 2,
            "cash", "paid", 350, 0,
            "confirmed", "2026-08-28", "مدير النظام", "حجز مقعد نافذة VIP مع خدمة إنترنت ووجبة خفيفة"
          );

          insertBus.run(
            "BUS-2026-1002", "TKT-NUR-44120", "PNR-LND-8832", "round_trip", "درجة أولى رجال أعمال", "BUS-405", "04 - 05",
            2, "مؤسسة النخبة للتجارة", "م. سالم الكندي", "0559988776", "2098765432",
            180, "USD", "تذكرة نقل بري دولي درجة أولى (جدة -> دبي ذهاب وعودة)",
            3, "شركة النور للنقل الدولي والبري", 140, "USD", "تكلفة مقعدين باص دولي فاخر شامل التأمين والرسوم",
            40, "USD", "أرباح وعمولة حجز رحلة برية دولية", 3.75,
            "جدة", "محطة البلد للنقل الدولي", "دبي", "محطة دبي الغبيبة المركزية",
            "2026-09-18", "10:00", "09:15", "2026-09-19", "08:00",
            50, 3,
            "bank_transfer", "paid", 180, 0,
            "confirmed", "2026-08-27", "مدير النظام", "رحلة برية دولية مع استراحة في المحطات المعتمدة"
          );

          insertBus.run(
            "BUS-2026-1003", "TKT-RUW-66512", "PNR-LND-9944", "one_way", "حافلة سرير نوم (Sleeper)", "BUS-770", "B-08",
            3, "فاطمة علي الزهراني", "فاطمة علي الزهراني", "0543322110", "1044556677",
            120000, "YER", "تذكرة نقل بري سرير نوم مريح من صنعاء إلى عدن",
            4, "شركة الرويشان للنقل والسفريات", 95000, "YER", "تكلفة حجز سرير نوم باص الرويشان السياحي",
            25000, "YER", "عمولة الوكالة على حجز باص الرويشان", 1,
            "صنعاء", "مكتب الرويشان شارع الستين", "عدن", "محطة الشيخ عثمان المركزية",
            "2026-09-15", "21:00", "20:30", "2026-09-16", "07:00",
            35, 2,
            "credit", "unpaid", 0, 120000,
            "pending", "2026-08-28", "مدير النظام", "الدفع آجل على حساب العميلة طرفنا"
          );
        }
      } catch (e) {
        console.error("Bus bookings seed warning:", e);
      }

      // Seed Travel Insurance
      db.prepare(`
        INSERT INTO travel_insurances (policy_number, insurance_company, customer_id, passenger_name, passport_number, start_date, end_date, duration_days, coverage_type, destination_country, cost_price, selling_price, commission, profit, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run("POL-8899001", "شركة التعاونية للتأمين", 1, "عبدالله محمد العتيبي", "A12345678", "2026-09-10", "2026-09-25", 15, "تأمين طبي وسياحي وحالات الطوارئ", "الإمارات العربية المتحدة", 120, 200, 80, 80, "active", "بوليصة صادرة إلكترونياً ومفعلة");

      // Seed Travel Suppliers
      const insSupp = db.prepare(`
        INSERT INTO travel_suppliers (supplier_code, name, supplier_type, contact_person, phone, email, country, current_balance, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insSupp.run("SUP-AIR-01", "شركة الخطوط السعودية (Saudia)", "شركة طيران", "مكتب مبيعات الوكلاء", "920022222", "b2b@saudia.com", "السعودية", 15000, "مورد تذاكر طيران مباشر");
      insSupp.run("SUP-HTL-01", "مجموعة فنادق أكور العالمية (Accor)", "فندق / سلسلة", "إدارة الحجوزات المركزية", "0114005000", "reservations@accor.com", "السعودية", 8500, "تأكيد حجوزات فورية وصافي عمولة");
      insSupp.run("SUP-VSA-01", "مركز التأشيرات المعتمد VFS Global", "وكيل تأشيرات", "قسم التنسيق السفاري", "0118001122", "info@vfs.com", "السعودية", 3200, "معاملات شنغن وبريطانيا وأمريكا");

      // Seed Centralized Sales Invoice
      const invRes = db.prepare(`
        INSERT INTO travel_invoices (invoice_number, invoice_date, customer_id, customer_name, payment_method, payment_status, cost_subtotal, fees_subtotal, selling_subtotal, discount, net_selling, net_profit, paid_amount, remaining_amount, user_name, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run("INV-TRV-2026-001", "2026-08-20", 1, "عبدالله محمد العتيبي", "cash", "paid", 9200, 300, 11700, 200, 11500, 2000, "مدير النظام", "فاتورة مبيعات شاملة (تذاكر طيران + فندق + تأمين)");

      const invId = Number(invRes.lastInsertRowid);
      db.prepare(`
        INSERT INTO travel_invoice_items (invoice_id, service_type, description, passenger_name, cost_price, service_fees, selling_price, profit)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(invId, "flight", "تذكرة طيران الرياض -> دبي (الخطوط السعودية)", "عبدالله العتيبي + سارة العتيبي", 2400, 100, 3000, 500);
      db.prepare(`
        INSERT INTO travel_invoice_items (invoice_id, service_type, description, passenger_name, cost_price, service_fees, selling_price, profit)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(invId, "hotel", "حجز فندق أتلانتس النخيل دبي (8 ليالي)", "عبدالله العتيبي", 6800, 200, 8500, 1500);

      // Seed Quotation
      const qRes = db.prepare(`
        INSERT INTO travel_quotations (quotation_number, quotation_date, valid_until, customer_id, customer_name, status, total_cost, total_fees, total_selling, total_profit, terms_conditions, user_name, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run("QUO-2026-001", "2026-08-22", "2026-08-29", 3, "فاطمة علي الزهراني", "sent", 14650, 350, 17950, 2950, "العرض ساري لمدة 7 أيام من تاريخه والتغيير في أسعار التذاكر يعتمد على الإتاحة", "مدير النظام", "عرض سعر رحلة باريس وتأشيرة الشنغن");

      const qId = Number(qRes.lastInsertRowid);
      db.prepare(`
        INSERT INTO travel_quotation_items (quotation_id, service_type, description, cost_price, service_fees, selling_price, profit)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(qId, "flight", "تذكرة طيران الرياض -> باريس (الخطوط الفرنسية)", 3200, 100, 3800, 500);
      db.prepare(`
        INSERT INTO travel_quotation_items (quotation_id, service_type, description, cost_price, service_fees, selling_price, profit)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(qId, "visa", "تأشيرة شنغن فرنسا السياحية شاملة موعد البصمة", 450, 50, 650, 150);
      db.prepare(`
        INSERT INTO travel_quotation_items (quotation_id, service_type, description, cost_price, service_fees, selling_price, profit)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(qId, "hotel", "إقامة فندق بولمان باريس إيفل (10 ليالي)", 11000, 200, 13500, 2300);

      // Seed Procurement Order & Invoice
      const poRes = db.prepare(`
        INSERT INTO travel_procurement_orders (po_number, po_date, supplier_id, supplier_name, service_category, status, total_cost, expected_selling_price, expected_profit, user_name, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run("PO-TRV-001", "2026-08-15", 1, "شركة الخطوط السعودية (Saudia)", "تذاكر طيران", "approved", 12000, 15000, 3000, "مدير النظام", "شراء رصيد تذاكر رحلات الربيع المسبقة");

      const piRes = db.prepare(`
        INSERT INTO travel_procurement_invoices (pi_number, pi_date, po_id, supplier_id, supplier_name, supplier_invoice_ref, cost_subtotal, fees_subtotal, selling_subtotal, net_profit, payment_status, payment_method, user_name, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run("PI-TRV-001", "2026-08-15", Number(poRes.lastInsertRowid), 1, "شركة الخطوط السعودية (Saudia)", "SDA-INV-9988", 12000, 0, 15000, 3000, "paid", "bank", "مدير النظام", "فاتورة توريد شراء خدمات طيران معتمدة");

      const piId = Number(piRes.lastInsertRowid);
      db.prepare(`
        INSERT INTO travel_procurement_items (procurement_invoice_id, service_type, description, cost_price, fees, selling_price, profit)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(piId, "flight", "مجموعة تذاكر طيران خط الرياض - دبي (10 تذاكر)", 12000, 0, 15000, 3000);
    }
  } catch (e) {
    console.error("Error seeding Travel Extended Data:", e);
  }

  // ────────────────────────────────────────────────────────
  // MODULES 22 - 27: ENTERPRISE GLOBAL TRAVEL ERP EXPANSION
  // GDS Cryptic & PNR Parser, B2B/B2C Portals, BSP IATA, WhatsApp Hub, ATB Printing
  // ────────────────────────────────────────────────────────
  try {
    db.exec(`
      -- Module 22: GDS Cryptic & PNR Parser History
      CREATE TABLE IF NOT EXISTS travel_gds_pnr_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pnr_code TEXT NOT NULL,
        gds_system TEXT NOT NULL DEFAULT 'amadeus', -- 'amadeus', 'sabre', 'galileo', 'ndc'
        raw_text TEXT NOT NULL,
        passenger_name TEXT,
        airline_code TEXT,
        flight_number TEXT,
        route TEXT,
        departure_date TEXT,
        ticket_number TEXT,
        total_fare REAL DEFAULT 0,
        currency TEXT DEFAULT 'SAR',
        parsed_json TEXT,
        imported_booking_id INTEGER REFERENCES travel_bookings(id),
        status TEXT DEFAULT 'parsed', -- 'parsed', 'imported', 'failed'
        created_by TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      -- Module 23: Corporate Accounts (B2B Portal)
      CREATE TABLE IF NOT EXISTS travel_corporate_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_name TEXT NOT NULL,
        company_name_en TEXT,
        account_code TEXT UNIQUE NOT NULL,
        cr_number TEXT,
        tax_number TEXT,
        contact_person TEXT,
        contact_phone TEXT,
        contact_email TEXT,
        credit_limit REAL DEFAULT 50000,
        current_balance REAL DEFAULT 0,
        payment_terms_days INTEGER DEFAULT 30,
        portal_username TEXT UNIQUE,
        portal_password_hash TEXT,
        policy_max_booking_budget REAL DEFAULT 5000,
        policy_allowed_classes TEXT DEFAULT 'اقتصادية,أعمال',
        policy_require_manager_approval INTEGER DEFAULT 1,
        status TEXT DEFAULT 'active', -- 'active', 'suspended'
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_corporate_employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        corporate_id INTEGER NOT NULL REFERENCES travel_corporate_accounts(id) ON DELETE CASCADE,
        name_ar TEXT NOT NULL,
        name_en TEXT NOT NULL,
        employee_number TEXT NOT NULL,
        department TEXT,
        cost_center TEXT,
        job_title TEXT,
        phone TEXT,
        email TEXT,
        passport_number TEXT,
        passport_expiry TEXT,
        max_budget REAL DEFAULT 3000,
        allowed_class TEXT DEFAULT 'اقتصادية',
        requires_approval INTEGER DEFAULT 1,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_corporate_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_number TEXT UNIQUE NOT NULL,
        corporate_id INTEGER NOT NULL REFERENCES travel_corporate_accounts(id) ON DELETE CASCADE,
        employee_id INTEGER REFERENCES travel_corporate_employees(id),
        passenger_name TEXT NOT NULL,
        service_type TEXT DEFAULT 'flight',
        trip_type TEXT DEFAULT 'round_trip', -- 'one_way', 'round_trip', 'multi_city'
        origin TEXT NOT NULL,
        destination TEXT NOT NULL,
        departure_date TEXT NOT NULL,
        return_date TEXT,
        preferred_class TEXT DEFAULT 'اقتصادية',
        purpose_of_trip TEXT,
        estimated_cost REAL DEFAULT 0,
        actual_cost REAL DEFAULT 0,
        status TEXT DEFAULT 'pending_approval', -- 'pending_approval', 'approved', 'rejected', 'booked', 'cancelled'
        approver_name TEXT,
        approval_notes TEXT,
        approved_at TEXT,
        booking_id INTEGER REFERENCES travel_bookings(id),
        invoice_id INTEGER REFERENCES travel_invoices(id),
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      -- Module 24: B2C Online Requests & Self-Service Tracking
      CREATE TABLE IF NOT EXISTS travel_b2c_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_code TEXT UNIQUE NOT NULL,
        request_type TEXT NOT NULL, -- 'change_date', 'refund_ticket', 'visa_status_check', 'add_baggage', 'general_inquiry'
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_email TEXT,
        pnr_or_ticket TEXT,
        passport_number TEXT,
        request_details TEXT NOT NULL,
        preferred_new_date TEXT,
        calculated_fees REAL DEFAULT 0,
        status TEXT DEFAULT 'new', -- 'new', 'in_review', 'actioned', 'rejected'
        assigned_agent TEXT,
        agent_response TEXT,
        resolved_at TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      -- Module 25: IATA BSP Billing & Settlement Plan Reconciliation
      CREATE TABLE IF NOT EXISTS travel_bsp_periods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        period_code TEXT UNIQUE NOT NULL, -- e.g. 'BSP-2026-08-P1'
        period_name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        remittance_date TEXT,
        total_tickets_count INTEGER DEFAULT 0,
        bsp_gross_amount REAL DEFAULT 0,
        bsp_tax_amount REAL DEFAULT 0,
        bsp_commission_amount REAL DEFAULT 0,
        bsp_net_payable REAL DEFAULT 0,
        agency_gross_amount REAL DEFAULT 0,
        agency_net_amount REAL DEFAULT 0,
        variance_amount REAL DEFAULT 0,
        reconciliation_status TEXT DEFAULT 'in_progress', -- 'draft', 'in_progress', 'reconciled', 'settled'
        notes TEXT,
        reconciled_by TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_bsp_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        period_id INTEGER NOT NULL REFERENCES travel_bsp_periods(id) ON DELETE CASCADE,
        ticket_number TEXT NOT NULL,
        airline_code TEXT NOT NULL,
        pnr TEXT,
        passenger_name TEXT,
        issue_date TEXT NOT NULL,
        transaction_type TEXT DEFAULT 'TKTT', -- 'TKTT' (Sale), 'RFND' (Refund), 'EMD' (Ancillary), 'ADMA' (Debit Memo), 'ACMA' (Credit Memo)
        bsp_fare REAL DEFAULT 0,
        bsp_tax REAL DEFAULT 0,
        bsp_commission REAL DEFAULT 0,
        bsp_net REAL DEFAULT 0,
        agency_fare REAL DEFAULT 0,
        agency_net REAL DEFAULT 0,
        variance REAL DEFAULT 0,
        status TEXT DEFAULT 'matched', -- 'matched', 'fare_variance', 'tax_variance', 'missing_in_agency', 'unbilled_in_bsp'
        matched_booking_id INTEGER REFERENCES travel_bookings(id),
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS travel_bsp_memos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memo_type TEXT NOT NULL, -- 'ADM' (Debit Memo), 'ACM' (Credit Memo)
        memo_number TEXT UNIQUE NOT NULL,
        airline_code TEXT NOT NULL,
        airline_name TEXT NOT NULL,
        ticket_number TEXT,
        pnr TEXT,
        issue_date TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'SAR',
        reason_code TEXT,
        reason_description TEXT NOT NULL,
        status TEXT DEFAULT 'received', -- 'received', 'under_dispute', 'accepted', 'airline_waived', 'settled'
        dispute_deadline TEXT,
        dispute_notes TEXT,
        disputed_by TEXT,
        disputed_at TEXT,
        settled_date TEXT,
        journal_entry_id INTEGER REFERENCES journal_entries(id),
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      -- Module 26: Omni-Channel Notifications & WhatsApp API Hub
      CREATE TABLE IF NOT EXISTS travel_notification_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        channel TEXT DEFAULT 'whatsapp', -- 'whatsapp', 'sms', 'email'
        category TEXT DEFAULT 'operations', -- 'flight_reminder', 'ticket_issue', 'visa_update', 'payment_reminder', 'passport_expiry'
        message_body TEXT NOT NULL,
        parameters_json TEXT, -- array of available variables e.g. ["passenger_name", "pnr", "flight_no", "departure_time", "destination"]
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_notification_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel TEXT NOT NULL DEFAULT 'whatsapp',
        recipient_phone TEXT NOT NULL,
        recipient_name TEXT,
        template_code TEXT,
        message_body TEXT NOT NULL,
        entity_type TEXT, -- 'booking', 'visa', 'invoice', 'customer'
        entity_id INTEGER,
        status TEXT DEFAULT 'delivered', -- 'queued', 'sent', 'delivered', 'read', 'failed'
        gateway_message_id TEXT,
        error_message TEXT,
        sent_by TEXT,
        sent_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_notification_automations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_trigger TEXT UNIQUE NOT NULL, -- 'flight_24h_reminder', 'flight_delay', 'ticket_issued', 'booking_confirmed', 'visa_ready', 'passport_6m_expiry', 'payment_due_reminder'
        name TEXT NOT NULL,
        channel TEXT DEFAULT 'whatsapp',
        template_id INTEGER REFERENCES travel_notification_templates(id),
        is_enabled INTEGER DEFAULT 1,
        hours_before INTEGER DEFAULT 24,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS travel_notification_gateways (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_key TEXT UNIQUE NOT NULL, -- 'whatsapp_meta', 'infobip', 'twilio', 'unifonic', 'smtp_google', 'sendgrid'
        provider_name TEXT NOT NULL,
        channel_types TEXT NOT NULL, -- 'whatsapp', 'sms', 'whatsapp,sms', 'email'
        is_enabled INTEGER DEFAULT 0,
        is_default INTEGER DEFAULT 0,
        api_key TEXT,
        api_secret TEXT,
        base_url TEXT,
        account_id TEXT, -- Account SID, WABA ID, AppSID, etc.
        sender_id TEXT, -- Phone Number ID, Sender Name, From Email
        webhook_verify_token TEXT,
        config_json TEXT, -- custom extra settings in JSON format
        last_test_at TEXT,
        last_test_status TEXT, -- 'success', 'failed', 'not_tested'
        last_test_message TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      -- Module 27: ATB Boarding Pass & Thermal Ticket Printing Templates
      CREATE TABLE IF NOT EXISTS travel_atb_print_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_name TEXT NOT NULL,
        layout_format TEXT DEFAULT 'atb_standard_2part', -- 'atb_standard_2part', 'atb_standard_3part', 'thermal_80mm', 'a4_eticket'
        header_text TEXT DEFAULT 'BOARDING PASS / بطاقة صعود الطائرة',
        company_logo_url TEXT DEFAULT '/omnisystem-logo.png',
        barcode_symbology TEXT DEFAULT 'PDF417', -- 'PDF417', 'AZTEC', 'QR', 'CODE128'
        show_magnetic_stripe_sim INTEGER DEFAULT 1,
        show_baggage_stub INTEGER DEFAULT 1,
        show_seat_gate_box INTEGER DEFAULT 1,
        show_fare_breakdown INTEGER DEFAULT 1,
        disclaimer_text TEXT DEFAULT 'Gate closes 15 minutes before departure. International flights require passport check.',
        is_default INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );
    `);

    // Seed Default Notification Templates
    const tplCount = (db.prepare("SELECT COUNT(*) as c FROM travel_notification_templates").get() as { c: number }).c;
    if (tplCount === 0) {
      const insTpl = db.prepare(`
        INSERT INTO travel_notification_templates (template_code, name, channel, category, message_body, parameters_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      insTpl.run(
        "TPL-PRE-FLIGHT-24H",
        "تذكير موعد الرحلة قبل 24 ساعة (WhatsApp)",
        "whatsapp",
        "flight_reminder",
        "مرحباً عزيزنا المسافر {passenger_name} 👋\nنود تذكيركم بموعد رحلتكم رقم {flight_no} المتجهة إلى {destination} غداً بتاريخ {departure_date}.\nموعد الإقلاع: {departure_time}\nرقم الحجز (PNR): {pnr}\nالمقعد: {seat}\nيرجى التواجد في المطار قبل موعد الإقلاع بـ 3 ساعات.\nنتمنى لكم رحلة سعيدة وآمنة مع وكالة أومني فلاي للسفريات ✈️",
        JSON.stringify(["passenger_name", "flight_no", "destination", "departure_date", "departure_time", "pnr", "seat"])
      );
      insTpl.run(
        "TPL-TICKET-ISSUED",
        "إشعار إصدار التذكرة الإلكترونية (WhatsApp)",
        "whatsapp",
        "ticket_issue",
        "عزيزنا {passenger_name}، تم إصدار تذكرتكم بنجاح! 🎟️\nرقم التذكرة: {ticket_number}\nرقم الحجز (PNR): {pnr}\nخط السير: {origin} ⬅️ {destination}\nالناقل: {airline}\nيمكنكم تحميل التذكرة الإلكترونية عبر الرابط:\n{ticket_url}\nشكراً لاختياركم وكالة أومني فلاي 🌟",
        JSON.stringify(["passenger_name", "ticket_number", "pnr", "origin", "destination", "airline", "ticket_url"])
      );
      insTpl.run(
        "TPL-VISA-READY",
        "إشعار صدور التأشيرة وجاهزية الجواز (WhatsApp)",
        "whatsapp",
        "visa_update",
        "بشرى سارة عزيزنا {customer_name}! 🎉\nتمت الموافقة على تأشيرة {country} الخاصة بكم بنجاح، وجواز السفر جاهز للاستلام من فرعنا.\nرقم المعاملة: {visa_code}\nأوقات العمل: من 9 صباحاً حتى 10 مساءً.\nيسعدنا دائماً خدمتكم في وكالة أومني فلاي 🌍",
        JSON.stringify(["customer_name", "country", "visa_code"])
      );
      insTpl.run(
        "TPL-PASSPORT-EXPIRY",
        "تنبيه قرب انتهاء جواز السفر (WhatsApp/SMS)",
        "whatsapp",
        "passport_expiry",
        "عزيزنا {passenger_name}، نود إحاطتكم علماً بأن صلاحية جواز سفركم رقم {passport_no} تنتهي بتاريخ {expiry_date} (أقل من 6 أشهر).\nننصحكم بتجديده لتجنب أي تعثر في حجوزاتكم وسفرياتكم القادمة.\nوكالة أومني فلاي تتمنى لكم دوام التوفيق 🛂",
        JSON.stringify(["passenger_name", "passport_no", "expiry_date"])
      );
    }

    // Seed Notification Automations
    const autoCount = (db.prepare("SELECT COUNT(*) as c FROM travel_notification_automations").get() as { c: number }).c;
    if (autoCount === 0) {
      const insAuto = db.prepare(`
        INSERT INTO travel_notification_automations (event_trigger, name, channel, template_id, is_enabled, hours_before, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      insAuto.run("flight_24h_reminder", "تذكير المسافرين آلياً قبل إقلاع الرحلة بـ 24 ساعة", "whatsapp", 1, 1, 24, "إرسال تلقائي يومياً لجميع المسافرين للرحلات المجدولة");
      insAuto.run("ticket_issued", "إرسال التذكرة الإلكترونية فور تأكيد الإصدار", "whatsapp", 2, 1, 0, "إرسال فوري مع رابط التحميل PDF");
      insAuto.run("booking_confirmed", "إشعار تأكيد الحجز فور تسجيله في النظام", "whatsapp", 2, 1, 0, "إرسال فوري بتفاصيل الـ PNR للعميل");
      insAuto.run("visa_ready", "إشعار العميل فور تحديث حالة التأشيرة إلى صادرة", "whatsapp", 3, 1, 0, "إرسال فوري عند تغيير حالة التأشيرة");
      insAuto.run("passport_6m_expiry", "تنبيه المسافر قبل 6 أشهر من انتهاء صلاحية الجواز", "whatsapp", 4, 1, 4320, "فحص دوري للمسافرين وتنبيههم");
    }

    // Seed Notification Gateways
    const gwCount = (db.prepare("SELECT COUNT(*) as c FROM travel_notification_gateways").get() as { c: number }).c;
    if (gwCount === 0) {
      const insGw = db.prepare(`
        INSERT INTO travel_notification_gateways (
          provider_key, provider_name, channel_types, is_enabled, is_default,
          api_key, api_secret, base_url, account_id, sender_id, webhook_verify_token,
          config_json, last_test_at, last_test_status, last_test_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insGw.run(
        "whatsapp_meta", "Meta WhatsApp Cloud API (Official)", "whatsapp", 1, 1,
        "EAAG...SAMPLE_META_ACCESS_TOKEN", "meta_app_secret_demo", "https://graph.facebook.com/v19.0",
        "109283746501928", "105544332211000", "omnifly_meta_webhook_2026",
        JSON.stringify({ api_version: "v19.0", webhook_callback_url: "/api/travel/notifications/webhook/meta" }),
        new Date().toISOString().slice(0, 19).replace("T", " "), "success", "الاتصال السحابي ببوابة WhatsApp Meta نشط وجاهز"
      );

      insGw.run(
        "infobip", "Infobip Multi-Channel API (WhatsApp & SMS)", "whatsapp,sms", 1, 0,
        "ib_live_apikey_998877665544332211", "ib_secret_2026", "https://8k2pxm.api.infobip.com",
        "INFOBIP-ACCT-9921", "447860099299", "infobip_verify_token_secure",
        JSON.stringify({ default_sms_sender: "OMNIFLY", whatsapp_scenario_key: "SCN-OMNIFLY-01" }),
        new Date().toISOString().slice(0, 19).replace("T", " "), "success", "تم فحص واجهة Infobip بنجاح (جاهز للرسائل النصية والواتساب)"
      );

      insGw.run(
        "twilio", "Twilio Communications (SMS & WhatsApp)", "whatsapp,sms", 0, 0,
        "TWILIO_ACCOUNT_SID_SAMPLE", "tw_auth_token_secret_sample", "https://api.twilio.com/2010-04-01",
        "TWILIO_ACCOUNT_SID_SAMPLE", "+14155238886", "twilio_webhook_token",
        JSON.stringify({ whatsapp_from: "whatsapp:+14155238886", sms_from: "+1987654321" }),
        null, "not_tested", "في انتظار إدخال الـ Auth Token والبدء"
      );

      insGw.run(
        "unifonic", "Unifonic Enterprise SMS Gateway (KSA / MENA)", "sms", 1, 1,
        "unifonic_appsid_sample_token_8899", null, "https://el.cloud.unifonic.com/rest",
        "UNIFONIC-SA-01", "OMNIFLY", null,
        JSON.stringify({ default_sender: "OMNIFLY_TRV", encoding: "UTF8" }),
        new Date().toISOString().slice(0, 19).replace("T", " "), "success", "بوابة الرسائل النصية القصيرة السعودية جاهزة"
      );

      insGw.run(
        "smtp_google", "Google Workspace & SMTP Relay (البريد الإلكتروني)", "email", 1, 1,
        "google_app_password_sample", null, "smtp.gmail.com",
        "reservations@omnifly-travel.sa", "reservations@omnifly-travel.sa", null,
        JSON.stringify({ host: "smtp.gmail.com", port: 587, secure: false, from_name: "OmniFly Travel Reservations" }),
        new Date().toISOString().slice(0, 19).replace("T", " "), "success", "تم التحقق من خادم SMTP بنجاح"
      );
    }

    // Seed Default Corporate Accounts
    const corpCount = (db.prepare("SELECT COUNT(*) as c FROM travel_corporate_accounts").get() as { c: number }).c;
    if (corpCount === 0) {
      const insCorp = db.prepare(`
        INSERT INTO travel_corporate_accounts (company_name, company_name_en, account_code, cr_number, tax_number, contact_person, contact_phone, contact_email, credit_limit, current_balance, payment_terms_days, policy_max_booking_budget, policy_allowed_classes, policy_require_manager_approval, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const c1 = insCorp.run(
        "مجموعة بن لادن للمقاولات", "Binladen Construction Group", "CORP-SBG-01", "1010098877", "300445566700003",
        "م. سالم باحارث", "0501199887", "travel@binladen-group.sa", 150000, 42500, 45, 8000, "اقتصادية,أعمال", 1, "active", "حساب شركة معتمد مع كشف حساب شهري"
      );
      const c2 = insCorp.run(
        "شركة التقنية الرقمية المتقدمة", "Advanced Digital Tech Co.", "CORP-ADT-02", "1010887766", "300998811200003",
        "أ. ريم الشمري", "0554422110", "hr@advanced-tech.sa", 80000, 18200, 30, 4500, "اقتصادية", 1, "active", "سفريات المؤتمرات ووفود التدريب"
      );

      const corpId1 = Number(c1.lastInsertRowid);
      const corpId2 = Number(c2.lastInsertRowid);

      // Seed Corporate Employees
      const insEmp = db.prepare(`
        INSERT INTO travel_corporate_employees (corporate_id, name_ar, name_en, employee_number, department, cost_center, job_title, phone, email, passport_number, max_budget, allowed_class, requires_approval)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insEmp.run(corpId1, "م. طارق محمود السيد", "Eng. Tarek Mahmoud", "1", "إدارة المشاريع", "CC-PROJ-01", "مدير مشاريع أول", "0501199887", "tarek@binladen-group.sa", "P99887711", 7000, "أعمال", 1);
      insEmp.run(corpId1, "أ. فهد عبدالله المنصور", "Fahad Al-Mansour", "2", "الإدارة المالية", "CC-FIN-02", "مراقب مالي", "0502233445", "fahad@binladen-group.sa", "A44556677", 4000, "اقتصادية", 1);
      insEmp.run(corpId2, "د. حنان صالح الغامدي", "Dr. Hanan Al-Ghamdi", "3", "البحث والتطوير AI", "CC-RD-01", "كبير باحثين", "0554422110", "hanan@advanced-tech.sa", "B88771122", 6000, "اقتصادية,أعمال", 1);

      // Seed Corporate Requests
      const insReq = db.prepare(`
        INSERT INTO travel_corporate_requests (request_number, corporate_id, employee_id, passenger_name, service_type, trip_type, origin, destination, departure_date, return_date, preferred_class, purpose_of_trip, estimated_cost, actual_cost, status, approver_name, approved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insReq.run("REQ-CORP-2026-001", corpId1, 1, "م. طارق محمود السيد", "flight", "round_trip", "الرياض (RUH)", "دبي (DXB)", "2026-09-05", "2026-09-10", "أعمال", "حضور مؤتمر البناء والتشييد الخليجي", 3800, 3650, "approved", "المدير التنفيذي", "2026-08-20");
      insReq.run("REQ-CORP-2026-002", corpId1, 2, "أ. فهد عبدالله المنصور", "flight", "round_trip", "الرياض (RUH)", "جدة (JED)", "2026-09-12", "2026-09-14", "اقتصادية", "تدقيق حسابات فرع جدة", 950, 0, "pending_approval", null, null);
      insReq.run("REQ-CORP-2026-003", corpId2, 3, "د. حنان صالح الغامدي", "flight", "round_trip", "الرياض (RUH)", "لندن (LHR)", "2026-10-01", "2026-10-08", "أعمال", "مؤتمر الذكاء الاصطناعي العالمي", 8200, 0, "pending_approval", null, null);
    }

    // Seed BSP Reconciliation Period & Sample Tickets & ADM
    const bspCount = (db.prepare("SELECT COUNT(*) as c FROM travel_bsp_periods").get() as { c: number }).c;
    if (bspCount === 0) {
      const insBsp = db.prepare(`
        INSERT INTO travel_bsp_periods (period_code, period_name, start_date, end_date, remittance_date, total_tickets_count, bsp_gross_amount, bsp_tax_amount, bsp_commission_amount, bsp_net_payable, agency_gross_amount, agency_net_amount, variance_amount, reconciliation_status, notes, reconciled_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const b1 = insBsp.run(
        "BSP-2026-08-P1", "فترة IATA BSP للنصف الأول من أغسطس 2026", "2026-08-01", "2026-08-15", "2026-08-28",
        4, 9800, 1470, 490, 10780, 9800, 10780, 0, "reconciled", "المطابقة تامة ولا توجد فروقات على التذاكر المصدرة", "محاسب الطيران المعتمد"
      );

      const bspId1 = Number(b1.lastInsertRowid);

      const insBspTkt = db.prepare(`
        INSERT INTO travel_bsp_tickets (period_id, ticket_number, airline_code, pnr, passenger_name, issue_date, transaction_type, bsp_fare, bsp_tax, bsp_commission, bsp_net, agency_fare, agency_net, variance, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insBspTkt.run(bspId1, "065-2415896321", "SV", "PNR-X78Y90", "ALOTAIBI/ABDULLAH MR", "2026-08-05", "TKTT", 1200, 180, 60, 1320, 1200, 1320, 0, "matched", "متطابقة 100%");
      insBspTkt.run(bspId1, "065-2415896322", "SV", "PNR-X78Y90", "ALOTAIBI/SARAH MRS", "2026-08-05", "TKTT", 1200, 180, 60, 1320, 1200, 1320, 0, "matched", "متطابقة 100%");
      insBspTkt.run(bspId1, "176-9874123654", "EK", "PNR-E45T11", "ELSAYED/TAREK DR", "2026-08-10", "TKTT", 1800, 270, 90, 1980, 1800, 1980, 0, "matched", "متطابقة 100%");
      insBspTkt.run(bspId1, "057-3322114455", "AF", "PNR-F88Q32", "ALZAHRANI/FATIMA MS", "2026-08-12", "TKTT", 3200, 480, 160, 3520, 3200, 3520, 0, "matched", "تذكرة باريس متطابقة");

      // Seed ADM / ACM Memos
      const insMemo = db.prepare(`
        INSERT INTO travel_bsp_memos (memo_type, memo_number, airline_code, airline_name, ticket_number, pnr, issue_date, amount, reason_code, reason_description, status, dispute_deadline, dispute_notes, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insMemo.run(
        "ADM", "ADM-SV-2026-091", "SV", "الخطوط الجوية العربية السعودية", "065-2415896321", "PNR-X78Y90", "2026-08-16", 150, "CLASS_MISMATCH",
        "مذكرة خصم: تطبيق فئة حجز مخفضة V بدلاً من Q في خط سير العودة", "under_dispute", "2026-08-30", "تم تقديم اعتراض عبر BSPLink مع إرفاق سجل PNR التاريخي", "قيد المتابعة مع مكتب مبيعات الخطوط السعودية"
      );
      insMemo.run(
        "ACM", "ACM-EK-2026-014", "EK", "طيران الإمارات", "176-9874123654", "PNR-E45T11", "2026-08-18", 220, "OVERRIDE_COMMISSION",
        "مذكرة إضافة دائنة: تسوية عمولة حافز مبيعات التميز لرحلات الدرجة الأولى", "accepted", "2026-09-01", null, "تمت إضافة الرصيد لصالح الوكالة في كشف BSP"
      );
    }

    // Seed Sample GDS Raw PNR History
    const gdsCount = (db.prepare("SELECT COUNT(*) as c FROM travel_gds_pnr_history").get() as { c: number }).c;
    if (gdsCount === 0) {
      const insGds = db.prepare(`
        INSERT INTO travel_gds_pnr_history (pnr_code, gds_system, raw_text, passenger_name, airline_code, flight_number, route, departure_date, ticket_number, total_fare, currency, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insGds.run(
        "6X9ZKL", "amadeus",
        `RP/RUH1A0988/RUH1A0988            AA/SU   22AUG26/1420Z   6X9ZKL\n1.ALOTAIBI/ABDULLAH MR  2.ALOTAIBI/SARAH MRS\n 2  SV 112 Y 10SEP 4 RUHDXB HK2  0810 1055   *1A/E*\n 3  SV 113 Y 18SEP 5 DXBRUH HK2  1830 1930   *1A/E*\n 4 AP RUH +966 50 5544332 - AL-ALAMIYA TRAVEL\n 5 TK OK22AUG/RUH1A0988//ET\n 6 FA PAX 065-2415896321/ETSV/SAR1500.00/10SEP/RUH/S1-2\n 7 FA PAX 065-2415896322/ETSV/SAR1500.00/10SEP/RUH/S1-2`,
        "ALOTAIBI/ABDULLAH MR, ALOTAIBI/SARAH MRS", "SV", "SV 112 / SV 113", "RUH -> DXB -> RUH", "2026-09-10", "065-2415896321", 3000, "SAR", "imported", "مدير النظام"
      );
      insGds.run(
        "P89VTR", "sabre",
        `1.1ELSAYED/TAREK DR\n 1 EK 814 J 01SEP JEDCAI HK1  1420 1600 /E\n 2 EK 815 J 15SEP CAIJED HK1  2015 2345 /E\n TKT/TIME LIMIT - 28AUG26\n PH-JED 0554433221-A\n FA PAX 176-9874123654/ETEK/SAR2200.00`,
        "ELSAYED/TAREK DR", "EK", "EK 814 / EK 815", "JED -> CAI -> JED", "2026-09-01", "176-9874123654", 2200, "SAR", "imported", "موظف المبيعات"
      );
    }

    // Seed Default ATB Print Templates
    const atbCount = (db.prepare("SELECT COUNT(*) as c FROM travel_atb_print_templates").get() as { c: number }).c;
    if (atbCount === 0) {
      const insAtb = db.prepare(`
        INSERT INTO travel_atb_print_templates (template_name, layout_format, header_text, barcode_symbology, show_magnetic_stripe_sim, show_baggage_stub, show_seat_gate_box, show_fare_breakdown, is_default)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insAtb.run("قالب تذكرة وبطاقة صعود معيارية IATA ATB (مقسمة جزأين)", "atb_standard_2part", "BOARDING PASS / بطاقة صعود الطائرة", "PDF417", 1, 1, 1, 1, 1);
      insAtb.run("قالب تذكرة حرارية 80 ملم Thermal POS", "thermal_80mm", "إشعار حجز وتذكرة إلكترونية", "QR", 0, 1, 1, 1, 0);
      insAtb.run("قالب بطاقة صعود كاملة 3 أجزاء IATA ATB (3-Stub)", "atb_standard_3part", "BOARDING PASS & PASSENGER COUPON", "PDF417", 1, 1, 1, 1, 0);
    }

    // ────────────────────────────────────────────────────────
    // NEXT-GEN GLOBAL TRAVEL ERP EXTENSIONS (GAP ANALYSIS ROADMAP)
    // ────────────────────────────────────────────────────────

    // 1️⃣ IATA NDC Protocols & Direct Airline APIs
    db.exec(`
      CREATE TABLE IF NOT EXISTS travel_ndc_gateways (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_name TEXT NOT NULL,
        airline_code TEXT NOT NULL,
        api_endpoint TEXT NOT NULL,
        ndc_version TEXT DEFAULT '21.3', -- 17.2, 18.1, 21.3
        auth_type TEXT DEFAULT 'oauth2_token', -- 'oauth2_token', 'api_key', 'basic_auth'
        client_id TEXT,
        client_secret TEXT,
        status TEXT DEFAULT 'active', -- 'active', 'inactive', 'testing'
        fee_discount_pct REAL DEFAULT 4.5, -- savings compared to legacy GDS
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_ndc_offers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        offer_id TEXT UNIQUE NOT NULL,
        airline_code TEXT NOT NULL,
        airline_name TEXT NOT NULL,
        origin TEXT NOT NULL,
        destination TEXT NOT NULL,
        departure_time TEXT NOT NULL,
        arrival_time TEXT NOT NULL,
        flight_no TEXT NOT NULL,
        cabin_class TEXT DEFAULT 'Economy',
        base_fare REAL NOT NULL,
        taxes REAL NOT NULL,
        total_fare REAL NOT NULL,
        ndc_savings REAL DEFAULT 0,
        seat_selection_available INTEGER DEFAULT 1,
        baggage_allowance_kg INTEGER DEFAULT 30,
        meal_options TEXT DEFAULT 'حلال، نباتي، خالي من الغلوتين',
        ancillaries_json TEXT,
        status TEXT DEFAULT 'available', -- 'available', 'booked', 'expired'
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_air_mir_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_name TEXT NOT NULL,
        file_type TEXT NOT NULL, -- 'AIR' (Amadeus), 'MIR' (Sabre), 'BFM' (Galileo)
        pnr TEXT NOT NULL,
        ticket_numbers TEXT,
        airline_code TEXT NOT NULL,
        passenger_names TEXT NOT NULL,
        total_amount REAL NOT NULL,
        currency TEXT DEFAULT 'SAR',
        status TEXT DEFAULT 'processed', -- 'processed', 'queued', 'failed'
        parsed_data_json TEXT,
        journal_entry_id INTEGER REFERENCES journal_entries(id),
        processed_at TEXT DEFAULT (datetime('now', 'localtime')),
        error_log TEXT
      );

      CREATE TABLE IF NOT EXISTS travel_air_mir_listeners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        listener_name TEXT NOT NULL,
        protocol TEXT NOT NULL DEFAULT 'SFTP', -- 'SFTP', 'WEBHOOK', 'LOCAL_WATCHER'
        host TEXT,
        port INTEGER DEFAULT 22,
        remote_path TEXT DEFAULT '/outbox/tickets',
        is_running INTEGER DEFAULT 1,
        last_poll_at TEXT DEFAULT (datetime('now', 'localtime')),
        files_processed_count INTEGER DEFAULT 0
      );

      -- 2️⃣ Multi-Supplier Hotel Aggregators & Dynamic Markup Engine
      CREATE TABLE IF NOT EXISTS travel_hotel_aggregators (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_code TEXT UNIQUE NOT NULL, -- 'hotelbeds', 'webbeds', 'tbo_holidays', 'expedia_eps', 'travco', 'agoda_b2b'
        supplier_name TEXT NOT NULL,
        api_endpoint TEXT NOT NULL,
        api_key TEXT,
        secret_key TEXT,
        is_active INTEGER DEFAULT 1,
        status TEXT DEFAULT 'connected', -- 'connected', 'degraded', 'offline'
        avg_latency_ms INTEGER DEFAULT 120,
        currency TEXT DEFAULT 'USD',
        credit_balance REAL DEFAULT 25000.00
      );

      CREATE TABLE IF NOT EXISTS travel_markup_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_name TEXT NOT NULL,
        channel TEXT DEFAULT 'all', -- 'all', 'b2b_gold', 'b2b_platinum', 'b2b_silver', 'b2c_web', 'walk_in'
        service_type TEXT DEFAULT 'all', -- 'all', 'flight', 'hotel', 'visa', 'package', 'transport'
        destination_country TEXT DEFAULT 'all',
        airline_or_chain TEXT DEFAULT 'all',
        markup_type TEXT DEFAULT 'percentage', -- 'percentage', 'fixed_amount'
        markup_value REAL NOT NULL DEFAULT 5.0,
        discount_value REAL DEFAULT 0.0,
        priority INTEGER DEFAULT 1,
        is_active INTEGER DEFAULT 1,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      -- 3️⃣ Charter & Block Allotment Management (Flights & Hotels)
      CREATE TABLE IF NOT EXISTS travel_charter_blocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        block_code TEXT UNIQUE NOT NULL,
        block_name TEXT NOT NULL,
        flight_no TEXT NOT NULL,
        airline_code TEXT NOT NULL,
        origin TEXT NOT NULL,
        destination TEXT NOT NULL,
        travel_date TEXT NOT NULL,
        return_date TEXT,
        total_seats_contracted INTEGER NOT NULL,
        buy_rate_per_seat REAL NOT NULL,
        total_contract_cost REAL NOT NULL,
        sell_rate_per_seat REAL NOT NULL,
        seats_sold INTEGER DEFAULT 0,
        seats_held INTEGER DEFAULT 0,
        seats_available INTEGER NOT NULL,
        break_even_seats INTEGER NOT NULL,
        load_factor_pct REAL DEFAULT 0.0,
        season_tag TEXT DEFAULT 'umrah', -- 'hajj', 'umrah', 'summer_holiday', 'eid', 'regular'
        status TEXT DEFAULT 'active', -- 'active', 'closed', 'cancelled'
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_charter_allocations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        block_id INTEGER NOT NULL REFERENCES travel_charter_blocks(id) ON DELETE CASCADE,
        agent_or_client_name TEXT NOT NULL,
        seats_allocated INTEGER NOT NULL,
        seats_confirmed INTEGER DEFAULT 0,
        price_per_seat REAL NOT NULL,
        deposit_paid REAL DEFAULT 0,
        status TEXT DEFAULT 'confirmed', -- 'allocated', 'confirmed', 'released'
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_hotel_allotments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contract_code TEXT UNIQUE NOT NULL,
        hotel_id INTEGER,
        hotel_name TEXT NOT NULL,
        destination_city TEXT NOT NULL,
        check_in_start TEXT NOT NULL,
        check_out_end TEXT NOT NULL,
        room_type TEXT NOT NULL,
        total_rooms_contracted INTEGER NOT NULL,
        buy_rate_per_night REAL NOT NULL,
        sell_rate_per_night REAL NOT NULL,
        auto_release_days INTEGER DEFAULT 7,
        auto_release_date TEXT NOT NULL,
        rooms_sold INTEGER DEFAULT 0,
        rooms_available INTEGER NOT NULL,
        is_released INTEGER DEFAULT 0,
        penalty_after_release REAL DEFAULT 0,
        supplier_id INTEGER,
        status TEXT DEFAULT 'active', -- 'active', 'warning_near_release', 'released', 'completed'
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      -- 4️⃣ Regional E-Invoicing (ZATCA Phase 2) & Real-Time Multi-Currency FX Engine
      CREATE TABLE IF NOT EXISTS travel_zatca_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER REFERENCES travel_invoices(id),
        invoice_number TEXT UNIQUE NOT NULL,
        invoice_type TEXT DEFAULT 'standard_tax', -- 'standard_tax', 'simplified_tax', 'credit_note', 'debit_note'
        travel_tax_mode TEXT DEFAULT 'agent_commission_only', -- 'agent_commission_only' (15% on markup/fee), 'principal_full_value' (15% on full amount)
        issue_date TEXT NOT NULL,
        issue_time TEXT NOT NULL,
        seller_name TEXT NOT NULL,
        seller_vat_no TEXT NOT NULL,
        buyer_name TEXT NOT NULL,
        buyer_vat_no TEXT,
        total_taxable_amount REAL NOT NULL,
        vat_rate REAL DEFAULT 15.0,
        vat_amount REAL NOT NULL,
        grand_total REAL NOT NULL,
        uuid TEXT NOT NULL,
        previous_invoice_hash TEXT,
        invoice_hash TEXT NOT NULL,
        cryptographic_stamp TEXT NOT NULL,
        qr_code_tlv_base64 TEXT NOT NULL,
        ubl_xml_content TEXT,
        zatca_status TEXT DEFAULT 'cleared', -- 'reported', 'cleared', 'pending', 'rejected'
        zatca_response_msg TEXT DEFAULT 'تم الفحص والاعتماد بنجاح لدى منصة فاتورة (ZATCA Phase 2 Sandbox)',
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_fx_rates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        base_currency TEXT NOT NULL DEFAULT 'SAR',
        target_currency TEXT NOT NULL,
        rate REAL NOT NULL,
        inverse_rate REAL NOT NULL,
        last_updated TEXT DEFAULT (datetime('now', 'localtime')),
        source TEXT DEFAULT 'live_central_bank',
        is_active INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS travel_fx_revaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        revaluation_date TEXT NOT NULL,
        account_name TEXT NOT NULL,
        currency TEXT NOT NULL,
        foreign_balance REAL NOT NULL,
        old_rate REAL NOT NULL,
        new_rate REAL NOT NULL,
        local_amount_old REAL NOT NULL,
        local_amount_new REAL NOT NULL,
        gain_loss_amount REAL NOT NULL,
        is_posted INTEGER DEFAULT 1,
        journal_entry_id INTEGER REFERENCES journal_entries(id),
        created_by TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      -- 5️⃣ Virtual Credit Cards (VCC) Generator & B2B Settlement Gateway
      CREATE TABLE IF NOT EXISTS travel_vcc_cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        card_token TEXT UNIQUE NOT NULL,
        card_number_masked TEXT NOT NULL,
        card_holder_name TEXT NOT NULL,
        expiry_month TEXT NOT NULL,
        expiry_year TEXT NOT NULL,
        cvv TEXT NOT NULL,
        currency TEXT DEFAULT 'USD',
        credit_limit REAL NOT NULL,
        amount_charged REAL DEFAULT 0.0,
        balance_available REAL NOT NULL,
        issuer_gateway TEXT DEFAULT 'conferma', -- 'conferma', 'wex', 'mastercard_b2b', 'visa_commercial'
        card_type TEXT DEFAULT 'single_use', -- 'single_use', 'multi_use'
        mcc_restriction TEXT DEFAULT 'all_travel', -- '3000-3299_airlines', '3500-3999_hotels', 'all_travel'
        activation_date TEXT NOT NULL,
        expiration_date TEXT NOT NULL,
        status TEXT DEFAULT 'active', -- 'active', 'exhausted', 'cancelled', 'expired'
        booking_id INTEGER,
        supplier_id INTEGER,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_vcc_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vcc_id INTEGER NOT NULL REFERENCES travel_vcc_cards(id) ON DELETE CASCADE,
        transaction_ref TEXT UNIQUE NOT NULL,
        merchant_name TEXT NOT NULL,
        merchant_category_code TEXT,
        amount REAL NOT NULL,
        currency TEXT NOT NULL,
        auth_code TEXT NOT NULL,
        status TEXT DEFAULT 'settled', -- 'approved', 'settled', 'declined', 'reversed'
        transaction_date TEXT DEFAULT (datetime('now', 'localtime')),
        notes TEXT
      );

      -- 6️⃣ AI-Powered Smart Itinerary Generator & Day-by-Day Tour Planner
      CREATE TABLE IF NOT EXISTS travel_smart_itineraries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        destination_country TEXT NOT NULL,
        destination_city TEXT NOT NULL,
        duration_days INTEGER NOT NULL,
        duration_nights INTEGER NOT NULL,
        theme TEXT DEFAULT 'family', -- 'honeymoon', 'family', 'adventure', 'cultural_history', 'luxury_relaxation', 'umrah_plus'
        target_audience TEXT DEFAULT 'عائلات، أفراد، مجموعات سياحية',
        base_price REAL NOT NULL DEFAULT 4500,
        currency TEXT DEFAULT 'SAR',
        status TEXT DEFAULT 'published', -- 'draft', 'published', 'archived'
        overview TEXT NOT NULL,
        highlights_json TEXT,
        inclusions_json TEXT,
        exclusions_json TEXT,
        hero_image_url TEXT,
        qr_code_url TEXT,
        created_by TEXT DEFAULT 'مدير البرامج السياحية',
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_itinerary_days (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        itinerary_id INTEGER NOT NULL REFERENCES travel_smart_itineraries(id) ON DELETE CASCADE,
        day_number INTEGER NOT NULL,
        day_title TEXT NOT NULL,
        morning_activity TEXT,
        afternoon_activity TEXT,
        evening_activity TEXT,
        hotel_name TEXT,
        meals_included TEXT DEFAULT 'breakfast', -- 'breakfast', 'lunch', 'dinner', 'bb', 'all'
        transport_type TEXT DEFAULT 'حافلة VIP خاصة مع سائق ومرشد',
        photo_url TEXT,
        notes TEXT
      );
    `);

    // Seed NDC Gateways & Offers
    const ndcCount = (db.prepare("SELECT COUNT(*) as c FROM travel_ndc_gateways").get() as { c: number }).c;
    if (ndcCount === 0) {
      const insNdcGw = db.prepare(`
        INSERT INTO travel_ndc_gateways (provider_name, airline_code, api_endpoint, ndc_version, auth_type, client_id, client_secret, status, fee_discount_pct)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insNdcGw.run("Saudia Airlines Direct NDC API (Saudia NDC Hub)", "SV", "https://api.saudia.com/ndc/v21_3", "21.3", "oauth2_token", "SV_NDC_OMNIFLY_CLIENT", "sv_sec_992288", "active", 5.0);
      insNdcGw.run("Emirates Direct NDC (Emirates Gateway)", "EK", "https://api.emirates.com/ndc/v21_3", "21.3", "oauth2_token", "EK_NDC_OMNIFLY_CLIENT", "ek_sec_774411", "active", 4.5);
      insNdcGw.run("Qatar Airways NDC Hub (Oryx NDC)", "QR", "https://ndc.qatarairways.com/v21", "21.3", "oauth2_token", "QR_NDC_OMNIFLY_CLIENT", "qr_sec_332211", "active", 4.8);
      insNdcGw.run("Flydubai Direct NDC Connection", "FZ", "https://ndc.flydubai.com/api/v2", "18.1", "api_key", "FZ_NDC_OMNIFLY", "fz_key_551100", "active", 6.0);

      const insNdcOff = db.prepare(`
        INSERT INTO travel_ndc_offers (offer_id, airline_code, airline_name, origin, destination, departure_time, arrival_time, flight_no, cabin_class, base_fare, taxes, total_fare, ndc_savings, seat_selection_available, baggage_allowance_kg, meal_options, ancillaries_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insNdcOff.run(
        "NDC-SV-2026-901", "SV", "الخطوط السعودية (NDC مباشر)", "الرياض (RUH)", "دبي (DXB)", "2026-09-10 08:30", "2026-09-10 11:15", "SV 120", "ضيافة اقتصادية ممتازة", 850, 127.5, 977.5, 95.0, 1, 35, "وجبة ساخنة + قهوة سعودية مجانية",
        JSON.stringify([
          { id: "ANC-SEAT-1", name: "مقعد بمساحة إضافية للأرجل (Extra Legroom Row 12)", price: 75, currency: "SAR", selected: true },
          { id: "ANC-BAG-1", name: "حقيبة إضافية 23 كجم", price: 120, currency: "SAR", selected: false },
          { id: "ANC-LOUNGE-1", name: "دخول صالة الفرسان Alfursan Lounge", price: 150, currency: "SAR", selected: true }
        ])
      );
      insNdcOff.run(
        "NDC-EK-2026-302", "EK", "طيران الإمارات (NDC Direct)", "جدة (JED)", "لندن (LHR)", "2026-09-15 14:20", "2026-09-15 21:40", "EK 804 / EK 005", "درجة الأعمال الفاخرة", 7800, 1170, 8970, 650.0, 1, 40, "وجبات عالمية فاخرة + شيف خاص",
        JSON.stringify([
          { id: "ANC-SEAT-2", name: "مقعد سرير منبسط كامل (Lie-flat Bed Aisle 4A)", price: 0, currency: "SAR", selected: true },
          { id: "ANC-CHAUFFEUR", name: "خدمة سيارة بسائق خاص مجانية من المطار", price: 0, currency: "SAR", selected: true },
          { id: "ANC-WIFI", name: "باقة إنترنت غير محدود على متن الطائرة", price: 65, currency: "SAR", selected: true }
        ])
      );
      insNdcOff.run(
        "NDC-QR-2026-441", "QR", "الخطوط الجوية القطرية (Oryx NDC)", "الدمام (DMM)", "إسطنبول (IST)", "2026-09-20 09:00", "2026-09-20 15:30", "QR 1150", "اقتصادية مرنة", 1450, 217.5, 1667.5, 130.0, 1, 30, "وجبات شرقية وغربية طازجة",
        JSON.stringify([
          { id: "ANC-FASTTRACK", name: "المسار السريع للجوازات والتفتيش (Fast Track)", price: 90, currency: "SAR", selected: true },
          { id: "ANC-BAG-2", name: "وزن إضافي 10 كجم", price: 110, currency: "SAR", selected: false }
        ])
      );
    }

    // Seed AIR / MIR Real-time listener & Sample Processed Logs
    const airCount = (db.prepare("SELECT COUNT(*) as c FROM travel_air_mir_listeners").get() as { c: number }).c;
    if (airCount === 0) {
      const insList = db.prepare(`
        INSERT INTO travel_air_mir_listeners (listener_name, protocol, host, port, remote_path, is_running, files_processed_count)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      insList.run("خادم الاستماع لملفات Amadeus AIR Files", "SFTP", "sftp.amadeus.omnifly.sa", 22, "/incoming/air_tickets", 1, 24);
      insList.run("مستمع واجهة Sabre MIR Webhook Event Stream", "WEBHOOK", "api.omnifly.sa/api/travel/mir-stream", 443, "/mir_events", 1, 18);
      insList.run("مجلد الرقابة المحلي لجهاز إصدار التذاكر Local Folder Watcher", "LOCAL_WATCHER", "localhost", 0, "C:/OmniFly/GDS_Spooler", 1, 35);

      const insAir = db.prepare(`
        INSERT INTO travel_air_mir_files (file_name, file_type, pnr, ticket_numbers, airline_code, passenger_names, total_amount, currency, status, parsed_data_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insAir.run(
        "AIR_20260826_RUH1A0988_001.txt", "AIR", "6X9ZKL", "065-2415896321, 065-2415896322", "SV", "ALOTAIBI/ABDULLAH MR, ALOTAIBI/SARAH MRS", 3000, "SAR", "processed",
        JSON.stringify({ gds: "Amadeus", agent_sine: "RUH1A0988", routing: "RUH-DXB-RUH", fare: 3000, tax: 450, comm: 150, ledger_posted: true })
      );
      insAir.run(
        "MIR_SABRE_20260825_8891.dat", "MIR", "P89VTR", "176-9874123654", "EK", "ELSAYED/TAREK DR", 2200, "SAR", "processed",
        JSON.stringify({ gds: "Sabre", agent_sine: "P89V", routing: "JED-CAI-JED", fare: 2200, tax: 330, comm: 110, ledger_posted: true })
      );
    }

    // Seed Hotel Aggregators & Dynamic Markup Rules
    const aggCount = (db.prepare("SELECT COUNT(*) as c FROM travel_hotel_aggregators").get() as { c: number }).c;
    if (aggCount === 0) {
      const insAgg = db.prepare(`
        INSERT INTO travel_hotel_aggregators (supplier_code, supplier_name, api_endpoint, is_active, status, avg_latency_ms, currency, credit_balance)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insAgg.run("hotelbeds", "Hotelbeds Global B2B API Switch", "https://api.hotelbeds.com/hotel-api/1.0", 1, "connected", 98, "USD", 35000.0);
      insAgg.run("webbeds", "WebBeds / TotalStay Wholesale Hub", "https://api.webbeds.com/v2/hotels", 1, "connected", 115, "EUR", 28000.0);
      insAgg.run("tbo_holidays", "TBO Holidays Middle East & Asia Switch", "https://api.tbogroup.com/HotelAPI_V10/HotelService.svc", 1, "connected", 85, "USD", 42000.0);
      insAgg.run("expedia_eps", "Expedia Partner Solutions (EPS Rapid 3.0)", "https://api.ean.com/v3", 1, "connected", 140, "USD", 50000.0);
      insAgg.run("travco", "Travco XML Booking Engine", "https://xml.travco.co.uk/v4", 1, "connected", 160, "GBP", 15000.0);

      const insMkp = db.prepare(`
        INSERT INTO travel_markup_rules (rule_name, channel, service_type, destination_country, airline_or_chain, markup_type, markup_value, discount_value, priority, is_active, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insMkp.run("هامش ربح مبيعات الأفراد B2C (فنادق وطيران)", "b2c_web", "all", "all", "all", "percentage", 7.5, 0.0, 1, 1, "هامش ربح قياسي لبوابة العملاء المباشرة");
      insMkp.run("تسعير مكاتب وشركات B2B البلاتينية (خصم خاص)", "b2b_platinum", "all", "all", "all", "percentage", 2.0, 1.5, 2, 1, "عمولة مخفضة للوكلاء ذوي المبيعات العالية");
      insMkp.run("هامش ربح فنادق مكة والمدينة في موسم العمرة", "all", "hotel", "Saudi Arabia", "Hilton,Clock Towers,Fairmont", "fixed_amount", 120.0, 0.0, 3, 1, "إضافة مبلغ ثابت 120 ريال لكل ليلة فندقية");
      insMkp.run("خصم باقات العطلات الصيفية المبكرة Early Bird", "all", "package", "Turkey,Malaysia,Georgia", "all", "percentage", 4.0, 3.0, 4, 1, "خصم ترويجي 3% للمشتريات المبكرة");
    }

    // Seed Flight Charter Blocks & Hotel Seasonal Allotments
    const blkCount = (db.prepare("SELECT COUNT(*) as c FROM travel_charter_blocks").get() as { c: number }).c;
    if (blkCount === 0) {
      const insBlk = db.prepare(`
        INSERT INTO travel_charter_blocks (block_code, block_name, flight_no, airline_code, origin, destination, travel_date, return_date, total_seats_contracted, buy_rate_per_seat, total_contract_cost, sell_rate_per_seat, seats_sold, seats_held, seats_available, break_even_seats, load_factor_pct, season_tag, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const b1 = insBlk.run(
        "BLK-UMRAH-2026-01", "بلوك رحلات عمرة رجب وشعبان (طيران أديل / الرياض - جدة)", "F3 214", "F3", "الرياض (RUH)", "جدة (JED)", "2026-09-01", "2026-09-08",
        180, 450, 81000, 650, 142, 18, 20, 125, 78.9, "umrah", "active", "تم بيع 142 مقعد، نقطة التعادل 125 مقعد محققة بربح صافي"
      );
      const b2 = insBlk.run(
        "BLK-TR-SUMMER-02", "شارتر رحلات طرابزون السياحية الصيفية (طيران ناس)", "XY 618", "XY", "الدمام (DMM)", "طرابزون (TZX)", "2026-09-12", "2026-09-22",
        160, 1200, 192000, 1650, 128, 12, 20, 116, 80.0, "summer_holiday", "active", "معدل الإشغال 80% ومحقق أرباح ممتازة"
      );

      const blkId1 = Number(b1.lastInsertRowid);
      const insAlloc = db.prepare(`
        INSERT INTO travel_charter_allocations (block_id, agent_or_client_name, seats_allocated, seats_confirmed, price_per_seat, deposit_paid, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      insAlloc.run(blkId1, "وكالة الفرسان للسياحة والعمرة (B2B)", 50, 48, 620, 15000, "confirmed");
      insAlloc.run(blkId1, "شركة الرحلات الميسرة (B2B)", 40, 40, 620, 12000, "confirmed");
      insAlloc.run(blkId1, "مبيعات التجزئة المباشرة للأفراد B2C", 60, 54, 650, 35100, "confirmed");

      const insAlt = db.prepare(`
        INSERT INTO travel_hotel_allotments (contract_code, hotel_name, destination_city, check_in_start, check_out_end, room_type, total_rooms_contracted, buy_rate_per_night, sell_rate_per_night, auto_release_days, auto_release_date, rooms_sold, rooms_available, is_released, penalty_after_release, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insAlt.run(
        "ALT-MKK-FAIRMONT-26", "فندق فيرمونت برج ساعة مكة (Fairmont Makkah)", "مكة المكرمة", "2026-09-01", "2026-09-30", "غرفة ديلوكس إطلالة على الكعبة",
        45, 950, 1350, 7, "2026-08-25", 38, 7, 0, 0, "active", "عقد التزام موسمي - متبقي 7 غرف فقط"
      );
      insAlt.run(
        "ALT-IST-HILTON-BOS", "فندق هيلتون البوسفور إسطنبول (Hilton Bosphorus)", "إسطنبول", "2026-09-10", "2026-09-25", "غرفة عائلية إطلالة على البوسفور",
        25, 600, 850, 5, "2026-09-05", 20, 5, 0, 0, "warning_near_release", "تنبيه: اقتراب تاريخ الإفراج التلقائي (Auto-Release) خلال 10 أيام"
      );
      insAlt.run(
        "ALT-DXB-ATLANTIS-26", "منتجع أتلانتس النخلة دبي (Atlantis The Palm)", "دبي", "2026-09-15", "2026-09-28", "جناح أوشن عائلي (Ocean Suite)",
        15, 1400, 1950, 10, "2026-09-05", 13, 2, 0, 0, "active", "إشغال 87% ممتاز"
      );
    }

    // Seed ZATCA Invoices & Multi-Currency FX Rates
    const zatcaCount = (db.prepare("SELECT COUNT(*) as c FROM travel_zatca_invoices").get() as { c: number }).c;
    if (zatcaCount === 0) {
      const insZat = db.prepare(`
        INSERT INTO travel_zatca_invoices (
          invoice_number, invoice_type, travel_tax_mode, issue_date, issue_time,
          seller_name, seller_vat_no, buyer_name, buyer_vat_no,
          total_taxable_amount, vat_rate, vat_amount, grand_total,
          uuid, previous_invoice_hash, invoice_hash, cryptographic_stamp, qr_code_tlv_base64,
          zatca_status, zatca_response_msg
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insZat.run(
        "INV-ZATCA-2026-00101", "standard_tax", "agent_commission_only", "2026-08-25", "14:30:15",
        "شركة أومني فلاي العالمية للسفريات والسياحة", "300123456700003", "مجموعة بن لادن للمقاولات", "300445566700003",
        300.0, 15.0, 45.0, 345.0,
        "c81d4e2e-bcf2-11e6-869b-7c04d0d2f6cd", "NWZlYjM0OGE2ZjM5...PREV_HASH", "8a9f3b1e7c4d5a6b0c2e4f6a8b0d2e4f6a8b0d2e4f6a8b0d2e4f6a8b0d2e4f6a",
        "MEQCIB6...DIGITAL_ECDSA_STAMP_ZATCA_PHASE_2",
        "AQ3YtNix2YTYp9mF2YrYqSDZhNmE...TLV_BASE64_QR_CODE",
        "cleared", "تم الفحص والاعتماد بنجاح وتوليد الختم الرقمي المشفر المتوافق مع ZATCA Phase 2"
      );
      insZat.run(
        "INV-ZATCA-2026-00102", "simplified_tax", "principal_full_value", "2026-08-26", "11:15:00",
        "شركة أومني فلاي العالمية للسفريات والسياحة", "300123456700003", "عبدالله بن فهد العتيبي (عميل نقدي)", null,
        3000.0, 15.0, 450.0, 3450.0,
        "e92f5f3f-cd03-22f7-970c-8d15e1e3f7de", "8a9f3b1e7c4d5a...PREV_HASH", "9b0c2e4f6a8b0d2e4f6a8b0d2e4f6a8b0d2e4f6a8b0d2e4f6a8b0d2e4f6a8b0d",
        "MEYCIQDx...DIGITAL_ECDSA_STAMP_ZATCA_SIMPLIFIED",
        "AQ3YtNix2YTYp9mF2YrYqSDZhNmE...TLV_BASE64_QR_SIMPLIFIED",
        "cleared", "فاتورة ضريبية مبسطة معتمدة بختم مشفر ورمز استجابة سريعة TLV"
      );

      const insFx = db.prepare(`
        INSERT INTO travel_fx_rates (base_currency, target_currency, rate, inverse_rate, last_updated, source)
        VALUES (?, ?, ?, ?, datetime('now', 'localtime'), ?)
      `);
      insFx.run("SAR", "USD", 0.2667, 3.7500, "البنك المركزي السعودي SAMA");
      insFx.run("SAR", "EUR", 0.2450, 4.0816, "البنك المركزي الأوروبي ECB");
      insFx.run("SAR", "AED", 0.9792, 1.0212, "أسعار الصرف الرسمية الخليجية");
      insFx.run("SAR", "GBP", 0.2105, 4.7505, "بنك إنجلترا المركزي");
      insFx.run("SAR", "KWD", 0.0818, 12.2249, "بنك الكويت المركزي");
      insFx.run("SAR", "EGP", 13.0200, 0.0768, "البنك المركزي المصري");
      insFx.run("SAR", "TRY", 9.1500, 0.1093, "البنك المركزي التركي");

      const insRev = db.prepare(`
        INSERT INTO travel_fx_revaluations (revaluation_date, account_name, currency, foreign_balance, old_rate, new_rate, local_amount_old, local_amount_new, gain_loss_amount, is_posted, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insRev.run("2026-08-25", "حساب رصيد فندق هيلتون العالمي (USD)", "USD", 15000, 3.745, 3.750, 56175, 56250, 75.0, 1, "محاسب العملات الأجنبية");
    }

    // Seed Virtual Credit Cards (VCC) & Transactions
    const vccCount = (db.prepare("SELECT COUNT(*) as c FROM travel_vcc_cards").get() as { c: number }).c;
    if (vccCount === 0) {
      const insVcc = db.prepare(`
        INSERT INTO travel_vcc_cards (
          card_token, card_number_masked, card_holder_name, expiry_month, expiry_year, cvv,
          currency, credit_limit, amount_charged, balance_available, issuer_gateway, card_type,
          mcc_restriction, activation_date, expiration_date, status, booking_id, supplier_id, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const v1 = insVcc.run(
        "VCC-CONF-2026-9901", "5425 •••• •••• 8812", "OMNIFLY TRV / HOTELBEDS BKG #88219", "12", "2027", "849",
        "USD", 1250.00, 1250.00, 0.00, "conferma", "single_use",
        "3500-3999_hotels", "2026-08-20", "2026-09-20", "exhausted", 1, 1, "بطاقة افتراضية محددة بدقة لدفع حجز فندق أتلانتس دبي عبر Hotelbeds"
      );
      const v2 = insVcc.run(
        "VCC-WEX-2026-4402", "4111 •••• •••• 3349", "OMNIFLY TRV / SAUDIA DIRECT NDC", "10", "2027", "612",
        "SAR", 3800.00, 3650.00, 150.00, "wex", "single_use",
        "3000-3299_airlines", "2026-08-24", "2026-09-24", "active", 2, 2, "بطاقة افتراضية لتسوية تذاكر الخطوط السعودية عبر واجهة NDC مباشرة"
      );

      const vccId1 = Number(v1.lastInsertRowid);
      const vccId2 = Number(v2.lastInsertRowid);

      const insTx = db.prepare(`
        INSERT INTO travel_vcc_transactions (vcc_id, transaction_ref, merchant_name, merchant_category_code, amount, currency, auth_code, status, transaction_date, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insTx.run(vccId1, "TX-VCC-889101", "HOTELBEDS SLU SPAIN", "3501", 1250.00, "USD", "AUTH88192", "settled", "2026-08-20 16:45:00", "تسوية فورية لقيمة الإقامة الفندقية");
      insTx.run(vccId2, "TX-VCC-992244", "SAUDIA AIRLINES JEDDAH", "3008", 3650.00, "SAR", "AUTH44190", "settled", "2026-08-24 11:20:00", "خصم تذاكر رحلة دبي");
    }

    // Seed AI Smart Tour Itineraries
    const itinCount = (db.prepare("SELECT COUNT(*) as c FROM travel_smart_itineraries").get() as { c: number }).c;
    if (itinCount === 0) {
      const insItin = db.prepare(`
        INSERT INTO travel_smart_itineraries (
          title, destination_country, destination_city, duration_days, duration_nights,
          theme, target_audience, base_price, currency, status, overview,
          highlights_json, inclusions_json, exclusions_json, hero_image_url, qr_code_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const it1 = insItin.run(
        "برنامج سحر الشمال التركي وإسطنبول الفاخر (8 أيام / 7 ليالي)",
        "تركيا (Turkey)", "إسطنبول وطرابزون وأوزنجول", 8, 7,
        "family", "العائلات، محبي الطبيعة، والأزواج", 5800, "SAR", "published",
        "برنامج سياحي متكامل يجمع بين عراقة إسطنبول وسحر البوسفور مع روعة طبيعة طرابزون وبحيرة أوزنجول وجبال حيدر نبي مع إقامة فندقية 5 نجوم وسيارة خاصة بسائق.",
        JSON.stringify([
          "جولة مضيق البوسفور بيخت خاص VIP",
          "زيارة بحيرة أوزنجول ومطل السحاب",
          "جولة مرتفعات آيدر وشلالات طرابزون",
          "يوم تسوق حر في مجمعات زورلو وستيشن إسطنبول",
          "سهرة عشاء تركية تقليدية راقية"
        ]),
        JSON.stringify([
          "تذاكر الطيران الدولي والداخلي مع وزن 30 كجم",
          "إقامة 7 ليالي بفنادق 5 نجوم مع بوفيه إفطار مفتوح",
          "استقبال وتوديع بمركبة مرسيدس فيتو VIP خاصة",
          "مرشد سياحي يتحدث العربية طوال الجولات",
          "شرائح إنترنت 25GB وتأمين سفر سياحي دولي"
        ]),
        JSON.stringify([
          "رسوم التأشيرة الإلكترونية لتركيا",
          "وجبات الغداء والعشاء غير المذكورة",
          "الأنشطة الاختيارية (مثل ركوب الباراشوت والهليكوبتر)"
        ]),
        "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=1200",
        "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://omnifly.sa/itineraries/turkey-8d"
      );

      const it2 = insItin.run(
        "رحلة العجائب الماليزية: كوالالمبور ولنكاوي وبينانج (10 أيام / 9 ليالي)",
        "ماليزيا (Malaysia)", "كوالالمبور، لنكاوي، بينانج", 10, 9,
        "honeymoon", "شهر العسل، العائلات الفاخرة", 7400, "SAR", "published",
        "باقة استثنائية تشمل مرتفعات جينتنج، شواطئ لنكاوي الساحرة مع رحلة المانغروف، وتلفريك السماء، مع إقامة في أرقى المنتجعات المطلة على البحر مباشرة.",
        JSON.stringify([
          "صعود برجي بتروناس التوأم وحصن كوالالمبور",
          "رحلة المانغروف وإطعام النسور في لنكاوي",
          "التلفريك الهوائي والجسر المعلق SkyBridge",
          "زيارة هضبة بينانج وحديقة الفواكه الاستوائية"
        ]),
        JSON.stringify([
          "طيران دولي + 2 رحلات طيران داخلي بين الجزر",
          "منتجعات 5 نجوم مطلة على البحر مع إفطار كامل",
          "تنقلات خاصة VIP بسيارات حديثة ومكيفة",
          "تذاكر دخول جميع المزارات المشمولة بالبرنامج"
        ]),
        JSON.stringify([
          "المصاريف الشخصية والأنشطة البحرية الإضافية",
          "ضريبة السياحة الفندقية المحلية (تدفع بالفندق)"
        ]),
        "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=1200",
        "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://omnifly.sa/itineraries/malaysia-10d"
      );

      const itinId1 = Number(it1.lastInsertRowid);
      const insDay = db.prepare(`
        INSERT INTO travel_itinerary_days (itinerary_id, day_number, day_title, morning_activity, afternoon_activity, evening_activity, hotel_name, meals_included, transport_type, photo_url, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insDay.run(
        itinId1, 1, "اليوم الأول: الوصول إلى إسطنبول والاستقبال الملكي",
        "الاستقبال في مطار إسطنبول الجديد (IST) من قبل مندوب الوكالة بمركبة مرسيدس VIP",
        "التوجه للفندق واستلام الغرف والراحة من عناء السفر",
        "جولة مسائية خفيفة في منطقة نيشانتاشي الراقية وعشاء ترحيبي",
        "Hilton Istanbul Bosphorus (5 نجوم)", "dinner", "سيارة مرسيدس فيتو VIP خاصة",
        "https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?w=600", "يرجى تجهيز الجوازات عند الاستقبال"
      );
      insDay.run(
        itinId1, 2, "اليوم الثاني: عبق التاريخ وجولة قصر دولمة بهجة والبسفور",
        "زيارة قصر دولمة بهجة الملكي ومسجد أورتاكوي الشهير",
        "رحلة بحرية خاصة في مضيق البوسفور لمشاهدة القلاع والجسور المعلقة",
        "زيارة ميدان تقسيم وشارع الاستقلال للتسوق وتناول العشاء",
        "Hilton Istanbul Bosphorus (5 نجوم)", "breakfast", "سيارة خاصة + يخت خاص VIP",
        "https://images.unsplash.com/photo-1527838832700-5059252407fa?w=600", "كاميرا التصوير موصى بها بشدة"
      );
      insDay.run(
        itinId1, 3, "اليوم الثالث: الطيران إلى طرابزون والوصول لعروس الشمال",
        "الإفطار والانتقال للمطار للسفر برحلة داخلية إلى طرابزون",
        "الاستقبال في مطار طرابزون والتوجه إلى قصر أتاتورك ومطل بوزتبه الساحر",
        "تناول الشاي التركي على قمة بوزتبه والاستقرار في الفندق",
        "Radisson Blu Hotel Trabzon (5 نجوم)", "breakfast", "طيران داخلي + سيارة VIP خاصة",
        "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600", "الطقس في الشمال التركي لطيف وماطر"
      );
      insDay.run(
        itinId1, 4, "اليوم الرابع: سحر بحيرة أوزنجول وجبال السلطان مراد",
        "الانطلاق صباحاً نحو بحيرة أوزنجول الساحرة بين الجبال الخضراء",
        "جولة حول البحيرة وركوب القوارب وزيارة شلالات أوزنجول الخلابة",
        "جلسة هادئة على ضفاف البحيرة وتناول وجبة سمك السلمون النهري الشهيرة",
        "Uzungol Inan Kardesler Hotel (إطلالة بحيرة)", "breakfast,dinner", "سيارة دفع رباعي خاصة VIP",
        "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600", "إطلالة بانورامية لا تُنسى"
      );
    }
  } catch (e) {
    console.error("Error creating Enterprise Travel Extension Tables:", e);
  }

  // ────────────────────────────────────────────────────────
  // ENHANCED INVENTORY SYSTEM TABLES & MIGRATIONS
  // ────────────────────────────────────────────────────────
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS purchase_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_number TEXT UNIQUE NOT NULL,
        supplier_id INTEGER REFERENCES suppliers(id),
        supplier_name TEXT NOT NULL,
        purchase_order_id INTEGER REFERENCES purchase_orders(id),
        invoice_id INTEGER REFERENCES purchase_invoices(id),
        invoice_number TEXT,
        return_date TEXT,
        total_amount REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'approved', -- 'approved', 'cancelled'
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        cancelled_at TEXT,
        cancelled_by TEXT,
        cancel_reason TEXT
      );

      CREATE TABLE IF NOT EXISTS purchase_return_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_id INTEGER NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id),
        product_name TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL DEFAULT 0,
        total_price REAL NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS internal_stock_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_number TEXT UNIQUE NOT NULL,
        branch_id INTEGER DEFAULT 1,
        requesting_department TEXT NOT NULL,
        target_warehouse_id TEXT DEFAULT 'wh-main',
        target_warehouse_name TEXT DEFAULT 'المخزن الرئيسي',
        status TEXT NOT NULL DEFAULT 'pending_approval', -- 'pending_approval', 'approved', 'preparing', 'issued', 'received', 'cancelled'
        notes TEXT,
        requested_by TEXT NOT NULL,
        approved_by TEXT,
        prepared_by TEXT,
        issued_by TEXT,
        received_by TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS internal_stock_request_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER NOT NULL REFERENCES internal_stock_requests(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id),
        product_name TEXT NOT NULL,
        requested_qty REAL NOT NULL DEFAULT 1,
        approved_qty REAL,
        issued_qty REAL,
        unit TEXT DEFAULT 'حبة',
        unit_cost REAL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS stock_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        batch_number TEXT NOT NULL,
        expiry_date TEXT,
        quantity REAL NOT NULL DEFAULT 0,
        unit_cost REAL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );
    `);
  } catch (e) {
    console.error("Error creating enhanced inventory tables:", e);
  }

  // Add cancellation, status & expiry columns to existing inventory tables
  const inventoryAlterations = [
    ["stock_issue_vouchers", "status", "TEXT DEFAULT 'approved'"],
    ["stock_issue_vouchers", "cancelled_at", "TEXT"],
    ["stock_issue_vouchers", "cancelled_by", "TEXT"],
    ["stock_issue_vouchers", "cancel_reason", "TEXT"],

    ["stock_return_vouchers", "status", "TEXT DEFAULT 'approved'"],
    ["stock_return_vouchers", "cancelled_at", "TEXT"],
    ["stock_return_vouchers", "cancelled_by", "TEXT"],
    ["stock_return_vouchers", "cancel_reason", "TEXT"],

    ["stock_transfers", "cancelled_at", "TEXT"],
    ["stock_transfers", "cancelled_by", "TEXT"],
    ["stock_transfers", "cancel_reason", "TEXT"],

    ["stocktakes", "cancelled_at", "TEXT"],
    ["stocktakes", "cancelled_by", "TEXT"],
    ["stocktakes", "cancel_reason", "TEXT"],

    ["stock_waste_records", "status", "TEXT DEFAULT 'approved'"],
    ["stock_waste_records", "cancelled_at", "TEXT"],
    ["stock_waste_records", "cancelled_by", "TEXT"],
    ["stock_waste_records", "cancel_reason", "TEXT"],

    ["products", "batch_number", "TEXT"],
    ["products", "expiry_date", "TEXT"],
    ["products", "min_stock", "INTEGER DEFAULT 10"],
    ["products", "max_stock", "INTEGER DEFAULT 1000"],
    ["products", "unit", "TEXT DEFAULT 'حبة'"],
    ["products", "multi_units", "TEXT"],
    ["products", "supplier_id", "INTEGER DEFAULT 1"],
    ["products", "supplier_name", "TEXT"],
    ["products", "warehouse_id", "INTEGER DEFAULT 1"],
    ["products", "warehouse_name", "TEXT DEFAULT 'المخزن الرئيسي'"],
    ["products", "image_url", "TEXT"],
    ["products", "tax_rate", "REAL DEFAULT 15.0"],
    ["products", "is_sellable", "INTEGER DEFAULT 1"],
    ["products", "show_in_pos", "INTEGER DEFAULT 1"],
    ["products", "item_type", "TEXT DEFAULT 'sellable'"]
  ];

  for (const [table, col, type] of inventoryAlterations) {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch {}
  }

  // Purchase Orders alterations for comprehensive procurement lifecycle
  const poAlterations = [
    ["purchase_orders", "pr_id", "INTEGER REFERENCES purchase_requests(id)"],
    ["purchase_orders", "branch_id", "INTEGER DEFAULT 1"],
    ["purchase_orders", "warehouse_id", "INTEGER DEFAULT 1"],
    ["purchase_orders", "order_date", "TEXT"],
    ["purchase_orders", "expected_delivery_date", "TEXT"],
    ["purchase_orders", "subtotal", "REAL DEFAULT 0"],
    ["purchase_orders", "discount", "REAL DEFAULT 0"],
    ["purchase_orders", "tax", "REAL DEFAULT 0"],
    ["purchase_orders", "shipping_cost", "REAL DEFAULT 0"],
    ["purchase_orders", "payment_terms", "TEXT DEFAULT 'نقداً'"],
    ["purchase_orders", "delivery_terms", "TEXT"],
    ["purchase_orders", "approval_tier", "TEXT DEFAULT 'branch'"],
    ["purchase_orders", "approved_by", "TEXT"],
    ["purchase_orders", "approved_at", "TEXT"],
    ["purchase_orders", "shipment_status", "TEXT DEFAULT 'created'"]
  ];
  for (const [table, col, type] of poAlterations) {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch {}
  }


  // ────────────────────────────────────────────────────────
  // OMNI ERP INTEGRATION MIGRATIONS (BRANCHES, CURRENCIES, SESSIONS)
  // ────────────────────────────────────────────────────────
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS currencies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        symbol TEXT NOT NULL,
        fraction TEXT,
        type TEXT NOT NULL, -- 'local' or 'foreign'
        exchange_rate REAL NOT NULL DEFAULT 1.0,
        active INTEGER NOT NULL DEFAULT 1
      );
    `);
    const curCount = (db.prepare("SELECT COUNT(*) as c FROM currencies").get() as { c: number }).c;
    if (curCount === 0) {
      db.prepare("INSERT INTO currencies (name, symbol, fraction, type, exchange_rate) VALUES (?,?,?,?,?)").run("ريال يمني", "YER", "فلس", "local", 1.0);
      db.prepare("INSERT INTO currencies (name, symbol, fraction, type, exchange_rate) VALUES (?,?,?,?,?)").run("ريال سعودي", "SAR", "هللة", "foreign", 0.27);
      db.prepare("INSERT INTO currencies (name, symbol, fraction, type, exchange_rate) VALUES (?,?,?,?,?)").run("دولار أمريكي", "USD", "سنت", "foreign", 1.0);
      db.prepare("INSERT INTO currencies (name, symbol, fraction, type, exchange_rate) VALUES (?,?,?,?,?)").run("دينار أردني", "JOD", "قرش", "foreign", 0.71);
    }
  } catch (e) {
    console.error("Error creating currencies:", e);
  }

  const branchCols = [
    ["company_id", "INTEGER DEFAULT 1"],
    ["company_name", "TEXT DEFAULT 'شركة عماد عقلان'"],
    ["foreign_name", "TEXT DEFAULT 'Emad Aqlaan Co.'"],
    ["branch_foreign_name", "TEXT DEFAULT 'Main Branch'"],
    ["group_id", "INTEGER DEFAULT 1"],
    ["header_1", "TEXT"],
    ["header_2", "TEXT"],
    ["header_3", "TEXT"],
    ["header_1_foreign", "TEXT"],
    ["header_2_foreign", "TEXT"],
    ["header_3_foreign", "TEXT"],
    ["tax_id", "TEXT"],
    ["tax_rate", "REAL DEFAULT 15"],
    ["commercial_reg", "TEXT"],
    ["lat", "TEXT"],
    ["long", "TEXT"],
    ["city", "TEXT"],
    ["street", "TEXT"],
    ["building", "TEXT"]
  ];
  for (const [col, type] of branchCols) {
    try { db.exec(`ALTER TABLE branches ADD COLUMN ${col} ${type}`); } catch {}
  }

  // Active Sessions & Audit list for ERP
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS erp_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT NOT NULL,
        device_name TEXT NOT NULL,
        login_time TEXT NOT NULL,
        logout_time TEXT,
        status TEXT NOT NULL DEFAULT 'نشط',
        branch_id INTEGER DEFAULT 1,
        language TEXT DEFAULT 'عربي',
        ip_address TEXT DEFAULT '192.168.1.100',
        notes TEXT,
        created_by TEXT DEFAULT 'مدير النظام',
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_by TEXT,
        updated_at TEXT,
        edit_count INTEGER DEFAULT 0
      );
    `);
    const sessCols = [
      ["user_id", "INTEGER"],
      ["ip_address", "TEXT DEFAULT '192.168.1.100'"],
      ["notes", "TEXT"],
      ["created_by", "TEXT DEFAULT 'مدير النظام'"],
      ["created_at", "TEXT DEFAULT '2026-07-18 07:29:52'"],
      ["updated_by", "TEXT"],
      ["updated_at", "TEXT"],
      ["edit_count", "INTEGER DEFAULT 0"]
    ];
    for (const [col, type] of sessCols) {
      try { db.exec(`ALTER TABLE erp_sessions ADD COLUMN ${col} ${type}`); } catch {}
    }
    const sCount = (db.prepare("SELECT COUNT(*) as c FROM erp_sessions").get() as { c: number }).c;
    if (sCount === 0) {
      db.prepare("INSERT INTO erp_sessions (username, device_name, login_time, logout_time, status, branch_id, language, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)")
        .run("مدير النظام", "DESKTOP-QLP03GF-EMAD", "2026-07-18 07:29:52", null, "نشط", 1, "عربي", "مدير النظام", "2026-07-18 07:29:52");
      db.prepare("INSERT INTO erp_sessions (username, device_name, login_time, logout_time, status, branch_id, language, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)")
        .run("مدير النظام", "DESKTOP-QLP03GF-EMAD", "2026-07-18 10:52:12", "2026-07-18 11:45:00", "خروج", 1, "عربي", "مدير النظام", "2026-07-18 10:52:12");
      db.prepare("INSERT INTO erp_sessions (username, device_name, login_time, logout_time, status, branch_id, language, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)")
        .run("مطور النظام", "DESKTOP-DEV-PC", "2026-07-18 09:15:30", null, "نشط", 1, "عربي", "مطور النظام", "2026-07-18 09:15:30");
    }
  } catch (e) {}

  // User Groups table (مجموعة المستخدمين) for Group-level RBAC & User Linking
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_number INTEGER UNIQUE NOT NULL,
        name_ar TEXT NOT NULL,
        name_en TEXT,
        is_system_admin INTEGER NOT NULL DEFAULT 0,
        is_suspended INTEGER NOT NULL DEFAULT 0,
        suspended_date TEXT,
        suspended_reason TEXT,
        notes TEXT,
        can_discount INTEGER NOT NULL DEFAULT 0,
        perm_create_invoice INTEGER NOT NULL DEFAULT 1,
        perm_edit_invoice INTEGER NOT NULL DEFAULT 1,
        perm_cancel_invoice INTEGER NOT NULL DEFAULT 0,
        perm_return INTEGER NOT NULL DEFAULT 0,
        perm_view_prices INTEGER NOT NULL DEFAULT 1,
        perm_view_profits INTEGER NOT NULL DEFAULT 0,
        perm_edit_stock INTEGER NOT NULL DEFAULT 0,
        perm_stocktake INTEGER NOT NULL DEFAULT 0,
        perm_edit_entries INTEGER NOT NULL DEFAULT 0,
        perm_close_periods INTEGER NOT NULL DEFAULT 0,
        perm_view_salaries INTEGER NOT NULL DEFAULT 0,
        can_void_bills INTEGER NOT NULL DEFAULT 0,
        can_view_cost INTEGER NOT NULL DEFAULT 0,
        can_change_currencies INTEGER NOT NULL DEFAULT 0,
        can_approve_returns INTEGER NOT NULL DEFAULT 0,
        can_open_close_safe INTEGER NOT NULL DEFAULT 0,
        can_transfer_funds INTEGER NOT NULL DEFAULT 0,
        can_edit_products INTEGER NOT NULL DEFAULT 0,
        can_delete_orders INTEGER NOT NULL DEFAULT 0,
        created_by TEXT DEFAULT 'مدير النظام',
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_by TEXT,
        updated_at TEXT,
        edit_count INTEGER NOT NULL DEFAULT 0
      );
    `);
    const ugCount = (db.prepare("SELECT COUNT(*) as c FROM user_groups").get() as { c: number }).c;
    if (ugCount === 0) {
      const insUg = db.prepare(`
        INSERT INTO user_groups (
          group_number, name_ar, name_en, is_system_admin, is_suspended, suspended_date, suspended_reason, notes,
          can_discount, perm_create_invoice, perm_edit_invoice, perm_cancel_invoice, perm_return,
          perm_view_prices, perm_view_profits, perm_edit_stock, perm_stocktake,
          perm_edit_entries, perm_close_periods, perm_view_salaries,
          can_void_bills, can_view_cost, can_change_currencies, can_approve_returns,
          can_open_close_safe, can_transfer_funds, can_edit_products, can_delete_orders,
          created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insUg.run(
        1, "مجموعة الإدارة العليا والنظام", "System Administrators Group", 1, 0, null, null,
        "مجموعة مديري النظام والإدارة العليا - تمتلك كافة الصلاحيات الإدارية والمالية المطلقة على مستوى جميع الأنظمة والفروع",
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
        "مدير النظام", "2026-07-18 07:30:00"
      );
      insUg.run(
        2, "مجموعة الإدارة المالية والمحاسبين", "Financial & Accountants Group", 0, 0, null, null,
        "مجموعة المحاسبين والمراجعين الماليين - صلاحيات القيود المحاسبية وتسويات الصناديق والبنوك والقوائم المالية",
        1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0,
        "مدير النظام", "2026-07-18 08:00:00"
      );
      insUg.run(
        3, "مجموعة المبيعات ونقاط البيع والكاشير", "Sales, POS & Cashiers Group", 0, 0, null, null,
        "مجموعة موظفي المبيعات ونقاط البيع الفورية والكاشير اليومي",
        0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0,
        "مدير النظام", "2026-07-18 08:15:00"
      );
      insUg.run(
        4, "مجموعة أمناء المخازن والمستودعات والجرد", "Warehouse & Inventory Management Group", 0, 0, null, null,
        "مجموعة مسؤولي المخازن والتوريد والصرف والجرد المخزني",
        0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0,
        "مدير النظام", "2026-07-18 08:30:00"
      );
      insUg.run(
        5, "مجموعة الموارد البشرية وشؤون الموظفين", "HR & Personnel Group", 0, 0, null, null,
        "مجموعة مسؤولي شؤون الموظفين والرواتب والموارد البشرية",
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0,
        "مدير النظام", "2026-07-18 08:45:00"
      );
    }

    // Ensure existing user_groups have updated Warehouse/Sales ERP labels instead of legacy travel labels
    try {
      db.exec(`
        UPDATE user_groups SET
          name_ar = 'مجموعة الإدارة المالية والمحاسبين',
          notes = 'مجموعة المحاسبين والمراجعين الماليين - صلاحيات القيود المحاسبية وتسويات الصناديق والبنوك والقوائم المالية'
        WHERE group_number = 2 AND (notes LIKE '%BSP%' OR notes LIKE '%عمولات%');
        UPDATE user_groups SET
          name_ar = 'مجموعة المبيعات ونقاط البيع والكاشير',
          name_en = 'Sales, POS & Cashiers Group',
          notes = 'مجموعة موظفي المبيعات ونقاط البيع الفورية والكاشير اليومي'
        WHERE group_number = 3 AND (name_ar LIKE '%التذاكر%' OR name_ar LIKE '%الحجوزات%' OR notes LIKE '%السياحية%');
        UPDATE user_groups SET
          name_ar = 'مجموعة أمناء المخازن والمستودعات والجرد',
          name_en = 'Warehouse & Inventory Management Group',
          notes = 'مجموعة مسؤولي المخازن والتوريد والصرف والجرد المخزني'
        WHERE group_number = 4 AND (name_ar LIKE '%الوثائق%' OR notes LIKE '%السفر%');
      `);
    } catch {}

    const userGroupCols = [
      ["group_id", "INTEGER REFERENCES user_groups(id)"],
      ["user_number", "INTEGER DEFAULT 1"],
      ["name_en", "TEXT"],
      ["department", "TEXT DEFAULT 'الإدارة العامة'"],
      ["job_title", "TEXT"],
      ["start_date", "TEXT"],
      ["end_date", "TEXT"],
      ["from_time", "TEXT DEFAULT '08:00'"],
      ["to_time", "TEXT DEFAULT '22:00'"],
      ["force_change_password", "INTEGER DEFAULT 0"],
      ["disallow_more_than_two_devices", "INTEGER DEFAULT 0"],
      ["employee_self_service", "INTEGER DEFAULT 1"],
      ["allowed_device_name", "TEXT DEFAULT 'DESKTOP-QLP03GF-EMAD'"],
      ["copied_from_user_id", "INTEGER"],
      ["customer_id", "INTEGER"],
      ["safe_id", "INTEGER DEFAULT 1"],
      ["is_cashier", "INTEGER DEFAULT 0"],
      ["fingerprint_registered", "INTEGER DEFAULT 0"],
      ["handheld_enabled", "INTEGER DEFAULT 1"],
      ["pos_terminal_id", "INTEGER DEFAULT 1"],
      ["is_suspended", "INTEGER DEFAULT 0"],
      ["suspended_date", "TEXT"],
      ["suspended_reason", "TEXT"],
      ["created_by", "TEXT DEFAULT 'مدير النظام'"],
      ["created_at", "TEXT DEFAULT '2026-07-18 07:30:00'"],
      ["updated_by", "TEXT"],
      ["updated_at", "TEXT"],
      ["edit_count", "INTEGER DEFAULT 0"]
    ];
    for (const [col, type] of userGroupCols) {
      try { db.exec(`ALTER TABLE users ADD COLUMN ${col} ${type}`); } catch {}
    }

    // Auto-assign default group_id and user_number to existing users that don't have one yet
    db.exec(`
      UPDATE users SET group_id = 1, user_number = id WHERE group_id IS NULL AND (role IN ('admin', 'developer', 'general_manager') OR username IN ('admin', 'developer'));
      UPDATE users SET group_id = 2, user_number = id WHERE group_id IS NULL AND role = 'accountant';
      UPDATE users SET group_id = 3, user_number = id WHERE group_id IS NULL AND role IN ('sales', 'cashier', 'gds_spec');
      UPDATE users SET group_id = 4, user_number = id WHERE group_id IS NULL AND role IN ('storekeeper', 'purchasing');
      UPDATE users SET group_id = 5, user_number = id WHERE group_id IS NULL AND role = 'hr';
      UPDATE users SET group_id = 3, user_number = id WHERE group_id IS NULL;
      UPDATE users SET user_number = id WHERE user_number IS NULL OR user_number = 0;
    `);

    // Warehouse Sales Invoices (فواتير المبيعات المخزنية - نقدية وآجلة)
    db.exec(`
      CREATE TABLE IF NOT EXISTS warehouse_sales_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_no TEXT UNIQUE NOT NULL,
        ref_no TEXT,
        invoice_date TEXT NOT NULL,
        invoice_time TEXT NOT NULL,
        branch_id INTEGER DEFAULT 1,
        warehouse_id INTEGER DEFAULT 1,
        customer_id INTEGER,
        customer_name TEXT NOT NULL,
        sales_rep_id INTEGER,
        sales_rep_name TEXT,
        cost_center_id INTEGER,
        payment_type TEXT NOT NULL DEFAULT 'cash', -- 'cash' (نقدي), 'credit' (آجل), 'bank' (بنكي), 'card' (شبكة), 'split' (متعدد)
        currency TEXT DEFAULT 'ريال',
        exchange_rate REAL DEFAULT 1.0,
        subtotal REAL NOT NULL DEFAULT 0.0,
        discount_val REAL NOT NULL DEFAULT 0.0,
        tax_val REAL NOT NULL DEFAULT 0.0,
        service_charge REAL DEFAULT 0.0,
        delivery_charge REAL DEFAULT 0.0,
        total_amount REAL NOT NULL DEFAULT 0.0,
        paid_amount REAL NOT NULL DEFAULT 0.0,
        remaining_amount REAL NOT NULL DEFAULT 0.0,
        status TEXT NOT NULL DEFAULT 'posted', -- 'draft' (مسودة), 'posted' (مرحل ومعتمد), 'approved' (معتمد), 'cancelled' (ملغي)
        posted_at TEXT,
        posted_by TEXT,
        journal_entry_id INTEGER REFERENCES journal_entries(id),
        notes TEXT,
        created_by TEXT DEFAULT 'مدير النظام',
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_by TEXT,
        updated_at TEXT,
        edit_count INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS warehouse_sales_invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL REFERENCES warehouse_sales_invoices(id) ON DELETE CASCADE,
        seq INTEGER NOT NULL DEFAULT 1,
        product_id INTEGER,
        barcode TEXT,
        item_code TEXT,
        item_name TEXT NOT NULL,
        unit TEXT DEFAULT 'حبة',
        quantity REAL NOT NULL DEFAULT 1.0,
        unit_price REAL NOT NULL DEFAULT 0.0,
        discount_pct REAL DEFAULT 0.0,
        discount_val REAL DEFAULT 0.0,
        tax_pct REAL DEFAULT 15.0,
        tax_val REAL DEFAULT 0.0,
        subtotal REAL NOT NULL DEFAULT 0.0,
        total_after_tax REAL NOT NULL DEFAULT 0.0,
        warehouse_id INTEGER DEFAULT 1,
        batch_number TEXT,
        expiry_date TEXT,
        notes TEXT
      );
    `);

    // Seed sample warehouse sales invoices if empty
    const wsiCount = (db.prepare("SELECT COUNT(*) as c FROM warehouse_sales_invoices").get() as { c: number }).c;
    if (wsiCount === 0) {
      const insWsi = db.prepare(`
        INSERT INTO warehouse_sales_invoices (
          invoice_no, ref_no, invoice_date, invoice_time, branch_id, warehouse_id, customer_id, customer_name,
          sales_rep_name, payment_type, subtotal, discount_val, tax_val, total_amount, paid_amount, remaining_amount,
          status, posted_at, posted_by, notes, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insWsiItem = db.prepare(`
        INSERT INTO warehouse_sales_invoice_items (
          invoice_id, seq, product_id, barcode, item_code, item_name, unit, quantity, unit_price, discount_pct, discount_val, tax_pct, tax_val, subtotal, total_after_tax, warehouse_id, batch_number, expiry_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const r1 = insWsi.run(
        "INV-2026-0001", "PO-CUST-8812", "2026-07-20", "14:30:22", 1, 1, 1, "عبدالله محمد العتيبي",
        "محمد الحرازي", "cash", 96500, 3500, 14475, 110975, 110975, 0,
        "posted", "2026-07-20 14:30:22", "مدير النظام", "فاتورة مبيعات مخزنية نقدية رسمية - تم ترحيلها وخصم الكميات من المخزون",
        "مدير النظام", "2026-07-20 14:30:22"
      );
      insWsiItem.run(r1.lastInsertRowid, 1, 1, "6281000101", "PRD-101", "أرز بسمتي هندي درجة أولى (كيس 10 كجم)", "كيس", 2, 2500, 5, 250, 15, 712.5, 4750, 5462.5, 1, "B-2026-01", "2027-01-01");
      insWsiItem.run(r1.lastInsertRowid, 2, 7, "6281000107", "PRD-107", "جهاز قارئ باركود ليزر لاسلكي احترافي", "حبة", 20, 4800, 3.5, 3360, 15, 13896, 92640, 106536, 1, "B-2026-02", "2027-06-30");

      const r2 = insWsi.run(
        "INV-2026-0002", "AGR-CORP-902", "2026-07-21", "11:15:00", 1, 1, 2, "شركة الأفق للاستشارات والهندسة",
        "عبدالرحمن الشميري", "credit", 81000, 9000, 10800, 82800, 0, 82800,
        "posted", "2026-07-21 11:15:00", "مدير النظام", "فاتورة مبيعات مخزنية آجلة للشركات - استحقاق السداد 30 يوم",
        "مدير النظام", "2026-07-21 11:15:00"
      );
      insWsiItem.run(r2.lastInsertRowid, 1, 2, "6281000102", "PRD-102", "زيت طبخ نباتي صافي (كرتون 6 عبوات)", "كرتون", 15, 1200, 10, 1800, 15, 2430, 16200, 18630, 1, "B-OIL-01", "2026-12-31");
      insWsiItem.run(r2.lastInsertRowid, 2, 6, "6281000106", "PRD-106", "شاي سيلاني ممتاز (كرتون 24 علبة)", "كرتون", 75, 850, 11, 7012.5, 15, 8503.125, 56737.5, 65240.625, 1, "B-TEA-01", "2026-12-31");
    }

    // ─── جدول تعريف الشاشات وصلاحيات استخدام الشاشات للمستخدمين ───
    db.exec(`
      CREATE TABLE IF NOT EXISTS system_screens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        screen_number INTEGER UNIQUE NOT NULL,
        screen_name TEXT NOT NULL,
        module_name TEXT NOT NULL,
        submodule_name TEXT,
        category_type TEXT NOT NULL DEFAULT 'عمليات', -- 'تهيئة', 'مدخلات', 'عمليات', 'تقارير'
        path TEXT,
        sort_order INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS user_screen_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        group_id INTEGER,
        screen_number INTEGER NOT NULL,
        screen_name TEXT NOT NULL,
        module_name TEXT NOT NULL,
        submodule_name TEXT,
        can_check INTEGER DEFAULT 1,        -- فحص / إتاحة الوصول للشاشة
        can_print INTEGER DEFAULT 1,        -- طباعة
        can_view_report INTEGER DEFAULT 1,  -- عرض التقرير
        can_add INTEGER DEFAULT 1,          -- إضافة
        can_edit INTEGER DEFAULT 1,         -- تعديل
        can_delete INTEGER DEFAULT 1,       -- حذف
        can_view INTEGER DEFAULT 1,         -- عرض
        can_review INTEGER DEFAULT 1,       -- مراجعة
        can_post INTEGER DEFAULT 1,         -- ترحيل
        created_by TEXT DEFAULT 'مدير النظام',
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_by TEXT,
        updated_at TEXT
      );
    `);

    // Seed default system screens if table is empty
    const screensCount = (db.prepare("SELECT COUNT(*) as c FROM system_screens").get() as { c: number }).c;
    if (screensCount === 0) {
      const insScreen = db.prepare(`
        INSERT INTO system_screens (screen_number, screen_name, module_name, submodule_name, category_type, path, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const DEFAULT_SCREENS = [
        // أنظمة الحسابات -> نظام الأستاذ العام -> عمليات الأستاذ العام (مطابقة للصورة بدقة)
        [20, "قيود اليومية", "نظام الأستاذ العام", "عمليات الأستاذ العام", "عمليات", "/accounting?tab=journal", 1],
        [21, "سند الصرف", "نظام الأستاذ العام", "عمليات الأستاذ العام", "عمليات", "/accounting?tab=payment_vouchers", 2],
        [22, "سند القبض", "نظام الأستاذ العام", "عمليات الأستاذ العام", "عمليات", "/accounting?tab=receipt_vouchers", 3],
        [24, "إشعارات مدينة", "نظام الأستاذ العام", "عمليات الأستاذ العام", "عمليات", "/accounting?tab=debit_notes", 4],
        [25, "إشعارات دائنة", "نظام الأستاذ العام", "عمليات الأستاذ العام", "عمليات", "/accounting?tab=credit_notes", 5],
        [26, "الشيكات المستحقة للسداد - آلياً", "نظام الأستاذ العام", "عمليات الأستاذ العام", "عمليات", "/accounting?tab=cheques_auto", 6],
        [27, "الشيكات المستحقة للسداد - يدوي", "نظام الأستاذ العام", "عمليات الأستاذ العام", "عمليات", "/accounting?tab=cheques_manual", 7],
        [28, "تسوية البنوك", "نظام الأستاذ العام", "عمليات الأستاذ العام", "عمليات", "/accounting?tab=bank_reconcile", 8],
        [298, "طلبات قيود اليومية", "نظام الأستاذ العام", "عمليات الأستاذ العام", "عمليات", "/accounting?tab=journal_requests", 9],
        [299, "طلبات سندات الصرف", "نظام الأستاذ العام", "عمليات الأستاذ العام", "عمليات", "/accounting?tab=payment_requests", 10],
        [300, "طلبات سندات القبض", "نظام الأستاذ العام", "عمليات الأستاذ العام", "عمليات", "/accounting?tab=receipt_requests", 11],
        [498, "صرف عملة", "نظام الأستاذ العام", "عمليات الأستاذ العام", "عمليات", "/currencies?tab=exchange", 12],

        // تهيئة الأستاذ العام
        [10, "الدليل المحاسبي وشجرة الحسابات", "نظام الأستاذ العام", "تهيئة الأستاذ العام", "تهيئة", "/accounting?tab=chart", 13],
        [11, "مراكز التكلفة والمشاريع", "نظام الأستاذ العام", "تهيئة الأستاذ العام", "تهيئة", "/accounting?tab=cost_centers", 14],
        [12, "الحسابات الوسيطة والصناديق", "نظام الأستاذ العام", "تهيئة الأستاذ العام", "تهيئة", "/accounting?tab=safes", 15],

        // مدخلات الأستاذ العام
        [15, "أرصدة أول المدة الافتتاحية", "نظام الأستاذ العام", "مدخلات الأستاذ العام", "مدخلات", "/accounting?tab=opening_balances", 16],
        [16, "توزيع الحسابات على الفروع", "نظام الأستاذ العام", "مدخلات الأستاذ العام", "مدخلات", "/branches", 17],

        // تقارير الأستاذ العام
        [30, "كشف حساب تحليلي وتفصيلي", "نظام الأستاذ العام", "تقارير الأستاذ العام", "تقارير", "/reports/cashier-statement", 18],
        [31, "ميزان المراجعة بالمجاميع والأرصدة", "نظام الأستاذ العام", "تقارير الأستاذ العام", "تقارير", "/accounting?tab=trial_balance", 19],
        [32, "قائمة الدخل والأرباح والخسائر", "نظام الأستاذ العام", "تقارير الأستاذ العام", "تقارير", "/accounting?tab=income_statement", 20],
        [33, "الميزانية العمومية والمركز المالي", "نظام الأستاذ العام", "تقارير الأستاذ العام", "تقارير", "/accounting?tab=balance_sheet", 21],
        [34, "دفتر اليومية والأستاذ العام", "نظام الأستاذ العام", "تقارير الأستاذ العام", "تقارير", "/accounting?tab=general_ledger", 22],

        // نظام إدارة المراجعة والترحيلات
        [40, "مراجعة وترحيل القيود اليومية", "نظام إدارة المراجعة والترحيلات", "عمليات الترحيل", "عمليات", "/accounting?tab=posting", 23],
        [41, "مراجعة وترحيل السندات المالية", "نظام إدارة المراجعة والترحيلات", "عمليات الترحيل", "عمليات", "/accounting?tab=vouchers_post", 24],
        [42, "إلغاء وفك ترحيل العمليات", "نظام إدارة المراجعة والترحيلات", "عمليات الترحيل", "عمليات", "/accounting?tab=unpost", 25],

        // أنظمة المخازن
        [49, "متغيرات نظام المخازن والتهيئة العامة", "أنظمة المخازن", "تهيئة المخزون", "تهيئة", "/inventory-variables", 25.5],
        [50, "بطاقة تعريف الأصناف والمنتجات", "أنظمة المخازن", "مدخلات المخزون", "مدخلات", "/products", 26],
        [51, "وحدات القياس والتحويلات", "أنظمة المخازن", "تهيئة المخزون", "تهيئة", "/inventory?tab=units", 27],
        [52, "سندات التوريد المخزني (GRN)", "أنظمة المخازن", "عمليات المخزون", "عمليات", "/suppliers?tab=grn", 28],
        [53, "سندات الصرف والتحويل المخزني", "أنظمة المخازن", "عمليات المخزون", "عمليات", "/inventory?tab=requests", 29],
        [54, "الجرد الدوري والتسويات المخزنية", "أنظمة المخازن", "عمليات المخزون", "عمليات", "/inventory?tab=stocktake", 30],
        [55, "التالف والهالك ومردودات المخزون", "أنظمة المخازن", "عمليات المخزون", "عمليات", "/inventory?tab=waste", 31],
        [56, "طباعة استيكرات الباركود والملصقات", "أنظمة المخازن", "عمليات المخزون", "عمليات", "/inventory?tab=barcode", 32],
        [57, "تقارير حركة ومراقبة المخزون", "أنظمة المخازن", "تقارير المخزون", "تقارير", "/inventory?tab=reports", 33],

        // أنظمة المبيعات ونقاط البيع
        [60, "نقطة البيع السريعة POS والكاشير", "أنظمة العملاء ونقاط البيع", "عمليات المبيعات", "عمليات", "/pos", 34],
        [61, "فاتورة المبيعات المخزنية (نقد / آجل)", "أنظمة العملاء ونقاط البيع", "عمليات المبيعات", "عمليات", "/sales-invoices", 35],
        [62, "فواتير المبيعات المركزية Invoices", "أنظمة العملاء ونقاط البيع", "عمليات المبيعات", "عمليات", "/orders", 36],
        [63, "مردودات ومرتجع المبيعات Returns", "أنظمة العملاء ونقاط البيع", "عمليات المبيعات", "عمليات", "/returns", 37],
        [64, "عروض الأسعار والطلبيات Quotations", "أنظمة العملاء ونقاط البيع", "عمليات المبيعات", "عمليات", "/travel-quotations", 38],
        [65, "إدارة العملاء والشركات CRM", "أنظمة العملاء ونقاط البيع", "مدخلات العملاء", "مدخلات", "/customers", 39],
        [66, "ورديات وشفتات الكاشير والصناديق", "أنظمة العملاء ونقاط البيع", "عمليات المبيعات", "عمليات", "/shifts", 40],
        [67, "إدارة الطاولات والجلسات", "أنظمة العملاء ونقاط البيع", "عمليات المبيعات", "عمليات", "/tables", 41],

        // أنظمة الموردين والمشتريات
        [70, "طلبات الشراء الداخلية (PR)", "أنظمة الموردين والمشتريات", "عمليات المشتريات", "عمليات", "/suppliers?tab=requests", 42],
        [71, "عروض أسعار الموردين (RFQ)", "أنظمة الموردين والمشتريات", "عمليات المشتريات", "عمليات", "/suppliers?tab=rfqs", 43],
        [72, "أوامر شراء المنتجات والبضائع (PO)", "أنظمة الموردين والمشتريات", "عمليات المشتريات", "عمليات", "/suppliers?tab=orders", 44],
        [73, "فواتير المشتريات والمخزون الوارد", "أنظمة الموردين والمشتريات", "عمليات المشتريات", "عمليات", "/suppliers?tab=invoices", 45],
        [74, "إدارة الموردين والذمم الدائنة", "أنظمة الموردين والمشتريات", "مدخلات الموردين", "مدخلات", "/suppliers?tab=suppliers", 46],
        [75, "سندات صرف الموردين والدفعات", "أنظمة الموردين والمشتريات", "عمليات المشتريات", "عمليات", "/suppliers?tab=payments_returns", 47],
        [76, "تقارير المشتريات والموردين", "أنظمة الموردين والمشتريات", "تقارير المشتريات", "تقارير", "/suppliers?tab=reports", 48],

        // أنظمة رأس المال البشري وشؤون الموظفين
        [80, "سجلات وبيانات الموظفين", "أنظمة رأس المال البشري", "مدخلات الموظفين", "مدخلات", "/hr?view=employees", 49],
        [81, "الحضور والانصراف والورديات", "أنظمة رأس المال البشري", "عمليات الموظفين", "عمليات", "/hr?view=attendance", 50],
        [82, "مسير المرتبات والأجور الشهرية", "أنظمة رأس المال البشري", "عمليات الموظفين", "عمليات", "/hr?view=salaries", 51],
        [83, "سلف ومستحقات وعهد الموظفين", "أنظمة رأس المال البشري", "عمليات الموظفين", "عمليات", "/hr?view=loans", 52],
        [84, "الإجازات والجزاءات والمكافآت", "أنظمة رأس المال البشري", "عمليات الموظفين", "عمليات", "/hr?view=leaves", 53],
        [85, "تقارير ومؤشرات شؤون الموظفين", "أنظمة رأس المال البشري", "تقارير الموظفين", "تقارير", "/hr?view=reports_tab", 54],

        // إدارة وتهيئة النظام
        [110, "إدارة وبيانات المستخدمين", "إدارة النظام", "أمان النظام", "تهيئة", "/users?tab=master_record", 55],
        [111, "عرض المستخدمين النشطين حالياً", "إدارة النظام", "أمان النظام", "عمليات", "/users?tab=active_users", 56],
        [113, "صلاحيات استخدام الشاشات للمستخدمين", "إدارة النظام", "أمان النظام", "تهيئة", "/users?tab=screen_permissions", 58],
        [114, "سجل الرقابة والتدقيق والأمان", "إدارة النظام", "أمان النظام", "تقارير", "/audit", 59],
        [115, "النسخ الاحتياطي واستعادة البيانات", "إدارة النظام", "أمان النظام", "عمليات", "/backup-restore", 60],
        [116, "تهيئة الفروع والعملات وإعدادات النظام", "تهيئة النظام", "تهيئة عامة", "تهيئة", "/settings", 61],
        [117, "تصميم الترويسة وطباعة المستندات", "تهيئة النظام", "تهيئة عامة", "تهيئة", "/document-print-settings", 62],
        [900, "تراخيص التشغيل والتفعيل وحماية النظام (خاص بالمطور فقط)", "إدارة النظام", "حماية وترخيص المطور", "تهيئة", "/licenses", 99]
      ];

      for (const scr of DEFAULT_SCREENS) {
        insScreen.run(...scr);
      }
    }

    // Ensure screen 112 (user groups) is removed and screen 900 (developer license screen) and updated paths exist
    try {
      db.prepare("DELETE FROM system_screens WHERE screen_number = 112").run();
      db.prepare("DELETE FROM user_screen_permissions WHERE screen_number = 112").run();
      db.prepare("UPDATE system_screens SET path = '/accounting?tab=payment_vouchers' WHERE screen_number = 21").run();
      db.prepare("UPDATE system_screens SET path = '/accounting?tab=receipt_vouchers' WHERE screen_number = 22").run();
      db.prepare("UPDATE system_screens SET path = '/accounting?tab=chart' WHERE screen_number = 10").run();
      db.prepare("UPDATE system_screens SET path = '/accounting?tab=opening_balances' WHERE screen_number = 15").run();
      db.prepare(`
        INSERT OR IGNORE INTO system_screens (screen_number, screen_name, module_name, submodule_name, category_type, path, sort_order)
        VALUES (900, 'تراخيص التشغيل والتفعيل وحماية النظام (خاص بالمطور فقط)', 'إدارة النظام', 'حماية وترخيص المطور', 'تهيئة', '/licenses', 99)
      `).run();
      db.prepare(`
        UPDATE user_screen_permissions
        SET can_check=0, can_print=0, can_view_report=0, can_add=0, can_edit=0, can_delete=0, can_view=0, can_review=0, can_post=0
        WHERE screen_number = 900
      `).run();
    } catch (e) {}

    // جدول متغيرات نظام المخازن والتهيئة العامة (Warehouse System Variables)
    db.exec(`
      CREATE TABLE IF NOT EXISTS warehouse_system_variables (
        id INTEGER PRIMARY KEY DEFAULT 1,
        -- خيارات التقييم والتكلفة
        costing_method TEXT NOT NULL DEFAULT 'moving_average', -- moving_average, fifo, lifo, last_price, standard
        cost_level TEXT NOT NULL DEFAULT 'warehouse',           -- warehouse, company
        allow_below_cost_sale INTEGER NOT NULL DEFAULT 0,      -- 0=منع, 1=تحذير وسماح, 2=سماح مطلق
        allow_negative_stock INTEGER NOT NULL DEFAULT 0,       -- 0=منع الرصيد السالب, 1=تحذير, 2=سماح
        enforce_expiry_date INTEGER NOT NULL DEFAULT 1,        -- إجبارية إدخال تاريخ الصلاحية
        enforce_batch_lot INTEGER NOT NULL DEFAULT 1,          -- إجبارية رقم التشغيلة/الدفعة
        enable_serial_numbers INTEGER NOT NULL DEFAULT 0,      -- تفعيل الأرقام التسلسلية
        auto_barcode_type TEXT NOT NULL DEFAULT 'EAN13',       -- EAN13, Code128, AutoSerial
        barcode_prefix TEXT NOT NULL DEFAULT '29',             -- بادئة الباركود الداخلي
        
        -- سياسات التوريد والصرف والتحويل
        grn_require_purchase_order INTEGER NOT NULL DEFAULT 1, -- إلزام ربط التوريد بأمر الشراء
        grn_allowed_overage_pct REAL NOT NULL DEFAULT 5.0,     -- نسبة التجاوز المسموحة %
        grn_update_cost_on_save INTEGER NOT NULL DEFAULT 1,    -- تحديث التكلفة فور حفظ التوريد
        issue_require_cost_center INTEGER NOT NULL DEFAULT 1,  -- إجبارية مركز التكلفة عند الصرف
        issue_require_purpose_desc INTEGER NOT NULL DEFAULT 1, -- إجبارية بيان وغرض الصرف
        issue_block_expired_items INTEGER NOT NULL DEFAULT 1,  -- منع صرف الأصناف منتهية الصلاحية
        transfer_mechanism TEXT NOT NULL DEFAULT 'two_step',   -- two_step (مرحلتين), one_step (مباشر)
        transfer_cost_basis TEXT NOT NULL DEFAULT 'source_cost', -- source_cost, company_avg, transfer_price
        include_shipping_in_transfer_cost INTEGER NOT NULL DEFAULT 1, -- إضافة مصاريف النقل للتكلفة
        
        -- الجرد والرقابة ومستويات المخزون
        freeze_stock_during_stocktake INTEGER NOT NULL DEFAULT 1, -- تجميد حركات المخزن أثناء الجرد
        auto_post_stocktake_variances INTEGER NOT NULL DEFAULT 0, -- ترحيل فروقات الجرد آلياً
        stocktake_approval_threshold REAL NOT NULL DEFAULT 5000.0, -- حد اعتماد فروقات الجرد
        stocktake_frequency TEXT NOT NULL DEFAULT 'monthly',       -- دورية الجرد
        alert_min_stock INTEGER NOT NULL DEFAULT 1,              -- تنبيه الحد الأدنى
        alert_reorder_point INTEGER NOT NULL DEFAULT 1,          -- تنبيه حد الطلب
        alert_max_stock INTEGER NOT NULL DEFAULT 1,              -- تنبيه الحد الأعلى
        expiry_warning_days INTEGER NOT NULL DEFAULT 60,         -- تنبيه قرب انتهاء الصلاحية بالأيام
        
        -- الباركود والميزان والوحدات
        enable_scale_barcode INTEGER NOT NULL DEFAULT 1,         -- تفعيل باركود الميزان الإلكتروني
        scale_barcode_prefix TEXT NOT NULL DEFAULT '99',         -- بادئة ميزان الوزن (مثلاً 99 أو 20)
        scale_code_length INTEGER NOT NULL DEFAULT 5,            -- طول كود الصنف في باركود الميزان
        scale_value_type TEXT NOT NULL DEFAULT 'total_price',    -- total_price, weight_grams
        scale_decimals INTEGER NOT NULL DEFAULT 2,               -- الخانات العشرية للميزان
        quantity_decimals INTEGER NOT NULL DEFAULT 2,            -- خانات الكميات العشرية
        price_decimals INTEGER NOT NULL DEFAULT 2,               -- خانات الأسعار والتكاليف
        allow_multi_units INTEGER NOT NULL DEFAULT 1,            -- تفعيل تعدد الوحدات
        
        -- الربط والتأثير المحاسبي
        accounting_inventory_system TEXT NOT NULL DEFAULT 'perpetual', -- perpetual (جرد مستمر), periodic (دوري)
        inv_control_account TEXT NOT NULL DEFAULT '120101',      -- حساب مراقبة المخزون
        cogs_account TEXT NOT NULL DEFAULT '510101',             -- حساب تكلفة البضاعة المباعة
        goods_in_transit_account TEXT NOT NULL DEFAULT '120201', -- حساب بضاعة بالطريق
        stock_surplus_account TEXT NOT NULL DEFAULT '420301',    -- حساب فائض وأرباح الجرد
        stock_deficit_account TEXT NOT NULL DEFAULT '520301',    -- حساب عجز وهالك الجرد
        stock_revaluation_account TEXT NOT NULL DEFAULT '520401',-- حساب تسويات تقييم المخزون
        
        -- الصلاحيات والاعتمادات
        require_supervisor_approval_issue INTEGER NOT NULL DEFAULT 1, -- موافقة المشرف لسند الصرف
        issue_approval_amount REAL NOT NULL DEFAULT 10000.0,           -- سقف الصرف بدون موافقة
        prevent_deleting_posted_vouchers INTEGER NOT NULL DEFAULT 1,   -- منع حذف السندات المرحلة
        enable_audit_trail INTEGER NOT NULL DEFAULT 1,                 -- تفعيل سجل التدقيق

        -- خيارات متقدمة 1 و2 التفصيلية (Advanced Options Fields from Onyx Pro ERP)
        allow_delete_receipt_item INTEGER NOT NULL DEFAULT 0,
        allow_edit_received_qty INTEGER NOT NULL DEFAULT 0,
        allow_edit_receiving_wh INTEGER NOT NULL DEFAULT 0,
        allow_exceed_transfer_qty INTEGER NOT NULL DEFAULT 0,
        allow_edit_transit_account INTEGER NOT NULL DEFAULT 0,
        link_transfer_to_request INTEGER NOT NULL DEFAULT 0,
        link_issue_to_request INTEGER NOT NULL DEFAULT 0,
        link_receipt_to_order INTEGER NOT NULL DEFAULT 0,
        enforce_ref_no INTEGER NOT NULL DEFAULT 0,
        enforce_description INTEGER NOT NULL DEFAULT 0,
        use_item_accessories INTEGER NOT NULL DEFAULT 1,
        auto_link_item_accessory INTEGER NOT NULL DEFAULT 0,
        link_item_activities_to_perms INTEGER NOT NULL DEFAULT 1,
        handle_consignment_goods INTEGER NOT NULL DEFAULT 1,
        handle_trust_goods INTEGER NOT NULL DEFAULT 1,
        deduct_composite_sales_in_reconcile INTEGER NOT NULL DEFAULT 0,
        include_main_group_in_item_code INTEGER NOT NULL DEFAULT 1,
        alert_exceed_max_transfer_qty INTEGER NOT NULL DEFAULT 0,
        auto_receipt_transfer_by_wh INTEGER NOT NULL DEFAULT 0,
        manual_items_in_repair_waste INTEGER NOT NULL DEFAULT 0,
        use_item_bom INTEGER NOT NULL DEFAULT 1,
        show_desc_at_item_level INTEGER NOT NULL DEFAULT 0,
        use_standard_costing INTEGER NOT NULL DEFAULT 0,
        auto_generate_item_code INTEGER NOT NULL DEFAULT 0,
        use_receipt_expenses INTEGER NOT NULL DEFAULT 1,
        use_expiry_date INTEGER NOT NULL DEFAULT 1,
        adopt_transfer_price_as_receipt_cost INTEGER NOT NULL DEFAULT 0,
        use_weight_dimension_system INTEGER NOT NULL DEFAULT 1,
        weight_dimension_type TEXT NOT NULL DEFAULT '1_weight',
        weight_unit_factor_desc TEXT NOT NULL DEFAULT 'Weight Unit Factor',
        cost_decimals INTEGER NOT NULL DEFAULT 6,
        general_decimals INTEGER NOT NULL DEFAULT 4,
        min_pricing_sign TEXT NOT NULL DEFAULT '+',
        min_pricing_pct REAL NOT NULL DEFAULT 0.0,
        max_pricing_sign TEXT NOT NULL DEFAULT '+',
        max_pricing_pct REAL NOT NULL DEFAULT 0.0,
        min_cost_pct REAL NOT NULL DEFAULT 0.0,
        max_cost_pct REAL NOT NULL DEFAULT 0.0,
        allow_expired_receipt_mode TEXT NOT NULL DEFAULT '2_allow',
        batch_lot_columns_count INTEGER NOT NULL DEFAULT 5,
        batch_grid_columns_json TEXT NOT NULL DEFAULT '[{"id":1,"name":"رقم التشغيلة / الدفعة","size":"12","item_specific":1,"visible":1},{"id":2,"name":"خط الإنتاج / الوجبة","size":"10","item_specific":0,"visible":1},{"id":3,"name":"سنة الصنع / الموديل","size":"8","item_specific":1,"visible":1},{"id":4,"name":"بلد المنشأ والمصدر","size":"15","item_specific":0,"visible":1},{"id":5,"name":"رقم الرف والموقع","size":"10","item_specific":0,"visible":1}]',
        barcode_matrix_json TEXT NOT NULL DEFAULT '[{"id":1,"segment":"المجموعة الرئيسية","field_length":10,"direction":"left","active":1},{"id":2,"segment":"المجموعة الفرعية","field_length":10,"direction":"left","active":1},{"id":3,"segment":"تاريخ الإنتهاء","field_length":6,"direction":"left","active":1},{"id":4,"segment":"كود الصنف التسلسلي","field_length":8,"direction":"left","active":1}]',
        use_price_change_request INTEGER NOT NULL DEFAULT 0,
        price_by_smallest_unit INTEGER NOT NULL DEFAULT 1,
        check_source_wh_in_transfer INTEGER NOT NULL DEFAULT 1,

        updated_by TEXT NOT NULL DEFAULT 'مدير النظام',
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS warehouse_variables_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        changed_by TEXT NOT NULL DEFAULT 'مدير النظام',
        changed_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        section_name TEXT NOT NULL,
        field_name TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        reason TEXT
      );
    `);

    // Dynamic Column Migration for existing database
    const existingCols = (db.prepare("PRAGMA table_info(warehouse_system_variables)").all() as any[]).map(c => c.name);
    const newColDefs: { [key: string]: string } = {
      allow_delete_receipt_item: "INTEGER NOT NULL DEFAULT 0",
      allow_edit_received_qty: "INTEGER NOT NULL DEFAULT 0",
      allow_edit_receiving_wh: "INTEGER NOT NULL DEFAULT 0",
      allow_exceed_transfer_qty: "INTEGER NOT NULL DEFAULT 0",
      allow_edit_transit_account: "INTEGER NOT NULL DEFAULT 0",
      link_transfer_to_request: "INTEGER NOT NULL DEFAULT 0",
      link_issue_to_request: "INTEGER NOT NULL DEFAULT 0",
      link_receipt_to_order: "INTEGER NOT NULL DEFAULT 0",
      enforce_ref_no: "INTEGER NOT NULL DEFAULT 0",
      enforce_description: "INTEGER NOT NULL DEFAULT 0",
      use_item_accessories: "INTEGER NOT NULL DEFAULT 1",
      auto_link_item_accessory: "INTEGER NOT NULL DEFAULT 0",
      link_item_activities_to_perms: "INTEGER NOT NULL DEFAULT 1",
      handle_consignment_goods: "INTEGER NOT NULL DEFAULT 1",
      handle_trust_goods: "INTEGER NOT NULL DEFAULT 1",
      deduct_composite_sales_in_reconcile: "INTEGER NOT NULL DEFAULT 0",
      include_main_group_in_item_code: "INTEGER NOT NULL DEFAULT 1",
      alert_exceed_max_transfer_qty: "INTEGER NOT NULL DEFAULT 0",
      auto_receipt_transfer_by_wh: "INTEGER NOT NULL DEFAULT 0",
      manual_items_in_repair_waste: "INTEGER NOT NULL DEFAULT 0",
      use_item_bom: "INTEGER NOT NULL DEFAULT 1",
      show_desc_at_item_level: "INTEGER NOT NULL DEFAULT 0",
      use_standard_costing: "INTEGER NOT NULL DEFAULT 0",
      auto_generate_item_code: "INTEGER NOT NULL DEFAULT 0",
      use_receipt_expenses: "INTEGER NOT NULL DEFAULT 1",
      use_expiry_date: "INTEGER NOT NULL DEFAULT 1",
      adopt_transfer_price_as_receipt_cost: "INTEGER NOT NULL DEFAULT 0",
      use_weight_dimension_system: "INTEGER NOT NULL DEFAULT 1",
      weight_dimension_type: "TEXT NOT NULL DEFAULT '1_weight'",
      weight_unit_factor_desc: "TEXT NOT NULL DEFAULT 'Weight Unit Factor'",
      cost_decimals: "INTEGER NOT NULL DEFAULT 6",
      general_decimals: "INTEGER NOT NULL DEFAULT 4",
      min_pricing_sign: "TEXT NOT NULL DEFAULT '+'",
      min_pricing_pct: "REAL NOT NULL DEFAULT 0.0",
      max_pricing_sign: "TEXT NOT NULL DEFAULT '+'",
      max_pricing_pct: "REAL NOT NULL DEFAULT 0.0",
      min_cost_pct: "REAL NOT NULL DEFAULT 0.0",
      max_cost_pct: "REAL NOT NULL DEFAULT 0.0",
      allow_expired_receipt_mode: "TEXT NOT NULL DEFAULT '2_allow'",
      batch_lot_columns_count: "INTEGER NOT NULL DEFAULT 5",
      batch_grid_columns_json: "TEXT NOT NULL DEFAULT '[{\"id\":1,\"name\":\"رقم التشغيلة / الدفعة\",\"size\":\"12\",\"item_specific\":1,\"visible\":1},{\"id\":2,\"name\":\"خط الإنتاج / الوجبة\",\"size\":\"10\",\"item_specific\":0,\"visible\":1},{\"id\":3,\"name\":\"سنة الصنع / الموديل\",\"size\":\"8\",\"item_specific\":1,\"visible\":1},{\"id\":4,\"name\":\"بلد المنشأ والمصدر\",\"size\":\"15\",\"item_specific\":0,\"visible\":1},{\"id\":5,\"name\":\"رقم الرف والموقع\",\"size\":\"10\",\"item_specific\":0,\"visible\":1}]'",
      barcode_matrix_json: "TEXT NOT NULL DEFAULT '[{\"id\":1,\"segment\":\"المجموعة الرئيسية\",\"field_length\":10,\"direction\":\"left\",\"active\":1},{\"id\":2,\"segment\":\"المجموعة الفرعية\",\"field_length\":10,\"direction\":\"left\",\"active\":1},{\"id\":3,\"segment\":\"تاريخ الإنتهاء\",\"field_length\":6,\"direction\":\"left\",\"active\":1},{\"id\":4,\"segment\":\"كود الصنف التسلسلي\",\"field_length\":8,\"direction\":\"left\",\"active\":1}]'",
      use_price_change_request: "INTEGER NOT NULL DEFAULT 0",
      price_by_smallest_unit: "INTEGER NOT NULL DEFAULT 1",
      check_source_wh_in_transfer: "INTEGER NOT NULL DEFAULT 1"
    };

    for (const [colName, colDef] of Object.entries(newColDefs)) {
      if (!existingCols.includes(colName)) {
        try {
          db.exec(`ALTER TABLE warehouse_system_variables ADD COLUMN ${colName} ${colDef}`);
        } catch (err) {
          console.warn(`Could not add column ${colName}:`, err);
        }
      }
    }

    // Ensure row 1 exists in warehouse_system_variables
    const wvRow = db.prepare("SELECT id FROM warehouse_system_variables WHERE id = 1").get();
    if (!wvRow) {
      db.prepare(`
        INSERT INTO warehouse_system_variables (
          id, costing_method, cost_level, allow_below_cost_sale, allow_negative_stock, enforce_expiry_date,
          enforce_batch_lot, enable_serial_numbers, auto_barcode_type, barcode_prefix,
          grn_require_purchase_order, grn_allowed_overage_pct, grn_update_cost_on_save,
          issue_require_cost_center, issue_require_purpose_desc, issue_block_expired_items,
          transfer_mechanism, transfer_cost_basis, include_shipping_in_transfer_cost,
          freeze_stock_during_stocktake, auto_post_stocktake_variances, stocktake_approval_threshold,
          stocktake_frequency, alert_min_stock, alert_reorder_point, alert_max_stock, expiry_warning_days,
          enable_scale_barcode, scale_barcode_prefix, scale_code_length, scale_value_type, scale_decimals,
          quantity_decimals, price_decimals, allow_multi_units,
          accounting_inventory_system, inv_control_account, cogs_account, goods_in_transit_account,
          stock_surplus_account, stock_deficit_account, stock_revaluation_account,
          require_supervisor_approval_issue, issue_approval_amount, prevent_deleting_posted_vouchers,
          enable_audit_trail, updated_by
        ) VALUES (
          1, 'moving_average', 'warehouse', 0, 0, 1,
          1, 0, 'EAN13', '29',
          1, 5.0, 1,
          1, 1, 1,
          'two_step', 'source_cost', 1,
          1, 0, 5000.0,
          'monthly', 1, 1, 1, 60,
          1, '99', 5, 'total_price', 2,
          2, 2, 1,
          'perpetual', '120101', '510101', '120201',
          '420301', '520301', '520401',
          1, 10000.0, 1,
          1, 'مدير النظام'
        )
      `).run();
    }
  } catch (e) {
    console.error("Error creating user_groups or warehouse variables tables:", e);
  }

  // Role Permissions table for customizable granular access control
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role TEXT PRIMARY KEY,
        can_void_bills INTEGER NOT NULL DEFAULT 0,
        can_view_cost INTEGER NOT NULL DEFAULT 0,
        can_change_currencies INTEGER NOT NULL DEFAULT 0,
        can_approve_returns INTEGER NOT NULL DEFAULT 0,
        can_open_close_safe INTEGER NOT NULL DEFAULT 0,
        can_transfer_funds INTEGER NOT NULL DEFAULT 0,
        can_edit_products INTEGER NOT NULL DEFAULT 0,
        can_delete_orders INTEGER NOT NULL DEFAULT 0
      );
    `);

    const permCount = (db.prepare("SELECT COUNT(*) as c FROM role_permissions").get() as { c: number }).c;
    if (permCount === 0) {
      db.prepare(`INSERT INTO role_permissions (role, can_void_bills, can_view_cost, can_change_currencies, can_approve_returns, can_open_close_safe, can_transfer_funds, can_edit_products, can_delete_orders) VALUES (?, 1, 1, 1, 1, 1, 1, 1, 1)`).run("developer");
      db.prepare(`INSERT INTO role_permissions (role, can_void_bills, can_view_cost, can_change_currencies, can_approve_returns, can_open_close_safe, can_transfer_funds, can_edit_products, can_delete_orders) VALUES (?, 1, 1, 1, 1, 1, 1, 1, 1)`).run("admin");
      db.prepare(`INSERT INTO role_permissions (role, can_void_bills, can_view_cost, can_change_currencies, can_approve_returns, can_open_close_safe, can_transfer_funds, can_edit_products, can_delete_orders) VALUES (?, 0, 1, 0, 0, 1, 1, 0, 0)`).run("accountant");
      db.prepare(`INSERT INTO role_permissions (role, can_void_bills, can_view_cost, can_change_currencies, can_approve_returns, can_open_close_safe, can_transfer_funds, can_edit_products, can_delete_orders) VALUES (?, 0, 0, 0, 0, 1, 0, 0, 0)`).run("cashier");
    }
  } catch (e) {
    console.error("Error creating role_permissions table:", e);
  }

  // Units of measurement and item types
  try {
    db.exec(`
      -- جدول وحدات القياس (Units of Measurement)
      CREATE TABLE IF NOT EXISTS units_of_measurement (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        default_package REAL NOT NULL DEFAULT 1.0,
        is_package_locked INTEGER NOT NULL DEFAULT 0,
        unit_type TEXT NOT NULL DEFAULT 'numerical', -- numerical (1- عددية), measured (2- مقاسة)
        category TEXT NOT NULL DEFAULT 'weight',      -- weight (1- وزن), volume (2- حجم), area (3- مساحة), lengths (4- أطوال), liquids (5- سوائل), distances (6- مسافات)
        conversion_factor REAL NOT NULL DEFAULT 1.0,
 base_unit TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      -- جدول معاملات تحويل الوحدات المقاسة (Unit Conversions Matrix)
      CREATE TABLE IF NOT EXISTS unit_conversions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unit_id INTEGER NOT NULL,
        from_unit TEXT NOT NULL,
        to_unit TEXT NOT NULL,
        factor REAL NOT NULL,
        operation TEXT DEFAULT 'multiply'
      );

      -- جدول أنواع الأصناف وتصنيفاتها (Item Types)
      CREATE TABLE IF NOT EXISTS item_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type_number INTEGER NOT NULL UNIQUE,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        foreign_name TEXT DEFAULT '',
        main_group_id INTEGER DEFAULT 1,
        main_group_name TEXT DEFAULT '001 مجموعة المواد الغذائية والسلع',
        sub_group_id INTEGER DEFAULT 1,
        sub_group_name TEXT DEFAULT 'المجموعة الفرعية 1',
        sub_sub_group_id INTEGER DEFAULT 1,
        sub_sub_group_name TEXT DEFAULT 'تحت الفرعية 1',
        auxiliary_group_id INTEGER DEFAULT 1,
        auxiliary_group_name TEXT DEFAULT 'المساعدة 1',
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
      );
    `);

    // Seed Units of Measurement if empty
    const unitCount = (db.prepare("SELECT COUNT(*) as c FROM units_of_measurement").get() as { c: number }).c;
    if (unitCount === 0) {
      const insUnit = db.prepare(`
        INSERT INTO units_of_measurement (id, code, name, default_package, is_package_locked, unit_type, category, conversion_factor, base_unit, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      insUnit.run(1, "الكرتون", "الكرتون", 12.0, 0, "numerical", "weight", 12.0, "حبة", "كرتون تعبئة قياسي 12 حبة");
      insUnit.run(2, "حبة", "حبة / قطعة", 1.0, 1, "numerical", "weight", 1.0, "حبة", "الوحدة الصغرى الفردية");
      insUnit.run(3, "درزن", "درزن (12 قطعة)", 12.0, 0, "numerical", "weight", 12.0, "حبة", "درزن تجاري");
      insUnit.run(4, "باكت", "باكت / شدة", 6.0, 0, "numerical", "weight", 6.0, "حبة", "باكت وسيط");
      insUnit.run(5, "كجم", "كيلو جرام (kg)", 1.0, 1, "measured", "weight", 1.0, "جم", "وحدة وزن معيارية");
      insUnit.run(6, "m³", "متر مكعب (Volume m³)", 1.0, 1, "measured", "volume", 1.0, "cm³", "وحدة حجوم ومكعبات");
      insUnit.run(7, "m²", "متر مربع (Area m²)", 1.0, 1, "measured", "area", 1.0, "cm²", "وحدة مساحات رخام وبلاط وزجاج");
      insUnit.run(8, "m", "متر طولي (Length m)", 1.0, 1, "measured", "lengths", 1.0, "cm", "وحدة أطوال كيابل وأقمشة");
      insUnit.run(9, "لتر", "لتر سوائل (Liter L)", 1.0, 1, "measured", "liquids", 1.0, "مل", "وحدة قياس سوائل وزيوت");
      insUnit.run(10, "طن", "طن متري (Ton)", 1000.0, 1, "measured", "weight", 1000.0, "كجم", "طن حديد وأسمنت وخشب");

      // Seed unit conversions matching Image 1
      const insConv = db.prepare(`
        INSERT INTO unit_conversions (unit_id, from_unit, to_unit, factor, operation)
        VALUES (?, ?, ?, ?, ?)
      `);
      insConv.run(6, "m³", "cm³", 0.01, "multiply");
      insConv.run(6, "m³", "mlm³", 0.001, "multiply");
      insConv.run(8, "m", "cm", 0.01, "multiply");
      insConv.run(8, "m", "mlm", 0.001, "multiply");
      insConv.run(8, "m", "mi", 2589988.110336, "multiply");
      insConv.run(8, "m", "yd", 0.83612736, "multiply");
      insConv.run(7, "m²", "cm²", 0.01, "multiply");
      insConv.run(7, "m²", "yd²", 0.83612736, "multiply");
      insConv.run(7, "m²", "mi²", 2589988.110336, "multiply");
      insConv.run(7, "m²", "mlm²", 0.001, "multiply");
      insConv.run(5, "كجم", "جم", 0.001, "multiply");
      insConv.run(9, "لتر", "مل", 0.001, "multiply");
    }

    // Seed Item Types if empty (matching Image 2)
    const typeCount = (db.prepare("SELECT COUNT(*) as c FROM item_types").get() as { c: number }).c;
    if (typeCount === 0) {
      const insType = db.prepare(`
        INSERT INTO item_types (type_number, code, name, foreign_name, main_group_id, main_group_name, sub_group_id, sub_group_name, sub_sub_group_id, sub_sub_group_name, auxiliary_group_id, auxiliary_group_name, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insType.run(1, "01", "سلعي", "Goods / Commercial Products", 1, "001 مجموعة المواد الغذائية والسلع", 1, "المجموعة الفرعية 1", 1, "تحت الفرعية 1", 1, "المساعدة 1", 1);
      insType.run(2, "02", "خدمي", "Services & Fees", 2, "002 مجموعة الخدمات والرسوم", 1, "خدمات عامة", 1, "خدمات تشغيل", 1, "مساعدة 1", 1);
      insType.run(3, "03", "تصنيعي / مركب (BOM)", "Manufacturing / Assembly (BOM)", 3, "003 مجموعة التصنيع والتجميع", 1, "وجبات مجهزة", 1, "خلطات", 1, "مساعدة 1", 1);
      insType.run(4, "04", "مادة خام مخزنية", "Raw Materials", 4, "004 مجموعة الخامات الأولية", 1, "خامات مطبخ", 1, "توابل وبهارات", 1, "مساعدة 1", 1);
      insType.run(5, "05", "بضاعة تحت التصريف / أمانات", "Consignment / Trust Goods", 5, "005 مجموعة بضائع الأمانات", 1, "أمانات موردين", 1, "برسم البيع", 1, "مساعدة 1", 1);
      insType.run(6, "06", "مستلزمات تشغيل وتعبئة", "Packaging & Operating Supplies", 6, "006 مستلزمات التعبئة والتغليف", 1, "أكياس وعلب", 1, "استيكرات", 1, "مساعدة 1", 1);
    }
  } catch (e) {
    console.error("Error creating units or item types tables:", e);
  }

  // Inventory Transaction Types (Stock Adjustment, Stock Issue, Stock Receipt, Stock Requisition)
  try {
    db.exec(`
      -- 1. جدول أنواع تسوية المخزون (Stock Adjustment Types)
      CREATE TABLE IF NOT EXISTS stock_adjustment_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type_number INTEGER UNIQUE NOT NULL,
        name TEXT NOT NULL,
        foreign_name TEXT DEFAULT '',
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      -- 2. جدول أنواع الصرف المخزني (Stock Issue / Outgoing Types)
      CREATE TABLE IF NOT EXISTS stock_issue_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type_number INTEGER UNIQUE NOT NULL,
        name TEXT NOT NULL,
        foreign_name TEXT DEFAULT '',
        is_restaurant INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      -- 3. جدول أنواع التوريد المخزني (Stock Receipt / Incoming Types)
      CREATE TABLE IF NOT EXISTS stock_receipt_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type_number INTEGER UNIQUE NOT NULL,
        name TEXT NOT NULL,
        foreign_name TEXT DEFAULT '',
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      -- 4. جدول أنواع الطلبات المخزنية (Stock Requisition Types)
      CREATE TABLE IF NOT EXISTS stock_requisition_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type_number INTEGER UNIQUE NOT NULL,
        name TEXT NOT NULL,
        foreign_name TEXT DEFAULT '',
        requisition_effect_type TEXT NOT NULL DEFAULT 'all', -- 'issue', 'transfer', 'all'
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );
    `);

    // Seed Stock Adjustment Types if empty
    const adjCount = (db.prepare("SELECT COUNT(*) as c FROM stock_adjustment_types").get() as { c: number }).c;
    if (adjCount === 0) {
      const insAdj = db.prepare(`
        INSERT INTO stock_adjustment_types (type_number, name, foreign_name, active)
        VALUES (?, ?, ?, 1)
      `);
      insAdj.run(1, "تسوية مخزون", "Stock Adjustment");
      insAdj.run(2, "تسوية جرد سنوي", "Annual Inventory Adjustment");
      insAdj.run(3, "تسوية تالف وأضرار", "Damage & Waste Adjustment");
    }

    // Seed Stock Issue Types if empty
    const issueCount = (db.prepare("SELECT COUNT(*) as c FROM stock_issue_types").get() as { c: number }).c;
    if (issueCount === 0) {
      const insIssue = db.prepare(`
        INSERT INTO stock_issue_types (type_number, name, foreign_name, is_restaurant, active)
        VALUES (?, ?, ?, ?, 1)
      `);
      insIssue.run(1, "أمر صرف مخزني", "Outgoing / Standard Issue Order", 0);
      insIssue.run(2, "أمر صرف مخزني الإدارة", "Management Issue Order", 0);
      insIssue.run(3, "أمر صرف مطاعم وطهي", "Kitchen & Restaurant Issue", 1);
    }

    // Seed Stock Receipt Types if empty
    const receiptCount = (db.prepare("SELECT COUNT(*) as c FROM stock_receipt_types").get() as { c: number }).c;
    if (receiptCount === 0) {
      const insReceipt = db.prepare(`
        INSERT INTO stock_receipt_types (type_number, name, foreign_name, active)
        VALUES (?, ?, ?, 1)
      `);
      insReceipt.run(1, "أمر توريد مخزني صنعاء", "Incoming / Sanaa Warehouse Receipt");
      insReceipt.run(2, "أمر توريد بضاعة أمانات", "Consignment Goods Receipt");
      insReceipt.run(3, "أمر توريد تجميع وإعادة تعبئة", "Assembly Receipt Order");
    }

    // Seed Stock Requisition Types if empty
    const reqCount = (db.prepare("SELECT COUNT(*) as c FROM stock_requisition_types").get() as { c: number }).c;
    if (reqCount === 0) {
      const insReq = db.prepare(`
        INSERT INTO stock_requisition_types (type_number, name, foreign_name, requisition_effect_type, active)
        VALUES (?, ?, ?, ?, 1)
      `);
      insReq.run(1, "طلب صرف مخزني", "Stock Issue Requisition", "issue");
      insReq.run(2, "طلب تحويل مخزني", "Stock Transfer Requisition", "transfer");
      insReq.run(3, "طلب مخزني الحديدة", "Hodeidah Warehouse Requisition", "all");
    }
  } catch (e) {
    console.error("Error creating stock transaction types tables:", e);
  }

  // ─── Warehouse Operations & Document Archiving Tables (Matching 5 Onyx Pro Screens) ───
  try {
    db.exec(`
      -- 1. جدول أرشفة الوثائق والمستندات (Document Archiving - Image 1)
      CREATE TABLE IF NOT EXISTS document_archives (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voucher_type TEXT NOT NULL DEFAULT '1-9 أمر صرف مخزني',
        voucher_id INTEGER DEFAULT 1,
        file_no TEXT NOT NULL,
        file_date TEXT NOT NULL DEFAULT (date('now')),
        file_description TEXT NOT NULL,
        file_notes TEXT DEFAULT '',
        document_type_code TEXT DEFAULT '1-9 أمر صرف مخزني',
        file_name TEXT NOT NULL,
        file_size TEXT DEFAULT '1.2 MB',
        file_mime TEXT DEFAULT 'application/msword',
        file_path TEXT DEFAULT '',
        uploaded_by TEXT DEFAULT 'مدير النظام',
        uploaded_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      -- 2. جدول التحويل المخزني المتعدد (Multi-Warehouse Transfer Header - Image 2)
      CREATE TABLE IF NOT EXISTS multi_warehouse_transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transfer_no INTEGER UNIQUE NOT NULL,
        transfer_date TEXT NOT NULL DEFAULT (date('now')),
        branch_id INTEGER DEFAULT 1,
        branch_name TEXT DEFAULT '1-الإدارة العامة',
        transfer_type TEXT DEFAULT '1-تحويل مخزني',
        ref_no TEXT DEFAULT '22',
        default_cost_center TEXT DEFAULT '1101-المبيعات المعارض',
        default_warehouse_id INTEGER DEFAULT 1,
        default_warehouse_name TEXT DEFAULT '1-مخزن التحرير',
        reason TEXT DEFAULT 'تحويل بضائع متكررة إلى معارض ومخازن الفروع',
        inv_reg_no TEXT DEFAULT '215',
        project_no TEXT DEFAULT '1201-مشروع التوسع',
        activity_no TEXT DEFAULT '1101-نشاط المبيعات',
        statement TEXT DEFAULT 'تحويل مخزني متعدد من مخزن التحرير إلى عدة مخازن فرعية',
        status TEXT DEFAULT 'pending', -- 'pending' | 'converted' | 'cancelled'
        created_by TEXT DEFAULT '1-مدير النظام',
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS multi_warehouse_transfer_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transfer_id INTEGER NOT NULL,
        seq INTEGER NOT NULL DEFAULT 1,
        item_code TEXT NOT NULL,
        item_name TEXT NOT NULL,
        from_warehouse_id INTEGER NOT NULL DEFAULT 1,
        from_warehouse_name TEXT DEFAULT '1-مخزن التحرير',
        to_warehouse_id INTEGER NOT NULL DEFAULT 2,
        to_warehouse_name TEXT DEFAULT '2-مخزن الحصبة',
        expiry_date TEXT DEFAULT '',
        batch_no TEXT DEFAULT 'B-2025-01',
        quantity REAL NOT NULL DEFAULT 1.0,
        supplier_code TEXT DEFAULT '1001',
        supplier_name TEXT DEFAULT 'نبيل الجعدي',
        FOREIGN KEY (transfer_id) REFERENCES multi_warehouse_transfers(id) ON DELETE CASCADE
      );

      -- 3. جدول التحويل المخزني المباشر (Standard Warehouse Transfer - Image 3)
      CREATE TABLE IF NOT EXISTS standard_warehouse_transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transfer_no INTEGER UNIQUE NOT NULL,
        transfer_date TEXT NOT NULL DEFAULT (date('now')),
        branch_id INTEGER DEFAULT 1,
        branch_name TEXT DEFAULT '1-الإدارة العامة',
        from_warehouse_id INTEGER NOT NULL DEFAULT 1,
        from_warehouse_name TEXT DEFAULT '1-مخزن التحرير',
        to_warehouse_id INTEGER NOT NULL DEFAULT 2,
        to_warehouse_name TEXT DEFAULT '2-مخزن الحصبة',
        transfer_type TEXT DEFAULT '1-تحويل مخزني',
        costing_method TEXT DEFAULT '1-التكلفة',
        cost_center TEXT DEFAULT '1101-المبيعات المعارض',
        activity_no TEXT DEFAULT '1101-نافذة بيع كمبيوترات حدة',
        ref_no TEXT DEFAULT '222',
        inv_reg_no TEXT DEFAULT '215',
        project_no TEXT DEFAULT '1201-مشروع الكمبيوترات',
        customer_name TEXT DEFAULT '1010003-علي العمراني',
        statement TEXT DEFAULT 'تحويل أجهزة PC من مخزن التحرير إلى مخزن الحصبة حسب توجيهات الإدارة العامة',
        reason TEXT DEFAULT 'وجود منافسة واستكمال كمية العرض',
        variance_account TEXT DEFAULT '1168010001-وس الوسيط المخزني',
        is_posted INTEGER NOT NULL DEFAULT 0,
        is_deferred INTEGER NOT NULL DEFAULT 0,
        is_pending INTEGER NOT NULL DEFAULT 1,
        close_transferred_qty INTEGER NOT NULL DEFAULT 0,
        receipt_type TEXT DEFAULT '1-استلام مباشر',
        total_amount REAL DEFAULT 0.0,
        created_by TEXT DEFAULT '1-مدير النظام',
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS standard_warehouse_transfer_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transfer_id INTEGER NOT NULL,
        seq INTEGER NOT NULL DEFAULT 1,
        item_code TEXT NOT NULL,
        item_name TEXT NOT NULL,
        unit TEXT DEFAULT 'حبة',
        quantity REAL NOT NULL DEFAULT 1.0,
        package_size REAL DEFAULT 1.0,
        expiry_date TEXT DEFAULT '',
        batch_no TEXT DEFAULT 'B-PC-100',
        supplier_code TEXT DEFAULT '1001',
        supplier_name TEXT DEFAULT 'نبيل الجعدي',
        unit_cost REAL DEFAULT 0.0,
        total_cost REAL DEFAULT 0.0,
        FOREIGN KEY (transfer_id) REFERENCES standard_warehouse_transfers(id) ON DELETE CASCADE
      );

      -- 4. جدول استلام التحويل المخزني (Warehouse Transfer Receipt / GRN - Image 4)
      CREATE TABLE IF NOT EXISTS warehouse_transfer_receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_no INTEGER UNIQUE NOT NULL,
        receipt_date TEXT NOT NULL DEFAULT (date('now')),
        branch_id INTEGER DEFAULT 1,
        branch_name TEXT DEFAULT '1-الإدارة العامة',
        to_warehouse_id INTEGER NOT NULL DEFAULT 2,
        to_warehouse_name TEXT DEFAULT '2-مخزن الحصبة',
        from_warehouse_id INTEGER NOT NULL DEFAULT 1,
        from_warehouse_name TEXT DEFAULT '1-مخزن التحرير',
        ref_no TEXT DEFAULT '215',
        cost_center TEXT DEFAULT '1101-المبيعات المعارض',
        activity_no TEXT DEFAULT '210-محطة طريق المطار',
        transfer_order_no INTEGER DEFAULT 7,
        intermediate_account TEXT DEFAULT '1168010001-وسيط التحويلات المخزنية',
        receipt_type TEXT DEFAULT '2-استلام / مرتجع',
        project_no TEXT DEFAULT '1101-مشروع الحصبة',
        customer_name TEXT DEFAULT '1110003-علي العمراني',
        statement TEXT DEFAULT 'استلام كميات أجهزة الكمبيوتر المحولة بموجب أمر التحويل رقم 7',
        received_by TEXT DEFAULT 'نبيل الجعدي - أمين مخزن الحصبة',
        is_posted INTEGER NOT NULL DEFAULT 0,
        total_qty REAL DEFAULT 0.0,
        created_by TEXT DEFAULT '1-مدير النظام',
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS warehouse_transfer_receipt_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_id INTEGER NOT NULL,
        seq INTEGER NOT NULL DEFAULT 1,
        item_code TEXT NOT NULL,
        item_name TEXT NOT NULL,
        unit TEXT DEFAULT 'حبة',
        transferred_qty REAL NOT NULL DEFAULT 0.0,
        received_qty REAL NOT NULL DEFAULT 0.0,
        expiry_date TEXT DEFAULT '',
        batch_no TEXT DEFAULT 'B-PC-100',
        supplier_code TEXT DEFAULT '1001',
        supplier_name TEXT DEFAULT 'نبيل الجعدي',
        FOREIGN KEY (receipt_id) REFERENCES warehouse_transfer_receipts(id) ON DELETE CASCADE
      );

      -- 5. جدول التسويات المخزنية (Stock Adjustment Vouchers - Image 5)
      CREATE TABLE IF NOT EXISTS stock_adjustment_vouchers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        adjustment_no INTEGER UNIQUE NOT NULL,
        adjustment_date TEXT NOT NULL DEFAULT (date('now')),
        branch_id INTEGER DEFAULT 1,
        branch_name TEXT DEFAULT '1-الإدارة العامة',
        account_no TEXT DEFAULT '021130008-فروقات أرباح وخسائر / تسويات جردية',
        currency TEXT DEFAULT '1-ريال يمني',
        exchange_rate REAL DEFAULT 1.0,
        adjustment_type TEXT DEFAULT '2-تسوية مخزنية (كمية / تكلفة)',
        statement TEXT DEFAULT 'تسوية الجرد السنوي ومعالجة فروقات نقص وزيادة الكميات والتكاليف',
        batch_no TEXT DEFAULT 'B-2025-ADJ',
        contract_no TEXT DEFAULT '',
        cost_center TEXT DEFAULT '1101-المبيعات المعارض',
        activity_no TEXT DEFAULT '1101-نشاط عام',
        total_adjustment_amount REAL DEFAULT 671895.50,
        is_posted INTEGER NOT NULL DEFAULT 0,
        created_by TEXT DEFAULT '1-مدير النظام',
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS stock_adjustment_voucher_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        adjustment_id INTEGER NOT NULL,
        seq INTEGER NOT NULL DEFAULT 1,
        item_code TEXT NOT NULL,
        item_name TEXT NOT NULL,
        unit_cost REAL NOT NULL DEFAULT 0.0,
        batch_no TEXT DEFAULT '',
        average_cost REAL NOT NULL DEFAULT 0.0,
        book_qty REAL NOT NULL DEFAULT 0.0,
        actual_qty REAL NOT NULL DEFAULT 0.0,
        variance_qty REAL NOT NULL DEFAULT 0.0,
        adjustment_qty REAL NOT NULL DEFAULT 0.0,
        variance_amount REAL NOT NULL DEFAULT 0.0,
        supplier_code TEXT DEFAULT '1001',
        supplier_name TEXT DEFAULT 'جمال المحمودي',
        FOREIGN KEY (adjustment_id) REFERENCES stock_adjustment_vouchers(id) ON DELETE CASCADE
      );
    `);

    // Seed Document Archives if empty
    const docCount = (db.prepare("SELECT COUNT(*) as c FROM document_archives").get() as { c: number }).c;
    if (docCount === 0) {
      const insDoc = db.prepare(`
        INSERT INTO document_archives (voucher_type, voucher_id, file_no, file_date, file_description, file_notes, document_type_code, file_name, file_size, file_mime, file_path, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insDoc.run("1-9 أمر صرف مخزني", 1, "1", "2015-11-24", "أمر صرف مخزني - وثائق معتمدة", "مستندات تسليم المواد السلعية المنصرفة رسمياً", "1-9 أمر صرف مخزني", "للمواد السلعية المنصرفة.doc", "1.4 MB", "application/msword", "/docs/materials_issued.doc", "1-مدير النظام");
      insDoc.run("أمر توريد مخزني", 1, "2", "2015-11-25", "فاتورة الشراء وتقرير الفحص الفني", "مرفق صو الفاتورة وتقرير الجودة للمواد الموردة", "2-1 أمر توريد مخزني", "فاتورة_المشتريات_صنعاء.pdf", "2.1 MB", "application/pdf", "/docs/invoice_sanaa.pdf", "نبيل الجعدي");
    }

    // Seed Multi Warehouse Transfer if empty
    const multiCount = (db.prepare("SELECT COUNT(*) as c FROM multi_warehouse_transfers").get() as { c: number }).c;
    if (multiCount === 0) {
      const insMulti = db.prepare(`
        INSERT INTO multi_warehouse_transfers (transfer_no, transfer_date, branch_name, transfer_type, ref_no, default_cost_center, default_warehouse_name, reason, inv_reg_no, project_no, activity_no, statement, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insMulti.run(33, "2015-11-29", "1-الإدارة العامة", "1-تحويل مخزني", "22", "1101-المبيعات المعارض", "1-مخزن التحرير", "تغطية احتياجات الفروع والمستودعات الإقليمية", "215", "1201-مشروع المعارض", "1101-نشاط المبيعات", "تحويل بضائع مواد غذائية من المركز الرئيسي إلى مخزن الحصبة ومخزن المعارض", "pending");
      
      const multiId = (db.prepare("SELECT id FROM multi_warehouse_transfers WHERE transfer_no = 33").get() as any)?.id;
      if (multiId) {
        const insMultiItem = db.prepare(`
          INSERT INTO multi_warehouse_transfer_items (transfer_id, seq, item_code, item_name, from_warehouse_name, to_warehouse_name, expiry_date, batch_no, quantity, supplier_code, supplier_name)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insMultiItem.run(multiId, 1, "001-1002", "سكر هندي عام 50 كيلو", "1-مخزن التحرير", "2-مخزن الحصبة", "2026-12-31", "B-SUGAR-50", 100, "1001", "نبيل الجعدي");
        insMultiItem.run(multiId, 2, "001-1002", "سكر هندي عام 50 كيلو", "1-مخزن التحرير", "3-مخزن المعارض", "2026-12-31", "B-SUGAR-50", 100, "1001", "نبيل الجعدي");
      }
    }

    // Seed Standard Warehouse Transfer if empty
    const stdCount = (db.prepare("SELECT COUNT(*) as c FROM standard_warehouse_transfers").get() as { c: number }).c;
    if (stdCount === 0) {
      const insStd = db.prepare(`
        INSERT INTO standard_warehouse_transfers (transfer_no, transfer_date, branch_name, from_warehouse_name, to_warehouse_name, transfer_type, costing_method, cost_center, activity_no, ref_no, inv_reg_no, project_no, customer_name, statement, reason, variance_account, is_posted, total_amount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insStd.run(7, "2015-12-01", "1-الإدارة العامة", "1-مخزن التحرير", "2-مخزن الحصبة", "1-تحويل مخزني", "1-التكلفة", "1101-المبيعات المعارض", "1101-نافذة بيع كمبيوترات حدة", "222", "215", "1201-مشروع الكمبيوترات", "1010003-علي العمراني", "تحويل أجهزة PC من مخزن التحرير إلى مخزن الحصبة حسب توجيه الإدارة العامة", "وجود منافسة للمبتدئين وتلبية طلب المعرض", "1168010001-وسيط التحويلات المخزنية", 0, 4500.0);

      const stdId = (db.prepare("SELECT id FROM standard_warehouse_transfers WHERE transfer_no = 7").get() as any)?.id;
      if (stdId) {
        const insStdItem = db.prepare(`
          INSERT INTO standard_warehouse_transfer_items (transfer_id, seq, item_code, item_name, unit, quantity, package_size, expiry_date, batch_no, supplier_code, supplier_name, unit_cost, total_cost)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insStdItem.run(stdId, 1, "000-0080", "جهاز PC ذكي متكامل", "حبة", 22, 1, "2027-01-01", "B-PC-100", "1001", "نبيل الجعدي", 204.55, 4500.0);
      }
    }

    // Seed Warehouse Transfer Receipt if empty
    const rcptCount = (db.prepare("SELECT COUNT(*) as c FROM warehouse_transfer_receipts").get() as { c: number }).c;
    if (rcptCount === 0) {
      const insRcpt = db.prepare(`
        INSERT INTO warehouse_transfer_receipts (receipt_no, receipt_date, branch_name, to_warehouse_name, from_warehouse_name, ref_no, cost_center, activity_no, transfer_order_no, intermediate_account, receipt_type, project_no, customer_name, statement, received_by, is_posted, total_qty)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insRcpt.run(10, "2015-12-02", "1-الإدارة العامة", "2-مخزن الحصبة", "1-مخزن التحرير", "215", "1101-المبيعات المعارض", "210-محطة طريق المطار", 7, "1168010001-وسيط التحويلات المخزنية", "2-استلام / مرتجع", "1101-مشروع الحصبة", "1110003-علي العمراني", "إدخال الاستلام المخزني للبضاعة المحولة من مخزن التحرير بموجب أمر التحويل رقم 7", "نبيل الجعدي - أمين مخزن الحصبة", 0, 22.0);

      const rcptId = (db.prepare("SELECT id FROM warehouse_transfer_receipts WHERE receipt_no = 10").get() as any)?.id;
      if (rcptId) {
        const insRcptItem = db.prepare(`
          INSERT INTO warehouse_transfer_receipt_items (receipt_id, seq, item_code, item_name, unit, transferred_qty, received_qty, expiry_date, batch_no, supplier_code, supplier_name)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insRcptItem.run(rcptId, 1, "001-1003", "سكر السعيد 10 كيلو", "حبة", 22, 22, "2026-06-30", "B-SUGAR-10", "1001", "نبيل الجعدي");
      }
    }

    // Seed Stock Adjustment Voucher if empty
    const adjVCount = (db.prepare("SELECT COUNT(*) as c FROM stock_adjustment_vouchers").get() as { c: number }).c;
    if (adjVCount === 0) {
      const insAdjV = db.prepare(`
        INSERT INTO stock_adjustment_vouchers (adjustment_no, adjustment_date, branch_name, account_no, currency, exchange_rate, adjustment_type, statement, batch_no, contract_no, cost_center, activity_no, total_adjustment_amount, is_posted)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insAdjV.run(1, "2015-12-05", "1-الإدارة العامة", "021130008-فروقات أرباح وخسائر / تسويات جردية", "1-ريال يمني", 215.0, "2-تسوية مخزنية (كمية / تكلفة)", "معالجة فروقات الزيادة والنقص الكمي والتكلفي بين الجرد الفعلي وأستاذ المخازن", "B-2015-ADJ", "215", "1101-المبيعات المعارض", "1101-نشاط عام", 671895.50, 0);

      const adjVId = (db.prepare("SELECT id FROM stock_adjustment_vouchers WHERE adjustment_no = 1").get() as any)?.id;
      if (adjVId) {
        const insAdjVItem = db.prepare(`
          INSERT INTO stock_adjustment_voucher_items (adjustment_id, seq, item_code, item_name, unit_cost, batch_no, average_cost, book_qty, actual_qty, variance_qty, adjustment_qty, variance_amount, supplier_code, supplier_name)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insAdjVItem.run(adjVId, 1, "001-1001", "سكر برزيلي 50 كغم", 200.0, "B-01", 6997.50, 2500, 2000, -500, -500, -100000.0, "1001", "جمال المحمودي");
        insAdjVItem.run(adjVId, 2, "001-1002", "مخلفات كنسة سكر", 700.0, "B-02", 100.0, 800, 700, -100, -100, -70000.0, "1001", "جمال المحمودي");
        insAdjVItem.run(adjVId, 3, "001-1003", "سكر هندي عام 50كيلو", 150.0, "B-03", 1.6154, 130, 150, 20, 20, 3000.0, "1001", "جمال المحمودي");
        insAdjVItem.run(adjVId, 4, "001-1005", "سكر سوداني 50كغم", 500.0, "B-04", 229.411, 500, 1000, 500, 500, 250000.0, "1001", "جمال المحمودي");
        insAdjVItem.run(adjVId, 5, "001-3001", "سكر صيدلاني", 300.0, "B-05", 100.0, 100, 300, 200, 200, 60000.0, "1001", "جمال المحمودي");
        insAdjVItem.run(adjVId, 6, "001-3003", "سكر تسجيلات", 210.0, "B-06", 124.838, 220, 210, -10, -10, -2100.0, "1001", "نبيل الجعدي");
        insAdjVItem.run(adjVId, 7, "001-5001", "سكر لهناء ممتاز 50كيلو", 400.0, "B-07", 4.484, 300, 800, 500, 500, 200000.0, "1001", "نبيل الجعدي");
        insAdjVItem.run(adjVId, 8, "002-0001", "عتبة تركي رقم 14", 1000.0, "B-08", 1.000, 100, 300, 200, 200, 200000.0, "1001", "نبيل الجعدي");
      }
    }
  } catch (e) {
    console.error("Error creating warehouse operations & document archiving tables:", e);
  }

  // Item Hierarchy & Classification Groups (Images 1, 2, 3, 4: Sub Groups, Sub-Sub Groups, Auxiliary Groups, Item Classifications)
  try {
    db.exec(`
      -- 1. جدول المجموعات الفرعية للأصناف (Item Sub Groups - Image 1)
      CREATE TABLE IF NOT EXISTS item_sub_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        main_group_id INTEGER NOT NULL DEFAULT 1,
        main_group_name TEXT DEFAULT '80 مجموعات الساعات',
        sub_group_code TEXT NOT NULL,
        name TEXT NOT NULL,
        foreign_name TEXT DEFAULT '',
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      -- 2. جدول المجموعات تحت الفرعية للأصناف (Item Sub-Sub Groups - Image 2)
      CREATE TABLE IF NOT EXISTS item_sub_sub_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sub_group_id INTEGER NOT NULL DEFAULT 1,
        sub_group_name TEXT DEFAULT '001 ساعات كاسيو',
        main_group_id INTEGER NOT NULL DEFAULT 80,
        main_group_name TEXT DEFAULT '80 مجموعات الساعات',
        sub_sub_group_code TEXT NOT NULL,
        item_code_prefix TEXT DEFAULT '080',
        name TEXT NOT NULL,
        foreign_name TEXT DEFAULT '',
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      -- 3. جدول المجموعات المساعدة للأصناف (Item Auxiliary / Assistant Groups - Image 3)
      CREATE TABLE IF NOT EXISTS item_auxiliary_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        foreign_name TEXT DEFAULT '',
        main_group_id INTEGER DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      -- 4. جدول تصنيفات الأصناف وهرمية الرتب (Item Classifications & Category Tree - Image 4)
      CREATE TABLE IF NOT EXISTS item_classifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        classification_code TEXT NOT NULL UNIQUE,
        parent_code TEXT DEFAULT '',
        name TEXT NOT NULL,
        foreign_name TEXT DEFAULT '',
        is_transactional INTEGER NOT NULL DEFAULT 1, -- 1=يتأثر بالعمليات, 0=تجميعي/رئيسي
        main_group_id INTEGER DEFAULT 1,
        activity_name TEXT DEFAULT 'نشاط أصناف تجارية',
        default_markup_pct REAL NOT NULL DEFAULT 0.0,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );
    `);

    // Seed Item Sub Groups
    const subCount = (db.prepare("SELECT COUNT(*) as c FROM item_sub_groups").get() as { c: number }).c;
    if (subCount === 0) {
      const insSub = db.prepare(`
        INSERT INTO item_sub_groups (main_group_id, main_group_name, sub_group_code, name, foreign_name, active)
        VALUES (?, ?, ?, ?, ?, 1)
      `);
      insSub.run(80, "80 مجموعات الساعات", "001", "ساعات كاسيو", "Casio Watches");
      insSub.run(80, "80 مجموعات الساعات", "002", "ساعات رولكس", "Rolex Watches");
      insSub.run(1, "001 مجموعة المواد الغذائية والسلع", "003", "عصائر ومشروبات", "Juices & Beverages");
    }

    // Seed Item Sub-Sub Groups
    const subSubCount = (db.prepare("SELECT COUNT(*) as c FROM item_sub_sub_groups").get() as { c: number }).c;
    if (subSubCount === 0) {
      const insSubSub = db.prepare(`
        INSERT INTO item_sub_sub_groups (sub_group_id, sub_group_name, main_group_id, main_group_name, sub_sub_group_code, item_code_prefix, name, foreign_name, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `);
      insSubSub.run(1, "001 ساعات كاسيو", 80, "80 مجموعات الساعات", "001", "080", "ساعات جلدية", "Leather Watches");
      insSubSub.run(1, "001 ساعات كاسيو", 80, "80 مجموعات الساعات", "002", "081", "ساعات معدنية ضد الماء", "Stainless Steel Watches");
    }

    // Seed Item Auxiliary Groups
    const auxCount = (db.prepare("SELECT COUNT(*) as c FROM item_auxiliary_groups").get() as { c: number }).c;
    if (auxCount === 0) {
      const insAux = db.prepare(`
        INSERT INTO item_auxiliary_groups (group_code, name, foreign_name, main_group_id, active)
        VALUES (?, ?, ?, ?, 1)
      `);
      insAux.run("001", "ساعات رجالي", "Men Watches", 80);
      insAux.run("002", "ساعات نسائي", "Women Watches", 80);
      insAux.run("003", "أطقم ومستلزمات هدايا", "Gift Sets & Accessories", 80);
    }

    // Seed Item Classifications
    const classCount = (db.prepare("SELECT COUNT(*) as c FROM item_classifications").get() as { c: number }).c;
    if (classCount === 0) {
      const insClass = db.prepare(`
        INSERT INTO item_classifications (classification_code, parent_code, name, foreign_name, is_transactional, main_group_id, activity_name, default_markup_pct, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `);
      insClass.run("11", "", "قسم الساعات والمجوهرات", "Watches & Jewelry Dept", 0, 80, "ساعات وإكسسوارات", 0.0);
      insClass.run("1101", "11", "كاسيو جلد", "Casio Leather Line", 1, 80, "ساعات وإكسسوارات", 15.0);
      insClass.run("1102", "11", "كاسيو معدني", "Casio Steel Line", 1, 80, "ساعات وإكسسوارات", 20.0);
    }
  } catch (e) {
    console.error("Error creating item hierarchy groups tables:", e);
  }

  // Comprehensive Accounting Tables (OmniFinance)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS bank_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bank_name TEXT NOT NULL,
        account_number TEXT NOT NULL,
        iban TEXT,
        swift TEXT,
        balance REAL NOT NULL DEFAULT 0.0,
        currency TEXT NOT NULL DEFAULT 'ريال',
        branch_id INTEGER DEFAULT 1,
        notes TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS inter_account_transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transfer_number TEXT UNIQUE NOT NULL,
        transfer_date TEXT NOT NULL,
        from_type TEXT NOT NULL, -- 'safe' or 'bank'
        from_id INTEGER NOT NULL,
        from_name TEXT NOT NULL,
        to_type TEXT NOT NULL, -- 'safe' or 'bank'
        to_id INTEGER NOT NULL,
        to_name TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'ريال',
        notes TEXT,
        journal_entry_id INTEGER REFERENCES journal_entries(id),
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS fixed_assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL, -- 'أجهزة ومعدات', 'وسائل نقل', 'أثاث وديكور', 'مباني وعقارات'
        purchase_date TEXT NOT NULL,
        purchase_cost REAL NOT NULL DEFAULT 0.0,
        salvage_value REAL NOT NULL DEFAULT 0.0,
        useful_life_years INTEGER NOT NULL DEFAULT 5,
        accumulated_depreciation REAL NOT NULL DEFAULT 0.0,
        net_book_value REAL NOT NULL DEFAULT 0.0,
        branch_id INTEGER DEFAULT 1,
        location TEXT,
        responsible_person TEXT,
        status TEXT NOT NULL DEFAULT 'active', -- 'active', 'sold', 'scrapped'
        account_code TEXT DEFAULT '12100',
        accum_depr_account_code TEXT DEFAULT '12200',
        depr_expense_account_code TEXT DEFAULT '61500',
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS asset_depreciations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fixed_asset_id INTEGER NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
        asset_name TEXT NOT NULL,
        period_date TEXT NOT NULL,
        depreciation_amount REAL NOT NULL,
        accumulated_total REAL NOT NULL,
        net_book_value_after REAL NOT NULL,
        journal_entry_id INTEGER REFERENCES journal_entries(id),
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS recurring_expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        frequency TEXT NOT NULL DEFAULT 'monthly', -- 'monthly', 'quarterly', 'yearly'
        next_due_date TEXT NOT NULL,
        safe_id INTEGER REFERENCES safes(id),
        bank_account_id INTEGER REFERENCES bank_accounts(id),
        cost_center_id INTEGER,
        auto_generate INTEGER NOT NULL DEFAULT 1,
        active INTEGER NOT NULL DEFAULT 1,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS bank_reconciliations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reconciliation_number TEXT UNIQUE NOT NULL,
        bank_account_id INTEGER NOT NULL REFERENCES bank_accounts(id),
        bank_name TEXT NOT NULL,
        statement_date TEXT NOT NULL,
        statement_balance REAL NOT NULL DEFAULT 0.0,
        book_balance REAL NOT NULL DEFAULT 0.0,
        difference REAL NOT NULL DEFAULT 0.0,
        status TEXT NOT NULL DEFAULT 'completed', -- 'draft', 'completed'
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS bank_reconciliation_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reconciliation_id INTEGER NOT NULL REFERENCES bank_reconciliations(id) ON DELETE CASCADE,
        transaction_date TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL, -- 'deposit', 'withdrawal'
        is_matched INTEGER NOT NULL DEFAULT 1,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS cost_centers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        branch_id INTEGER DEFAULT 1,
        notes TEXT,
        active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS fiscal_periods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        period_code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open', -- 'open', 'closed'
        closed_at TEXT,
        closed_by TEXT,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS safe_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_number TEXT UNIQUE NOT NULL,
        safe_id INTEGER NOT NULL REFERENCES safes(id),
        safe_name TEXT NOT NULL,
        date TEXT NOT NULL,
        user_id INTEGER,
        user_name TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'ريال',
        statement TEXT NOT NULL,
        reference_number TEXT,
        operation_type TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS travel_commissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        commission_code TEXT UNIQUE NOT NULL,
        commission_type TEXT NOT NULL, -- 'airline', 'hotel', 'supplier', 'employee', 'agent', 'branch'
        entity_id INTEGER,
        entity_name TEXT NOT NULL,
        reference_type TEXT DEFAULT 'booking',
        reference_id TEXT,
        reference_number TEXT,
        currency TEXT DEFAULT 'ريال',
        expected_amount REAL DEFAULT 0,
        received_amount REAL DEFAULT 0,
        due_amount REAL DEFAULT 0,
        paid_amount REAL DEFAULT 0,
        difference REAL DEFAULT 0,
        status TEXT DEFAULT 'pending', -- 'pending', 'partially_received', 'received', 'paid', 'settled'
        due_date TEXT,
        payment_date TEXT,
        notes TEXT,
        user_name TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS currency_rates_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        currency_id INTEGER REFERENCES currencies(id),
        currency_code TEXT NOT NULL,
        rate REAL NOT NULL,
        effective_date TEXT NOT NULL,
        notes TEXT,
        user_name TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS currency_revaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        revaluation_number TEXT UNIQUE NOT NULL,
        revaluation_date TEXT NOT NULL,
        currency_id INTEGER REFERENCES currencies(id),
        currency_code TEXT NOT NULL,
        old_rate REAL NOT NULL,
        new_rate REAL NOT NULL,
        total_gain_loss REAL DEFAULT 0,
        notes TEXT,
        user_name TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );
    `);
  } catch (e) {
    console.error("Error creating OmniFinance tables:", e);
  }

  // Column alterations for accounting, permissions & employee commission compatibility
  const acctAlterations = [
    ["vouchers", "bank_account_id", "INTEGER REFERENCES bank_accounts(id)"],
    ["vouchers", "cost_center_id", "INTEGER REFERENCES cost_centers(id)"],
    ["journal_entries", "status", "TEXT DEFAULT 'posted'"],
    ["journal_entries", "is_reversed", "INTEGER DEFAULT 0"],
    ["journal_entries", "reversal_of_id", "INTEGER REFERENCES journal_entries(id)"],
    ["journal_entries", "user_id", "INTEGER REFERENCES users(id)"],
    ["journal_entry_lines", "cost_center_id", "INTEGER REFERENCES cost_centers(id)"],
    ["expenses", "cost_center_id", "INTEGER REFERENCES cost_centers(id)"],
    ["expenses", "bank_account_id", "INTEGER REFERENCES bank_accounts(id)"],
    ["expenses", "is_recurring", "INTEGER DEFAULT 0"],
    ["expenses", "account_id", "INTEGER REFERENCES accounts(id)"],
    ["expenses", "branch_id", "INTEGER DEFAULT 1"],
    ["expenses", "employee_id", "INTEGER REFERENCES hr_employees(id)"],
    ["expenses", "attachment_url", "TEXT"],
    ["expenses", "currency", "TEXT DEFAULT 'ريال'"],
    ["expenses", "safe_id", "INTEGER REFERENCES safes(id)"],

    ["users", "perm_view", "INTEGER DEFAULT 1"],
    ["users", "perm_add", "INTEGER DEFAULT 1"],
    ["users", "perm_edit", "INTEGER DEFAULT 1"],
    ["users", "perm_delete", "INTEGER DEFAULT 1"],
    ["users", "perm_print", "INTEGER DEFAULT 1"],
    ["users", "perm_export", "INTEGER DEFAULT 1"],
    ["users", "perm_approve", "INTEGER DEFAULT 1"],
    ["users", "perm_cancel", "INTEGER DEFAULT 1"],
    ["users", "perm_refund", "INTEGER DEFAULT 1"],
    ["users", "perm_edit_prices", "INTEGER DEFAULT 1"],
    ["users", "perm_view_profits", "INTEGER DEFAULT 1"],
    ["users", "perm_view_costs", "INTEGER DEFAULT 1"],

    ["hr_employees", "branch_id", "INTEGER DEFAULT 1"],
    ["hr_employees", "job_title", "TEXT DEFAULT 'مُنسق سياحة وقاطع تذاكر'"],
    ["hr_employees", "commission_rate", "REAL DEFAULT 5.0"],
    ["hr_employees", "commission_basis", "TEXT DEFAULT 'sales_value'"],
    ["hr_employees", "sales_target", "REAL DEFAULT 50000.0"],

    ["accounts", "name_en", "TEXT"],
    ["accounts", "tax_account", "TEXT"],
    ["accounts", "currency", "TEXT DEFAULT 'YER'"],
    ["accounts", "is_parent", "INTEGER DEFAULT 0"],
    ["accounts", "stop_dealing", "INTEGER DEFAULT 0"],
    ["accounts", "auto_add", "INTEGER DEFAULT 1"],
    ["accounts", "level", "INTEGER DEFAULT 1"],
    ["accounts", "notes", "TEXT"],
    ["safes", "account_code", "TEXT"],
    ["customers", "account_code", "TEXT"]
  ];
  for (const [table, col, type] of acctAlterations) {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch {}
  }

  // Account Currencies, Safes Linkages, Customers Linkages tables
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS account_currencies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        currency_id INTEGER REFERENCES currencies(id),
        currency_code TEXT NOT NULL,
        currency_name TEXT NOT NULL,
        min_balance REAL DEFAULT 0,
        max_balance REAL DEFAULT 100000000,
        exchange_rate REAL DEFAULT 1.0,
        is_primary INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS account_safes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        safe_id INTEGER NOT NULL REFERENCES safes(id) ON DELETE CASCADE,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        UNIQUE(account_id, safe_id)
      );

      CREATE TABLE IF NOT EXISTS account_customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        UNIQUE(account_id, customer_id)
      );
    `);
  } catch (e) {
    console.error("Error creating account relational tables:", e);
  }

  // Seed default travel commissions if empty
  try {
    const commCount = (db.prepare("SELECT COUNT(*) as c FROM travel_commissions").get() as { c: number }).c;
    if (commCount === 0) {
      const insComm = db.prepare(`
        INSERT INTO travel_commissions (commission_code, commission_type, entity_name, reference_type, reference_number, currency, expected_amount, received_amount, due_amount, paid_amount, difference, status, due_date, notes, user_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insComm.run("COM-2026-001", "airline", "شركة الخطوط السعودية (Saudia)", "booking", "PNR-SDA-8821", "ريال", 1500, 1500, 0, 1200, 300, "partially_received", "2026-09-01", "عمولة تذاكر طيران رحلة دبي الجماعية", "مدير النظام");
      insComm.run("COM-2026-002", "hotel", "مجموعة فنادق أكور (Accor)", "booking", "HTL-7701", "ريال", 2200, 2000, 200, 2000, 0, "partially_received", "2026-09-15", "عمولة حجز أتلانتس النخيل دبي", "موظف الحجوزات");
      insComm.run("COM-2026-003", "supplier", "شركة الأفق للنقل السياحي", "procurement", "PI-TRV-001", "ريال", 800, 800, 0, 800, 0, "settled", "2026-08-20", "عمولة توريد باصات نقل المطار", "محاسب النظام");
      insComm.run("COM-2026-004", "employee", "أحمد باوزير (مسؤول المبيعات)", "invoice", "INV-TRV-2026-001", "ريال", 500, 0, 500, 300, 200, "pending", "2026-08-30", "عمولة مبيعات بوليصة التأمين والرحلة", "مدير الفرع");
      insComm.run("COM-2026-005", "agent", "وكالة الفريد للسفريات", "booking", "QUO-2026-001", "ريال", 1200, 1000, 200, 1000, 0, "partially_received", "2026-09-10", "عمولة تسويق برنامج شنغن فرنسا", "موظف التأشيرات");
      insComm.run("COM-2026-006", "branch", "فرع الرياض الرئيسي", "manual", "BRN-RHD-2026", "ريال", 3500, 3500, 0, 3500, 0, "settled", "2026-08-15", "عمولة الفرع عن إجمالي مبيعات الشهر", "المدير العام");
    }
  } catch (e) {
    console.error("Error seeding travel commissions:", e);
  }

  // Seed default safe transactions if empty
  try {
    const stCount = (db.prepare("SELECT COUNT(*) as c FROM safe_transactions").get() as { c: number }).c;
    if (stCount === 0) {
      const insSt = db.prepare(`
        INSERT INTO safe_transactions (transaction_number, safe_id, safe_name, date, user_name, amount, currency, statement, reference_number, operation_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insSt.run("TRX-SAF-001", 1, "الصندوق الرئيسي", "2026-08-01 08:00", "مدير النظام", 50000, "ريال", "افتتاح الصندوق المالي الرئيسي", "OPEN-001", "open");
      insSt.run("TRX-SAF-002", 1, "الصندوق الرئيسي", "2026-08-10 10:30", "الكاشير الأول", 3500, "ريال", "قبض قيمة حجز تذكرة طيران وفندق", "INV-TRV-2026-001", "receipt");
      insSt.run("TRX-SAF-003", 1, "الصندوق الرئيسي", "2026-08-12 14:15", "المحاسب", 250, "ريال", "صرف ضيافة ومطبوعات مكتبية", "EXP-1029", "expense");
      insSt.run("TRX-SAF-004", 1, "الصندوق الرئيسي", "2026-08-15 11:00", "مدير الفرع", 10000, "ريال", "تحويل نقدية إلى صندوق الفرع الثاني", "TRF-882", "transfer");
      insSt.run("TRX-SAF-005", 1, "الصندوق الرئيسي", "2026-08-18 09:00", "مدير النظام", 20000, "ريال", "إيداع تغذية حساب الصندوق من البنك", "DEP-901", "deposit");
      insSt.run("TRX-SAF-006", 1, "الصندوق الرئيسي", "2026-08-20 16:45", "مدير النظام", 5000, "ريال", "سحب نقدية إدارية", "WTH-302", "withdrawal");
      insSt.run("TRX-SAF-007", 1, "الصندوق الرئيسي", "2026-08-21 18:00", "الكاشير الأول", 50, "ريال", "تسوية فروقات جرد الوردية زيادة", "ADJ-004", "adjustment");
    }
  } catch (e) {
    console.error("Error seeding safe transactions:", e);
  }

  // Seed default bank accounts if empty
  try {
    const bankCount = (db.prepare("SELECT COUNT(*) as c FROM bank_accounts").get() as { c: number }).c;
    if (bankCount === 0) {
      db.prepare("INSERT INTO bank_accounts (bank_name, account_number, iban, balance, currency, notes) VALUES (?, ?, ?, ?, ?, ?)")
        .run("البنك الأهلي - الحساب الرئيسي", "1029384756", "SA03800000001029384756", 4200000, "ريال", "الحساب البنكي الأول لتحويلات الكروت والشبكة");
      db.prepare("INSERT INTO bank_accounts (bank_name, account_number, iban, balance, currency, notes) VALUES (?, ?, ?, ?, ?, ?)")
        .run("بنك الراجحي - حساب المشتريات", "5049382710", "SA92800000005049382710", 1850000, "ريال", "حساب الموردين والمشتروات الذكية");
    }
  } catch (e) {}

  // Seed default cost centers if empty
  try {
    const ccCount = (db.prepare("SELECT COUNT(*) as c FROM cost_centers").get() as { c: number }).c;
    if (ccCount === 0) {
      db.prepare("INSERT INTO cost_centers (code, name, branch_id, notes) VALUES (?, ?, ?, ?)").run("CC-101", "فرع صنعاء الرئيسي", 1, "المركز الرئيسي والمطعم");
      db.prepare("INSERT INTO cost_centers (code, name, branch_id, notes) VALUES (?, ?, ?, ?)").run("CC-102", "فرع عدن - صالة الضيافة", 2, "فرع المحافظات الجنوبية");
      db.prepare("INSERT INTO cost_centers (code, name, branch_id, notes) VALUES (?, ?, ?, ?)").run("CC-201", "قسم التوصيل والسفري", 1, "إدارة أسطول الدليفري");
      db.prepare("INSERT INTO cost_centers (code, name, branch_id, notes) VALUES (?, ?, ?, ?)").run("CC-301", "المطبخ المركزي والمخبز", 1, "التجهيز والتصنيع");
    }
  } catch (e) {}

  // Seed default fiscal periods if empty
  try {
    const fpCount = (db.prepare("SELECT COUNT(*) as c FROM fiscal_periods").get() as { c: number }).c;
    if (fpCount === 0) {
      db.prepare("INSERT INTO fiscal_periods (period_code, name, start_date, end_date, status) VALUES (?, ?, ?, ?, ?)")
        .run("FY-2026", "السنة المالية 2026", "2026-01-01", "2026-12-31", "open");
      db.prepare("INSERT INTO fiscal_periods (period_code, name, start_date, end_date, status) VALUES (?, ?, ?, ?, ?)")
        .run("FY-2025", "السنة المالية 2025 (مغلقة)", "2025-01-01", "2025-12-31", "closed");
    }
  } catch (e) {}

  // Seed fixed assets if empty
  try {
    const faCount = (db.prepare("SELECT COUNT(*) as c FROM fixed_assets").get() as { c: number }).c;
    if (faCount === 0) {
      db.prepare(`
        INSERT INTO fixed_assets (asset_code, name, category, purchase_date, purchase_cost, salvage_value, useful_life_years, accumulated_depreciation, net_book_value, location, responsible_person)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run("AST-001", "فرن آلي دوار إيطالي", "أجهزة ومعدات", "2025-01-15", 1200000, 100000, 5, 220000, 980000, "المطبخ المركزي", "الشيف الرئيسي");

      db.prepare(`
        INSERT INTO fixed_assets (asset_code, name, category, purchase_date, purchase_cost, salvage_value, useful_life_years, accumulated_depreciation, net_book_value, location, responsible_person)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run("AST-002", "سيارة تويوتا هايلوكس دليفري", "وسائل نقل", "2025-06-01", 1800000, 300000, 5, 300000, 1500000, "موقف الفرع الرئيسي", "مشرف التوصيل");
    }
  } catch (e) {}

  // Seed recurring expenses if empty
  try {
    const reCount = (db.prepare("SELECT COUNT(*) as c FROM recurring_expenses").get() as { c: number }).c;
    if (reCount === 0) {
      db.prepare(`
        INSERT INTO recurring_expenses (title, category, amount, frequency, next_due_date, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run("إيجار مقر الفرع الرئيسي", "إيجار", 500000, "monthly", "2026-09-01", "استحقاق إيجار شهري لمالك العقار");

      db.prepare(`
        INSERT INTO recurring_expenses (title, category, amount, frequency, next_due_date, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run("اشتراك إنترنت فايبر ونظام السحاب", "اتصالات وإنترنت", 45000, "monthly", "2026-08-25", "الفاتورة الشهرية لخدمة الاتصال الدائم");
    }
  } catch (e) {}

  // Seed Chart of Accounts (COA) for Travel & Tourism ERP
  try {
    const accCount = (db.prepare("SELECT COUNT(*) as c FROM accounts").get() as { c: number }).c;
    if (accCount === 0) {
      const standardAccounts = [
        // Assets (10000)
        { code: "10000", name: "الأصول", type: "asset", parent_code: null },
        { code: "11000", name: "الأصول المتداولة", type: "asset", parent_code: "10000" },
        { code: "11100", name: "الصندوق الرئيسي للمؤسسة", type: "asset", parent_code: "11000" },
        { code: "11101", name: "صندوق الكاشير والمبيعات", type: "asset", parent_code: "11000" },
        { code: "11200", name: "الذمم المدينة (حسابات العملاء والمدينين)", type: "asset", parent_code: "11000" },
        { code: "11300", name: "المخزون السلعي وبضاعة المستودعات", type: "asset", parent_code: "11000" },
        
        // Liabilities (20000)
        { code: "20000", name: "الالتزامات", type: "liability", parent_code: null },
        { code: "21000", name: "الالتزامات المتداولة", type: "liability", parent_code: "20000" },
        { code: "21100", name: "الذمم الدائنة (حسابات الموردين والدائنين)", type: "liability", parent_code: "21000" },
        { code: "21200", name: "رواتب وأجور وعمولات الموظفين المستحقة", type: "liability", parent_code: "21000" },
        
        // Equity (30000)
        { code: "30000", name: "حقوق الملكية", type: "equity", parent_code: null },
        { code: "31000", name: "رأس المال المعتمد للمؤسسة", type: "equity", parent_code: "30000" },
        { code: "32000", name: "الأرباح والخسائر المبقاة", type: "equity", parent_code: "30000" },
        
        // Revenue (40000)
        { code: "40000", name: "إيرادات المبيعات والنشاط التجاري", type: "revenue", parent_code: null },
        { code: "41000", name: "إيرادات مبيعات البضائع والمنتجات (تجزئة وجملة)", type: "revenue", parent_code: "40000" },
        { code: "42000", name: "إيرادات مبيعات الفروع ونقاط البيع", type: "revenue", parent_code: "40000" },
        { code: "43000", name: "إيرادات الخدمات التجارية والتوريدات", type: "revenue", parent_code: "40000" },
        { code: "44000", name: "إيرادات عقود التوريد والشحن والتوصيل", type: "revenue", parent_code: "40000" },
        { code: "45000", name: "إيرادات الخصومات المكتسبة والحوافز التجارية", type: "revenue", parent_code: "40000" },
        
        // Cost of Sales (50000)
        { code: "50000", name: "تكلفة البضاعة والمبيعات (COGS)", type: "cogs", parent_code: null },
        { code: "51000", name: "تكلفة البضاعة المباعة والمنتجات المباشرة", type: "cogs", parent_code: "50000" },
        { code: "52000", name: "تكلفة المشتريات والتوريدات المخزنية", type: "cogs", parent_code: "50000" },
        { code: "53000", name: "تكلفة الشحن والنقل والتخليص", type: "cogs", parent_code: "50000" },
        
        // Expenses (60000)
        { code: "60000", name: "المصروفات التشغيلية والإدارية", type: "expense", parent_code: null },
        { code: "61000", name: "المصاريف التشغيلية ومصاريف الفروع والمستودعات", type: "expense", parent_code: "60000" },
        { code: "62000", name: "مصروف التسويق والدعاية والإعلان التجاري", type: "expense", parent_code: "60000" },
        { code: "63000", name: "مصروف الرواتب والأجور وعمولات المبيعات", type: "expense", parent_code: "60000" }
      ];

      const stmt = db.prepare("INSERT INTO accounts (code, name, type, parent_code, balance) VALUES (?, ?, ?, ?, 0.0)");
      for (const acc of standardAccounts) {
        stmt.run(acc.code, acc.name, acc.type, acc.parent_code);
      }
    }
  } catch (e) {
    console.error("Error seeding chart of accounts:", e);
  }

  // Seed default subaccounts for 11200 and 21100 if none exist
  try {
    const hasSub11200 = db.prepare("SELECT COUNT(*) as c FROM accounts WHERE parent_code = '11200'").get() as any;
    if (hasSub11200 && hasSub11200.c === 0) {
      const stmt = db.prepare("INSERT INTO accounts (code, name, type, parent_code, balance, active) VALUES (?, ?, ?, ?, 0.0, 1)");
      stmt.run("11201", "حساب العملاء المباشرين للمكتب (عملاء مباشرين)", "asset", "11200");
      stmt.run("11202", "حساب عملاء الشركات والجهات السياحية", "asset", "11200");
    }
    const hasSub21100 = db.prepare("SELECT COUNT(*) as c FROM accounts WHERE parent_code = '21100'").get() as any;
    if (hasSub21100 && hasSub21100.c === 0) {
      const stmt = db.prepare("INSERT INTO accounts (code, name, type, parent_code, balance, active) VALUES (?, ?, ?, ?, 0.0, 1)");
      stmt.run("21101", "حساب المكاتب والوكالات الوسيطة الشريكة", "liability", "21100");
      stmt.run("21102", "حساب موردي ووسطاء الخدمات السياحية", "liability", "21100");
    }
  } catch (e) {
    console.error("Error seeding default sub-accounts for 11200 and 21100:", e);
  }

  try {
    db.exec("ALTER TABLE accounts ADD COLUMN opening_debit REAL DEFAULT 0.0");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE accounts ADD COLUMN opening_credit REAL DEFAULT 0.0");
  } catch (e) {}

  // Create views for compatibility with reports and queries
  try {
    db.exec(`
      CREATE VIEW IF NOT EXISTS cashier_shifts AS
      SELECT id, user_id, user_name, start_time, end_time, starting_cash, cash_sales, card_sales, withdrawals, deposits, actual_cash, difference as variance, status
      FROM cash_shifts;
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE VIEW IF NOT EXISTS waste_records AS
      SELECT id, waste_number, warehouse_name, product_name, product_id, quantity, unit, unit_cost as cost, total_cost, reason, notes, created_at as waste_date, user_id, status
      FROM stock_waste_records;
    `);
  } catch (e) {}

  // Preserve user-configured settings; only seed defaults if keys do not exist
  try {
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('businessName', 'مؤسسة أومني سيستم للتجارة والمبيعات (Omni System Pro ERP)')").run();
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('receiptMessage', 'شكراً لتعاملكم معنا - يسعدنا خدمتكم دائماً')").run();
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('masterCopiesCount', '1')").run();
  } catch {}
}

function seedData() {
  const userCount = (db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number }).c;
  if (userCount > 0) return;

  const adminHash = hashPassword("admin123");
  const cashierHash = hashPassword("cashier123");
  const devHash = hashPassword("dev123");

  db.prepare(`INSERT INTO users (username, password_hash, name, role, active) VALUES (?,?,?,?,1)`)
    .run("developer", devHash, "مطور النظام", "developer");
  db.prepare(`INSERT INTO users (username, password_hash, name, role, active) VALUES (?,?,?,?,1)`)
    .run("admin", adminHash, "مدير النظام السياحي", "admin");
  db.prepare(`INSERT INTO users (username, password_hash, name, role, active) VALUES (?,?,?,?,1)`)
    .run("cashier", cashierHash, "مسؤول الحجوزات والمبيعات", "cashier");

  const categories = [
    { name: "تذاكر الطيران", color: "#0284c7" },
    { name: "حجوزات الفنادق", color: "#6366f1" },
    { name: "التأشيرات والدخوليات", color: "#10b981" },
    { name: "البرامج والباقات السياحية", color: "#f59e0b" },
    { name: "النقل واللوجستيات", color: "#8b5cf6" },
    { name: "تأمين السفر", color: "#ec4899" }
  ];
  const insertCat = db.prepare("INSERT INTO categories (name, color) VALUES (?,?)");
  const catIds: number[] = [];
  for (const cat of categories) {
    const r = insertCat.run(cat.name, cat.color);
    catIds.push(r.lastInsertRowid as number);
  }

  const products = [
    { number: 1, name: "تذكرة طيران دولية (International Flight)", price: 2500, cost: 2200, category_id: catIds[0], is_sellable: 1, show_in_pos: 1, item_type: "sellable", stock: 999, unit: "تذكرة" },
    { number: 2, name: "تذكرة طيران داخلية (Domestic Flight)", price: 800, cost: 700, category_id: catIds[0], is_sellable: 1, show_in_pos: 1, item_type: "sellable", stock: 999, unit: "تذكرة" },
    { number: 3, name: "حجز فندق 5 نجوم (ليلة واحدة)", price: 1200, cost: 950, category_id: catIds[1], is_sellable: 1, show_in_pos: 1, item_type: "sellable", stock: 999, unit: "ليلة" },
    { number: 4, name: "حجز فندق 4 نجوم (ليلة واحدة)", price: 650, cost: 500, category_id: catIds[1], is_sellable: 1, show_in_pos: 1, item_type: "sellable", stock: 999, unit: "ليلة" },
    { number: 5, name: "إصدار تأشيرة سياحية شنغن (Schengen Visa)", price: 850, cost: 600, category_id: catIds[2], is_sellable: 1, show_in_pos: 1, item_type: "sellable", stock: 999, unit: "معاملة" },
    { number: 6, name: "تأشيرة دخول إلكترونية (E-Visa)", price: 450, cost: 300, category_id: catIds[2], is_sellable: 1, show_in_pos: 1, item_type: "sellable", stock: 999, unit: "معاملة" },
    { number: 7, name: "برنامج سياحي شامل دبي 5 أيام VIP", price: 4800, cost: 3900, category_id: catIds[3], is_sellable: 1, show_in_pos: 1, item_type: "composite", stock: 100, unit: "باقة" },
    { number: 8, name: "خدمة استقبال وتوصيل مطار VIP", price: 350, cost: 250, category_id: catIds[4], is_sellable: 1, show_in_pos: 1, item_type: "sellable", stock: 999, unit: "رحلة" },
    { number: 9, name: "وثيقة تأمين سفر دولي شامل", price: 300, cost: 180, category_id: catIds[5], is_sellable: 1, show_in_pos: 1, item_type: "sellable", stock: 999, unit: "بوليصة" },
    { number: 10, name: "رسوم تعديل وإعادة إصدار تذكرة", price: 200, cost: 100, category_id: catIds[0], is_sellable: 1, show_in_pos: 1, item_type: "sellable", stock: 999, unit: "خدمة" }
  ];

  const insertProd = db.prepare(
    "INSERT INTO products (number, name, price, cost, category_id, active, is_sellable, show_in_pos, item_type, stock, unit) VALUES (?,?,?,?,?,1,?,?,?,?,?)"
  );
  for (const p of products) {
    insertProd.run(p.number, p.name, p.price, p.cost, p.category_id, p.is_sellable, p.show_in_pos, p.item_type, p.stock, p.unit ?? "خدمة");
  }

  const defaultSettings: [string, string][] = [
    ["businessName", "مؤسسة أومني سيستم للتجارة والمبيعات (Omni System Pro ERP)"],
    ["address", "الرياض، المملكة العربية السعودية - طريق الملك فهد"],
    ["phone", "0501234567"],
    ["taxNumber", "300000000000003"],
    ["taxRate", "15"],
    ["currency", "ريال"],
    ["receiptMessage", "شكراً لتعاملكم معنا في مؤسسة أومني سيستم - يسعدنا خدمتكم دائماً"],
    ["printLogo", "true"],
    ["printQr", "false"],
    ["showCashier", "true"],
    ["showCustomer", "true"],
    ["receiptPaperSize", "A4"],
    ["showOrderNumber", "true"],
    ["showTableNumber", "false"],
    ["showDateTime", "true"],
    ["showBarcode", "false"],
    ["showOrderType", "true"],
    ["showTax", "true"],
    ["showDiscount", "true"],
    ["showNotes", "true"],
    ["autoPrintTrigger", "after_payment"],
    ["maxReprintCount", "3"],
    ["masterCopiesCount", "1"],
    ["logoUrl", ""],
  ];
  const insertSetting = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?,?)");
  for (const [key, value] of defaultSettings) {
    insertSetting.run(key, value);
  }

  // Seed sample travel suppliers if empty
  const suppCount = (db.prepare("SELECT count(*) as c FROM suppliers").get() as any)?.c || 0;
  if (suppCount === 0) {
    const insertSupp = db.prepare(`
      INSERT INTO suppliers (name, contact_person, phone, email, tax_number, commercial_register, address, payment_terms, bank_name, bank_account, rating, balance, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertSupp.run("الخطوط الجوية العربية السعودية (Saudia)", "قسم مبيعات الوكالات", "0112223344", "agents@saudia.com", "300123456700003", "1010554433", "الرياض - المطار القديم", "15 يوم", "مصرف الراجحي", "SA4480000123608010123456", 5, 0, "الناقل الوطني الرئيسي وتوريد حجوزات التذاكر");
    insertSupp.run("مجموعة فنادق أكور العالمية (Accor Hotels)", "أحمد المهيدب", "0119988776", "reservations@accor-hotels.com", "300765432100003", "1010667788", "الرياض - العليا", "30 يوم", "البنك الأهلي السعودي", "SA2210000045608010654321", 5, 0, "مورد رئيسي لغرف وأجنحة الفنادق الفاخرة");
    insertSupp.run("شركة الأفق للنقل السياحي والليموزين", "فهد المنصور", "0543322110", "transfers@alofooq-transport.sa", "300998811200003", "1010332211", "جدة - طريق الملك عبد العزيز", "نقداً عند التنفيذ", "بنك الرياض", "SA8820000078908010987654", 5, 0, "خدمات الاستقبال من المطارات والنقل الفاخر");
  }

  // Seed receipt copy configs
  const copyConfigs = [
    { copy_number: 1, label: "نسخة المسافر / العميل" },
    { copy_number: 2, label: "نسخة قسم المبيعات والحجوزات" },
    { copy_number: 3, label: "نسخة الإدارة المالية والمحاسبة" },
    { copy_number: 4, label: "نسخة الأرشيف وسجل الرحلات" },
  ];
  const insertCopy = db.prepare("INSERT OR IGNORE INTO receipt_copy_configs (copy_number, label, enabled) VALUES (?,?,?)");
  for (const c of copyConfigs) {
    insertCopy.run(c.copy_number, c.label, c.copy_number <= 2 ? 1 : 0);
  }

  // Seed department print configs
  const insertDept = db.prepare(
    "INSERT OR IGNORE INTO department_print_configs (category_id, printer_name, copies, enabled, print_order) VALUES (?,?,?,?,?)"
  );
  catIds.forEach((cid, idx) => {
    insertDept.run(cid, null, 1, 1, idx + 1);
  });

  const now = new Date();
  const adminUser = db.prepare("SELECT id FROM users WHERE username='admin'").get() as { id: number };

  const insertOrder = db.prepare(`
    INSERT INTO orders (invoice_number, subtotal, discount, tax, total, payment_method, cash_amount, user_id, created_at)
    VALUES (?,?,?,?,?,?,?,?,?)
  `);
  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total, category_id, category_name)
    VALUES (?,?,?,?,?,?,?,?)
  `);

  for (let i = 0; i < 20; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - 2 - Math.floor(i / 5));
    d.setHours(12 + (i % 5), 0, 0, 0);
    const subtotal = 20500 + i * 3000;
    const tax = Math.round(subtotal * 0.15);
    const total = subtotal + tax;
    const invNum = String((i % 5) + 1);
    const result = insertOrder.run(invNum, subtotal, 0, tax, total, "cash", total, adminUser.id, d.toISOString());
    const orderId = result.lastInsertRowid;
    insertItem.run(orderId, 1, "تذكرة طيران دولية", 2, 2500, 5000, catIds[0], "تذاكر الطيران");
    insertItem.run(orderId, 3, "حجز فندق 5 نجوم", 3, 1200, 3600, catIds[1], "حجوزات الفنادق");
  }

  // Seed Travel & Tourism initial sample data if travel_passengers is empty
  const paxCount = (db.prepare("SELECT COUNT(*) as c FROM travel_passengers").get() as { c: number }).c;
  if (paxCount === 0) {
    // Ensure sample travel customers exist
    const custInsert = db.prepare(`
      INSERT INTO customers (name, name_en, phone, alternate_phone, email, address, nationality, country, dob, gender, national_id, passport_number, passport_issue_date, passport_expiry_date, employer, notes, customer_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const c1 = custInsert.run("عبدالله محمد العتيبي", "Abdullah Al-Otaibi", "0505544332", "0501122334", "abdullah@otaibitravel.sa", "الرياض - حي العليا", "سعودي", "السعودية", "1985-06-15", "ذكر", "1088776655", "A12345678", "2021-01-10", "2031-01-09", "شركة أرامكو", "عميل VIP دائم - يفضل المقاعد الأمامية في الرحلات", "vip");
    const c2 = custInsert.run("شركة الأفق للاستشارات والهندسة", "Horizon Consulting Co.", "0114567890", "0554433221", "travel@horizon-eng.com", "جدة - طريق الملك عبد العزيز", "سعودي", "السعودية", "", "شركة", "7001234567", "", "", "", "شركة استشارات", "حساب شركة آجل - تسوية شهرية", "corporate");
    const c3 = custInsert.run("فاطمة علي الزهراني", "Fatima Al-Zahrani", "0567788990", "0509988776", "fatima.zahrani@gmail.com", "الدمام - الشاطئ", "سعودية", "السعودية", "1992-11-20", "أنثى", "1099887766", "B98765432", "2022-05-14", "2027-02-10", "وزارة التعليم", "تحتاج تأشيرة شنغن وتذاكر طيران إلى فرنسا", "debtor");

    const custId1 = Number(c1.lastInsertRowid);
    const custId2 = Number(c2.lastInsertRowid);
    const custId3 = Number(c3.lastInsertRowid);

    // Insert Passengers (Decoupled concept)
    const paxInsert = db.prepare(`
      INSERT INTO travel_passengers (customer_id, name_ar, name_en, title, dob, gender, nationality, passport_number, passport_issue_date, passport_expiry_date, passport_issue_place, passport_type, national_id, phone, email, special_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const p1 = paxInsert.run(custId1, "عبدالله محمد العتيبي", "Abdullah Mohammed Al-Otaibi", "Mr", "1985-06-15", "ذكر", "سعودي", "A12345678", "2021-01-10", "2031-01-09", "الرياض", "عادي", "1088776655", "0505544332", "abdullah@otaibitravel.sa", "وجبة خالية من الغلوتين / نافذة");
    const p2 = paxInsert.run(custId1, "سارة عبدالله العتيبي", "Sarah Abdullah Al-Otaibi", "Mrs", "1988-09-12", "أنثى", "سعودية", "A87654321", "2022-03-01", "2032-02-28", "الرياض", "عادي", "1088776656", "0505544332", "sarah@gmail.com", "مقعد بجانب الزوج");
    const p3 = paxInsert.run(custId2, "د. طارق محمود السيد", "Dr. Tarek Mahmoud El-Sayed", "Mr", "1978-04-05", "ذكر", "مصري", "P99887711", "2020-08-15", "2027-01-15", "القاهرة", "عادي", "27804051234", "0554433221", "tarek@horizon-eng.com", "درجة رجال الأعمال");
    const p4 = paxInsert.run(custId3, "فاطمة علي الزهراني", "Fatima Ali Al-Zahrani", "Ms", "1992-11-20", "أنثى", "سعودية", "B98765432", "2022-05-14", "2027-02-10", "الدمام", "عادي", "1099887766", "0567788990", "fatima.zahrani@gmail.com", "تأشيرة فرنسا / باريس");

    const paxId1 = Number(p1.lastInsertRowid);
    const paxId2 = Number(p2.lastInsertRowid);
    const paxId3 = Number(p3.lastInsertRowid);
    const paxId4 = Number(p4.lastInsertRowid);

    // Insert Travel Bookings
    const bkInsert = db.prepare(`
      INSERT INTO travel_bookings (booking_number, service_type, customer_id, passenger_id, airline_supplier, flight_number, origin_city, destination_city, departure_date, return_date, ticket_number, pnr, status, issue_date, cost_price, selling_price, commission, payment_status, payment_method, user_name, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    bkInsert.run("TKT-2026-001", "flight", custId1, paxId1, "الخطوط السعودية (Saudia)", "SV-112", "الرياض (RUH)", "دبي (DXB)", "2026-09-10", "2026-09-18", "065-2415896321", "PNR-X78Y90", "confirmed", "2026-08-20", 1200, 1500, 300, "paid", "card", "مدير النظام", "رحلة عمل ومهمة رسمية");
    bkInsert.run("TKT-2026-002", "flight", custId1, paxId2, "الخطوط السعودية (Saudia)", "SV-112", "الرياض (RUH)", "دبي (DXB)", "2026-09-10", "2026-09-18", "065-2415896322", "PNR-X78Y90", "confirmed", "2026-08-20", 1200, 1500, 300, "paid", "card", "مدير النظام", "مرافقة الزوج");
    bkInsert.run("TKT-2026-003", "flight", custId2, paxId3, "طيران الإمارات (Emirates)", "EK-814", "جدة (JED)", "القاهرة (CAI)", "2026-09-01", "2026-09-15", "176-9874123654", "PNR-E45T11", "pending_issue", "", 1800, 2200, 400, "unpaid", "credit", "موظف المبيعات", "في انتظار موافقة الإدارة وتأكيد الدفع الآجل");
    bkInsert.run("TKT-2026-004", "flight", custId3, paxId4, "الخطوط الفرنسية (Air France)", "AF-521", "الرياض (RUH)", "باريس (CDG)", "2026-09-25", "2026-10-05", "057-3322114455", "PNR-F88Q32", "issued", "2026-08-22", 3200, 3800, 600, "partial", "cash", "مدير النظام", "تم إصدار التذكرة بنجاح");

    // Insert Travel Visas
    const visaInsert = db.prepare(`
      INSERT INTO travel_visas (visa_number, customer_id, passenger_id, country, visa_type, status, application_date, expiry_date, cost_price, selling_price, missing_docs, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    visaInsert.run("VSA-9901", custId3, paxId4, "فرنسا (شنغن)", "سياحية متعدية", "under_process", "2026-08-15", "2026-08-28", 450, 650, "حساب بنكي معتمد لآخر 6 أشهر", "موعد البصمة تم حجزه يوم 25 أغسطس");
    visaInsert.run("VSA-9902", custId1, paxId1, "الإمارات", "تأشيرة مقيم خليجي", "approved", "2026-08-01", "2026-11-01", 200, 350, "", "تم الإصدار وبانتظار تسليم العميل");

    // Insert Travel Hotels
    const hotelInsert = db.prepare(`
      INSERT INTO travel_hotels (booking_ref, customer_id, passenger_id, hotel_name, city_country, check_in, check_out, room_type, nights, cost_price, selling_price, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    hotelInsert.run("HTL-7701", custId1, paxId1, "فندق أتلانتس النخيل", "دبي - الإمارات", "2026-09-10", "2026-09-18", "جناح ديلوكس مطل على البحر", 8, 8000, 9800, "confirmed", "تشمل الإفطار والاستخدام المجاني للألعاب المائية");
    hotelInsert.run("HTL-7702", custId3, paxId4, "فندق بولمان باريس إيفل", "باريس - فرنسا", "2026-09-25", "2026-10-05", "غرفة كلاسيكية مزدوجة", 10, 11000, 13500, "confirmed", "إطلالة مباشرة على برج إيفل");

    // Insert Contact Logs
    const logInsert = db.prepare(`
      INSERT INTO travel_contact_logs (customer_id, contact_type, summary, user_name)
      VALUES (?, ?, ?, ?)
    `);
    logInsert.run(custId1, "واتساب", "تم إرسال جدول الرحلة وتأكيد حجز فندق أتلانتس دبي عبر الواتساب.", "مدير النظام");
    logInsert.run(custId3, "اتصال", "تذكير العميل بضرورة إحاطة الحساب البنكي المعتمد لمركز التأشيرات قبل موعد البصمة.", "موظف المبيعات");
  }

  // Seed / ensure Umrah Pilgrims monitoring sample data exists for "محمد اليمني"
  try {
    let mohammedCust: any = db.prepare("SELECT id FROM customers WHERE name LIKE '%محمد اليمني%'").get();
    if (!mohammedCust) {
      const info = db.prepare(`
        INSERT INTO customers (name, phone, customer_type, address, balance, active)
        VALUES ('محمد اليمني', '0555123456', 'وكيل عمرة وزيارة', 'مكة المكرمة / جدة', 0, 1)
      `).run();
      mohammedCust = { id: Number(info.lastInsertRowid) };
    }

    const umrahPilgrims = [
      {
        name_ar: "علي عبدالله علي الشهابي",
        name_en: "Ali Abdullah Ali Al-Shehabi",
        passport_number: "14800339",
        visa_type: "تأشيرة عمره",
        program_duration_days: 86,
        travel_date: "2026-06-16",
        expected_exit_date: "2026-09-10",
        remaining_days: 3,
        nationality: "يمني",
        gender: "ذكر",
        travel_status: "داخل مكة"
      },
      {
        name_ar: "يوسف محمد سود الشريف",
        name_en: "Youssef Mohammed Sood Al-Sharif",
        passport_number: "10270557",
        visa_type: "تأشيرة عمره",
        program_duration_days: 85,
        travel_date: "2026-06-22",
        expected_exit_date: "2026-09-15",
        remaining_days: 8,
        nationality: "يمني",
        gender: "ذكر",
        travel_status: "داخل مكة"
      },
      {
        name_ar: "عبدالله علي صالح الشهابي",
        name_en: "Abdullah Ali Saleh Al-Shehabi",
        passport_number: "14800340",
        visa_type: "تأشيرة عمره",
        program_duration_days: 86,
        travel_date: "2026-06-16",
        expected_exit_date: "2026-09-10",
        remaining_days: 3,
        nationality: "يمني",
        gender: "ذكر",
        travel_status: "داخل مكة"
      }
    ];

    for (const p of umrahPilgrims) {
      const exists = db.prepare("SELECT id FROM travel_passengers WHERE passport_number = ? OR name_ar = ?").get(p.passport_number, p.name_ar);
      if (!exists) {
        db.prepare(`
          INSERT INTO travel_passengers (
            customer_id, name_ar, name_en, passport_number, visa_type,
            program_duration_days, travel_date, expected_exit_date, remaining_days,
            nationality, gender, travel_status, passport_type
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          mohammedCust.id, p.name_ar, p.name_en, p.passport_number, p.visa_type,
          p.program_duration_days, p.travel_date, p.expected_exit_date, p.remaining_days,
          p.nationality, p.gender, p.travel_status, 'عادي'
        );
      }
    }
  } catch (err) {
    console.warn("Umrah pilgrims sample seed note in seedData:", err);
  }
}

export function syncCustomerAccounts(): void {
  try {
    try { db.exec("ALTER TABLE customers ADD COLUMN account_code TEXT"); } catch {}

    const acc11200 = db.prepare("SELECT id FROM accounts WHERE code = '11200'").get();
    if (!acc11200) {
      db.prepare(`
        INSERT INTO accounts (code, name, type, parent_code, balance, active, is_parent, auto_add, level)
        VALUES ('11200', 'العملاء والذمم المدينة', 'asset', '11000', 0, 1, 1, 1, 2)
      `).run();
    } else {
      db.prepare(`
        UPDATE accounts 
        SET is_parent = 1, type = 'asset', parent_code = '11000' 
        WHERE code = '11200'
      `).run();
    }

    const getNextSubCodeCust = () => {
      const rows = db.prepare("SELECT code FROM accounts WHERE code LIKE '112%' AND code != '11200'").all() as { code: string }[];
      let maxNum = 11200;
      for (const r of rows) {
        const num = parseInt(r.code, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
      return String(maxNum + 1);
    };

    const customersList = db.prepare("SELECT * FROM customers").all() as any[];
    for (const cust of customersList) {
      // PREVENT employee customer account creation & delete rogue employee customers
      const isEmployee = db.prepare("SELECT id FROM hr_employees WHERE TRIM(name) = TRIM(?)").get(cust.name) as any;
      if (isEmployee) {
        try {
          db.prepare("DELETE FROM customers WHERE id = ?").run(cust.id);
        } catch {}
        continue;
      }

      // RULE: Customers affiliated with an intermediary agency/office MUST NOT have a separate account created in chart of accounts!
      const isIndirect = cust.affiliation_type === 'agency' || 
                         cust.affiliation_type === 'indirect' || 
                         cust.customer_type === 'indirect' || 
                         cust.customer_type === 'agent_customer' || 
                         cust.customer_type === 'sub_customer' || 
                         (cust.affiliation_type !== 'direct' && (
                           (cust.office_id != null && Number(cust.office_id) > 1) || 
                           (cust.partner_office_id != null && Number(cust.partner_office_id) > 1) || 
                           (cust.office_name && String(cust.office_name).trim() !== '' && !String(cust.office_name).includes('الرئيسي') && !String(cust.office_name).includes('مباشر'))
                         ));

      if (isIndirect) {
        let officeAcc = null;
        const offId = cust.office_id || cust.partner_office_id;
        if (offId) {
          const off = db.prepare("SELECT account_code, name FROM travel_partner_offices WHERE id = ?").get(offId) as any;
          if (off) {
            if (off.account_code && (off.account_code.startsWith("112") || !off.account_code.startsWith("211"))) {
              officeAcc = off.account_code;
            } else {
              const code = getNextSubCodeCust();
              db.prepare(`
                INSERT INTO accounts (code, name, type, parent_code, balance, active, is_parent, auto_add, level)
                VALUES (?, ?, 'asset', '11200', 0, 1, 0, 1, 3)
              `).run(code, off.name || `مكتب وسيط #${offId}`);
              db.prepare("UPDATE travel_partner_offices SET account_code = ? WHERE id = ?").run(code, offId);
              officeAcc = code;
            }
          }
        }
        if (!officeAcc && cust.office_name) {
          const offByName = db.prepare("SELECT account_code, id FROM travel_partner_offices WHERE name = ?").get(cust.office_name) as any;
          if (offByName?.account_code) {
            officeAcc = offByName.account_code;
          }
        }
        if (!officeAcc) {
          officeAcc = "11200";
        }

        // Clean up any old individual account previously assigned to this customer
        const oldCode = cust.account_code;
        if (oldCode && oldCode !== officeAcc) {
          try {
            db.prepare("UPDATE journal_entry_lines SET account_code = ? WHERE account_code = ?").run(officeAcc, oldCode);
            if (oldCode !== "11200" && oldCode !== "21100" && oldCode !== "21101") {
              db.prepare("DELETE FROM accounts WHERE code = ?").run(oldCode);
            }
          } catch {}
        }

        // Clean up any rogue personal accounts created anywhere matching this customer's name
        try {
          const rogueAccounts = db.prepare("SELECT code FROM accounts WHERE TRIM(name) = ?").all(String(cust.name || '').trim()) as any[];
          for (const rogue of rogueAccounts) {
            if (rogue.code !== officeAcc) {
              db.prepare("UPDATE journal_entry_lines SET account_code = ? WHERE account_code = ?").run(officeAcc, rogue.code);
              if (rogue.code !== "11200" && rogue.code !== "21100" && rogue.code !== "21101") {
                db.prepare("DELETE FROM accounts WHERE code = ?").run(rogue.code);
              }
            }
          }
        } catch {}

        // Remove from account_customers link table
        try {
          db.prepare("DELETE FROM account_customers WHERE customer_id = ?").run(cust.id);
        } catch {}

        if (cust.account_code !== officeAcc) {
          db.prepare("UPDATE customers SET account_code = ? WHERE id = ?").run(officeAcc, cust.id);
        }
        continue;
      }

      // Direct customers (تابع للمركز الرئيسي / الفرع مباشرة)
      // Link each direct customer to their dedicated sub-account under 11400 (ذمم العملاء والمدينين التجاريين)
      try {
        const subCode = getCustomerSubAccountCode(db as any, cust.id, cust.name);
        if (subCode && cust.account_code !== subCode) {
          db.prepare("UPDATE customers SET account_code = ? WHERE id = ?").run(subCode, cust.id);
        }
      } catch {
        let code = cust.account_code;
        let existingAcc = (code && code !== "11200" && code !== "11400") ? db.prepare("SELECT * FROM accounts WHERE code = ?").get(code) as any : null;
        if (!existingAcc) {
          const accByName = db.prepare("SELECT * FROM accounts WHERE (parent_code = '11400' OR parent_code = '11200') AND TRIM(name) = ?").get(String(cust.name || "").trim()) as any;
          if (accByName) {
            code = accByName.code;
          } else {
            code = getNextSubCodeCust();
            db.prepare(`
              INSERT INTO accounts (code, name, type, parent_code, balance, active, is_parent, auto_add, level)
              VALUES (?, ?, 'asset', '11200', ?, 1, 0, 1, 3)
            `).run(code, cust.name, Number(cust.balance || 0));
          }
          db.prepare("UPDATE customers SET account_code = ? WHERE id = ?").run(code, cust.id);
        }
      }
    }

    // Migrate any remaining travel/tourism partner office names in travel_partner_offices, customers, and accounts to commercial/sales names
    try {
      db.exec(`
        UPDATE travel_partner_offices
        SET name = 'مؤسسة القابلي للتجارة والتوزيع',
            name_en = 'Al-Qabili Trading & Distribution',
            notes = 'موزع ووكيل مبيعات معتمد'
        WHERE name LIKE '%القابلي للسفريات%' OR name LIKE '%للسفريات والسياحة%';

        UPDATE travel_partner_offices
        SET name = REPLACE(REPLACE(REPLACE(name, 'للسفريات والسياحة', 'للتجارة والتوزيع'), 'للسفريات', 'للتجارة والتوزيع'), 'للسياحة', 'للتوريدات التجارية'),
            notes = REPLACE(COALESCE(notes, ''), 'وكيل سفر', 'وكيل مبيعات وتوزيع')
        WHERE name LIKE '%سفريات%' OR name LIKE '%سياح%' OR notes LIKE '%سفر%';

        UPDATE customers
        SET office_name = 'مؤسسة القابلي للتجارة والتوزيع'
        WHERE office_name LIKE '%القابلي للسفريات%';

        UPDATE customers
        SET office_name = 'المركز الرئيسي - الإدارة العامة للمبيعات'
        WHERE office_name IS NULL OR office_name = '' OR office_name LIKE '%المكتب الرئيسي%';

        UPDATE accounts SET name = 'مؤسسة النخبة للتجارة والتوزيع - فرع عدن' WHERE name LIKE '%النخبة للسفريات%';
        UPDATE accounts SET name = 'شركة الصقر الذهبي للتوريدات التجارية' WHERE name LIKE '%الصقر الذهبي للسياحة%';
        UPDATE accounts SET name = 'مؤسسة الأفق العالمي للتجارة والمبيعات' WHERE name LIKE '%الأفق العالمي للطيران%';
        UPDATE accounts SET name = 'فرع المكلا للتجارة والتوزيع' WHERE name LIKE '%المكلا للخدمات السياحية%';
        UPDATE accounts SET name = 'مؤسسة القابلي للتجارة والتوزيع' WHERE name LIKE '%القابلي للسفريات%';

        UPDATE warehouse_sales_invoice_items
        SET item_code = 'PRD-101', barcode = '6281000101', item_name = 'أرز بسمتي هندي درجة أولى (كيس 10 كجم)', unit = 'كيس'
        WHERE item_code = 'TRV-101' OR item_name LIKE '%تذكرة طيران دولية%';

        UPDATE warehouse_sales_invoice_items
        SET item_code = 'PRD-107', barcode = '6281000107', item_name = 'جهاز قارئ باركود ليزر لاسلكي احترافي', unit = 'حبة'
        WHERE item_code = 'TRV-102' OR item_name LIKE '%خدمة استخراج تأشيرة%';

        UPDATE warehouse_sales_invoice_items
        SET item_code = 'PRD-102', barcode = '6281000102', item_name = 'زيت طبخ نباتي صافي (كرتون 6 عبوات)', unit = 'كرتون'
        WHERE item_code = 'TRV-205' OR item_name LIKE '%حجز فندقي 5 نجوم%';
      `);
    } catch {}

    try { runErpAccountingSync(db as any); } catch {}
  } catch (err) {
    console.error("Error in syncCustomerAccounts:", err);
  }
}

export function syncSupplierAccounts(): void {
  try {
    try { db.exec("ALTER TABLE suppliers ADD COLUMN account_code TEXT"); } catch {}
    try { db.exec("ALTER TABLE travel_suppliers ADD COLUMN account_code TEXT"); } catch {}
    try { db.exec("ALTER TABLE travel_transport_companies ADD COLUMN account_code TEXT"); } catch {}
    try { db.exec("ALTER TABLE travel_hotels_db ADD COLUMN account_code TEXT"); } catch {}
    try { db.exec("ALTER TABLE travel_partner_offices ADD COLUMN account_code TEXT"); } catch {}

    const acc21100 = db.prepare("SELECT id FROM accounts WHERE code = '21100'").get();
    if (!acc21100) {
      db.prepare(`
        INSERT INTO accounts (code, name, type, parent_code, balance, active, is_parent, auto_add, level)
        VALUES ('21100', 'الذمم الدائنة (حسابات الموردين والدائنين)', 'liability', '21000', 0, 1, 1, 1, 2)
      `).run();
    } else {
      db.prepare(`
        UPDATE accounts 
        SET is_parent = 1, type = 'liability', parent_code = '21000' 
        WHERE code = '21100'
      `).run();
    }

    const getNextSubCode = () => {
      const rows = db.prepare("SELECT code FROM accounts WHERE code LIKE '211%' AND code != '21100'").all() as { code: string }[];
      let maxNum = 21100;
      for (const r of rows) {
        const num = parseInt(r.code, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
      return String(maxNum + 1);
    };

    // 1. Suppliers
    const suppliers = db.prepare("SELECT * FROM suppliers").all() as any[];
    for (const supp of suppliers) {
      const sName = supp.name || (`مورد #${supp.id}`);
      let code = supp.account_code;
      let existingAcc = code ? db.prepare("SELECT * FROM accounts WHERE code = ?").get(code) as any : null;

      if (!existingAcc) {
        const accByName = db.prepare("SELECT * FROM accounts WHERE parent_code = '21100' AND name = ?").get(sName) as any;
        if (accByName) {
          code = accByName.code;
        } else {
          code = getNextSubCode();
          db.prepare(`
            INSERT INTO accounts (code, name, type, parent_code, balance, active, is_parent, auto_add, level)
            VALUES (?, ?, 'liability', '21100', ?, 1, 0, 1, 3)
          `).run(code, sName, Number(supp.balance || 0));
        }
        db.prepare("UPDATE suppliers SET account_code = ? WHERE id = ?").run(code, supp.id);
      } else {
        if (existingAcc.name !== sName) {
          db.prepare("UPDATE accounts SET name = ? WHERE code = ?").run(sName, code);
        }
      }
    }

    // 2. Travel Suppliers
    const travelSuppliers = db.prepare("SELECT * FROM travel_suppliers").all() as any[];
    for (const ts of travelSuppliers) {
      const tsName = ts.name || (`مورد سفر #${ts.id}`);
      let code = ts.account_code;
      let existingAcc = code ? db.prepare("SELECT * FROM accounts WHERE code = ?").get(code) as any : null;

      if (!existingAcc) {
        const accByName = db.prepare("SELECT * FROM accounts WHERE parent_code = '21100' AND name = ?").get(tsName) as any;
        if (accByName) {
          code = accByName.code;
        } else {
          code = getNextSubCode();
          db.prepare(`
            INSERT INTO accounts (code, name, type, parent_code, balance, active, is_parent, auto_add, level)
            VALUES (?, ?, 'liability', '21100', ?, 1, 0, 1, 3)
          `).run(code, tsName, Number(ts.current_balance || 0));
        }
        db.prepare("UPDATE travel_suppliers SET account_code = ? WHERE id = ?").run(code, ts.id);
      } else {
        if (existingAcc.name !== tsName) {
          db.prepare("UPDATE accounts SET name = ? WHERE code = ?").run(tsName, code);
        }
      }
    }

    // 3. Transport Companies
    try {
      const transportCompanies = db.prepare("SELECT * FROM travel_transport_companies").all() as any[];
      for (const tc of transportCompanies) {
        const tcName = tc.company_name || tc.name || (`شركة نقل بري #${tc.id}`);
        let code = tc.account_code;
        let existingAcc = code ? db.prepare("SELECT * FROM accounts WHERE code = ?").get(code) as any : null;

        if (!existingAcc) {
          const accByName = db.prepare("SELECT * FROM accounts WHERE parent_code = '21100' AND name = ?").get(tcName) as any;
          if (accByName) {
            code = accByName.code;
          } else {
            code = getNextSubCode();
            db.prepare(`
              INSERT INTO accounts (code, name, type, parent_code, balance, active, is_parent, auto_add, level)
              VALUES (?, ?, 'liability', '21100', 0, 1, 0, 1, 3)
            `).run(code, tcName);
          }
          db.prepare("UPDATE travel_transport_companies SET account_code = ? WHERE id = ?").run(code, tc.id);
        } else {
          if (existingAcc.name !== tcName) {
            db.prepare("UPDATE accounts SET name = ? WHERE code = ?").run(tcName, code);
          }
        }
      }
    } catch (e) {
      console.error("Error syncing travel_transport_companies:", e);
    }

    // 4. Hotels DB
    try {
      const hotelsList = db.prepare("SELECT * FROM travel_hotels_db").all() as any[];
      for (const h of hotelsList) {
        const hName = (h.name_ar || h.name || h.name_en || "").trim() || (`فندق #${h.id}`);
        let code = h.account_code;
        let existingAcc = code ? db.prepare("SELECT * FROM accounts WHERE code = ?").get(code) as any : null;

        if (!existingAcc) {
          const accByName = db.prepare("SELECT * FROM accounts WHERE parent_code = '21100' AND name = ?").get(hName) as any;
          if (accByName) {
            code = accByName.code;
          } else {
            code = getNextSubCode();
            db.prepare(`
              INSERT INTO accounts (code, name, type, parent_code, balance, active, is_parent, auto_add, level)
              VALUES (?, ?, 'liability', '21100', 0, 1, 0, 1, 3)
            `).run(code, hName);
          }
          db.prepare("UPDATE travel_hotels_db SET account_code = ? WHERE id = ?").run(code, h.id);
        } else {
          if (existingAcc.name !== hName) {
            db.prepare("UPDATE accounts SET name = ? WHERE code = ?").run(hName, code);
          }
        }
      }
    } catch (e) {
      console.error("Error syncing travel_hotels_db:", e);
    }
    try {
      db.exec(`UPDATE accounts SET name = (SELECT name_ar FROM travel_hotels_db WHERE travel_hotels_db.account_code = accounts.code) WHERE parent_code = '21100' AND code IN (SELECT account_code FROM travel_hotels_db WHERE name_ar IS NOT NULL AND name_ar != '')`);
    } catch (e) {}

    // 5. Partner Offices (ذمم مدينة - أصول متداولة تحت 11200)
    try {
      const getNextSubCode112 = () => {
        const rows = db.prepare("SELECT code FROM accounts WHERE code LIKE '112%' AND code != '11200'").all() as { code: string }[];
        let maxNum = 11200;
        for (const r of rows) {
          const num = parseInt(r.code, 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
        let cand = maxNum + 1;
        while (db.prepare("SELECT id FROM accounts WHERE code = ?").get(String(cand))) {
          cand++;
        }
        return String(cand);
      };

      const partnerOffices = db.prepare("SELECT * FROM travel_partner_offices").all() as any[];
      for (const po of partnerOffices) {
        const poName = po.name || po.office_name || (`مكتب شركاء #${po.id}`);
        let code = po.account_code;
        
        // If code is under 21100 or starts with 211, migrate it to 11200
        if (code && (code.startsWith("211") || code === "21100")) {
          const oldCode = code;
          const newCode = getNextSubCode112();
          try {
            db.prepare(`
              INSERT INTO accounts (code, name, type, parent_code, balance, active, is_parent, auto_add, level)
              VALUES (?, ?, 'asset', '11200', 0, 1, 0, 1, 3)
            `).run(newCode, poName);
            db.prepare("UPDATE journal_entry_lines SET account_code = ? WHERE account_code = ?").run(newCode, oldCode);
            try {
              db.prepare("DELETE FROM accounts WHERE code = ?").run(oldCode);
            } catch {
              try { db.prepare("UPDATE accounts SET active = 0 WHERE code = ?").run(oldCode); } catch {}
            }
          } catch (mErr) {
            console.error("Migration of partner office account error:", mErr);
          }
          db.prepare("UPDATE travel_partner_offices SET account_code = ? WHERE id = ?").run(newCode, po.id);
          db.prepare("UPDATE customers SET account_code = ? WHERE office_id = ? AND affiliation_type = 'agency'").run(newCode, po.id);
          code = newCode;
        }

        let existingAcc = code ? db.prepare("SELECT * FROM accounts WHERE code = ?").get(code) as any : null;

        if (!existingAcc) {
          const accByName = db.prepare("SELECT * FROM accounts WHERE parent_code = '11200' AND name = ?").get(poName) as any;
          if (accByName) {
            code = accByName.code;
          } else {
            code = getNextSubCode112();
            db.prepare(`
              INSERT INTO accounts (code, name, type, parent_code, balance, active, is_parent, auto_add, level)
              VALUES (?, ?, 'asset', '11200', 0, 1, 0, 1, 3)
            `).run(code, poName);
          }
          db.prepare("UPDATE travel_partner_offices SET account_code = ? WHERE id = ?").run(code, po.id);
        } else {
          if (existingAcc.name !== poName) {
            db.prepare("UPDATE accounts SET name = ? WHERE code = ?").run(poName, code);
          }
          if (existingAcc.parent_code !== '11200' || existingAcc.type !== 'asset') {
            db.prepare("UPDATE accounts SET parent_code = '11200', type = 'asset' WHERE code = ?").run(code);
          }
        }
      }
    } catch (e) {
      console.error("Error syncing travel_partner_offices:", e);
    }

    // Also sync customer accounts
    syncCustomerAccounts();
    runErpAccountingSync(db as any);
  } catch (err) {
    console.error("Error in syncSupplierAccounts:", err);
  }
}

export function ensureDefaultAccountingChart(): void {
  try {
    const requiredAccounts = [
      { code: '11100', name: 'الصندوق الرئيسي للمؤسسة', type: 'asset', parent_code: '11000' },
      { code: '11120', name: 'البنوك والمصارف بالحسابات الجارية', type: 'asset', parent_code: '11000' },
      { code: '11200', name: 'الذمم المدينة (حسابات العملاء والمدينين)', type: 'asset', parent_code: '11000', is_parent: 1 },
      { code: '21100', name: 'الذمم الدائنة (حسابات الموردين والدائنين)', type: 'liability', parent_code: '21000', is_parent: 1 },
      { code: '41001', name: 'إيرادات مبيعات البضائع والمنتجات (تجزئة وجملة)', type: 'revenue', parent_code: '41000' },
      { code: '42001', name: 'إيرادات مبيعات الفروع ونقاط البيع', type: 'revenue', parent_code: '42000' },
      { code: '43001', name: 'إيرادات الخدمات التجارية والتوريدات', type: 'revenue', parent_code: '43000' },
      { code: '44001', name: 'إيرادات عقود التوريد والشحن والتوصيل', type: 'revenue', parent_code: '44000' },
      { code: '45000', name: 'إيرادات الخصومات المكتسبة والحوافز التجارية', type: 'revenue', parent_code: '40000' },
      { code: '41020', name: 'مردودات ومسموحات المبيعات', type: 'revenue', parent_code: '41000' },
      { code: '51000', name: 'تكلفة البضاعة المباعة والمنتجات المباشرة', type: 'cogs', parent_code: '50000' },
      { code: '52000', name: 'تكلفة المشتريات والتوريدات المخزنية', type: 'cogs', parent_code: '50000' },
      { code: '53000', name: 'تكلفة الشحن والنقل والتخليص', type: 'cogs', parent_code: '50000' },
      { code: '54000', name: 'تكلفة التعبئة والتغليف والمستودعات المباشرة', type: 'cogs', parent_code: '50000' },
      { code: '55000', name: 'تكلفة التأمين والمصروفات التشغيلية المباشرة', type: 'cogs', parent_code: '50000' },
    ];

    for (const acc of requiredAccounts) {
      const exists = db.prepare("SELECT id FROM accounts WHERE code = ?").get(acc.code);
      if (!exists) {
        db.prepare(`
          INSERT INTO accounts (code, name, type, parent_code, balance, active, is_parent, auto_add, level)
          VALUES (?, ?, ?, ?, 0, 1, ?, 1, 3)
        `).run(acc.code, acc.name, acc.type, acc.parent_code, acc.is_parent ? 1 : 0);
      }
    }
  } catch (err) {
    console.error("Error in ensureDefaultAccountingChart:", err);
  }
}

export function ensureUmrahPilgrimsData(): void {
  try {
    let mohammedCust: any = db.prepare("SELECT id FROM customers WHERE name LIKE '%محمد اليمني%'").get();
    if (!mohammedCust) {
      const info = db.prepare(`
        INSERT INTO customers (name, phone, address)
        VALUES ('محمد اليمني', '0555123456', 'مكة المكرمة / جدة')
      `).run();
      mohammedCust = { id: Number(info.lastInsertRowid) };
    }

    const umrahPilgrims = [
      {
        name_ar: "علي عبدالله علي الشهابي",
        name_en: "Ali Abdullah Ali Al-Shehabi",
        passport_number: "14800339",
        visa_type: "تأشيرة عمره",
        program_duration_days: 86,
        travel_date: "2026-06-16",
        expected_exit_date: "2026-09-10",
        remaining_days: 3,
        nationality: "يمني",
        gender: "ذكر",
        travel_status: "داخل مكة"
      },
      {
        name_ar: "يوسف محمد سود الشريف",
        name_en: "Youssef Mohammed Sood Al-Sharif",
        passport_number: "10270557",
        visa_type: "تأشيرة عمره",
        program_duration_days: 85,
        travel_date: "2026-06-22",
        expected_exit_date: "2026-09-15",
        remaining_days: 8,
        nationality: "يمني",
        gender: "ذكر",
        travel_status: "داخل مكة"
      },
      {
        name_ar: "عبدالله علي صالح الشهابي",
        name_en: "Abdullah Ali Saleh Al-Shehabi",
        passport_number: "14800340",
        visa_type: "تأشيرة عمره",
        program_duration_days: 86,
        travel_date: "2026-06-16",
        expected_exit_date: "2026-09-10",
        remaining_days: 3,
        nationality: "يمني",
        gender: "ذكر",
        travel_status: "داخل مكة"
      }
    ];

    for (const p of umrahPilgrims) {
      const exists = db.prepare("SELECT id FROM travel_passengers WHERE passport_number = ? OR name_ar = ?").get(p.passport_number, p.name_ar);
      if (!exists) {
        db.prepare(`
          INSERT INTO travel_passengers (
            customer_id, name_ar, name_en, passport_number, visa_type,
            program_duration_days, travel_date, expected_exit_date, remaining_days,
            nationality, gender, travel_status, passport_type
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          mohammedCust.id, p.name_ar, p.name_en, p.passport_number, p.visa_type,
          p.program_duration_days, p.travel_date, p.expected_exit_date, p.remaining_days,
          p.nationality, p.gender, p.travel_status, 'عادي'
        );
      }
    }
  } catch (err) {
    console.warn("Umrah pilgrims sample seed note in ensureUmrahPilgrimsData:", err);
  }
}

export function ensureTravelHotelsColumns() {
  try {
    const cols = (db.prepare("PRAGMA table_info(travel_hotels)").all() as any[]).map(c => c.name);
    const set = new Set(cols);
    const required: [string, string][] = [
      ["booking_ref", "TEXT"],
      ["voucher_number", "TEXT"],
      ["confirmation_number", "TEXT"],
      ["customer_id", "INTEGER"],
      ["customer_name", "TEXT"],
      ["passenger_id", "INTEGER"],
      ["guest_name", "TEXT"],
      ["guest_phone", "TEXT"],
      ["guest_passport", "TEXT"],
      ["hotel_db_id", "INTEGER"],
      ["hotel_name", "TEXT"],
      ["country", "TEXT"],
      ["city", "TEXT"],
      ["city_country", "TEXT"],
      ["check_in", "TEXT"],
      ["check_out", "TEXT"],
      ["room_type", "TEXT DEFAULT 'مزدوجة'"],
      ["nights", "INTEGER DEFAULT 1"],
      ["customer_days", "INTEGER DEFAULT 1"],
      ["supplier_days", "INTEGER DEFAULT 1"],
      ["rooms_count", "INTEGER DEFAULT 1"],
      ["guests_count", "INTEGER DEFAULT 1"],
      ["meal_plan", "TEXT DEFAULT 'إفطار شامل (Bed & Breakfast)'"],
      ["cost_price", "REAL DEFAULT 0"],
      ["selling_price", "REAL DEFAULT 0"],
      ["commission", "REAL DEFAULT 0"],
      ["profit", "REAL DEFAULT 0"],
      ["customer_currency", "TEXT DEFAULT 'SAR'"],
      ["supplier_currency", "TEXT DEFAULT 'SAR'"],
      ["commission_currency", "TEXT DEFAULT 'SAR'"],
      ["customer_statement", "TEXT"],
      ["supplier_statement", "TEXT"],
      ["commission_statement", "TEXT"],
      ["payment_method", "TEXT DEFAULT 'cash'"],
      ["payment_status", "TEXT DEFAULT 'paid'"],
      ["paid_amount", "REAL DEFAULT 0"],
      ["remaining_balance", "REAL DEFAULT 0"],
      ["supplier_payment_method", "TEXT DEFAULT 'credit'"],
      ["supplier_payment_status", "TEXT DEFAULT 'unpaid'"],
      ["supplier_paid_amount", "REAL DEFAULT 0"],
      ["supplier_remaining_balance", "REAL DEFAULT 0"],
      ["supplier_office_id", "INTEGER"],
      ["supplier_office_name", "TEXT"],
      ["supplier_id", "INTEGER"],
      ["supplier_name", "TEXT"],
      ["status", "TEXT DEFAULT 'confirmed'"],
      ["issue_date", "TEXT"],
      ["notes", "TEXT"]
    ];
    for (const [col, colType] of required) {
      if (!set.has(col)) {
        try { db.exec(`ALTER TABLE travel_hotels ADD COLUMN ${col} ${colType}`); } catch {}
      }
    }
  } catch (e) {
    console.error("ensureTravelHotelsColumns warning:", e);
  }
}

export function ensureTravelBusBookingsColumns() {
  try {
    const cols = (db.prepare("PRAGMA table_info(travel_bus_bookings)").all() as any[]).map(c => c.name);
    const set = new Set(cols);
    const required: [string, string][] = [
      ["booking_number", "TEXT"],
      ["ticket_number", "TEXT"],
      ["pnr_number", "TEXT"],
      ["trip_type", "TEXT DEFAULT 'one_way'"],
      ["bus_type", "TEXT"],
      ["bus_number", "TEXT"],
      ["seat_number", "TEXT"],
      ["customer_id", "INTEGER"],
      ["customer_name", "TEXT"],
      ["passenger_id", "INTEGER"],
      ["passenger_name", "TEXT"],
      ["passenger_phone", "TEXT"],
      ["passenger_national_id", "TEXT"],
      ["selling_price", "REAL DEFAULT 0"],
      ["customer_currency", "TEXT DEFAULT 'SAR'"],
      ["customer_statement", "TEXT"],
      ["company_id", "INTEGER"],
      ["company_name", "TEXT"],
      ["cost_price", "REAL DEFAULT 0"],
      ["supplier_currency", "TEXT DEFAULT 'SAR'"],
      ["supplier_statement", "TEXT"],
      ["agency_commission", "REAL DEFAULT 0"],
      ["commission_currency", "TEXT DEFAULT 'SAR'"],
      ["commission_statement", "TEXT"],
      ["exchange_rate", "REAL DEFAULT 1"],
      ["origin_city", "TEXT"],
      ["origin_station", "TEXT"],
      ["destination_city", "TEXT"],
      ["destination_station", "TEXT"],
      ["departure_date", "TEXT"],
      ["departure_time", "TEXT"],
      ["boarding_time", "TEXT"],
      ["arrival_date", "TEXT"],
      ["arrival_time", "TEXT"],
      ["return_departure_date", "TEXT"],
      ["luggage_weight", "REAL DEFAULT 30"],
      ["luggage_pieces", "INTEGER DEFAULT 2"],
      ["payment_method", "TEXT DEFAULT 'cash'"],
      ["payment_status", "TEXT DEFAULT 'paid'"],
      ["paid_amount", "REAL DEFAULT 0"],
      ["remaining_balance", "REAL DEFAULT 0"],
      ["supplier_payment_method", "TEXT DEFAULT 'credit'"],
      ["supplier_payment_status", "TEXT DEFAULT 'unpaid'"],
      ["supplier_paid_amount", "REAL DEFAULT 0"],
      ["supplier_remaining_balance", "REAL DEFAULT 0"],
      ["status", "TEXT DEFAULT 'confirmed'"],
      ["issue_date", "TEXT"],
      ["issued_by", "TEXT"],
      ["notes", "TEXT"]
    ];
    for (const [col, colType] of required) {
      if (!set.has(col)) {
        try { db.exec(`ALTER TABLE travel_bus_bookings ADD COLUMN ${col} ${colType}`); } catch {}
      }
    }
  } catch (e) {
    console.error("ensureTravelBusBookingsColumns warning:", e);
  }
}

export function ensureTravelVisasColumns() {
  try {
    const cols = (db.prepare("PRAGMA table_info(travel_visas)").all() as any[]).map(c => c.name);
    const set = new Set(cols);
    const required: [string, string][] = [
      ["visa_number", "TEXT"],
      ["application_number", "TEXT"],
      ["customer_id", "INTEGER"],
      ["passenger_id", "INTEGER"],
      ["country", "TEXT"],
      ["visa_type", "TEXT"],
      ["status", "TEXT DEFAULT 'under_process'"],
      ["application_date", "TEXT"],
      ["expected_travel_date", "TEXT"],
      ["expiry_date", "TEXT"],
      ["duration_days", "INTEGER DEFAULT 30"],
      ["cost_price", "REAL DEFAULT 0"],
      ["selling_price", "REAL DEFAULT 0"],
      ["office_fees", "REAL DEFAULT 0"],
      ["paid_amount", "REAL DEFAULT 0"],
      ["remaining_balance", "REAL DEFAULT 0"],
      ["responsible_employee", "TEXT"],
      ["embassy_entity", "TEXT"],
      ["supplier_agent", "TEXT"],
      ["supplier_office_id", "INTEGER"],
      ["supplier_office_name", "TEXT"],
      ["customer_currency", "TEXT DEFAULT 'SAR'"],
      ["customer_statement", "TEXT"],
      ["supplier_currency", "TEXT DEFAULT 'SAR'"],
      ["supplier_statement", "TEXT"],
      ["agency_commission", "REAL DEFAULT 0"],
      ["commission_currency", "TEXT DEFAULT 'SAR'"],
      ["exchange_rate", "REAL DEFAULT 1"],
      ["payment_method", "TEXT DEFAULT 'cash'"],
      ["payment_status", "TEXT DEFAULT 'paid'"],
      ["supplier_payment_method", "TEXT DEFAULT 'credit'"],
      ["supplier_payment_status", "TEXT DEFAULT 'unpaid'"],
      ["supplier_paid_amount", "REAL DEFAULT 0"],
      ["supplier_remaining_balance", "REAL DEFAULT 0"],
      ["issued_visa_number", "TEXT"],
      ["issue_date", "TEXT"],
      ["rejection_reason", "TEXT"],
      ["rejection_date", "TEXT"],
      ["delivered_to", "TEXT"],
      ["delivery_date", "TEXT"],
      ["delivery_method", "TEXT"],
      ["delivery_notes", "TEXT"],
      ["border_number", "TEXT"],
      ["service_voucher_no", "TEXT"],
      ["checklist_passport", "INTEGER DEFAULT 0"],
      ["checklist_photos", "INTEGER DEFAULT 0"],
      ["checklist_hotel", "INTEGER DEFAULT 0"],
      ["checklist_ticket", "INTEGER DEFAULT 0"],
      ["checklist_bank", "INTEGER DEFAULT 0"],
      ["checklist_job_letter", "INTEGER DEFAULT 0"],
      ["checklist_insurance", "INTEGER DEFAULT 0"],
      ["checklist_extra", "INTEGER DEFAULT 0"],
      ["missing_docs", "TEXT"],
      ["notes", "TEXT"]
    ];
    for (const [col, colType] of required) {
      if (!set.has(col)) {
        try { db.exec(`ALTER TABLE travel_visas ADD COLUMN ${col} ${colType}`); } catch {}
      }
    }
  } catch (e) {
    console.error("ensureTravelVisasColumns warning:", e);
  }
}

export function fixTravelForeignKeys() {
  try {
    // 1. Check travel_visas foreign keys
    const visasFks = db.prepare("PRAGMA foreign_key_list(travel_visas)").all() as any[];
    const hasVisaSuppFk = visasFks.some(fk => fk.table === 'travel_partner_offices' && fk.from === 'supplier_office_id');

    if (hasVisaSuppFk) {
      console.log("Migrating travel_visas schema to remove supplier_office_id foreign key constraint...");
      db.transaction(() => {
        db.pragma("foreign_keys = OFF");
        
        // Backup
        db.exec("ALTER TABLE travel_visas RENAME TO travel_visas_old");
        
        // Create new table
        db.exec(`
          CREATE TABLE travel_visas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            visa_number TEXT UNIQUE,
            customer_id INTEGER REFERENCES customers(id),
            passenger_id INTEGER REFERENCES travel_passengers(id),
            country TEXT NOT NULL,
            visa_type TEXT DEFAULT 'سياحية',
            status TEXT DEFAULT 'under_process',
            application_date TEXT,
            expiry_date TEXT,
            cost_price REAL DEFAULT 0,
            selling_price REAL DEFAULT 0,
            missing_docs TEXT,
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            application_number TEXT,
            expected_travel_date TEXT,
            duration_days INTEGER DEFAULT 30,
            office_fees REAL DEFAULT 0,
            paid_amount REAL DEFAULT 0,
            remaining_balance REAL DEFAULT 0,
            responsible_employee TEXT,
            embassy_entity TEXT,
            supplier_agent TEXT,
            checklist_passport INTEGER DEFAULT 0,
            checklist_photos INTEGER DEFAULT 0,
            checklist_hotel INTEGER DEFAULT 0,
            checklist_ticket INTEGER DEFAULT 0,
            checklist_bank INTEGER DEFAULT 0,
            checklist_job_letter INTEGER DEFAULT 0,
            checklist_insurance INTEGER DEFAULT 0,
            checklist_extra INTEGER DEFAULT 0,
            issued_visa_number TEXT,
            issue_date TEXT,
            rejection_reason TEXT,
            rejection_date TEXT,
            delivered_to TEXT,
            delivery_date TEXT,
            delivery_method TEXT,
            delivery_notes TEXT,
            border_number TEXT,
            service_voucher_no TEXT,
            supplier_office_id INTEGER, -- Removed references
            supplier_office_name TEXT,
            customer_currency TEXT DEFAULT 'SAR',
            customer_statement TEXT,
            supplier_currency TEXT DEFAULT 'SAR',
            supplier_statement TEXT,
            agency_commission REAL DEFAULT 0,
            commission_currency TEXT DEFAULT 'SAR',
            exchange_rate REAL DEFAULT 1,
            account_entry_id INTEGER,
            outward_date TEXT,
            batch_number TEXT,
            outward_voucher_no TEXT,
            inward_date TEXT,
            inward_note TEXT,
            inward_status TEXT,
            department TEXT DEFAULT 'عام',
            delivery_type TEXT DEFAULT 'باليد',
            payment_method TEXT DEFAULT 'cash',
            payment_status TEXT DEFAULT 'paid',
            invoice_number TEXT,
            tax_amount REAL DEFAULT 0,
            supplier_payment_method TEXT DEFAULT 'credit',
            supplier_payment_status TEXT DEFAULT 'unpaid',
            supplier_paid_amount REAL DEFAULT 0,
            supplier_remaining_balance REAL DEFAULT 0
          )
        `);

        // Copy data
        db.exec(`
          INSERT INTO travel_visas (
            id, visa_number, customer_id, passenger_id, country, visa_type, status,
            application_date, expiry_date, cost_price, selling_price, missing_docs, notes, created_at,
            application_number, expected_travel_date, duration_days, office_fees, paid_amount, remaining_balance,
            responsible_employee, embassy_entity, supplier_agent, checklist_passport, checklist_photos, checklist_hotel,
            checklist_ticket, checklist_bank, checklist_job_letter, checklist_insurance, checklist_extra,
            issued_visa_number, issue_date, rejection_reason, rejection_date, delivered_to, delivery_date,
            delivery_method, delivery_notes, border_number, service_voucher_no, supplier_office_id, supplier_office_name,
            customer_currency, customer_statement, supplier_currency, supplier_statement, agency_commission,
            commission_currency, exchange_rate, account_entry_id, outward_date, batch_number, outward_voucher_no,
            inward_date, inward_note, inward_status, department, delivery_type, payment_method, payment_status,
            invoice_number, tax_amount, supplier_payment_method, supplier_payment_status, supplier_paid_amount,
            supplier_remaining_balance
          )
          SELECT 
            id, visa_number, customer_id, passenger_id, country, visa_type, status,
            application_date, expiry_date, cost_price, selling_price, missing_docs, notes, created_at,
            application_number, expected_travel_date, duration_days, office_fees, paid_amount, remaining_balance,
            responsible_employee, embassy_entity, supplier_agent, checklist_passport, checklist_photos, checklist_hotel,
            checklist_ticket, checklist_bank, checklist_job_letter, checklist_insurance, checklist_extra,
            issued_visa_number, issue_date, rejection_reason, rejection_date, delivered_to, delivery_date,
            delivery_method, delivery_notes, border_number, service_voucher_no, supplier_office_id, supplier_office_name,
            customer_currency, customer_statement, supplier_currency, supplier_statement, agency_commission,
            commission_currency, exchange_rate, account_entry_id, outward_date, batch_number, outward_voucher_no,
            inward_date, inward_note, inward_status, department, delivery_type, payment_method, payment_status,
            invoice_number, tax_amount, supplier_payment_method, supplier_payment_status, supplier_paid_amount,
            supplier_remaining_balance
          FROM travel_visas_old
        `);

        // Drop backup
        db.exec("DROP TABLE travel_visas_old");
        db.pragma("foreign_keys = ON");
      })();
      console.log("travel_visas schema migrated successfully.");
    }

    // 2. Check travel_hotels foreign keys
    const hotelsFks = db.prepare("PRAGMA foreign_key_list(travel_hotels)").all() as any[];
    const hasHotelSuppFk = hotelsFks.some(fk => fk.table === 'travel_partner_offices' && fk.from === 'supplier_office_id');

    if (hasHotelSuppFk) {
      console.log("Migrating travel_hotels schema to remove supplier_office_id foreign key constraint...");
      db.transaction(() => {
        db.pragma("foreign_keys = OFF");
        
        // Backup
        db.exec("ALTER TABLE travel_hotels RENAME TO travel_hotels_old");
        
        // Create new table
        db.exec(`
          CREATE TABLE travel_hotels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            booking_ref TEXT UNIQUE,
            customer_id INTEGER REFERENCES customers(id),
            passenger_id INTEGER REFERENCES travel_passengers(id),
            hotel_name TEXT NOT NULL,
            city_country TEXT NOT NULL,
            check_in TEXT,
            check_out TEXT,
            room_type TEXT DEFAULT 'مزدوجة',
            nights INTEGER DEFAULT 1,
            cost_price REAL DEFAULT 0,
            selling_price REAL DEFAULT 0,
            status TEXT DEFAULT 'confirmed',
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            voucher_number TEXT,
            hotel_db_id INTEGER REFERENCES travel_hotels_db(id),
            country TEXT,
            city TEXT,
            customer_days INTEGER DEFAULT 1,
            supplier_days INTEGER DEFAULT 1,
            customer_currency TEXT DEFAULT 'SAR',
            supplier_currency TEXT DEFAULT 'SAR',
            commission_currency TEXT DEFAULT 'SAR',
            customer_statement TEXT,
            supplier_statement TEXT,
            commission_statement TEXT,
            commission REAL DEFAULT 0,
            profit REAL DEFAULT 0,
            rooms_count INTEGER DEFAULT 1,
            guests_count INTEGER DEFAULT 1,
            meal_plan TEXT DEFAULT 'إفطار شامل (Bed & Breakfast)',
            payment_method TEXT DEFAULT 'cash',
            payment_status TEXT DEFAULT 'paid',
            paid_amount REAL DEFAULT 0,
            remaining_balance REAL DEFAULT 0,
            supplier_payment_method TEXT DEFAULT 'credit',
            supplier_payment_status TEXT DEFAULT 'unpaid',
            supplier_paid_amount REAL DEFAULT 0,
            supplier_remaining_balance REAL DEFAULT 0,
            guest_name TEXT,
            guest_phone TEXT,
            guest_passport TEXT,
            confirmation_number TEXT,
            issue_date TEXT,
            customer_name TEXT,
            supplier_office_id INTEGER, -- Removed references
            supplier_office_name TEXT,
            supplier_id INTEGER,
            supplier_name TEXT
          )
        `);

        // Copy data
        db.exec(`
          INSERT INTO travel_hotels (
            id, booking_ref, customer_id, passenger_id, hotel_name, city_country, check_in, check_out,
            room_type, nights, cost_price, selling_price, status, notes, created_at,
            voucher_number, hotel_db_id, country, city, customer_days, supplier_days,
            customer_currency, supplier_currency, commission_currency, customer_statement,
            supplier_statement, commission_statement, commission, profit, rooms_count, guests_count,
            meal_plan, payment_method, payment_status, paid_amount, remaining_balance,
            supplier_payment_method, supplier_payment_status, supplier_paid_amount,
            supplier_remaining_balance, guest_name, guest_phone, guest_passport,
            confirmation_number, issue_date, customer_name, supplier_office_id,
            supplier_office_name, supplier_id, supplier_name
          )
          SELECT 
            id, booking_ref, customer_id, passenger_id, hotel_name, city_country, check_in, check_out,
            room_type, nights, cost_price, selling_price, status, notes, created_at,
            voucher_number, hotel_db_id, country, city, customer_days, supplier_days,
            customer_currency, supplier_currency, commission_currency, customer_statement,
            supplier_statement, commission_statement, commission, profit, rooms_count, guests_count,
            meal_plan, payment_method, payment_status, paid_amount, remaining_balance,
            supplier_payment_method, supplier_payment_status, supplier_paid_amount,
            supplier_remaining_balance, guest_name, guest_phone, guest_passport,
            confirmation_number, issue_date, customer_name, supplier_office_id,
            supplier_office_name, supplier_id, supplier_name
          FROM travel_hotels_old
        `);

        // Drop backup
        db.exec("DROP TABLE travel_hotels_old");
        db.pragma("foreign_keys = ON");
      })();
      console.log("travel_hotels schema migrated successfully.");
    }

    // 3. Check travel_documents foreign keys
    const docsFks = db.prepare("PRAGMA foreign_key_list(travel_documents)").all() as any[];
    const hasOldVisaFk = docsFks.some(fk => fk.table === 'travel_visas_old');
    if (hasOldVisaFk) {
      console.log("Migrating travel_documents schema to fix foreign keys...");
      db.transaction(() => {
        db.pragma("foreign_keys = OFF");
        db.exec("ALTER TABLE travel_documents RENAME TO travel_documents_old");
        db.exec(`
          CREATE TABLE travel_documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_type TEXT NOT NULL DEFAULT 'جواز السفر',
            title TEXT NOT NULL,
            file_url TEXT,
            file_name TEXT,
            file_size INTEGER DEFAULT 0,
            customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
            passenger_id INTEGER REFERENCES travel_passengers(id) ON DELETE SET NULL,
            booking_id INTEGER REFERENCES travel_bookings(id) ON DELETE SET NULL,
            visa_id INTEGER REFERENCES travel_visas(id) ON DELETE SET NULL,
            expiry_date TEXT,
            notify_before_days INTEGER DEFAULT 30,
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
          )
        `);
        db.exec(`
          INSERT INTO travel_documents (
            id, document_type, title, file_url, file_name, file_size,
            customer_id, passenger_id, booking_id, visa_id, expiry_date, notify_before_days, notes, created_at
          )
          SELECT 
            id, document_type, title, file_url, file_name, file_size,
            customer_id, passenger_id, booking_id, visa_id, expiry_date, notify_before_days, notes, created_at
          FROM travel_documents_old
        `);
        db.exec("DROP TABLE travel_documents_old");
        db.pragma("foreign_keys = ON");
      })();
      console.log("travel_documents schema migrated successfully.");
    }
  } catch (err: any) {
    console.error("Error migrating travel schemas:", err);
  }
  try {
    const columns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
    const columnNames = columns.map(c => c.name);

    const missingColumns = [
      "email", "phone", "avatar_url", "default_branch_id", "language", "timezone", "status", "full_name",
      "employee_id", "branch_id", "group_id", "user_number", "name_en", "department", "job_title", "start_date", "end_date",
      "work_start_time", "work_end_time", "force_password_change", "restrict_devices", "allow_self_service",
      "is_cashier", "is_customer_rep", "is_pos_user", "is_handheld_user", "allowed_devices", "default_safe_id", "customer_id", "fingerprint_id", "pos_permission_template", "is_system_admin",
      "is_suspended", "suspended_date", "suspended_reason",
      "created_by", "created_at", "edit_count",
      "perm_create_invoice", "perm_edit_invoice", "perm_cancel_invoice", "perm_return", "perm_view_prices", "perm_view_profits",
      "perm_edit_stock", "perm_stocktake", "perm_edit_entries", "perm_close_periods", "perm_view_salaries"
    ];

    for (const col of missingColumns) {
      if (!columnNames.includes(col)) {
        console.log(`[Database] Adding missing column to users: ${col}`);
        db.exec(`ALTER TABLE users ADD COLUMN ${col} TEXT;`);
      }
    }
  } catch (err) {
    console.error("[Database] Error ensuring users columns:", err);
  }
}

function ensureUsersColumns() {
  try {
    const columns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
    const columnNames = columns.map(c => c.name);

    const missingColumns = [
      "email", "phone", "avatar_url", "default_branch_id", "language", "timezone", "status", "full_name",
      "employee_id", "branch_id", "group_id", "user_number", "name_en", "department", "job_title", "start_date", "end_date",
      "work_start_time", "work_end_time", "force_password_change", "restrict_devices", "allow_self_service",
      "is_cashier", "is_customer_rep", "is_pos_user", "is_handheld_user", "allowed_devices", "default_safe_id", "customer_id", "fingerprint_id", "pos_permission_template", "is_system_admin",
      "is_suspended", "suspended_date", "suspended_reason",
      "created_by", "created_at", "edit_count",
      "perm_create_invoice", "perm_edit_invoice", "perm_cancel_invoice", "perm_return", "perm_view_prices", "perm_view_profits",
      "perm_edit_stock", "perm_stocktake", "perm_edit_entries", "perm_close_periods", "perm_view_salaries"
    ];

    for (const col of missingColumns) {
      if (!columnNames.includes(col)) {
        console.log(`[Database] Adding missing column to users: ${col}`);
        db.exec(`ALTER TABLE users ADD COLUMN ${col} TEXT;`);
      }
    }
  } catch (err) {
    console.error("[Database] Error ensuring users columns:", err);
  }
}

initSchema();
ensureUsersColumns();
runMigrations();
seedData();
ensureDefaultAccountingChart();
syncSupplierAccounts();
ensureUmrahPilgrimsData();
ensureTravelHotelsColumns();
ensureTravelBusBookingsColumns();
ensureTravelVisasColumns();
fixTravelForeignKeys();

export function createDoubleEntryJournal(
  entryDate: string,
  description: string,
  sourceType: string,
  sourceId: number,
  lines: { account_code: string; debit: number; credit: number; description?: string; currency?: string; exchange_rate?: number; foreign_amount?: number; cost_center_id?: number }[],
  meta?: { currency?: string; currency_rate?: number; reference_no?: string; doc_type?: string; cost_center_id?: number; entry_class?: string; tx_code?: string; attachments?: string }
): number {
  const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);

  // Allow small rounding tolerance, balance it
  const diff = Math.abs(totalDebit - totalCredit);
  if (diff > 0.01) {
    throw new Error(`القيد غير متزن! إجمالي المدين: ${totalDebit}، إجمالي الدائن: ${totalCredit}`);
  }

  // Get next sequential unique entry number
  const maxRow = db.prepare("SELECT COALESCE(MAX(id), 0) as m FROM journal_entries").get() as { m: number };
  let nextSeq = (maxRow?.m || 0) + 1;
  let entryNumber = `JV-${String(nextSeq).padStart(5, "0")}`;
  while (db.prepare("SELECT 1 FROM journal_entries WHERE entry_number = ?").get(entryNumber)) {
    nextSeq++;
    entryNumber = `JV-${String(nextSeq).padStart(5, "0")}`;
  }

  // Create standard date string if empty
  const cleanDate = entryDate || new Date().toISOString().slice(0, 10);

  // Check if date falls in a closed fiscal period
  const closedPeriod = db.prepare(`
    SELECT name FROM fiscal_periods 
    WHERE status = 'closed' 
    AND ? BETWEEN start_date AND end_date
  `).get(cleanDate) as { name: string };

  if (closedPeriod) {
    throw new Error(`لا يمكن تسجيل القيد في تاريخ ${cleanDate} لأن الفترة المالية "${closedPeriod.name}" مغلقة.`);
  }

  // Run transaction manually
  const entryRes = db.prepare(`
    INSERT INTO journal_entries (
      entry_number, entry_date, description, source_type, source_id,
      currency, currency_rate, reference_no, doc_type, cost_center_id, entry_class, tx_code, attachments
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entryNumber,
    cleanDate,
    description,
    sourceType,
    sourceId,
    meta?.currency || "SAR",
    meta?.currency_rate || 1.0,
    meta?.reference_no || null,
    meta?.doc_type || "قيد عادي",
    meta?.cost_center_id || null,
    meta?.entry_class || "عام",
    meta?.tx_code || null,
    meta?.attachments || null
  );

  const entryId = entryRes.lastInsertRowid as number;

  for (const line of lines) {
    const acc = db.prepare("SELECT id, type, parent_code FROM accounts WHERE code = ?").get(line.account_code) as { id: number; type: string; parent_code: string | null };
    if (!acc) {
      throw new Error(`الحساب ذو الرمز ${line.account_code} غير موجود في دليل الحسابات!`);
    }

    db.prepare(`
      INSERT INTO journal_entry_lines (
        journal_entry_id, account_id, account_code, debit, credit, description,
        currency, exchange_rate, foreign_amount, cost_center_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entryId,
      acc.id,
      line.account_code,
      Number(line.debit) || 0,
      Number(line.credit) || 0,
      line.description || null,
      line.currency || meta?.currency || "SAR",
      Number(line.exchange_rate) || 1.0,
      Number(line.foreign_amount) || 0,
      line.cost_center_id || null
    );

    // Update account balance
    const isDebitNormal = ["asset", "expense", "cogs", "wastage"].includes(acc.type);
    const amountChange = isDebitNormal
      ? ((Number(line.debit) || 0) - (Number(line.credit) || 0))
      : ((Number(line.credit) || 0) - (Number(line.debit) || 0));

    db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").run(amountChange, acc.id);

    // Propagate balance update to parent accounts in Chart of Accounts
    let pCode = acc.parent_code;
    let guard = 0;
    while (pCode && guard < 5) {
      guard++;
      const parentAcc = db.prepare("SELECT id, parent_code FROM accounts WHERE code = ?").get(pCode) as { id: number; parent_code: string | null } | undefined;
      if (!parentAcc) break;
      db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").run(amountChange, parentAcc.id);
      pCode = parentAcc.parent_code;
    }
  }

  return entryId;
}

export function updateDoubleEntryJournal(
  entryId: number,
  entryDate: string,
  description: string,
  lines: { account_code: string; debit: number; credit: number; description?: string; currency?: string; exchange_rate?: number; foreign_amount?: number; cost_center_id?: number }[],
  meta?: { currency?: string; currency_rate?: number; reference_no?: string; doc_type?: string; cost_center_id?: number; entry_class?: string; tx_code?: string; attachments?: string }
): void {
  const existing = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(entryId) as any;
  if (!existing) {
    throw new Error("القيد المحاسبي غير موجود للتعديل!");
  }

  const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);

  const diff = Math.abs(totalDebit - totalCredit);
  if (diff > 0.01) {
    throw new Error(`القيد غير متزن! إجمالي المدين: ${totalDebit}، إجمالي الدائن: ${totalCredit}`);
  }

  const cleanDate = entryDate || existing.entry_date;

  // 1. Revert previous lines impact on account balances
  const oldLines = db.prepare(`
    SELECT l.*, a.type as account_type
    FROM journal_entry_lines l
    JOIN accounts a ON a.id = l.account_id
    WHERE l.journal_entry_id = ?
  `).all(entryId) as any[];

  for (const oldLine of oldLines) {
    const isDebitNormal = ["asset", "expense", "cogs", "wastage"].includes(oldLine.account_type);
    const amountChange = isDebitNormal
      ? (oldLine.debit - oldLine.credit)
      : (oldLine.credit - oldLine.debit);

    db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?").run(amountChange, oldLine.account_id);
  }

  // 2. Delete old lines
  db.prepare("DELETE FROM journal_entry_lines WHERE journal_entry_id = ?").run(entryId);

  // 3. Update header
  db.prepare(`
    UPDATE journal_entries
    SET entry_date = ?, description = ?, currency = ?, currency_rate = ?, reference_no = ?, doc_type = ?, cost_center_id = ?, entry_class = ?, tx_code = ?, attachments = ?
    WHERE id = ?
  `).run(
    cleanDate,
    description,
    meta?.currency || existing.currency || "SAR",
    meta?.currency_rate || existing.currency_rate || 1.0,
    meta?.reference_no !== undefined ? meta.reference_no : existing.reference_no,
    meta?.doc_type || existing.doc_type || "قيد عادي",
    meta?.cost_center_id !== undefined ? meta.cost_center_id : existing.cost_center_id,
    meta?.entry_class || existing.entry_class || "عام",
    meta?.tx_code !== undefined ? meta.tx_code : existing.tx_code,
    meta?.attachments !== undefined ? meta.attachments : existing.attachments,
    entryId
  );

  // 4. Insert new lines and apply new balance changes
  for (const line of lines) {
    const acc = db.prepare("SELECT id, type FROM accounts WHERE code = ?").get(line.account_code) as { id: number; type: string };
    if (!acc) {
      throw new Error(`الحساب ذو الرمز ${line.account_code} غير موجود في دليل الحسابات!`);
    }

    db.prepare(`
      INSERT INTO journal_entry_lines (
        journal_entry_id, account_id, debit, credit, description,
        currency, exchange_rate, foreign_amount, cost_center_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entryId,
      acc.id,
      Number(line.debit) || 0,
      Number(line.credit) || 0,
      line.description || null,
      line.currency || meta?.currency || existing.currency || "SAR",
      Number(line.exchange_rate) || 1.0,
      Number(line.foreign_amount) || 0,
      line.cost_center_id || null
    );

    const isDebitNormal = ["asset", "expense", "cogs", "wastage"].includes(acc.type);
    const amountChange = isDebitNormal
      ? ((Number(line.debit) || 0) - (Number(line.credit) || 0))
      : ((Number(line.credit) || 0) - (Number(line.debit) || 0));

    db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").run(amountChange, acc.id);
  }
}

export function deleteDoubleEntryJournal(entryId: number): void {
  const existing = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(entryId) as any;
  if (!existing) {
    throw new Error("القيد غير موجود للحذف!");
  }

  // 1. Revert lines impact on account balances
  const oldLines = db.prepare(`
    SELECT l.*, a.type as account_type
    FROM journal_entry_lines l
    JOIN accounts a ON a.id = l.account_id
    WHERE l.journal_entry_id = ?
  `).all(entryId) as any[];

  for (const oldLine of oldLines) {
    const isDebitNormal = ["asset", "expense", "cogs", "wastage"].includes(oldLine.account_type);
    const amountChange = isDebitNormal
      ? (oldLine.debit - oldLine.credit)
      : (oldLine.credit - oldLine.debit);

    db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?").run(amountChange, oldLine.account_id);
  }

  // 2. Delete lines & entry
  db.prepare("DELETE FROM journal_entry_lines WHERE journal_entry_id = ?").run(entryId);
  db.prepare("DELETE FROM journal_entries WHERE id = ?").run(entryId);
}

export function seedWorkReportsAndPDFData(): void {
  try {
    // 0. Ensure default customers exist first
    const custCount = (db.prepare("SELECT COUNT(*) as c FROM customers").get() as any)?.c || 0;
    if (custCount === 0) {
      const insCust = db.prepare("INSERT INTO customers (id, name, phone, email, address) VALUES (?, ?, ?, ?, ?)");
      try { insCust.run(1, "عبدالله محمد العتيبي", "0501234567", "abdullah@example.com", "الرياض"); } catch {}
      try { insCust.run(2, "سارة أحمد الشمري", "0559876543", "sara@example.com", "جدة"); } catch {}
      try { insCust.run(3, "فاطمة علي الزهراني", "0561112233", "fatima@example.com", "الدمام"); } catch {}
    }

    const customersList = db.prepare("SELECT id FROM customers LIMIT 3").all() as any[];
    const cId1 = customersList[0]?.id || 1;
    const cId2 = customersList[1]?.id || customersList[0]?.id || 1;
    const cId3 = customersList[2]?.id || customersList[0]?.id || 1;

    // 1. Ensure Customers & Passengers
    const passCount = (db.prepare("SELECT COUNT(*) as c FROM travel_passengers").get() as any)?.c || 0;
    if (passCount === 0) {
      const insPass = db.prepare(`
        INSERT INTO travel_passengers (customer_id, name_ar, name_en, passport_number, passport_expiry_date, nationality, gender, dob, phone, email)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insPass.run(cId1, "عبدالله محمد العتيبي", "ABDULLAH MOHAMMED ALOTAIBI", "A12345678", "2029-05-20", "سعودي", "M", "1988-03-15", "0501234567", "alotaibi@example.com");
      insPass.run(cId1, "سارة خالد العتيبي", "SARAH KHALED ALOTAIBI", "A87654321", "2028-11-10", "سعودي", "F", "1992-07-22", "0507654321", "sarah@example.com");
      insPass.run(cId2, "د. طارق محمود السيد", "DR. TAREK MAHMOUD ELSAYED", "P99887766", "2030-01-15", "مصري", "M", "1980-09-05", "0554433221", "tarek@example.com");
      insPass.run(cId3, "فاطمة علي الزهراني", "FATIMA ALI ALZAHRANI", "B44556677", "2027-08-18", "سعودي", "F", "1995-12-01", "0543322110", "fatima@example.com");
      insPass.run(cId3, "عمر محمد الفاروق", "OMAR MOHAMMED ALFAROOQ", "N33221100", "2029-12-30", "يمني", "M", "1985-04-12", "0561122334", "omar@example.com");
    }

    const passengersList = db.prepare("SELECT id FROM travel_passengers LIMIT 4").all() as any[];
    const pId1 = passengersList[0]?.id || 1;
    const pId2 = passengersList[1]?.id || passengersList[0]?.id || 1;
    const pId3 = passengersList[2]?.id || passengersList[0]?.id || 1;
    const pId4 = passengersList[3]?.id || passengersList[0]?.id || 1;

    // 2. Ensure Flight Bookings
    const bkCount = (db.prepare("SELECT COUNT(*) as c FROM travel_bookings").get() as any)?.c || 0;
    if (bkCount === 0) {
      const insBk = db.prepare(`
        INSERT INTO travel_bookings (
          booking_number, service_type, customer_id, passenger_id, airline_supplier,
          flight_number, origin_city, destination_city, departure_date, return_date,
          ticket_number, pnr, status, issue_date, cost_price, selling_price, commission,
          paid_amount, remaining_balance, payment_status, payment_method, user_name, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insBk.run("BK-SV-2026-101", "flight", cId1, pId1, "الخطوط الجوية السعودية (Saudia)", "SV 112 / SV 113", "الرياض (RUH)", "دبي (DXB)", "2026-09-10", "2026-09-18", "065-2415896321", "PNR-SV-991", "confirmed", "2026-08-20", 1200, 1500, 300, 1500, 0, "paid", "cash", "مدير النظام", "تذكرة طيران ذهاب وعودة شاملة الحقائب والوجبة");
      insBk.run("BK-EK-2026-102", "flight", cId2, pId3, "طيران الإمارات (Emirates)", "EK 814 / EK 815", "جدة (JED)", "القاهرة (CAI)", "2026-09-15", "2026-09-25", "176-9874123654", "PNR-EK-442", "confirmed", "2026-08-22", 1800, 2200, 400, 2200, 0, "paid", "bank_transfer", "موظف المبيعات", "درجة رجال الأعمال - مقعد نافذة VIP");
      insBk.run("BK-AF-2026-103", "flight", cId3, pId4, "الخطوط الفرنسية (Air France)", "AF 540 / AF 541", "الرياض (RUH)", "باريس (CDG)", "2026-10-01", "2026-10-12", "057-3322114455", "PNR-AF-883", "confirmed", "2026-08-25", 3200, 3800, 600, 3800, 0, "paid", "credit_card", "مدير النظام", "رحلة سياحية إلى باريس شاملة الوجبة والوزن الإضافي");
      insBk.run("BK-QR-2026-104", "flight", cId1, pId2, "الخطوط القطريـة (Qatar Airways)", "QR 1160", "الدمام (DMM)", "الدوحة (DOH)", "2026-09-20", null, "157-8899001122", "PNR-QR-505", "confirmed", "2026-08-28", 850, 1100, 250, 1100, 0, "paid", "cash", "محاسب الطيران", "تذكرة ذهاب فقط - الدرجة السياحية المرنة");
    }

    // 3. Ensure Hotel Reservations
    const htlCount = (db.prepare("SELECT COUNT(*) as c FROM travel_hotels").get() as any)?.c || 0;
    if (htlCount === 0) {
      const insHtl = db.prepare(`
        INSERT INTO travel_hotels (
          booking_ref, hotel_name, city_country, check_in, check_out,
          nights, room_type, customer_id, passenger_id,
          cost_price, selling_price, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insHtl.run("HTL-MK-901", "فندق الفيرمونت برج الساعة مكة", "مكة المكرمة - السعودية", "2026-09-10", "2026-09-15", 5, "جناح ديلوكس إطلالة الكعبة", cId1, pId1, 4500, 5800, "confirmed", "حجز مؤكد مع قسيمة فندق رسمية VOUCHER-FAIRMONT-2026");
      insHtl.run("HTL-DXB-902", "فندق أتلانتس النخيل دبي", "دبي - الإمارات", "2026-09-18", "2026-09-22", 4, "غرفة أوشن جونيور ديلوكس", cId2, pId3, 3800, 4900, "confirmed", "شامل جميع الضرائب ورسوم الخدمة ورسم السائح");
      insHtl.run("HTL-PAR-903", "فندق بولمان باريس برج إيفل", "باريس - فرنسا", "2026-10-02", "2026-10-10", 8, "غرفة ديلوكس إطلالة برج إيفل", cId3, pId4, 8800, 11200, "confirmed", "حجز مؤكد لشخصين شامل الضرائب والمحليات");
    }

    // 4. Ensure Visa Applications
    const visaCount = (db.prepare("SELECT COUNT(*) as c FROM travel_visas").get() as any)?.c || 0;
    if (visaCount === 0) {
      const insVisa = db.prepare(`
        INSERT INTO travel_visas (
          visa_number, customer_id, passenger_id, country, visa_type,
          status, application_date, expiry_date, cost_price, selling_price, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insVisa.run("VSA-SCH-2026-01", cId3, pId4, "فرنسا (شنغن فرنسا)", "سياحية متعددة السفرات (1 سنة)", "issued", "2026-08-01", "2027-08-01", 450, 750, "تأشيرة شنغن صادرة ومطبوعة على الجواز بنجاح");
      insVisa.run("VSA-UK-2026-02", cId1, pId1, "المملكة المتحدة (بريطانيا EVW)", "إعفاء إلكتروني سياحي EVW", "issued", "2026-08-10", "2026-11-10", 180, 350, "تصريح سفر إلكتروني بريطاني مؤكد للعميل");
      insVisa.run("VSA-USA-2026-03", cId2, pId3, "الولايات المتحدة الأمريكية (B1/B2)", "رجال أعمال وسياحة (10 سنوات)", "under_process", "2026-08-15", null, 650, 1100, "تم حجز موعد المقابلة بمركز السفارة الأمريكية بالرياض");
    }

    // 5. Ensure Accounting Journal Entries & Lines
    const jnlCount = (db.prepare("SELECT COUNT(*) as c FROM journal_entries").get() as any)?.c || 0;
    if (jnlCount === 0) {
      const insJnl = db.prepare(`
        INSERT INTO journal_entries (entry_number, entry_date, description, source_type, source_id)
        VALUES (?, ?, ?, ?, ?)
      `);

      const insLine = db.prepare(`
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (?, ?, ?, ?, ?)
      `);

      const accCash = (db.prepare("SELECT id FROM accounts WHERE code='11100' OR name LIKE '%صندوق%'").get() as any)?.id || 1;
      const accBank = (db.prepare("SELECT id FROM accounts WHERE code='11200' OR name LIKE '%بنك%'").get() as any)?.id || 2;
      const accAP = (db.prepare("SELECT id FROM accounts WHERE code='21100' OR name LIKE '%دائنة%' OR name LIKE '%موردين%'").get() as any)?.id || 4;
      const accSales = (db.prepare("SELECT id FROM accounts WHERE code='41100' OR name LIKE '%مبيعات%'").get() as any)?.id || 5;

      const r1 = insJnl.run("JV-2026-001", "2026-08-20", "قيد استحقاق وإثبات مبيعات تذاكر طيران وفندق - العميل عبدالله العتيبي", "sale", 1);
      const jId1 = Number(r1.lastInsertRowid);
      insLine.run(jId1, accCash, 11500, 0, "تحصيل نقدي بالصندوق الرئيسي مقابل فاتورة مبيعات INV-TRV-2026-001");
      insLine.run(jId1, accSales, 0, 11500, "إثبات إيرادات مبيعات خدمات السفر والسياحة");

      const r2 = insJnl.run("JV-2026-002", "2026-08-22", "قيد سداد مستحقات شركة الخطوط السعودية عن شهر أغسطس", "voucher", 2);
      const jId2 = Number(r2.lastInsertRowid);
      insLine.run(jId2, accAP, 15000, 0, "إقفال حساب المورد الخطوط السعودية (21100)");
      insLine.run(jId2, accBank, 0, 15000, "خصم من حساب البنك الأهلي السعودي - تحويل بنكي معتمد");

      const r3 = insJnl.run("JV-2026-003", "2026-08-28", "إثبات مبيعات حافلات سابتكو النقل الجماعي - رحلة الرياض مكة", "sale", 3);
      const jId3 = Number(r3.lastInsertRowid);
      insLine.run(jId3, accCash, 350, 0, "مقبوضات تذكرة سابتكو VIP نقداً");
      insLine.run(jId3, accSales, 0, 350, "إيراد مبيعات تذاكر النقل البري الحافلات");
    }

    // 6. Ensure Suppliers exist and sync with Accounts Payable 21100
    const suppCount = (db.prepare("SELECT COUNT(*) as c FROM suppliers").get() as any)?.c || 0;
    if (suppCount === 0) {
      const insSuppMain = db.prepare(`
        INSERT INTO suppliers (name, phone, email, address, balance)
        VALUES (?, ?, ?, ?, ?)
      `);
      insSuppMain.run("شركة الخطوط الجوية السعودية (Saudia)", "920022222", "b2b@saudia.com", "الرياض - طريق الملك خالد", 15000);
      insSuppMain.run("مجموعة فنادق أكور العالمية (Accor Hotels)", "0114005000", "reservations@accor.com", "جدة - طريق كورنيش", 8500);
      insSuppMain.run("الشركة السعودية للنقل الجماعي (سابتكو SAPTCO)", "920000877", "b2b@saptco.com.sa", "الرياض - التخصصي", 4200);
      insSuppMain.run("مركز التأشيرات الدولي المعتمد VFS Global", "0118001122", "support@vfsglobal.com", "الرياض - المروج", 2100);
    }

    // 7. Ensure Sales Orders for Reports
    const ordCount = (db.prepare("SELECT COUNT(*) as c FROM orders").get() as any)?.c || 0;
    if (ordCount === 0) {
      const insOrd = db.prepare(`
        INSERT INTO orders (invoice_number, subtotal, discount, tax, total, payment_method, cash_amount, card_amount, customer_id, user_id, note, order_type, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insItem = db.prepare(`
        INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total, category_name)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const o1 = insOrd.run("INV-2026-001", 10000, 0, 1500, 11500, "cash", 11500, 0, 1, 2, "فاتورة حجز باقة سياحية متكاملة (دبي + طيران)", "takeaway", "2026-08-20 10:30:00");
      const oid1 = Number(o1.lastInsertRowid);
      insItem.run(oid1, 101, "تذكرة طيران الرياض - دبي", 2, 1500, 3000, "تذاكر طيران");
      insItem.run(oid1, 102, "حجز فندق أتلانتس دبي (4 ليالي)", 1, 7000, 7000, "حجوزات فنادق");

      const o2 = insOrd.run("INV-2026-002", 4000, 200, 570, 4370, "card", 0, 4370, 2, 2, "خدمات إصدار تأشيرةشنغن فرنسا وصالة فرسان", "dine-in", "2026-08-22 14:15:00");
      const oid2 = Number(o2.lastInsertRowid);
      insItem.run(oid2, 103, "إصدار تأشيرة شنغن فرنسا", 2, 1500, 3000, "تأشيرات سفر");
      insItem.run(oid2, 104, "رسوم حجز صالة فرسان المطار VIP", 2, 500, 1000, "خدمات خاصة");

      const o3 = insOrd.run("INV-2026-003", 300, 0, 45, 345, "cash", 345, 0, 3, 2, "تذكرة حافلة سابتكو VIP - الرياض مكة", "delivery", "2026-08-28 09:00:00");
      const oid3 = Number(o3.lastInsertRowid);
      insItem.run(oid3, 105, "تذكرة نقل بري VIP حافلات سابتكو", 1, 300, 300, "نقل بري");
    }

    // ────────────────────────────────────────────────────────
    // CLEANUP ROGUE CUSTOMERS CREATED FOR EMPLOYEES & MIGRATE
    // ────────────────────────────────────────────────────────
    try {
      const rogueCusts = db.prepare("SELECT id, account_code, name FROM customers WHERE name IN (SELECT name FROM hr_employees) OR notes LIKE '%وجبة%' OR notes LIKE '%موظف%'").all() as any[];
      for (const rc of rogueCusts) {
        const emp = db.prepare("SELECT id, name, account_code FROM hr_employees WHERE name = ?").get(rc.name) as any;
        if (emp) {
          const empCode = emp.account_code || `214${String(emp.id).padStart(2, "0")}`;
          const empAcc = db.prepare("SELECT id FROM accounts WHERE code = ?").get(empCode) as any;
          if (empAcc && rc.account_code) {
            // Update journal entry lines to point to the correct employee account!
            db.prepare("UPDATE journal_entry_lines SET account_id = ?, account_code = ? WHERE account_code = ?").run(empAcc.id, empCode, rc.account_code);
          }
        }
        if (rc.account_code) {
          db.prepare("DELETE FROM accounts WHERE code = ?").run(rc.account_code);
        }
        db.prepare("DELETE FROM customers WHERE id = ?").run(rc.id);
      }
    } catch (cleanErr) {
      console.warn("Cleanup rogue customers migration notice:", cleanErr);
    }

    // Sync supplier accounts into Chart of Accounts
    syncSupplierAccounts();
  } catch (err) {
    console.error("seedWorkReportsAndPDFData error:", err);
  }
}

// Automatically trigger seeding on backend start
try {
  seedWorkReportsAndPDFData();
} catch (e) {
  console.error("Auto seed execution error:", e);
}

export function deleteJournalBySource(sourceType: string, sourceId: number): void {
  try {
    const entry = db.prepare("SELECT id FROM journal_entries WHERE source_type = ? AND source_id = ?").get(sourceType, sourceId) as any;
    if (entry) {
      deleteDoubleEntryJournal(entry.id);
    }
  } catch (e) {
    console.error("deleteJournalBySource error:", e);
  }
}

