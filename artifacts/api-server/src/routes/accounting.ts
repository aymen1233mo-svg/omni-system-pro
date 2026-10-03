import { Router } from "express";
import { db, createDoubleEntryJournal, updateDoubleEntryJournal, deleteDoubleEntryJournal, syncSupplierAccounts, syncCustomerAccounts } from "../lib/sqlite";
import { runErpAccountingSync } from "../lib/erp-accounting-sync";
import { getAuthUser } from "./auth";
import { getSupplierAccountCode, getCustomerAccountCode } from "./customers";
import { syncWarehouseInvoiceJournal } from "./warehouse-invoices";
import { getBusinessDate, getSqlBusinessDateModifier } from "../lib/business-day";

const router = Router();

function requireAdmin(req: any, res: any): boolean {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "غير مسجل الدخول" });
    return false;
  }
  return true;
}

/* ─── 1. Financial Dashboard Stats (لوحة التحكم المالية) ─── */
router.get("/accounting/dashboard-stats", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const today = getBusinessDate("accounting");
    const salesMod = getSqlBusinessDateModifier("sales");

    // Sales Today
    const todaySalesRow = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total 
      FROM orders 
      WHERE date(datetime(created_at, '${salesMod}')) = ? AND (status IS NULL OR status != 'cancelled')
    `).get(today) as { total: number };

    // Purchases Today
    const todayPurchasesRow = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total 
      FROM purchase_invoices 
      WHERE DATE(invoice_date) = ?
    `).get(today) as { total: number };

    // Total Expenses All Time / Month
    const totalExpensesRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM expenses
    `).get() as { total: number };

    // Receipts Total (Vouchers)
    const totalReceiptsRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM vouchers WHERE type = 'receipt'
    `).get() as { total: number };

    // Payments Total (Vouchers)
    const totalPaymentsRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM vouchers WHERE type = 'payment'
    `).get() as { total: number };

    // Cash Drawers Balances (Safes)
    const safesBalanceRow = db.prepare(`
      SELECT COALESCE(SUM(balance), 0) as total FROM safes WHERE active = 1
    `).get() as { total: number };

    // Bank Accounts Balances
    const bankBalanceRow = db.prepare(`
      SELECT COALESCE(SUM(balance), 0) as total FROM bank_accounts WHERE active = 1
    `).get() as { total: number };

    // Supplier Payables (AP)
    const supplierPayablesRow = db.prepare(`
      SELECT COALESCE(SUM(balance), 0) as total FROM suppliers
    `).get() as { total: number };

    // Customer Receivables (AR)
    const customerReceivablesRow = db.prepare(`
      SELECT COALESCE(SUM(balance), 0) as total FROM customers
    `).get() as { total: number };

    // Total Revenue (Sales + Receipts)
    const totalRevenueRow = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE status IS NULL OR status != 'cancelled'
    `).get() as { total: number };

    // Total COGS from Order Items
    const totalCogsRow = db.prepare(`
      SELECT COALESCE(SUM(i.quantity * COALESCE(p.cost, i.unit_price * 0.5)), 0) as total
      FROM order_items i
      LEFT JOIN products p ON p.id = i.product_id
      JOIN orders o ON o.id = i.order_id
      WHERE o.status IS NULL OR o.status != 'cancelled'
    `).get() as { total: number };

    const grossProfit = totalRevenueRow.total - totalCogsRow.total;
    const netProfit = grossProfit - totalExpensesRow.total;

    // Monthly Expense Breakdown
    const expenseBreakdown = db.prepare(`
      SELECT category, COALESCE(SUM(amount), 0) as amount
      FROM expenses
      GROUP BY category
      ORDER BY amount DESC
      LIMIT 6
    `).all();

    // Top Unpaid Purchase Invoices / Bills
    const overdueBills = db.prepare(`
      SELECT id, invoice_number, supplier_name, remaining_amount, due_date
      FROM purchase_invoices
      WHERE payment_status != 'paid' AND remaining_amount > 0
      ORDER BY due_date ASC
      LIMIT 5
    `).all();

    res.json({
      todaySales: todaySalesRow.total,
      todayPurchases: todayPurchasesRow.total,
      totalExpenses: totalExpensesRow.total,
      totalReceipts: totalReceiptsRow.total,
      totalPayments: totalPaymentsRow.total,
      safesBalance: safesBalanceRow.total,
      bankBalance: bankBalanceRow.total,
      supplierPayables: supplierPayablesRow.total,
      customerReceivables: customerReceivablesRow.total,
      totalRevenue: totalRevenueRow.total,
      totalCogs: totalCogsRow.total,
      grossProfit,
      netProfit,
      expenseBreakdown,
      overdueBills
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


/* ─── 2. Chart of Accounts (دليل الحسابات) ─── */
router.get("/accounting/accounts", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    try { runErpAccountingSync(db); } catch {}
    // Purge any rogue individual accounts matching agency-affiliated or indirect customers
    try {
      const agencyCusts = db.prepare(`
        SELECT name, account_code FROM customers 
        WHERE affiliation_type = 'agency' 
           OR affiliation_type = 'indirect' 
           OR customer_type = 'indirect' 
           OR customer_type = 'agent_customer' 
           OR customer_type = 'sub_customer' 
           OR (COALESCE(affiliation_type, '') != 'direct' AND (
             (office_id IS NOT NULL AND office_id > 1)
             OR (office_name IS NOT NULL AND TRIM(office_name) != '' AND office_name NOT LIKE '%الرئيسي%' AND office_name NOT LIKE '%مباشر%')
           ))
      `).all() as any[];
      for (const ag of agencyCusts) {
        if (ag.name) {
          const rogue = db.prepare("SELECT code FROM accounts WHERE TRIM(name) = ?").all(ag.name.trim()) as any[];
          for (const r of rogue) {
            if (r.code !== ag.account_code) {
              db.prepare("UPDATE journal_entry_lines SET account_code = ? WHERE account_code = ?").run(ag.account_code || "11200", r.code);
              if (r.code !== "11200" && r.code !== "11400" && r.code !== "21100" && r.code !== "21101") {
                db.prepare("DELETE FROM accounts WHERE code = ?").run(r.code);
              }
            }
          }
        }
      }
    } catch {}

    const accounts = db.prepare(`
      SELECT 
        a.*,
        (SELECT COUNT(*) FROM accounts WHERE parent_code = a.code) as children_count,
        (SELECT COUNT(*) FROM account_currencies WHERE account_id = a.id) as currencies_count,
        (SELECT COUNT(*) FROM account_safes WHERE account_id = a.id) as linked_safes_count,
        (SELECT COUNT(*) FROM account_customers ac JOIN customers c ON c.id = ac.customer_id WHERE ac.account_id = a.id AND (c.affiliation_type != 'agency' OR c.affiliation_type IS NULL)) as linked_customers_count,
        (SELECT COUNT(*) FROM journal_entry_lines WHERE account_id = a.id) as transactions_count
      FROM accounts a 
      WHERE (a.code IS NOT NULL AND TRIM(a.code) != '' AND a.name IS NOT NULL AND TRIM(a.name) != '' AND a.name NOT LIKE '%\uFFFD%')
        AND a.parent_code != '21400'
        AND (a.code NOT LIKE '214%' OR a.code = '21400')
        AND a.name NOT LIKE 'موظف:%'
        AND a.name NOT IN (
          SELECT TRIM(name) FROM customers 
          WHERE (
            affiliation_type = 'agency' OR 
            affiliation_type = 'indirect' OR 
            customer_type = 'indirect' OR 
            customer_type = 'agent_customer' OR 
            customer_type = 'sub_customer' OR 
            (COALESCE(affiliation_type, '') != 'direct' AND (
              (office_id IS NOT NULL AND office_id > 1) OR 
              (office_name IS NOT NULL AND TRIM(office_name) != '' AND office_name NOT LIKE '%الرئيسي%' AND office_name NOT LIKE '%مباشر%')
            ))
          )
          AND name IS NOT NULL AND TRIM(name) != ''
        )
      ORDER BY a.code ASC
    `).all();
    res.json(accounts);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


router.post("/accounting/opening-balances", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { balances } = req.body; // array of { code, opening_debit, opening_credit }

  try {
    // 1. Find and delete existing opening balance journal entry
    const existingEntry = db.prepare("SELECT id FROM journal_entries WHERE source_type = 'opening_balance'").get() as any;
    if (existingEntry) {
      deleteDoubleEntryJournal(existingEntry.id);
    }

    // 2. Reset all accounts opening balances to 0 first (to handle accounts not included in the payload)
    db.prepare("UPDATE accounts SET opening_debit = 0.0, opening_credit = 0.0").run();

    // 3. Update each account in the payload
    const updateStmt = db.prepare("UPDATE accounts SET opening_debit = ?, opening_credit = ? WHERE code = ?");
    for (const b of balances) {
      updateStmt.run(Number(b.opening_debit || 0), Number(b.opening_credit || 0), b.code);
    }

    // 4. Build journal entry lines
    const lines: any[] = [];
    let totalDebit = 0;
    let totalCredit = 0;

    for (const b of balances) {
      const d = Number(b.opening_debit || 0);
      const c = Number(b.opening_credit || 0);
      if (d > 0 || c > 0) {
        lines.push({
          account_code: b.code,
          debit: d,
          credit: c,
          description: "قيد رصيد افتتاحي للنظام"
        });
        totalDebit += d;
        totalCredit += c;
      }
    }

    if (lines.length > 0) {
      // Balance the entry if needed
      const diff = totalDebit - totalCredit;
      if (Math.abs(diff) > 0.001) {
        if (diff > 0) {
          // Debit is higher, credit the difference to Capital (31000)
          lines.push({
            account_code: "31000",
            debit: 0,
            credit: diff,
            description: "تسوية وتوازن أرصدة افتتاحية (رأس المال)"
          });
        } else {
          // Credit is higher, debit the difference to Capital (31000)
          lines.push({
            account_code: "31000",
            debit: Math.abs(diff),
            credit: 0,
            description: "تسوية وتوازن أرصدة افتتاحية (رأس المال)"
          });
        }
      }

      // 5. Create new balanced opening balance journal entry
      createDoubleEntryJournal(
        new Date().toISOString().slice(0, 10),
        "تسجيل وإثبات الأرصدة الافتتاحية التأسيسية للنظام",
        "opening_balance",
        1,
        lines,
        { doc_type: "قيد افتتاحي" }
      );
    }

    res.json({ success: true, message: "تم حفظ وتسجيل الأرصدة الافتتاحية بنجاح وتوليد قيد متزن تلقائياً." });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/accounting/accounts/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const account = db.prepare("SELECT * FROM accounts WHERE id = ?").get(req.params.id) as any;
    if (!account) {
      res.status(404).json({ error: "الحساب غير موجود" });
      return;
    }

    const currencies = db.prepare(`
      SELECT ac.*, c.symbol, c.type as cur_type
      FROM account_currencies ac
      LEFT JOIN currencies c ON c.id = ac.currency_id
      WHERE ac.account_id = ?
      ORDER BY ac.is_primary DESC, ac.id ASC
    `).all(req.params.id);

    const linkedSafes = db.prepare(`
      SELECT s.*, asf.id as link_id
      FROM account_safes asf
      JOIN safes s ON s.id = asf.safe_id
      WHERE asf.account_id = ?
    `).all(req.params.id);

    const linkedCustomers = db.prepare(`
      SELECT c.*, ac.id as link_id
      FROM account_customers ac
      JOIN customers c ON c.id = ac.customer_id
      WHERE ac.account_id = ? AND (c.affiliation_type != 'agency' OR c.affiliation_type IS NULL)
    `).all(req.params.id);

    const children = db.prepare(`
      SELECT a.*,
        (SELECT COUNT(*) FROM journal_entry_lines WHERE account_id = a.id) as transactions_count
      FROM accounts a
      WHERE a.parent_code = ?
      ORDER BY a.code ASC
    `).all(account.code);

    const linkedSuppliers = db.prepare(`
      SELECT id, name, phone, email, balance, account_code, 'عام' as source
      FROM suppliers
      WHERE account_code = ? OR account_code LIKE ?
      UNION ALL
      SELECT id, name, phone, email, current_balance as balance, account_code, 'سياحة' as source
      FROM travel_suppliers
      WHERE account_code = ? OR account_code LIKE ?
    `).all(account.code, `${account.code}%`, account.code, `${account.code}%`);

    let aggregatedBalance = Number(account.balance || 0);
    if (children && children.length > 0) {
      for (const child of children as any[]) {
        aggregatedBalance += Number(child.balance || 0);
      }
    }

    res.json({
      ...account,
      currencies,
      linked_safes: linkedSafes,
      linked_customers: linkedCustomers,
      children,
      linked_suppliers: linkedSuppliers,
      aggregated_balance: aggregatedBalance
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/accounting/accounts", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { 
    code, name, name_en, type, parent_code, 
    currency = "YER", is_parent = 0, stop_dealing = 0, auto_add = 1, level = 1,
    currencies = [], linked_safe_ids = [], linked_customer_ids = []
  } = req.body;

  if (!code || !name || !type) {
    res.status(400).json({ error: "الرمز والاسم ونوع الحساب حقول إجبارية" });
    return;
  }
  try {
    const existing = db.prepare("SELECT id FROM accounts WHERE code = ?").get(code);
    if (existing) {
      res.status(400).json({ error: "رمز الحساب مسجل مسبقاً! الرجاء استخدام رمز فريد." });
      return;
    }

    // Determine level from code length or parent
    let calcLevel = level;
    if (parent_code) {
      const parentAcc = db.prepare("SELECT level FROM accounts WHERE code = ?").get(parent_code) as any;
      if (parentAcc && parentAcc.level) {
        calcLevel = parentAcc.level + 1;
      }
    } else {
      calcLevel = code.length <= 1 ? 1 : code.length <= 2 ? 2 : code.length <= 4 ? 3 : 4;
    }

    const r = db.prepare(`
      INSERT INTO accounts (code, name, name_en, type, parent_code, currency, is_parent, stop_dealing, auto_add, level, balance, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.0, 1)
    `).run(code, name, name_en || null, type, parent_code || null, currency, is_parent ? 1 : 0, stop_dealing ? 1 : 0, auto_add ? 1 : 0, calcLevel);
    
    const accountId = r.lastInsertRowid as number;

    // Insert currencies
    if (Array.isArray(currencies) && currencies.length > 0) {
      const curStmt = db.prepare(`
        INSERT INTO account_currencies (account_id, currency_id, currency_code, currency_name, min_balance, max_balance, exchange_rate, is_primary, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `);
      for (const cur of currencies) {
        curStmt.run(
          accountId,
          cur.currency_id || null,
          cur.currency_code || cur.code || "YER",
          cur.currency_name || cur.name || "ريال",
          Number(cur.min_balance) || 0,
          Number(cur.max_balance) || 100000000,
          Number(cur.exchange_rate) || 1.0,
          cur.is_primary ? 1 : 0
        );
      }
    } else {
      // Add default primary currency
      db.prepare(`
        INSERT INTO account_currencies (account_id, currency_code, currency_name, min_balance, max_balance, exchange_rate, is_primary, active)
        VALUES (?, ?, ?, 0, 100000000, 1.0, 1, 1)
      `).run(accountId, currency, currency === "YER" ? "ريال يمني" : currency === "SAR" ? "ريال سعودي" : currency === "USD" ? "دولار أمريكي" : currency);
    }

    // Insert linked safes
    if (Array.isArray(linked_safe_ids) && linked_safe_ids.length > 0) {
      const safeStmt = db.prepare(`INSERT OR IGNORE INTO account_safes (account_id, safe_id) VALUES (?, ?)`);
      for (const sId of linked_safe_ids) {
        safeStmt.run(accountId, sId);
        try { db.prepare("UPDATE safes SET account_code = ? WHERE id = ?").run(code, sId); } catch {}
      }
    }

    // Insert linked customers
    if (Array.isArray(linked_customer_ids) && linked_customer_ids.length > 0) {
      const custStmt = db.prepare(`INSERT OR IGNORE INTO account_customers (account_id, customer_id) VALUES (?, ?)`);
      for (const cId of linked_customer_ids) {
        custStmt.run(accountId, cId);
        try { db.prepare("UPDATE customers SET account_code = ? WHERE id = ?").run(code, cId); } catch {}
      }
    }

    if (parent_code === "21100") {
      try { db.prepare("UPDATE accounts SET is_parent = 1 WHERE code = '21100'").run(); } catch {}
      try {
        const suppExists = db.prepare("SELECT id FROM suppliers WHERE account_code = ? OR name = ?").get(code, name);
        if (!suppExists) {
          db.prepare(`
            INSERT INTO suppliers (name, balance, notes, account_code)
            VALUES (?, 0, 'تم إنشاء المورد تلقائياً من دليل الحسابات', ?)
          `).run(name, code);
        }
      } catch (err) {}
    }

    const created = db.prepare("SELECT * FROM accounts WHERE id = ?").get(accountId);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/accounting/accounts/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { 
    name, name_en, active, parent_code, type, currency, 
    is_parent, stop_dealing, auto_add, level,
    currencies, linked_safe_ids, linked_customer_ids
  } = req.body;

  try {
    const existing = db.prepare("SELECT * FROM accounts WHERE id = ?").get(req.params.id) as any;
    if (!existing) {
      res.status(404).json({ error: "الحساب غير موجود" });
      return;
    }

    db.prepare(`
      UPDATE accounts 
      SET name = ?, name_en = ?, active = ?, parent_code = ?, type = ?, currency = ?, 
          is_parent = ?, stop_dealing = ?, auto_add = ?, level = ?
      WHERE id = ?
    `).run(
      name ?? existing.name,
      name_en !== undefined ? name_en : existing.name_en,
      active !== undefined ? (active ? 1 : 0) : existing.active,
      parent_code !== undefined ? parent_code : existing.parent_code,
      type ?? existing.type,
      currency ?? existing.currency ?? "YER",
      is_parent !== undefined ? (is_parent ? 1 : 0) : existing.is_parent,
      stop_dealing !== undefined ? (stop_dealing ? 1 : 0) : existing.stop_dealing,
      auto_add !== undefined ? (auto_add ? 1 : 0) : existing.auto_add,
      level !== undefined ? level : existing.level,
      req.params.id
    );

    const accountId = Number(req.params.id);

    // Update currencies if array provided
    if (Array.isArray(currencies)) {
      db.prepare("DELETE FROM account_currencies WHERE account_id = ?").run(accountId);
      const curStmt = db.prepare(`
        INSERT INTO account_currencies (account_id, currency_id, currency_code, currency_name, min_balance, max_balance, exchange_rate, is_primary, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `);
      for (const cur of currencies) {
        curStmt.run(
          accountId,
          cur.currency_id || null,
          cur.currency_code || cur.code || "YER",
          cur.currency_name || cur.name || "ريال",
          Number(cur.min_balance) || 0,
          Number(cur.max_balance) || 100000000,
          Number(cur.exchange_rate) || 1.0,
          cur.is_primary ? 1 : 0
        );
      }
    }

    // Update linked safes if array provided
    if (Array.isArray(linked_safe_ids)) {
      db.prepare("DELETE FROM account_safes WHERE account_id = ?").run(accountId);
      const safeStmt = db.prepare(`INSERT OR IGNORE INTO account_safes (account_id, safe_id) VALUES (?, ?)`);
      for (const sId of linked_safe_ids) {
        safeStmt.run(accountId, sId);
        try { db.prepare("UPDATE safes SET account_code = ? WHERE id = ?").run(existing.code, sId); } catch {}
      }
    }

    // Update linked customers if array provided
    if (Array.isArray(linked_customer_ids)) {
      db.prepare("DELETE FROM account_customers WHERE account_id = ?").run(accountId);
      const custStmt = db.prepare(`INSERT OR IGNORE INTO account_customers (account_id, customer_id) VALUES (?, ?)`);
      for (const cId of linked_customer_ids) {
        custStmt.run(accountId, cId);
        try { db.prepare("UPDATE customers SET account_code = ? WHERE id = ?").run(existing.code, cId); } catch {}
      }
    }

    const updated = db.prepare("SELECT * FROM accounts WHERE id = ?").get(req.params.id);
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/accounting/accounts/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const account = db.prepare("SELECT * FROM accounts WHERE id = ?").get(req.params.id) as any;
    if (!account) {
      res.status(404).json({ error: "الحساب غير موجود" });
      return;
    }

    // Check if account has sub-accounts
    const subCount = (db.prepare("SELECT COUNT(*) as c FROM accounts WHERE parent_code = ?").get(account.code) as any).c;
    if (subCount > 0) {
      res.status(400).json({ error: `لا يمكن حذف هذا الحساب لأنه يحتوي على ${subCount} حسابات فرعية مرتبطة به. يرجى حذف الحسابات الفرعية أولاً.` });
      return;
    }

    // Check if account has journal entries
    const journalCount = (db.prepare("SELECT COUNT(*) as c FROM journal_entry_lines WHERE account_id = ?").get(account.id) as any).c;
    if (journalCount > 0) {
      res.status(400).json({ error: `لا يمكن حذف الحساب "${account.name}" لوجود (${journalCount}) حركة وقيود محاسبية مسجلة عليه.` });
      return;
    }

    // Delete related linkages
    db.prepare("DELETE FROM account_currencies WHERE account_id = ?").run(account.id);
    db.prepare("DELETE FROM account_safes WHERE account_id = ?").run(account.id);
    db.prepare("DELETE FROM account_customers WHERE account_id = ?").run(account.id);
    
    // Delete account
    db.prepare("DELETE FROM accounts WHERE id = ?").run(account.id);

    res.json({ success: true, message: `تم حذف الحساب "${account.name}" بنجاح.` });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Account Currencies Sub-endpoints ───
router.get("/accounting/accounts/:id/currencies", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = db.prepare(`
      SELECT ac.*, c.symbol, c.exchange_rate as system_rate
      FROM account_currencies ac
      LEFT JOIN currencies c ON c.id = ac.currency_id
      WHERE ac.account_id = ?
      ORDER BY ac.is_primary DESC, ac.id ASC
    `).all(req.params.id);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/accounting/accounts/:id/currencies", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { currency_id, currency_code, currency_name, min_balance, max_balance, exchange_rate, is_primary } = req.body;
  if (!currency_code || !currency_name) {
    res.status(400).json({ error: "رمز واسم العملة مطلوبان" });
    return;
  }
  try {
    if (is_primary) {
      db.prepare("UPDATE account_currencies SET is_primary = 0 WHERE account_id = ?").run(req.params.id);
    }
    const r = db.prepare(`
      INSERT INTO account_currencies (account_id, currency_id, currency_code, currency_name, min_balance, max_balance, exchange_rate, is_primary, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      req.params.id,
      currency_id || null,
      currency_code,
      currency_name,
      Number(min_balance) || 0,
      Number(max_balance) || 100000000,
      Number(exchange_rate) || 1.0,
      is_primary ? 1 : 0
    );
    const created = db.prepare("SELECT * FROM account_currencies WHERE id = ?").get(r.lastInsertRowid);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/accounting/accounts/:id/currencies/:curId", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { min_balance, max_balance, exchange_rate, is_primary, active } = req.body;
  try {
    if (is_primary) {
      db.prepare("UPDATE account_currencies SET is_primary = 0 WHERE account_id = ?").run(req.params.id);
    }
    db.prepare(`
      UPDATE account_currencies
      SET min_balance = COALESCE(?, min_balance),
          max_balance = COALESCE(?, max_balance),
          exchange_rate = COALESCE(?, exchange_rate),
          is_primary = COALESCE(?, is_primary),
          active = COALESCE(?, active)
      WHERE id = ? AND account_id = ?
    `).run(
      min_balance !== undefined ? Number(min_balance) : null,
      max_balance !== undefined ? Number(max_balance) : null,
      exchange_rate !== undefined ? Number(exchange_rate) : null,
      is_primary !== undefined ? (is_primary ? 1 : 0) : null,
      active !== undefined ? (active ? 1 : 0) : null,
      req.params.curId,
      req.params.id
    );
    const updated = db.prepare("SELECT * FROM account_currencies WHERE id = ?").get(req.params.curId);
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/accounting/accounts/:id/currencies/:curId", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    db.prepare("DELETE FROM account_currencies WHERE id = ? AND account_id = ?").run(req.params.curId, req.params.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Generate Sub-Accounts (Auto-create subaccounts for safes or customers) ───
router.post("/accounting/accounts/:id/generate-subaccounts", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { entity_type } = req.body; // 'safes' | 'customers'
  try {
    const parentAccount = db.prepare("SELECT * FROM accounts WHERE id = ?").get(req.params.id) as any;
    if (!parentAccount) {
      res.status(404).json({ error: "الحساب الرئيسي غير موجود" });
      return;
    }

    let createdCount = 0;
    if (entity_type === "safes") {
      const safes = db.prepare("SELECT * FROM safes WHERE active = 1").all() as any[];
      for (let i = 0; i < safes.length; i++) {
        const safe = safes[i];
        const subCode = `${parentAccount.code}${String(i + 1).padStart(2, "0")}`;
        const existing = db.prepare("SELECT id FROM accounts WHERE code = ?").get(subCode) as any;
        let accId = existing?.id;
        if (!existing) {
          const r = db.prepare(`
            INSERT INTO accounts (code, name, type, parent_code, currency, level, balance, active)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
          `).run(subCode, `${safe.name} - (حساب صندوق فرعي)`, parentAccount.type, parentAccount.code, safe.currency || "YER", (parentAccount.level || 3) + 1, safe.balance || 0);
          accId = r.lastInsertRowid;
          createdCount++;
        }
        db.prepare("INSERT OR IGNORE INTO account_safes (account_id, safe_id) VALUES (?, ?)").run(accId, safe.id);
        db.prepare("UPDATE safes SET account_code = ? WHERE id = ?").run(subCode, safe.id);
      }
    } else if (entity_type === "customers") {
      const customers = db.prepare("SELECT * FROM customers").all() as any[];
      for (let i = 0; i < customers.length; i++) {
        const cust = customers[i];
        const subCode = `${parentAccount.code}${String(i + 1).padStart(3, "0")}`;
        const existing = db.prepare("SELECT id FROM accounts WHERE code = ?").get(subCode) as any;
        let accId = existing?.id;
        if (!existing) {
          const r = db.prepare(`
            INSERT INTO accounts (code, name, type, parent_code, currency, level, balance, active)
            VALUES (?, ?, ?, ?, 'YER', ?, ?, 1)
          `).run(subCode, `${cust.name} - (حساب عميل/وكيل)`, parentAccount.type, parentAccount.code, (parentAccount.level || 3) + 1, cust.balance || 0);
          accId = r.lastInsertRowid;
          createdCount++;
        }
        db.prepare("INSERT OR IGNORE INTO account_customers (account_id, customer_id) VALUES (?, ?)").run(accId, cust.id);
        db.prepare("UPDATE customers SET account_code = ? WHERE id = ?").run(subCode, cust.id);
      }
    }

    res.json({
      success: true,
      message: `تم توليد وربط ${createdCount} حسابات فرعية بنجاح تحت الحساب (${parentAccount.code} - ${parentAccount.name})`
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Bulk Import Accounts ───
router.post("/accounting/accounts/bulk-import", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { accounts = [] } = req.body;
  if (!Array.isArray(accounts) || accounts.length === 0) {
    res.status(400).json({ error: "لم يتم تقديم أي حسابات للاستيراد" });
    return;
  }

  try {
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO accounts (code, name, type, parent_code, currency, level, balance, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const validAccounts: any[] = [];
    const skippedReasons: string[] = [];

    for (let i = 0; i < accounts.length; i++) {
      const a = accounts[i];
      const rawCode = String(a.code ?? "").trim();
      const rawName = String(a.name ?? "").trim();

      // 1. Validation for Code
      if (!rawCode || rawCode.length === 0) {
        skippedReasons.push(`سطر ${i + 1}: كود الحساب فارغ`);
        continue;
      }
      if (rawCode.includes("\uFFFD") || /[\x00-\x08\x0E-\x1F]/.test(rawCode)) {
        skippedReasons.push(`سطر ${i + 1} (${rawCode}): كود الحساب يحتوي على رموز تالفة أو غير مقروءة`);
        continue;
      }

      // 2. Validation for Name
      if (!rawName || rawName.length === 0) {
        skippedReasons.push(`سطر ${i + 1} (${rawCode}): اسم الحساب فارغ`);
        continue;
      }
      if (rawName.includes("\uFFFD") || /[\x00-\x08\x0E-\x1F]/.test(rawName)) {
        skippedReasons.push(`سطر ${i + 1} (${rawCode}): اسم الحساب يحتوي على رموز تالفة أو غير مقروءة`);
        continue;
      }
      // Check if name is purely symbols / question marks or mojibake
      if (/^[\?\s\uFFFD\.\-_]+$/.test(rawName)) {
        skippedReasons.push(`سطر ${i + 1} (${rawCode}): اسم الحساب غير صالح`);
        continue;
      }

      // 3. Normalize Type
      let normalizedType = String(a.type || "").trim().toLowerCase();
      if (normalizedType.includes("أصول") || normalizedType.includes("اصول") || normalizedType.includes("أصل") || normalizedType === "asset") {
        normalizedType = "asset";
      } else if (normalizedType.includes("خصوم") || normalizedType.includes("التزام") || normalizedType.includes("إلتزام") || normalizedType === "liability") {
        normalizedType = "liability";
      } else if (normalizedType.includes("حقوق") || normalizedType.includes("رأس مال") || normalizedType.includes("راس مال") || normalizedType === "equity") {
        normalizedType = "equity";
      } else if (normalizedType.includes("إيراد") || normalizedType.includes("ايراد") || normalizedType.includes("مبيع") || normalizedType === "revenue") {
        normalizedType = "revenue";
      } else if (normalizedType.includes("مصروف") || normalizedType.includes("مصاريف") || normalizedType.includes("تكاليف") || normalizedType === "expense") {
        normalizedType = "expense";
      } else {
        // Infer from code if possible
        if (rawCode.startsWith("1")) normalizedType = "asset";
        else if (rawCode.startsWith("2")) normalizedType = "liability";
        else if (rawCode.startsWith("3")) normalizedType = "equity";
        else if (rawCode.startsWith("4")) normalizedType = "revenue";
        else if (rawCode.startsWith("5")) normalizedType = "expense";
        else normalizedType = "asset";
      }

      const parentCode = a.parent_code ? String(a.parent_code).trim() : null;
      const currency = a.currency ? String(a.currency).trim().toUpperCase() : "YER";
      const balance = Number(a.balance) || 0;
      const level = Number(a.level) || (rawCode.length <= 2 ? 1 : rawCode.length <= 4 ? 2 : 3);

      validAccounts.push({
        code: rawCode,
        name: rawName,
        type: normalizedType,
        parent_code: parentCode,
        currency,
        level,
        balance
      });
    }

    if (validAccounts.length === 0) {
      res.status(400).json({ 
        error: "لم يتم التعرف على أي حسابات صالحة للاستيراد. البيانات المرفوعة تحتوي على رموز تالفة أو أكواد مفقودة.",
        skippedCount: skippedReasons.length,
        skippedReasons
      });
      return;
    }

    const runInsertTx = db.transaction((accs: any[]) => {
      for (const item of accs) {
        insertStmt.run(
          item.code,
          item.name,
          item.type,
          item.parent_code,
          item.currency,
          item.level,
          item.balance
        );
      }
    });

    runInsertTx(validAccounts);

    res.json({ 
      success: true, 
      importedCount: validAccounts.length,
      skippedCount: skippedReasons.length,
      skippedReasons: skippedReasons.slice(0, 10)
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Clean Corrupted / Mojibake Accounts ───
router.post("/accounting/accounts/clean-corrupted", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const allAccounts = db.prepare("SELECT id, code, name FROM accounts").all() as any[];
    const corruptedIds: number[] = [];

    for (const a of allAccounts) {
      const code = String(a.code || "").trim();
      const name = String(a.name || "").trim();
      let isBad = false;

      if (!code || code.length === 0 || code.includes("\uFFFD")) isBad = true;
      if (!name || name.length === 0 || name.includes("\uFFFD")) isBad = true;
      if (/[\x00-\x08\x0E-\x1F]/.test(name) || /[\x00-\x08\x0E-\x1F]/.test(code)) isBad = true;
      if (/^[\?\s\uFFFD\.\-_]+$/.test(name)) isBad = true;

      if (isBad) {
        corruptedIds.push(a.id);
      }
    }

    let deletedCount = 0;
    if (corruptedIds.length > 0) {
      const delStmt = db.prepare("DELETE FROM accounts WHERE id = ?");
      for (const id of corruptedIds) {
        try {
          delStmt.run(id);
          deletedCount++;
        } catch {}
      }
    }

    res.json({ success: true, cleanedCount: deletedCount });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/accounting/accounts/:id/ledger", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const account = db.prepare("SELECT * FROM accounts WHERE id = ? OR code = ?").get(req.params.id, req.params.id) as any;
    if (!account) {
      res.status(404).json({ error: "الحساب غير موجود" });
      return;
    }

    let pilgrimsCount = 0;
    let bookingsCount = 0;
    let visaCount = 0;
    if (account && account.code) {
      try {
        const pCountRes = db.prepare(`
          SELECT COUNT(DISTINCT passenger_id) as c 
          FROM (
            SELECT passenger_id FROM travel_bookings WHERE customer_id IN (SELECT id FROM customers WHERE account_code = ?)
            UNION 
            SELECT passenger_id FROM travel_visas WHERE customer_id IN (SELECT id FROM customers WHERE account_code = ?)
          )
        `).get(account.code, account.code) as any;
        pilgrimsCount = pCountRes ? pCountRes.c : 0;

        const bCountRes = db.prepare(`
          SELECT COUNT(*) as c FROM travel_bookings WHERE customer_id IN (SELECT id FROM customers WHERE account_code = ?)
        `).get(account.code) as any;
        bookingsCount = bCountRes ? bCountRes.c : 0;

        const vCountRes = db.prepare(`
          SELECT COUNT(*) as c FROM travel_visas WHERE customer_id IN (SELECT id FROM customers WHERE account_code = ?)
        `).get(account.code) as any;
        visaCount = vCountRes ? vCountRes.c : 0;
      } catch (err) {
        console.error("Error counting pilgrims for account:", err);
      }
    }

    // Find any linked customer for this account
    const matchedCust = db.prepare("SELECT * FROM customers WHERE account_code = ? OR TRIM(name) = TRIM(?)").get(account.code, account.name) as any;

    // Ensure any posted warehouse sales invoices for this account or matched customer have synced journal entries
    try {
      const pendingWsi = db.prepare(`
        SELECT id FROM warehouse_sales_invoices
        WHERE status = 'posted'
          AND (account_id = ? OR account_code = ? OR (customer_id IS NOT NULL AND customer_id = ?) OR TRIM(customer_name) = TRIM(?))
          AND (journal_entry_id IS NULL OR account_code IS NULL OR account_code != ?)
      `).all(account.id, account.code, matchedCust?.id || -1, account.name, account.code) as { id: number }[];
      for (const w of pendingWsi) {
        syncWarehouseInvoiceJournal(w.id);
      }
    } catch {}

    const lines = db.prepare(`
      SELECT l.*, j.entry_number, j.entry_date, j.description as journal_desc, j.source_type, j.source_id,
             a.code as account_code, a.name as account_name
      FROM journal_entry_lines l
      JOIN journal_entries j ON j.id = l.journal_entry_id
      LEFT JOIN accounts a ON a.id = l.account_id
      WHERE l.account_id = ? OR a.code = ? OR l.account_code = ? OR l.account_id IN (SELECT id FROM accounts WHERE parent_code = ?)
      ORDER BY j.entry_date ASC, j.id ASC
    `).all(account.id, account.code, account.code, account.code) as any[];

    // Also pull any warehouse_sales_invoices for this account / customer if not already in journal lines
    try {
      const existingWsiIds = new Set(
        lines.filter(l => l.source_type === "warehouse_sales_invoice").map(l => String(l.source_id || ""))
      );
      const wsiRows = db.prepare(`
        SELECT * FROM warehouse_sales_invoices
        WHERE status != 'cancelled'
          AND (account_id = ? OR account_code = ? OR (customer_id IS NOT NULL AND customer_id = ?) OR TRIM(customer_name) = TRIM(?))
        ORDER BY invoice_date ASC, id ASC
      `).all(account.id, account.code, matchedCust?.id || -1, account.name) as any[];

      for (const wsi of wsiRows) {
        if (existingWsiIds.has(String(wsi.id))) continue;
        const cur = (wsi.currency === "ريال" || !wsi.currency) ? "YER" : String(wsi.currency).toUpperCase();
        const totalAmt = Number(wsi.total_amount || 0);
        const paidAmt = Number(wsi.paid_amount || 0);
        if (totalAmt > 0) {
          lines.push({
            id: `wsi_${wsi.id}`,
            account_id: account.id,
            debit: totalAmt,
            credit: 0,
            description: `فاتورة مبيعات مخزنية (${wsi.payment_type === "credit" ? "آجل" : "نقداً"}) رقم ${wsi.invoice_no} - ${wsi.customer_name || account.name}`,
            currency: cur,
            exchange_rate: Number(wsi.exchange_rate || 1),
            entry_number: wsi.invoice_no,
            entry_date: wsi.invoice_date || (wsi.created_at ? wsi.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
            journal_desc: `فاتورة مبيعات مخزنية رقم ${wsi.invoice_no}`,
            source_type: "warehouse_sales_invoice",
            source_id: wsi.id,
            account_code: account.code,
            account_name: account.name
          });
          if (wsi.payment_type !== "credit" || paidAmt > 0) {
            const settled = wsi.payment_type !== "credit" ? (paidAmt > 0 ? paidAmt : totalAmt) : paidAmt;
            if (settled > 0) {
              lines.push({
                id: `wsi_pay_${wsi.id}`,
                account_id: account.id,
                debit: 0,
                credit: settled,
                description: `سداد فاتورة مبيعات مخزنية رقم ${wsi.invoice_no} - ${wsi.customer_name || account.name}`,
                currency: cur,
                exchange_rate: Number(wsi.exchange_rate || 1),
                entry_number: wsi.invoice_no,
                entry_date: wsi.invoice_date || (wsi.created_at ? wsi.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
                journal_desc: `سداد فاتورة مبيعات مخزنية رقم ${wsi.invoice_no}`,
                source_type: "warehouse_sales_invoice_payment",
                source_id: wsi.id,
                account_code: account.code,
                account_name: account.name
              });
            }
          }
        }
      }
    } catch (err) {
      console.error("Error fetching warehouse_sales_invoices for account ledger:", err);
    }

    // If account matches a customer, also include any POS orders / returns / vouchers not yet in journal lines
    if (matchedCust) {
      try {
        const existingOrderIds = new Set(
          lines.filter(l => l.source_type === "order" || l.source_type === "pos_order" || l.source_type === "sale" || l.source_type === "inventory_sale").map(l => String(l.source_id || ""))
        );
        const custOrders = db.prepare("SELECT id, invoice_number, total, payment_method, created_at, note FROM orders WHERE customer_id = ? AND payment_method IN ('credit', 'split') AND (status IS NULL OR status NOT IN ('cancelled', 'returned'))").all(matchedCust.id) as any[];
        for (const o of custOrders) {
          if (existingOrderIds.has(String(o.id))) continue;
          const dateStr = o.created_at ? o.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
          lines.push({
            id: `ord_${o.id}`,
            account_id: account.id,
            debit: Number(o.total || 0),
            credit: 0,
            description: `فاتورة نقطة بيع POS رقم ${o.invoice_number}`,
            currency: "YER",
            exchange_rate: 1,
            entry_number: o.invoice_number,
            entry_date: dateStr,
            journal_desc: o.note || `فاتورة مبيعات رقم ${o.invoice_number}`,
            source_type: "order",
            source_id: o.id,
            account_code: account.code,
            account_name: account.name
          });
        }
      } catch {}
    }

    // If account belongs to a transport company, also pull bus bookings if not yet in journal lines
    if (account && account.code) {
      try {
        const tc = db.prepare("SELECT * FROM travel_transport_companies WHERE account_code = ? OR name = ?").get(account.code, account.name) as any;
        if (tc) {
          const busBookings = db.prepare(`
            SELECT id, booking_number, ticket_number, cost_price, selling_price, supplier_currency,
                   origin_city, destination_city, departure_date, created_at, notes, passenger_name, company_name
            FROM travel_bus_bookings
            WHERE (company_id = ? OR company_name = ?)
              AND COALESCE(supplier_payment_method, '') NOT IN ('cash', 'bank', 'نقداً', 'تحويل بنكي')
          `).all(tc.id, tc.name) as any[];

          const existingBookingIds = new Set(
            lines.filter(l => l.source_type === 'bus_booking').map(l => String(l.source_id || ''))
          );
          
          busBookings.forEach(bb => {
            if (!existingBookingIds.has(String(bb.id))) {
              lines.push({
                id: `bus_${bb.id}`,
                account_id: account.id,
                debit: 0,
                credit: Number(bb.cost_price || 0),
                description: `حجز نقل بري: ${bb.origin_city || ''} ➡️ ${bb.destination_city || ''} (تذكرة: ${bb.ticket_number || bb.booking_number}) - راكب: ${bb.passenger_name || ''}`,
                currency: bb.supplier_currency || "SAR",
                exchange_rate: 1,
                foreign_amount: 0,
                cost_center_id: null,
                entry_number: bb.booking_number,
                entry_date: bb.departure_date || (bb.created_at ? bb.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
                journal_desc: `تذكرة باص ${bb.company_name || tc.name}`,
                source_type: 'bus_booking',
                source_id: bb.id,
                account_code: account.code,
                account_name: account.name
              });
            }
          });
        }
      } catch (err) {
        console.error("Error fetching transport bus bookings for account ledger:", err);
      }
    }

    // If account matches an employee (starts with 214), also include any meal deductions not yet in journal lines
    if (account && account.code && account.code.startsWith("214") && account.code !== "21400") {
      try {
        const matchedEmp = db.prepare("SELECT * FROM hr_employees WHERE account_code = ? OR TRIM(name) = TRIM(?)").get(account.code, account.name) as any;
        if (matchedEmp) {
          const existingMealIds = new Set(
            lines.filter(l => l.source_type === "meal_deduction" || l.source_type === "sale" || String(l.description || l.journal_desc).includes("وجبة")).map(l => String(l.source_id || ""))
          );
          const empMeals = db.prepare("SELECT id, amount, notes, created_at, order_id, invoice_number, cashier_name FROM meal_deductions WHERE employee_id = ?").all(matchedEmp.id) as any[];
          for (const m of empMeals) {
            if (m.order_id && existingMealIds.has(String(m.order_id))) continue;
            if (existingMealIds.has(String(m.id))) continue;
            const dateStr = m.created_at ? m.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
            lines.push({
              id: `meal_${m.id}`,
              account_id: account.id,
              debit: Number(m.amount || 0), // Debiting employee (reducing credit balance)
              credit: 0,
              description: `خصم وجبة للموظف - سند تلقائي #${m.id} ${m.notes ? `(${m.notes})` : ''}`,
              currency: "SAR",
              exchange_rate: 1,
              entry_number: m.invoice_number || `MEAL-${m.id}`,
              entry_date: dateStr,
              journal_desc: m.notes || `خصم وجبة للموظف - ${m.cashier_name || ''}`,
              source_type: "meal_deduction",
              source_id: m.id,
              account_code: account.code,
              account_name: account.name
            });
          }
        }
      } catch (err) {
        console.error("Error fetching meal deductions for employee ledger:", err);
      }
    }

    const isDebitNormal = ["asset", "expense", "cogs", "wastage"].includes(account.type);

    const currencySummaries: Record<string, { totalDebit: number; totalCredit: number; balance: number }> = {
      SAR: { totalDebit: 0, totalCredit: 0, balance: 0 },
      YER: { totalDebit: 0, totalCredit: 0, balance: 0 },
      USD: { totalDebit: 0, totalCredit: 0, balance: 0 }
    };

    lines.forEach(line => {
      const cur = (line.currency || "SAR").toUpperCase();
      if (!currencySummaries[cur]) {
        currencySummaries[cur] = { totalDebit: 0, totalCredit: 0, balance: 0 };
      }
      const debitVal = Number(line.debit || 0);
      const creditVal = Number(line.credit || 0);
      currencySummaries[cur].totalDebit += debitVal;
      currencySummaries[cur].totalCredit += creditVal;
      const change = isDebitNormal ? (debitVal - creditVal) : (creditVal - debitVal);
      currencySummaries[cur].balance += change;
    });

    const { currency, start_date, end_date } = req.query as any;
    let targetLines = lines;
    if (currency && currency !== "all") {
      targetLines = targetLines.filter(line => String(line.currency || "SAR").toUpperCase() === currency.toUpperCase());
    }

    let previousBalance = 0;
    let runningBalance = 0;
    const ledger: any[] = [];
    targetLines.forEach(line => {
      const change = isDebitNormal ? (Number(line.debit || 0) - Number(line.credit || 0)) : (Number(line.credit || 0) - Number(line.debit || 0));
      const d = line.entry_date || "";
      if (start_date && d && d < start_date) {
        previousBalance += change;
      } else if (end_date && d && d > end_date) {
        // out of range
      } else {
        runningBalance = (ledger.length === 0 ? previousBalance : runningBalance) + change;
        ledger.push({
          ...line,
          running_balance: runningBalance
        });
      }
    });

    const finalBalance = ledger.length > 0 ? runningBalance : previousBalance;
    account.balance = finalBalance;

    res.json({
      account,
      previousBalance,
      currentBalance: finalBalance,
      ledger,
      lines: ledger,
      currencySummaries,
      pilgrimsCount,
      bookingsCount,
      visaCount
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


/* ─── 3. Journal Entries & Double-Entry (القيود اليومية) ─── */
router.get("/accounting/journal-entries", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { search, from_date, to_date, doc_type } = req.query as any;
    let query = "SELECT * FROM journal_entries WHERE 1=1";
    const params: any[] = [];

    if (search) {
      query += " AND (entry_number LIKE ? OR description LIKE ? OR reference_no LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (from_date) {
      query += " AND entry_date >= ?";
      params.push(from_date);
    }
    if (to_date) {
      query += " AND entry_date <= ?";
      params.push(to_date);
    }
    if (doc_type && doc_type !== "all") {
      query += " AND doc_type = ?";
      params.push(doc_type);
    }

    query += " ORDER BY id DESC";

    const entries = db.prepare(query).all(...params) as any[];
    for (const entry of entries) {
      entry.lines = db.prepare(`
        SELECT l.*, a.code as account_code, a.name as account_name, a.type as account_type
        FROM journal_entry_lines l
        JOIN accounts a ON a.id = l.account_id
        WHERE l.journal_entry_id = ?
        ORDER BY l.id ASC
      `).all(entry.id);
    }
    res.json(entries);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/accounting/journal-entries/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const entry = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(req.params.id) as any;
    if (!entry) {
      res.status(404).json({ error: "القيد المحاسبي غير موجود" });
      return;
    }
    entry.lines = db.prepare(`
      SELECT l.*, a.code as account_code, a.name as account_name, a.type as account_type
      FROM journal_entry_lines l
      JOIN accounts a ON a.id = l.account_id
      WHERE l.journal_entry_id = ?
      ORDER BY l.id ASC
    `).all(entry.id);
    res.json(entry);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/accounting/journal-entries", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const {
    entry_date,
    description,
    lines,
    currency,
    currency_rate,
    reference_no,
    doc_type,
    cost_center_id,
    entry_class,
    tx_code,
    attachments
  } = req.body;

  if (!description || !Array.isArray(lines) || lines.length < 2) {
    res.status(400).json({ error: "يجب إدخال بيان القيد وبندين محاسبيين على الأقل (مدين ودائن)" });
    return;
  }

  try {
    const entryId = createDoubleEntryJournal(
      entry_date || getBusinessDate("accounting"),
      description,
      "manual",
      0,
      lines,
      {
        currency: currency || "YER",
        currency_rate: Number(currency_rate) || 1.0,
        reference_no,
        doc_type: doc_type || "قيد عادي",
        cost_center_id: cost_center_id ? Number(cost_center_id) : undefined,
        entry_class: entry_class || "عام",
        tx_code,
        attachments: attachments ? JSON.stringify(attachments) : undefined
      }
    );
    const created = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(entryId) as any;
    created.lines = db.prepare(`
      SELECT l.*, a.code as account_code, a.name as account_name, a.type as account_type
      FROM journal_entry_lines l
      JOIN accounts a ON a.id = l.account_id
      WHERE l.journal_entry_id = ?
      ORDER BY l.id ASC
    `).all(entryId);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.put("/accounting/journal-entries/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const {
    entry_date,
    description,
    lines,
    currency,
    currency_rate,
    reference_no,
    doc_type,
    cost_center_id,
    entry_class,
    tx_code,
    attachments
  } = req.body;

  if (!description || !Array.isArray(lines) || lines.length < 2) {
    res.status(400).json({ error: "يجب إدخال بيان القيد وبندين محاسبيين على الأقل (مدين ودائن)" });
    return;
  }

  try {
    const entryId = Number(req.params.id);
    updateDoubleEntryJournal(
      entryId,
      entry_date || getBusinessDate("accounting"),
      description,
      lines,
      {
        currency: currency || "YER",
        currency_rate: Number(currency_rate) || 1.0,
        reference_no,
        doc_type: doc_type || "قيد عادي",
        cost_center_id: cost_center_id ? Number(cost_center_id) : undefined,
        entry_class: entry_class || "عام",
        tx_code,
        attachments: attachments ? JSON.stringify(attachments) : undefined
      }
    );
    const updated = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(entryId) as any;
    updated.lines = db.prepare(`
      SELECT l.*, a.code as account_code, a.name as account_name, a.type as account_type
      FROM journal_entry_lines l
      JOIN accounts a ON a.id = l.account_id
      WHERE l.journal_entry_id = ?
      ORDER BY l.id ASC
    `).all(entryId);
    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/accounting/journal-entries/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const entryId = Number(req.params.id);
    deleteDoubleEntryJournal(entryId);
    res.json({ success: true, message: "تم حذف القيد المحاسبي وتعديل الأرصدة بنجاح" });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/accounting/journal-entries/:id/reverse", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  try {
    const originalEntry = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(req.params.id) as any;
    if (!originalEntry) {
      res.status(404).json({ error: "القيد غير موجود" });
      return;
    }
    if (originalEntry.is_reversed) {
      res.status(400).json({ error: "هذا القيد معكوس ومصحح مسبقاً!" });
      return;
    }

    const originalLines = db.prepare(`
      SELECT l.*, a.code as account_code
      FROM journal_entry_lines l
      JOIN accounts a ON a.id = l.account_id
      WHERE l.journal_entry_id = ?
    `).all(req.params.id) as any[];

    // Swapping debits and credits to create reversing entry
    const reversedLines = originalLines.map(l => ({
      account_code: l.account_code,
      debit: l.credit,
      credit: l.debit,
      description: `عكس قيد: ${l.description || originalEntry.description}`
    }));

    const reversalId = createDoubleEntryJournal(
      new Date().toISOString().slice(0, 10),
      `قيد عكس وتصحيح للقيد رقم ${originalEntry.entry_number} بواسطة ${user?.name || "الموافق"}`,
      "reversal",
      originalEntry.id,
      reversedLines
    );

    db.prepare("UPDATE journal_entries SET is_reversed = 1 WHERE id = ?").run(originalEntry.id);
    db.prepare("UPDATE journal_entries SET reversal_of_id = ? WHERE id = ?").run(originalEntry.id, reversalId);

    res.json({ message: "تم عكس القيد بنجاح وإنشاء قيد تسوية عكسي", reversalId });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/accounting/trial-balance", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const accounts = db.prepare("SELECT * FROM accounts ORDER BY code ASC").all() as any[];
    let totalDebit = 0;
    let totalCredit = 0;
    
    const balanceSheet = accounts.map(acc => {
      const isDebitNormal = ["asset", "expense", "cogs", "wastage"].includes(acc.type);
      let debit = 0;
      let credit = 0;
      
      if (acc.balance >= 0) {
        if (isDebitNormal) {
          debit = acc.balance;
        } else {
          credit = acc.balance;
        }
      } else {
        if (isDebitNormal) {
          credit = Math.abs(acc.balance);
        } else {
          debit = Math.abs(acc.balance);
        }
      }
      
      totalDebit += debit;
      totalCredit += credit;
      
      return {
        ...acc,
        debit,
        credit
      };
    });
    
    res.json({
      accounts: balanceSheet,
      totalDebit,
      totalCredit
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


/* ─── 3.1 System Users for Vouchers & Statements ─── */
router.get("/accounting/system-users", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const user = getAuthUser(req);
    const isDev = user && (user.role === "developer" || user.username === "developer");
    let sql = `
      SELECT id, username, name, role, active 
      FROM users 
      WHERE active = 1 
    `;
    if (!isDev) {
      sql += ` AND role != 'developer' AND username != 'developer' AND name NOT LIKE '%مطور%' `;
    }
    sql += ` ORDER BY CASE WHEN role='admin' THEN 1 WHEN role='manager' THEN 2 WHEN role='accountant' THEN 3 ELSE 4 END, name`;
    const users = db.prepare(sql).all();
    res.json(users);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


/* ─── 4. Receipt & Payment Vouchers (سندات القبض والصرف) ─── */
router.get("/accounting/vouchers", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { type, party_type, party_id, search } = req.query as any;

  let sql = "SELECT * FROM vouchers WHERE 1=1";
  const params: any[] = [];

  if (type) {
    sql += " AND type = ?";
    params.push(type);
  }
  if (party_type) {
    sql += " AND party_type = ?";
    params.push(party_type);
  }
  if (party_id) {
    sql += " AND party_id = ?";
    params.push(party_id);
  }
  if (search) {
    sql += " AND (voucher_number LIKE ? OR party_name LIKE ? OR received_from LIKE ? OR payment_against LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  sql += " ORDER BY id DESC";
  try {
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/accounting/vouchers/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const row = db.prepare("SELECT * FROM vouchers WHERE id = ?").get(req.params.id);
    if (!row) {
      res.status(404).json({ error: "السند غير موجود" });
      return;
    }
    res.json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/accounting/vouchers", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const {
    type,
    party_type = "general",
    party_id = 0,
    party_name,
    amount,
    currency,
    received_from,
    payment_against,
    payment_method,
    amount_text,
    notes,
    header_title,
    header_subtitle,
    logo_url,
    accent_color,
    bottom_text,
    safe_id,
    bank_account_id,
    cost_center_id,
  } = req.body;

  let finalPartyName = party_name || received_from;
  const numericPartyId = Number(party_id) || 0;

  if (!finalPartyName && numericPartyId > 0) {
    if (party_type === "employee") {
      const emp = db.prepare("SELECT name FROM hr_employees WHERE id = ?").get(numericPartyId) as any;
      if (emp) finalPartyName = emp.name;
    } else if (party_type === "customer") {
      const cust = db.prepare("SELECT name FROM customers WHERE id = ?").get(numericPartyId) as any;
      if (cust) finalPartyName = cust.name;
    } else if (party_type === "supplier") {
      const supp = db.prepare("SELECT name FROM suppliers WHERE id = ?").get(numericPartyId) as any;
      if (supp) finalPartyName = supp.name;
    } else if (party_type === "account") {
      const acc = db.prepare("SELECT name FROM accounts WHERE id = ?").get(numericPartyId) as any;
      if (acc) finalPartyName = acc.name;
    } else if (party_type === "user" || party_type === "system_user") {
      const sysUser = db.prepare("SELECT id, name, username, role FROM users WHERE id = ?").get(numericPartyId) as any;
      if (sysUser) {
        const roleLabel = sysUser.role === 'admin' ? 'مدير نظام' : sysUser.role === 'accountant' ? 'محاسب' : sysUser.role === 'manager' ? 'مدير فرع' : 'كاشير';
        finalPartyName = `${sysUser.name} (${roleLabel})`;
      }
    }
  }

  if ((party_type === "user" || party_type === "system_user") && numericPartyId > 0) {
    const sysUser = db.prepare("SELECT id, name, username, role FROM users WHERE id = ?").get(numericPartyId) as any;
    if (sysUser) {
      const roleLabel = sysUser.role === 'admin' ? 'مدير نظام' : sysUser.role === 'accountant' ? 'محاسب' : sysUser.role === 'manager' ? 'مدير فرع' : 'كاشير';
      finalPartyName = `${sysUser.name} (${roleLabel})`;
    }
  }

  if (!finalPartyName && numericPartyId > 0) {
    finalPartyName = `طرف #${numericPartyId}`;
  }

  const numericAmount = Number(amount);

  if (!type || amount === undefined || amount === null || String(amount).trim() === "" || isNaN(numericAmount)) {
    res.status(400).json({ error: "الرجاء تحديد نوع السند وإدخال مبلغ مالي صحيح" });
    return;
  }

  if (!finalPartyName || !String(finalPartyName).trim()) {
    res.status(400).json({ error: "يرجى اختيار الطرف المستهدف أو كتابة اسم المستلم / المدفوع له" });
    return;
  }

  try {
    const maxRow = db.prepare("SELECT MAX(id) as maxId FROM vouchers").get() as { maxId: number };
    const nextId = (maxRow.maxId || 0) + 1;
    const nextNum = String(nextId);

    let finalSafeId = safe_id ? Number(safe_id) : null;
    let finalBankId = bank_account_id ? Number(bank_account_id) : null;

    if (!finalSafeId && !finalBankId) {
      const defaultSafe = db.prepare("SELECT id FROM safes WHERE name = 'الصندوق الرئيسي' LIMIT 1").get() as any;
      if (defaultSafe) finalSafeId = defaultSafe.id;
    }

    const docSettings = db.prepare("SELECT * FROM document_print_settings WHERE id = 1").get() as any;

    const r = db.prepare(`
      INSERT INTO vouchers (
        voucher_number, type, party_type, party_id, party_name, amount, currency,
        received_from, payment_against, payment_method, amount_text, notes,
        header_title, header_subtitle, logo_url, accent_color, bottom_text, safe_id, bank_account_id, cost_center_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      nextNum,
      type,
      party_type || "general",
      numericPartyId,
      finalPartyName,
      numericAmount,
      currency ?? "ريال",
      received_from ?? finalPartyName ?? "",
      payment_against ?? "",
      payment_method ?? "cash",
      amount_text ?? "",
      notes ?? "",
      header_title ?? docSettings?.company_name ?? "مخابز الشام للخبز العربي",
      header_subtitle ?? docSettings?.company_subtitle ?? "Maamil Al Sham",
      logo_url ?? docSettings?.logo_url ?? "/omnisystem-logo.png",
      accent_color ?? docSettings?.accent_color ?? "#ef4444",
      bottom_text ?? docSettings?.voucher_footer_text ?? "جودة الخبز ... سر ثقة عملائنا",
      finalSafeId,
      finalBankId,
      cost_center_id ? Number(cost_center_id) : null
    );

    const voucherId = r.lastInsertRowid;

    // --- Financial Impact: Journal Entry ---
    try {
      const safeAccCode = finalBankId ? "11120" : "11100"; // Bank or Cash
      let partyAccCode = "11100"; // Default

      if (party_type === "account" && numericPartyId > 0) {
        const acc = db.prepare("SELECT code FROM accounts WHERE id = ?").get(numericPartyId) as any;
        if (acc) partyAccCode = acc.code;
      } else if (party_type === "customer" && numericPartyId > 0) {
        partyAccCode = getCustomerAccountCode(numericPartyId);
      } else if (party_type === "supplier" && numericPartyId > 0) {
        partyAccCode = getSupplierAccountCode(numericPartyId);
      } else if (party_type === "employee" && numericPartyId > 0) {
        // Find employee account if exists, else use 21100 (Suppliers/Payables) or general expenses
        const emp = db.prepare("SELECT account_code FROM hr_employees WHERE id = ?").get(numericPartyId) as any;
        partyAccCode = emp?.account_code || "21100";
      }

      const journalLines: any[] = [];
      const description = `${type === 'receipt' ? 'سند قبض' : 'سند صرف'} رقم ${nextNum} - ${finalPartyName} (${notes || ''})`;

      if (type === "receipt") {
        // Receipt: Debit Safe/Bank, Credit Party
        journalLines.push(
          { account_code: safeAccCode, debit: numericAmount, credit: 0, description },
          { account_code: partyAccCode, debit: 0, credit: numericAmount, description }
        );
      } else {
        // Payment: Debit Party, Credit Safe/Bank
        journalLines.push(
          { account_code: partyAccCode, debit: numericAmount, credit: 0, description },
          { account_code: safeAccCode, debit: 0, credit: numericAmount, description }
        );
      }

      createDoubleEntryJournal(
        new Date().toISOString().slice(0, 10),
        description,
        "voucher",
        Number(voucherId),
        journalLines,
        { currency: currency || "SAR", cost_center_id: cost_center_id ? Number(cost_center_id) : undefined }
      );
    } catch (journalErr) {
      console.error("Error creating journal entry for voucher:", journalErr);
      // We don't fail the voucher creation if journal fails, but in a real system we might.
    }

    // Balance Updates
    if (finalSafeId) {
      if (type === "receipt") {
        db.prepare("UPDATE safes SET balance = balance + ? WHERE id = ?").run(numericAmount, finalSafeId);
      } else if (type === "payment") {
        db.prepare("UPDATE safes SET balance = balance - ? WHERE id = ?").run(numericAmount, finalSafeId);
      }
    } else if (finalBankId) {
      if (type === "receipt") {
        db.prepare("UPDATE bank_accounts SET balance = balance + ? WHERE id = ?").run(numericAmount, finalBankId);
      } else if (type === "payment") {
        db.prepare("UPDATE bank_accounts SET balance = balance - ? WHERE id = ?").run(numericAmount, finalBankId);
      }
    }

    // Party Balance update for Customer or Supplier
    if (party_type === "customer" && numericPartyId > 0) {
      if (type === "receipt") {
        db.prepare("UPDATE customers SET balance = balance - ? WHERE id = ?").run(numericAmount, numericPartyId);
      } else {
        db.prepare("UPDATE customers SET balance = balance + ? WHERE id = ?").run(numericAmount, numericPartyId);
      }
    } else if (party_type === "supplier" && numericPartyId > 0) {
      if (type === "payment") {
        db.prepare("UPDATE suppliers SET balance = balance - ? WHERE id = ?").run(numericAmount, numericPartyId);
      } else {
        db.prepare("UPDATE suppliers SET balance = balance + ? WHERE id = ?").run(numericAmount, numericPartyId);
      }
    }

    // Vouchers are standalone as requested (decoupled from journal entries)
    const created = db.prepare("SELECT * FROM vouchers WHERE id = ?").get(voucherId);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/accounting/vouchers/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const {
    voucher_number, type, party_type, party_id, party_name, amount, currency,
    received_from, payment_against, payment_method, amount_text, notes,
    header_title, header_subtitle, logo_url, accent_color, bottom_text, created_at
  } = req.body;

  try {
    db.prepare(`
      UPDATE vouchers
      SET voucher_number = ?, type = ?, party_type = ?, party_id = ?, party_name = ?, amount = ?, currency = ?,
          received_from = ?, payment_against = ?, payment_method = ?, amount_text = ?, notes = ?,
          header_title = ?, header_subtitle = ?, logo_url = ?, accent_color = ?, bottom_text = ?, created_at = ?
      WHERE id = ?
    `).run(
      voucher_number, type, party_type, party_id, party_name, amount, currency ?? "ريال",
      received_from ?? "", payment_against ?? "", payment_method ?? "cash", amount_text ?? "", notes ?? "",
      header_title ?? "مخابز الشام للخبز العربي", header_subtitle ?? "Maamil Al Sham",
      logo_url ?? "/omnisystem-logo.png", accent_color ?? "#ef4444", bottom_text ?? "جودة الخبز ... سر ثقة عملائنا",
      created_at ?? new Date().toISOString(), req.params.id
    );

    const updated = db.prepare("SELECT * FROM vouchers WHERE id = ?").get(req.params.id);
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/accounting/vouchers/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const voucher = db.prepare("SELECT type, amount, safe_id, bank_account_id FROM vouchers WHERE id = ?").get(req.params.id) as any;
    if (voucher) {
      if (voucher.safe_id) {
        if (voucher.type === "receipt") {
          db.prepare("UPDATE safes SET balance = balance - ? WHERE id = ?").run(voucher.amount, voucher.safe_id);
        } else if (voucher.type === "payment") {
          db.prepare("UPDATE safes SET balance = balance + ? WHERE id = ?").run(voucher.amount, voucher.safe_id);
        }
      } else if (voucher.bank_account_id) {
        if (voucher.type === "receipt") {
          db.prepare("UPDATE bank_accounts SET balance = balance - ? WHERE id = ?").run(voucher.amount, voucher.bank_account_id);
        } else if (voucher.type === "payment") {
          db.prepare("UPDATE bank_accounts SET balance = balance + ? WHERE id = ?").run(voucher.amount, voucher.bank_account_id);
        }
      }
    }

    db.prepare("DELETE FROM vouchers WHERE id = ?").run(req.params.id);
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


/* ─── 5. Manual Ledger Entries (تعديلات الحساب والقيود اليدوية) ─── */
router.post("/accounting/manual-entries", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { party_type, party_id, entry_date, description, debit, credit, notes } = req.body;

  if (!party_type || !party_id || !entry_date || !description) {
    res.status(400).json({ error: "جميع حقول القيد اليدوي مطلوبة (الطرف، التاريخ، البيان)" });
    return;
  }

  try {
    const r = db.prepare(`
      INSERT INTO manual_ledger_entries (party_type, party_id, entry_date, description, debit, credit, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      party_type, party_id, entry_date, description, debit ?? 0, credit ?? 0, notes ?? ""
    );

    const created = db.prepare("SELECT * FROM manual_ledger_entries WHERE id = ?").get(r.lastInsertRowid);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/accounting/manual-entries/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    db.prepare("DELETE FROM manual_ledger_entries WHERE id = ?").run(req.params.id);
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


/* ─── 6. Dynamic Account Statements (كشف حساب للعملاء والموظفين والموردين) ─── */
router.get("/accounting/statement/:party_type/:party_id", (req, res) => {
  try { syncSupplierAccounts(); /* statement sync */ } catch {}
  if (!requireAdmin(req, res)) return;
  const { party_type, party_id } = req.params;
  const { start_date, end_date, currency } = req.query as any;

  try {
    let partyInfo: any = null;
    if (party_type === "employee") {
      partyInfo = db.prepare(`
        SELECT e.*, d.name as department_name 
        FROM hr_employees e 
        LEFT JOIN hr_departments d ON d.id = e.department_id 
        WHERE e.id = ?
      `).get(party_id);
    } else if (party_type === "supplier") {
      partyInfo = db.prepare("SELECT * FROM suppliers WHERE id = ?").get(party_id)
        || db.prepare("SELECT id, name, phone, account_code FROM travel_suppliers WHERE id = ?").get(party_id)
        || db.prepare("SELECT id, name, phone, account_code FROM travel_transport_companies WHERE id = ?").get(party_id)
        || db.prepare("SELECT id, name_ar as name, phone, account_code FROM travel_hotels_db WHERE id = ?").get(party_id)
        || db.prepare("SELECT id, name, phone, account_code FROM travel_partner_offices WHERE id = ?").get(party_id);
    } else if (party_type === "transport" || party_type === "transport_company") {
      partyInfo = db.prepare("SELECT id, name, phone, account_code, notes FROM travel_transport_companies WHERE id = ?").get(party_id);
    } else if (party_type === "hotel") {
      partyInfo = db.prepare("SELECT id, name_ar as name, phone, account_code, notes FROM travel_hotels_db WHERE id = ?").get(party_id);
    } else if (party_type === "user" || party_type === "system_user") {
      const user = getAuthUser(req);
      const isDev = user && (user.role === "developer" || user.username === "developer");
      const sysUser = db.prepare("SELECT id, name, username, role, phone FROM users WHERE id = ?").get(party_id) as any;
      if (sysUser && (isDev || (sysUser.role !== "developer" && sysUser.username !== "developer" && !String(sysUser.name || "").includes("مطور")))) {
        const roleLabel = sysUser.role === 'admin' ? 'مدير نظام' : sysUser.role === 'accountant' ? 'محاسب' : sysUser.role === 'manager' ? 'مدير فرع' : 'كاشير';
        partyInfo = {
          id: sysUser.id,
          name: `${sysUser.name} (${roleLabel})`,
          username: sysUser.username,
          role: sysUser.role,
          phone: sysUser.phone || "مستخدم نظام",
          address: `الدور الوظيفي: ${roleLabel}`
        };
      }
    } else if (party_type === "account") {
      partyInfo = db.prepare("SELECT * FROM accounts WHERE id = ? OR code = ?").get(party_id, party_id);
    } else {
      partyInfo = db.prepare("SELECT * FROM customers WHERE id = ?").get(party_id) as any;
      
      // STRICT ACCOUNTING RULE: If this is an agency affiliated or indirect customer, reject individual statement!
      const isIndirect = partyInfo && (
        partyInfo.affiliation_type === 'agency' || 
        partyInfo.affiliation_type === 'indirect' || 
        partyInfo.customer_type === 'indirect' || 
        partyInfo.customer_type === 'agent_customer' || 
        partyInfo.customer_type === 'sub_customer' || 
        (partyInfo.affiliation_type !== 'direct' && (
          (partyInfo.office_id != null && Number(partyInfo.office_id) > 1) || 
          (partyInfo.partner_office_id != null && Number(partyInfo.partner_office_id) > 1) || 
          (partyInfo.office_name && String(partyInfo.office_name).trim() !== '' && !String(partyInfo.office_name).includes('الرئيسي') && !String(partyInfo.office_name).includes('مباشر'))
        ))
      );

      if (isIndirect) {
        res.status(400).json({
          error: `العميل (${partyInfo.name}) تابع لمكتب وكيل / وسيط (${partyInfo.office_name || 'المكتب الوسيط'}). لا يملك هذا العميل حساباً فردياً مستقلاً أو كشف حساب خاص في نظام الحسابات، وتظهر كافة معاملاته والتزاماته المالية حصرياً في كشف حساب المكتب الوسيط التابع له.`
        });
        return;
      }
    }

    if (!partyInfo) {
      res.status(404).json({ error: "الطرف المحدد غير موجود" });
      return;
    }

    const transactions: any[] = [];

    // Ensure any posted warehouse sales invoices for this customer/account have their journal entry synced
    try {
      if (party_type === "customer") {
        const custAccCode = getCustomerAccountCode(party_id);
        if (custAccCode && partyInfo.account_code !== custAccCode) {
          partyInfo.account_code = custAccCode;
        }
        const custWsi = db.prepare(`
          SELECT id FROM warehouse_sales_invoices
          WHERE status = 'posted' AND (customer_id = ? OR TRIM(customer_name) = TRIM(?))
        `).all(party_id, partyInfo.name || "") as { id: number }[];
        for (const w of custWsi) {
          syncWarehouseInvoiceJournal(w.id);
        }
      } else if (party_type === "account") {
        const accWsi = db.prepare(`
          SELECT id FROM warehouse_sales_invoices
          WHERE status = 'posted' AND (account_id = ? OR account_code = ? OR TRIM(customer_name) = TRIM(?))
        `).all(partyInfo.id, partyInfo.code, partyInfo.name || "") as { id: number }[];
        for (const w of accWsi) {
          syncWarehouseInvoiceJournal(w.id);
        }
      }
    } catch {}

    // Also pull journal entry lines matching the account code / party account code
    try {
      let accCode = partyInfo?.account_code;
      if (!accCode && party_type === "account") {
        accCode = partyInfo?.code;
      } else if (!accCode && (party_type === "supplier" || party_type === "transport" || party_type === "transport_company" || party_type === "hotel")) {
        accCode = getSupplierAccountCode(party_id);
      } else if (party_type === "customer") {
        accCode = getCustomerAccountCode(party_id) || partyInfo?.account_code;
      }

      if (accCode) {
        const jLines = db.prepare(`
          SELECT l.*, j.entry_number, j.entry_date, j.description as journal_desc, j.source_type, j.source_id, j.currency as header_currency
          FROM journal_entry_lines l
          JOIN journal_entries j ON j.id = l.journal_entry_id
          LEFT JOIN accounts a ON a.id = l.account_id
          WHERE (a.code = ? OR a.id = ? OR l.account_code = ?) AND (j.source_type IS NULL OR j.source_type != 'voucher')
        `).all(accCode, accCode, accCode) as any[];

        jLines.forEach(jl => {
          let lineCurrency = jl.currency || jl.header_currency || "SAR";
          if (jl.source_type === "hotel" && jl.source_id) {
            try {
              const htl = db.prepare("SELECT supplier_currency, customer_currency FROM travel_hotels WHERE id = ?").get(jl.source_id) as any;
              if (htl) {
                lineCurrency = htl.supplier_currency || htl.customer_currency || lineCurrency;
              }
            } catch (err) {}
          } else if ((jl.source_type === "booking" || jl.source_type === "flight_booking") && jl.source_id) {
            try {
              const flt = db.prepare("SELECT supplier_currency, customer_currency, currency FROM travel_bookings WHERE id = ?").get(jl.source_id) as any;
              if (flt) {
                lineCurrency = flt.supplier_currency || flt.customer_currency || flt.currency || lineCurrency;
              }
            } catch (err) {}
          } else if (jl.source_type === "visa" && jl.source_id) {
            try {
              const vsa = db.prepare("SELECT supplier_currency, customer_currency FROM travel_visas WHERE id = ?").get(jl.source_id) as any;
              if (vsa) {
                lineCurrency = vsa.supplier_currency || vsa.customer_currency || lineCurrency;
              }
            } catch (err) {}
          }

          transactions.push({
            date: jl.entry_date || jl.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
            datetime: jl.entry_date || jl.created_at || new Date().toISOString(),
            description: jl.description || jl.journal_desc || `قيد يومية رقم ${jl.entry_number}`,
            debit: jl.debit || 0,
            credit: jl.credit || 0,
            currency: lineCurrency,
            source: "journal_entry",
            source_id: jl.journal_entry_id,
            source_type: jl.source_type,
            source_doc_id: jl.source_id,
            notes: jl.description || "",
          });
        });
      }
    } catch (e) {
      console.error("Error fetching journal entry lines in statement:", e);
    }

    if (party_type === "customer") {
      // 0. Warehouse Sales Invoices (فاتورة المبيعات المخزنية نقد / آجل)
      try {
        const existingWsiDocIds = new Set(
          transactions.filter(t => t.source_type === "warehouse_sales_invoice" || t.source === "warehouse_sales_invoice").map(t => String(t.source_doc_id || t.source_id || ""))
        );
        const wsiList = db.prepare(`
          SELECT * FROM warehouse_sales_invoices
          WHERE status != 'cancelled'
            AND (customer_id = ? OR TRIM(customer_name) = TRIM(?) OR (account_code IS NOT NULL AND account_code = ?))
          ORDER BY invoice_date ASC, id ASC
        `).all(party_id, partyInfo.name || "", partyInfo.account_code || "") as any[];

        wsiList.forEach(wsi => {
          if (existingWsiDocIds.has(String(wsi.id))) return;
          const dateStr = wsi.invoice_date || (wsi.created_at ? wsi.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
          const cur = (wsi.currency === "ريال" || !wsi.currency) ? "YER" : String(wsi.currency).toUpperCase();
          const totalAmt = Number(wsi.total_amount || 0);
          const paidAmt = Number(wsi.paid_amount || 0);

          if (totalAmt > 0) {
            transactions.push({
              date: dateStr,
              datetime: wsi.created_at || dateStr,
              description: `فاتورة مبيعات مخزنية (${wsi.payment_type === "credit" ? "آجل" : "نقداً"}) رقم ${wsi.invoice_no}`,
              debit: totalAmt,
              credit: 0,
              source: "warehouse_sales_invoice",
              source_id: wsi.id,
              reference_id: wsi.invoice_no,
              currency: cur,
              notes: wsi.notes ?? "",
            });

            const settledAmt = wsi.payment_type !== "credit" ? (paidAmt > 0 ? paidAmt : totalAmt) : paidAmt;
            if (settledAmt > 0) {
              transactions.push({
                date: dateStr,
                datetime: wsi.created_at || dateStr,
                description: `سداد فاتورة مبيعات مخزنية رقم ${wsi.invoice_no}`,
                debit: 0,
                credit: settledAmt,
                source: "warehouse_sales_invoice_payment",
                source_id: wsi.id,
                reference_id: wsi.invoice_no,
                currency: cur,
                notes: `دفعة مسددة من فاتورة ${wsi.invoice_no}`,
              });
            }
          }
        });
      } catch (e) {
        console.error("Error fetching warehouse_sales_invoices in customer statement:", e);
      }

      const existingOrderDocIds = new Set(
        transactions.filter(t => t.source_type === "order" || t.source_type === "pos_order" || t.source_type === "sale" || t.source_type === "inventory_sale" || t.source === "order").map(t => String(t.source_doc_id || t.source_id || ""))
      );
      const orders = db.prepare(`
        SELECT id, invoice_number, total, payment_method, created_at, note
        FROM orders
        WHERE customer_id = ? AND payment_method IN ('credit', 'split') AND (status IS NULL OR status NOT IN ('cancelled', 'returned'))
      `).all(party_id) as any[];

      orders.forEach(o => {
        if (existingOrderDocIds.has(String(o.id))) return;
        transactions.push({
          date: o.created_at.slice(0, 10),
          datetime: o.created_at,
          description: `فاتورة مبيعات آجل رقم ${o.invoice_number}`,
          debit: o.total,
          credit: 0,
          source: "order",
          source_id: o.id,
          reference_id: o.invoice_number,
          currency: "SAR",
          notes: o.note ?? "",
        });
      });

      const existingReturnDocIds = new Set(
        transactions.filter(t => t.source_type === "return" || t.source === "return" || t.source_type === "sales_return" || t.source === "sales_return").map(t => String(t.source_doc_id || t.source_id || ""))
      );
      const returns = db.prepare(`
        SELECT id, return_number, total_refund, created_at, notes, status
        FROM returns
        WHERE customer_id = ? AND (status IS NULL OR status = 'approved')
      `).all(party_id) as any[];

      returns.forEach(r => {
        if (existingReturnDocIds.has(String(r.id))) return;
        transactions.push({
          date: r.created_at.slice(0, 10),
          datetime: r.created_at,
          description: `مرتجع مبيعات رقم ${r.return_number}`,
          debit: 0,
          credit: r.total_refund,
          source: "return",
          source_id: r.id,
          reference_id: r.return_number,
          currency: "SAR",
          notes: r.notes ?? "",
        });
      });

      try {
        const salesReturns = db.prepare(`
          SELECT id, return_number, total_amount, return_date, created_at, reason
          FROM sales_returns
          WHERE customer_id = ?
        `).all(party_id) as any[];
        salesReturns.forEach(sr => {
          const dStr = sr.return_date || (sr.created_at ? sr.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
          transactions.push({
            date: dStr,
            datetime: sr.created_at || dStr,
            description: `مرتجع مبيعات مخزني رقم ${sr.return_number}`,
            debit: 0,
            credit: Number(sr.total_amount || 0),
            source: "sales_return",
            source_id: sr.id,
            reference_id: sr.return_number,
            currency: "YER",
            notes: sr.reason ?? "",
          });
        });
      } catch {}

      // 1. Flight / Travel Bookings
      try {
        const existingFlightDocIds = new Set(
          transactions.filter(t => t.source_type === "booking" || t.source_type === "flight_booking" || t.source_type === "travel_booking" || t.source === "travel_booking" || t.source === "booking").map(t => String(t.source_doc_id || t.source_id || ""))
        );

        const bookings = db.prepare(`
          SELECT id, booking_number, ticket_number, pnr, selling_price, paid_amount, status, issue_date, notes, created_at, 
                 COALESCE(currency, customer_currency, 'SAR') as currency
          FROM travel_bookings
          WHERE customer_id = ?
        `).all(party_id) as any[];

        bookings.forEach(b => {
          if (existingFlightDocIds.has(String(b.id))) return;
          const dateStr = b.issue_date || (b.created_at ? b.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
          // Selling transaction (Debit)
          transactions.push({
            date: dateStr,
            datetime: b.created_at || dateStr,
            description: `إصدار تذكرة طيران PNR: ${b.pnr || ''} (رقم الحجز: ${b.booking_number})`,
            debit: b.selling_price || 0,
            credit: 0,
            source: "travel_booking",
            source_id: b.id,
            currency: b.currency || "SAR",
            notes: b.notes ?? "",
          });

          // Payment if any on the booking itself (Credit)
          const paid = Number(b.paid_amount || 0);
          if (paid > 0) {
            transactions.push({
              date: dateStr,
              datetime: b.created_at || dateStr,
              description: `سداد مقابل تذكرة طيران PNR: ${b.pnr || ''}`,
              debit: 0,
              credit: paid,
              source: "travel_booking_payment",
              source_id: b.id,
              currency: b.currency || "SAR",
              notes: `مسدد من حجز رقم ${b.booking_number}`,
            });
          }
        });
      } catch (e) {
        console.error("Error fetching travel_bookings in statement:", e);
      }

      // 2. Visa Bookings
      try {
        const existingVisaDocIds = new Set(
          transactions.filter(t => t.source_type === "visa" || t.source_type === "travel_visa" || t.source === "visa" || t.source === "travel_visa").map(t => String(t.source_doc_id || t.source_id || ""))
        );

        const visas = db.prepare(`
          SELECT id, visa_number, application_number, country, visa_type, selling_price, paid_amount, status, application_date, notes, created_at, customer_currency
          FROM travel_visas
          WHERE customer_id = ?
        `).all(party_id) as any[];

        visas.forEach(v => {
          if (existingVisaDocIds.has(String(v.id))) return;
          const dateStr = v.application_date || (v.created_at ? v.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
          transactions.push({
            date: dateStr,
            datetime: v.created_at || dateStr,
            description: `معاملة تأشيرة - ${v.country || ''} (${v.visa_type || 'عمرة'}) رقم الطلب: ${v.application_number || v.visa_number}`,
            debit: v.selling_price || 0,
            credit: 0,
            source: "travel_visa",
            source_id: v.id,
            currency: v.customer_currency || "SAR",
            notes: v.notes ?? "",
          });

          const paid = Number(v.paid_amount || 0);
          if (paid > 0) {
            transactions.push({
              date: dateStr,
              datetime: v.created_at || dateStr,
              description: `سداد مقابل معاملة تأشيرة ${v.application_number || v.visa_number}`,
              debit: 0,
              credit: paid,
              source: "travel_visa_payment",
              source_id: v.id,
              currency: v.customer_currency || "SAR",
              notes: `سداد من قيمة التأشيرة`,
            });
          }
        });
      } catch (e) {
        console.error("Error fetching travel_visas in statement:", e);
      }

      // 3. Hotel Bookings
      try {
        const existingHotelDocIds = new Set(
          transactions.filter(t => t.source_type === "hotel" || t.source_type === "travel_hotel" || t.source === "hotel" || t.source === "travel_hotel").map(t => String(t.source_doc_id || t.source_id || ""))
        );

        const hotels = db.prepare(`
          SELECT id, booking_ref, hotel_name, city, selling_price, paid_amount, status, issue_date, notes, created_at, customer_currency
          FROM travel_hotels
          WHERE customer_id = ?
        `).all(party_id) as any[];

        hotels.forEach(h => {
          if (existingHotelDocIds.has(String(h.id))) return;
          const dateStr = h.issue_date || (h.created_at ? h.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
          transactions.push({
            date: dateStr,
            datetime: h.created_at || dateStr,
            description: `حجز فندق: ${h.hotel_name || ''} - ${h.city || ''} (مرجع: ${h.booking_ref})`,
            debit: h.selling_price || 0,
            credit: 0,
            source: "travel_hotel",
            source_id: h.id,
            currency: h.customer_currency || "SAR",
            notes: h.notes ?? "",
          });

          const paid = Number(h.paid_amount || 0);
          if (paid > 0) {
            transactions.push({
              date: dateStr,
              datetime: h.created_at || dateStr,
              description: `سداد مقابل حجز الفندق (مرجع: ${h.booking_ref})`,
              debit: 0,
              credit: paid,
              source: "travel_hotel_payment",
              source_id: h.id,
              currency: h.customer_currency || "SAR",
              notes: `سداد من قيمة الفندق ${h.hotel_name}`,
            });
          }
        });
      } catch (e) {
        console.error("Error fetching travel_hotels in statement:", e);
      }

      // 4. Bus Bookings
      try {
        const existingBusDocIds = new Set(
          transactions.filter(t => t.source_type === "bus_booking" || t.source_type === "travel_bus_booking" || t.source === "bus_booking" || t.source === "travel_bus_booking").map(t => String(t.source_doc_id || t.source_id || ""))
        );

        const busBookings = db.prepare(`
          SELECT id, booking_number, ticket_number, origin_city, destination_city, selling_price, departure_date, created_at, notes, issue_date, customer_currency
          FROM travel_bus_bookings
          WHERE customer_id = ? AND COALESCE(payment_method, '') NOT IN ('cash', 'bank', 'نقداً', 'تحويل بنكي')
        `).all(party_id) as any[];

        busBookings.forEach(bb => {
          if (existingBusDocIds.has(String(bb.id))) return;
          const dateStr = bb.issue_date || bb.departure_date || (bb.created_at ? bb.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
          transactions.push({
            date: dateStr,
            datetime: bb.created_at || dateStr,
            description: `حجز نقل بري: ${bb.origin_city || ''} ➡️ ${bb.destination_city || ''} (تذكرة: ${bb.ticket_number || bb.booking_number})`,
            debit: bb.selling_price || 0,
            credit: 0,
            source: "travel_bus_booking",
            source_id: bb.id,
            currency: bb.customer_currency || "SAR",
            notes: bb.notes ?? "",
          });
        });
      } catch (e) {
        console.error("Error fetching travel_bus_bookings in statement:", e);
      }

      // 5. Travel Insurances
      try {
        const existingInsuranceDocIds = new Set(
          transactions.filter(t => t.source_type === "insurance" || t.source_type === "travel_insurance" || t.source === "insurance" || t.source === "travel_insurance").map(t => String(t.source_doc_id || t.source_id || ""))
        );

        const insurances = db.prepare(`
          SELECT id, policy_number, insurance_company, coverage_type, selling_price, created_at, notes, start_date
          FROM travel_insurances
          WHERE customer_id = ?
        `).all(party_id) as any[];

        insurances.forEach(ins => {
          if (existingInsuranceDocIds.has(String(ins.id))) return;
          const dateStr = ins.start_date || (ins.created_at ? ins.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
          transactions.push({
            date: dateStr,
            datetime: ins.created_at || dateStr,
            description: `إصدار بوليصة تأمين سفر: ${ins.insurance_company || ''} - رقم البوليصة: ${ins.policy_number}`,
            debit: ins.selling_price || 0,
            credit: 0,
            source: "travel_insurance",
            source_id: ins.id,
            currency: "SAR",
            notes: ins.notes ?? "",
          });
        });
      } catch (e) {
        console.error("Error fetching travel_insurances in statement:", e);
      }

    } else if (party_type === "supplier" || party_type === "transport" || party_type === "transport_company" || party_type === "hotel") {
      const partyName = partyInfo?.name || partyInfo?.company_name || "";
      
      const purchases = db.prepare(`
        SELECT id, invoice_number, total, invoice_date, notes
        FROM purchase_invoices
        WHERE supplier_id = ?
      `).all(party_id) as any[];

      purchases.forEach(p => {
        transactions.push({
          date: p.invoice_date,
          datetime: p.invoice_date,
          description: `فاتورة شراء رقم ${p.invoice_number}`,
          debit: 0,
          credit: p.total, // Supplier credit = we owe them
          source: "purchase_invoice",
          source_id: p.id,
          currency: "SAR",
          notes: p.notes ?? "",
        });
      });

      // 1. Bus Bookings for Supplier / Transport Company
      try {
        const existingBusDocIds = new Set(
          transactions.filter(t => t.source_type === "bus_booking" || t.source_type === "travel_bus_booking" || t.source === "bus_booking" || t.source === "travel_bus_booking").map(t => String(t.source_doc_id || t.source_id || ""))
        );

        const busBookings = db.prepare(`
          SELECT id, booking_number, ticket_number, origin_city, destination_city, cost_price, supplier_currency, departure_date, created_at, notes, issue_date
          FROM travel_bus_bookings
          WHERE (company_id = ? OR company_name = ? OR company_id IN (SELECT id FROM travel_transport_companies WHERE id = ? OR name = ?) OR company_name IN (SELECT name FROM travel_transport_companies WHERE id = ? OR name = ?))
            AND COALESCE(supplier_payment_method, '') NOT IN ('cash', 'bank', 'نقداً', 'تحويل بنكي')
        `).all(party_id, partyName, party_id, partyName, party_id, partyName) as any[];

        busBookings.forEach(bb => {
          if (existingBusDocIds.has(String(bb.id))) return;
          const dateStr = bb.issue_date || bb.departure_date || (bb.created_at ? bb.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
          transactions.push({
            date: dateStr,
            datetime: bb.created_at || dateStr,
            description: `تكلفة مقعد حافلة نقل بري: ${bb.origin_city || ''} ➡️ ${bb.destination_city || ''} (تذكرة: ${bb.ticket_number || bb.booking_number})`,
            debit: 0,
            credit: bb.cost_price || 0,
            currency: bb.supplier_currency || "SAR",
            source: "travel_bus_booking",
            source_id: bb.id,
            notes: bb.notes ?? "",
          });
        });
      } catch (e) {
        console.error("Error fetching bus bookings for supplier statement:", e);
      }

      // 2. Visa Bookings for Supplier / Office
      try {
        const existingVisaDocIds = new Set(
          transactions.filter(t => t.source_type === "visa" || t.source_type === "travel_visa" || t.source === "visa" || t.source === "travel_visa").map(t => String(t.source_doc_id || t.source_id || ""))
        );

        const visas = db.prepare(`
          SELECT id, visa_number, application_number, country, visa_type, cost_price, supplier_currency, application_date, notes, created_at
          FROM travel_visas
          WHERE supplier_office_id = ? OR supplier_office_name = ?
        `).all(party_id, partyName) as any[];

        visas.forEach(v => {
          if (existingVisaDocIds.has(String(v.id))) return;
          const dateStr = v.application_date || (v.created_at ? v.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
          transactions.push({
            date: dateStr,
            datetime: v.created_at || dateStr,
            description: `تكلفة معاملة تأشيرة: ${v.country || ''} (${v.visa_type || 'عمرة'}) رقم الطلب: ${v.application_number || v.visa_number}`,
            debit: 0,
            credit: v.cost_price || 0,
            currency: v.supplier_currency || "SAR",
            source: "travel_visa",
            source_id: v.id,
            notes: v.notes ?? "",
          });
        });
      } catch (e) {
        console.error("Error fetching visas for supplier statement:", e);
      }

      // 3. Hotel Bookings for Supplier / Hotel
      try {
        const existingHotelDocIds = new Set(
          transactions.filter(t => t.source_type === "hotel").map(t => String(t.source_doc_id || ""))
        );

        const hotels = db.prepare(`
          SELECT id, booking_ref, hotel_name, city, cost_price, 
                 COALESCE(supplier_currency, 'SAR') as supplier_currency, 
                 issue_date, notes, created_at, supplier_payment_method
          FROM travel_hotels
          WHERE supplier_office_id = ? OR supplier_id = ? OR hotel_db_id = ? OR hotel_name = ? 
             OR hotel_name IN (SELECT name_ar FROM travel_hotels_db WHERE id = ?)
             OR hotel_db_id IN (SELECT id FROM travel_hotels_db WHERE id = ? OR name_ar = ?)
        `).all(party_id, party_id, party_id, partyName, party_id, party_id, partyName) as any[];

        hotels.forEach(h => {
          if (existingHotelDocIds.has(String(h.id))) return;
          const isCash = h.supplier_payment_method === 'cash' || h.supplier_payment_method === 'bank_transfer' || h.supplier_payment_method === 'cheque' || h.supplier_payment_method === 'wallet' || h.supplier_payment_method === 'نقداً';
          if (isCash) return;

          const dateStr = h.issue_date || (h.created_at ? h.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
          transactions.push({
            date: dateStr,
            datetime: h.created_at || dateStr,
            description: `تكلفة حجز فندق: ${h.hotel_name || ''} - ${h.city || ''} (مرجع: ${h.booking_ref})`,
            debit: 0,
            credit: h.cost_price || 0,
            currency: h.supplier_currency || "SAR",
            source: "travel_hotel",
            source_id: h.id,
            notes: h.notes ?? "",
          });
        });
      } catch (e) {
        console.error("Error fetching hotels for supplier statement:", e);
      }

      // 4. Flight Bookings for Supplier
      try {
        const existingFlightDocIds = new Set(
          transactions.filter(t => t.source_type === "booking" || t.source_type === "flight_booking").map(t => String(t.source_doc_id || ""))
        );

        const flights = db.prepare(`
          SELECT id, booking_number, ticket_number, pnr, cost_price, 
                 COALESCE(supplier_currency, 'SAR') as supplier_currency, 
                 issue_date, notes, created_at
          FROM travel_bookings
          WHERE supplier_id = ? OR supplier_name = ?
        `).all(party_id, partyName) as any[];

        flights.forEach(f => {
          if (existingFlightDocIds.has(String(f.id))) return;
          const dateStr = f.issue_date || (f.created_at ? f.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
          transactions.push({
            date: dateStr,
            datetime: f.created_at || dateStr,
            description: `تكلفة تذكرة طيران PNR: ${f.pnr || ''} (رقم الحجز: ${f.booking_number})`,
            debit: 0,
            credit: f.cost_price || 0,
            currency: f.supplier_currency || "SAR",
            source: "travel_booking",
            source_id: f.id,
            notes: f.notes ?? "",
          });
        });
      } catch (e) {
        console.error("Error fetching flights for supplier statement:", e);
      }

      // 5. Affiliated Customers Operations for Intermediary Partner Agency/Office
      try {
        const isPartnerOffice = db.prepare("SELECT * FROM travel_partner_offices WHERE id = ? OR name = ? OR account_code = ?").get(party_id, partyName, partyInfo?.account_code) as any;
        if (isPartnerOffice) {
          const affCustomers = db.prepare(`
            SELECT id, name FROM customers 
            WHERE (
              affiliation_type = 'agency' 
              OR affiliation_type = 'indirect' 
              OR customer_type = 'indirect' 
              OR customer_type = 'agent_customer' 
              OR customer_type = 'sub_customer' 
              OR office_id = ? 
              OR office_name = ? 
              OR account_code = ?
            ) AND (office_id = ? OR office_name = ? OR account_code = ?)
          `).all(isPartnerOffice.id, isPartnerOffice.name, isPartnerOffice.account_code, isPartnerOffice.id, isPartnerOffice.name, isPartnerOffice.account_code) as any[];
          const custIds = affCustomers.map(c => c.id);

          if (custIds.length > 0) {
            const placeholders = custIds.map(() => '?').join(',');
            const existingSourceIds = new Set(transactions.map(t => String(t.source_id || '')));

            // 5a. Flight Bookings
            const affBookings = db.prepare(`
              SELECT b.id, b.booking_number, b.ticket_number, b.pnr, b.selling_price, b.paid_amount, b.customer_currency,
                     b.issue_date, b.created_at, b.notes, b.payment_method, c.name as customer_name
              FROM travel_bookings b
              JOIN customers c ON c.id = b.customer_id
              WHERE b.customer_id IN (${placeholders})
            `).all(...custIds) as any[];

            affBookings.forEach(b => {
              if (existingSourceIds.has(`aff_bk_${b.id}`)) return;
              const dateStr = b.issue_date || (b.created_at ? b.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
              transactions.push({
                date: dateStr,
                datetime: b.created_at || dateStr,
                description: `[العميل: ${b.customer_name}] قيمة تذكرة طيران PNR: ${b.pnr || ''} (تذكرة: ${b.ticket_number || b.booking_number})`,
                debit: b.selling_price || 0,
                credit: 0,
                currency: b.customer_currency || "SAR",
                source: "travel_booking",
                source_id: b.id,
                notes: `حجز تذكرة لصالح العميل: ${b.customer_name}`,
              });
              if (Number(b.paid_amount || 0) > 0) {
                transactions.push({
                  date: dateStr,
                  datetime: b.created_at || dateStr,
                  description: `[العميل: ${b.customer_name}] سداد دفعة مقابل تذكرة طيران (مرجع: ${b.booking_number})`,
                  debit: 0,
                  credit: Number(b.paid_amount || 0),
                  currency: b.customer_currency || "SAR",
                  source: "travel_booking_payment",
                  source_id: b.id,
                  notes: `سداد للعميل: ${b.customer_name}`,
                });
              }
            });

            // 5b. Visas
            const affVisas = db.prepare(`
              SELECT v.id, v.visa_number, v.application_number, v.country, v.visa_type, v.selling_price, v.paid_amount,
                     v.customer_currency, v.application_date, v.created_at, v.notes, c.name as customer_name
              FROM travel_visas v
              JOIN customers c ON c.id = v.customer_id
              WHERE v.customer_id IN (${placeholders})
            `).all(...custIds) as any[];

            affVisas.forEach(v => {
              if (existingSourceIds.has(`aff_visa_${v.id}`)) return;
              const dateStr = v.application_date || (v.created_at ? v.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
              transactions.push({
                date: dateStr,
                datetime: v.created_at || dateStr,
                description: `[العميل: ${v.customer_name}] رسوم معاملة تأشيرة: ${v.country || ''} (${v.visa_type || 'تأشيرة'}) رقم الطلب: ${v.application_number || v.visa_number}`,
                debit: v.selling_price || 0,
                credit: 0,
                currency: v.customer_currency || "SAR",
                source: "travel_visa",
                source_id: v.id,
                notes: `معاملة تأشيرة للعميل: ${v.customer_name}`,
              });
            });

            // 5c. Hotels
            const affHotels = db.prepare(`
              SELECT h.id, h.booking_ref, h.hotel_name, h.city, h.selling_price, h.paid_amount,
                     h.customer_currency, h.issue_date, h.created_at, h.notes, c.name as customer_name
              FROM travel_hotels h
              JOIN customers c ON c.id = h.customer_id
              WHERE h.customer_id IN (${placeholders})
            `).all(...custIds) as any[];

            affHotels.forEach(h => {
              if (existingSourceIds.has(`aff_hotel_${h.id}`)) return;
              const dateStr = h.issue_date || (h.created_at ? h.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
              transactions.push({
                date: dateStr,
                datetime: h.created_at || dateStr,
                description: `[العميل: ${h.customer_name}] حجز إقامة فندقية: ${h.hotel_name || ''} - ${h.city || ''} (مرجع: ${h.booking_ref})`,
                debit: h.selling_price || 0,
                credit: 0,
                currency: h.customer_currency || "SAR",
                source: "travel_hotel",
                source_id: h.id,
                notes: `إقامة فندقية للعميل: ${h.customer_name}`,
              });
            });

            // 5d. Bus Bookings
            const affBus = db.prepare(`
              SELECT b.id, b.booking_number, b.ticket_number, b.selling_price, b.customer_currency,
                     b.origin_city, b.destination_city, b.departure_date, b.created_at, b.notes, c.name as customer_name
              FROM travel_bus_bookings b
              JOIN customers c ON c.id = b.customer_id
              WHERE b.customer_id IN (${placeholders})
            `).all(...custIds) as any[];

            affBus.forEach(b => {
              if (existingSourceIds.has(`aff_bus_${b.id}`)) return;
              const dateStr = b.departure_date || (b.created_at ? b.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
              transactions.push({
                date: dateStr,
                datetime: b.created_at || dateStr,
                description: `[العميل: ${b.customer_name}] تذكرة نقل بري: ${b.origin_city || ''} ➡️ ${b.destination_city || ''} (تذكرة: ${b.ticket_number || b.booking_number})`,
                debit: b.selling_price || 0,
                credit: 0,
                currency: b.customer_currency || "SAR",
                source: "travel_bus_booking",
                source_id: b.id,
                notes: `نقل بري للعميل: ${b.customer_name}`,
              });
            });
          }
        }
      } catch (e) {
        console.error("Error fetching partner office affiliated customer transactions:", e);
      }

    } else if (party_type === "account") {
      const acc = partyInfo;
      if (acc && acc.code) {
        // Warehouse Sales Invoices linked to this account
        try {
          const existingWsiIds = new Set(
            transactions.filter(t => t.source_type === "warehouse_sales_invoice" || t.source === "warehouse_sales_invoice").map(t => String(t.source_doc_id || t.source_id || ""))
          );
          const linkedCust = db.prepare("SELECT id, name FROM customers WHERE account_code = ? OR TRIM(name) = TRIM(?)").get(acc.code, acc.name) as any;
          const accWsi = db.prepare(`
            SELECT * FROM warehouse_sales_invoices
            WHERE status != 'cancelled'
              AND (account_id = ? OR account_code = ? OR (customer_id IS NOT NULL AND customer_id = ?) OR TRIM(customer_name) = TRIM(?))
            ORDER BY invoice_date ASC, id ASC
          `).all(acc.id, acc.code, linkedCust?.id || -1, acc.name) as any[];

          accWsi.forEach(wsi => {
            if (existingWsiIds.has(String(wsi.id))) return;
            const dateStr = wsi.invoice_date || (wsi.created_at ? wsi.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
            const cur = (wsi.currency === "ريال" || !wsi.currency) ? "YER" : String(wsi.currency).toUpperCase();
            const totalAmt = Number(wsi.total_amount || 0);
            const paidAmt = Number(wsi.paid_amount || 0);
            if (totalAmt > 0) {
              transactions.push({
                date: dateStr,
                datetime: wsi.created_at || dateStr,
                description: `فاتورة مبيعات مخزنية (${wsi.payment_type === "credit" ? "آجل" : "نقداً"}) رقم ${wsi.invoice_no} - ${wsi.customer_name || acc.name}`,
                debit: totalAmt,
                credit: 0,
                currency: cur,
                source: "warehouse_sales_invoice",
                source_id: wsi.id,
                reference_id: wsi.invoice_no,
                notes: wsi.notes ?? "",
              });
              const settledAmt = wsi.payment_type !== "credit" ? (paidAmt > 0 ? paidAmt : totalAmt) : paidAmt;
              if (settledAmt > 0) {
                transactions.push({
                  date: dateStr,
                  datetime: wsi.created_at || dateStr,
                  description: `سداد فاتورة مبيعات مخزنية رقم ${wsi.invoice_no} - ${wsi.customer_name || acc.name}`,
                  debit: 0,
                  credit: settledAmt,
                  currency: cur,
                  source: "warehouse_sales_invoice_payment",
                  source_id: wsi.id,
                  reference_id: wsi.invoice_no,
                  notes: `دفعة مسددة من فاتورة ${wsi.invoice_no}`,
                });
              }
            }
          });
        } catch (e) {
          console.error("Error fetching warehouse_sales_invoices for account statement:", e);
        }

        // Transport bookings for transport company accounts
        try {
          const tc = db.prepare("SELECT * FROM travel_transport_companies WHERE account_code = ? OR name = ?").get(acc.code, acc.name) as any;
          if (tc) {
            const busBookings = db.prepare(`
              SELECT id, booking_number, ticket_number, cost_price, selling_price, supplier_currency,
                     origin_city, destination_city, departure_date, created_at, notes, passenger_name, company_name
              FROM travel_bus_bookings
              WHERE (company_id = ? OR company_name = ?)
                AND COALESCE(supplier_payment_method, '') NOT IN ('cash', 'bank', 'نقداً', 'تحويل بنكي')
            `).all(tc.id, tc.name) as any[];

            const existingBookingIds = new Set(
              transactions.filter(t => t.source === 'bus_booking' || t.source_type === 'bus_booking').map(t => String(t.source_id || ''))
            );

            busBookings.forEach(bb => {
              if (!existingBookingIds.has(String(bb.id))) {
                const dateStr = bb.departure_date || (bb.created_at ? bb.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
                transactions.push({
                  date: dateStr,
                  datetime: bb.created_at || dateStr,
                  description: `تكلفة مقعد حافلة نقل بري: ${bb.origin_city || ''} ➡️ ${bb.destination_city || ''} (تذكرة: ${bb.ticket_number || bb.booking_number}) - راكب: ${bb.passenger_name || ''}`,
                  debit: 0,
                  credit: Number(bb.cost_price || 0),
                  currency: bb.supplier_currency || "SAR",
                  source: "travel_bus_booking",
                  source_id: bb.id,
                  notes: bb.notes ?? "",
                });
              }
            });
          }
        } catch (e) {
          console.error("Error fetching bus bookings for account statement:", e);
        }
      }

    } else if (party_type === "employee") {
      const empInfo = db.prepare("SELECT * FROM hr_employees WHERE id = ?").get(party_id) as any;

      const salaries = db.prepare(`
        SELECT id, month, basic_salary, bonuses, deductions, net_salary, notes, created_at
        FROM hr_salaries
        WHERE employee_id = ?
      `).all(party_id) as any[];

      salaries.forEach(s => {
        // We only credit the basic salary, the other components will be fetched individually
        transactions.push({
          date: s.created_at ? s.created_at.slice(0, 10) : (s.month + "-28"),
          datetime: s.created_at ?? new Date().toISOString(),
          description: `راتب أساسي لشهر ${s.month}`,
          debit: 0,
          credit: s.basic_salary,
          source: "salary_earned",
          source_id: s.id,
          notes: s.notes ?? "",
        });
      });

      // If active employee has no posted salary for current month yet, accrue current month basic salary
      if (empInfo && empInfo.active) {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const hasCurrentSalary = salaries.some(s => s.month === currentMonth);
        if (!hasCurrentSalary && empInfo.basic_salary > 0) {
          transactions.push({
            date: `${currentMonth}-01`,
            datetime: `${currentMonth}-01T00:00:00.000Z`,
            description: `استحقاق الراتب الأساسي لشهر ${currentMonth} (الشهر الجاري)`,
            debit: 0,
            credit: empInfo.basic_salary,
            source: "salary_accrued",
            source_id: 0,
            notes: "استحقاق الراتب الأساسي للشهر الجاري قبل إغلاق الشهر",
          });
        }
      }

      // Fetch advances (loans)
      const loans = db.prepare(`
        SELECT id, amount, type, request_date, notes
        FROM hr_loans
        WHERE employee_id = ? AND status = 'approved'
      `).all(party_id) as any[];

      loans.forEach(l => {
        transactions.push({
          date: l.request_date.slice(0, 10),
          datetime: l.request_date,
          description: l.type === 'temporary' ? 'عهدة مالية مؤقتة' : 'سلفة نقدية/مقدم راتب',
          debit: l.amount,
          credit: 0,
          source: "hr_loan",
          source_id: l.id,
          notes: l.notes ?? "",
        });
      });

      // Fetch penalties
      const penalties = db.prepare(`
        SELECT id, amount, violation_name, date, notes
        FROM hr_penalties
        WHERE employee_id = ?
      `).all(party_id) as any[];

      penalties.forEach(p => {
        transactions.push({
          date: p.date.slice(0, 10),
          datetime: p.date,
          description: `جزاء/خصم: ${p.violation_name}`,
          debit: p.amount,
          credit: 0,
          source: "hr_penalty",
          source_id: p.id,
          notes: p.notes ?? "",
        });
      });

      // Fetch absences
      const abs_penalties = db.prepare(`
        SELECT a.id, a.date, a.notes, e.basic_salary 
        FROM hr_attendance a
        JOIN hr_employees e ON e.id = a.employee_id
        WHERE a.employee_id = ? AND a.status = 'absent'
      `).all(party_id) as any[];

      abs_penalties.forEach(a => {
        const dailyRate = (a.basic_salary || 0) / 30;
        transactions.push({
          date: a.date.slice(0, 10),
          datetime: a.date,
          description: `خصم غياب يوم بدون عذر`,
          debit: dailyRate,
          credit: 0,
          source: "hr_absence",
          source_id: a.id,
          notes: a.notes ?? "",
        });
      });

      // Fetch lates/delays
      const late_penalties = db.prepare(`
        SELECT a.id, a.date, a.notes, e.basic_salary 
        FROM hr_attendance a
        JOIN hr_employees e ON e.id = a.employee_id
        WHERE a.employee_id = ? AND a.status = 'late'
      `).all(party_id) as any[];

      late_penalties.forEach(a => {
        const dailyRate = (a.basic_salary || 0) / 30;
        const delayDeduction = dailyRate * 0.25;
        transactions.push({
          date: a.date.slice(0, 10),
          datetime: a.date,
          description: `خصم تأخير عن دوام الموظف`,
          debit: delayDeduction,
          credit: 0,
          source: "hr_delay",
          source_id: a.id,
          notes: a.notes ?? "",
        });
      });

      // Fetch unpaid leaves
      const unpaid_leaves = db.prepare(`
        SELECT l.id, l.start_date, l.end_date, l.notes, e.basic_salary
        FROM hr_leaves l
        JOIN hr_employees e ON e.id = l.employee_id
        WHERE l.employee_id = ? AND l.type = 'unpaid' AND l.status = 'approved'
      `).all(party_id) as any[];

      unpaid_leaves.forEach(l => {
        const start = new Date(l.start_date);
        const end = new Date(l.end_date);
        const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const dailyRate = (l.basic_salary || 0) / 30;
        const deduction = diffDays * dailyRate;
        transactions.push({
          date: l.start_date.slice(0, 10),
          datetime: l.start_date,
          description: `خصم إجازة بدون راتب (${diffDays} يوم)`,
          debit: deduction,
          credit: 0,
          source: "hr_unpaid_leave",
          source_id: l.id,
          notes: l.notes ?? "",
        });
      });

      // Fetch overtime
      const overtime = db.prepare(`
        SELECT id, total_amount, date, notes
        FROM hr_overtime
        WHERE employee_id = ?
      `).all(party_id) as any[];

      overtime.forEach(o => {
        transactions.push({
          date: o.date.slice(0, 10),
          datetime: o.date,
          description: `إضافي/عمل إضافي مستحق`,
          debit: 0,
          credit: o.total_amount,
          source: "hr_overtime",
          source_id: o.id,
          notes: o.notes ?? "",
        });
      });

      // Fetch entitlements
      const entitlements = db.prepare(`
        SELECT id, amount, type, date, notes
        FROM hr_entitlements
        WHERE employee_id = ?
      `).all(party_id) as any[];

      entitlements.forEach(e => {
        transactions.push({
          date: e.date.slice(0, 10),
          datetime: e.date,
          description: `استحقاق موظف: ${e.type === 'daily' ? 'يومي' : 'شهري'}`,
          debit: 0,
          credit: e.amount,
          source: "hr_entitlement",
          source_id: e.id,
          notes: e.notes ?? "",
        });
      });

      // Fetch standalone meal deductions (خصم الوجبات) if not already in journal entry lines
      const existingMealDocIds = new Set(
        transactions.filter(t => t.source_type === "meal_deduction" || t.source_type === "sale" || (t.source === "journal_entry" && String(t.notes || t.description).includes("وجبة"))).map(t => String(t.source_doc_id || t.source_id || ""))
      );
      const meals = db.prepare(`
        SELECT id, amount, notes, created_at, order_id, invoice_number
        FROM meal_deductions
        WHERE employee_id = ?
      `).all(party_id) as any[];

      meals.forEach(m => {
        if (m.order_id && existingMealDocIds.has(String(m.order_id))) return;
        if (existingMealDocIds.has(String(m.id))) return;
        transactions.push({
          date: (m.created_at || new Date().toISOString()).slice(0, 10),
          datetime: m.created_at || new Date().toISOString(),
          description: `خصم وجبات طعام${m.invoice_number ? ` (فاتورة #${m.invoice_number})` : ''}`,
          debit: m.amount,
          credit: 0,
          source: "meal_deduction",
          source_id: m.id,
          notes: m.notes ?? "",
        });
      });
    }

    // Source Vouchers (Receipts & Payments)
    const vouchers = db.prepare(`
      SELECT id, voucher_number, type, amount, created_at, payment_against, notes, currency
      FROM vouchers
      WHERE (party_type = ? OR (party_type IN ('user', 'system_user') AND ? IN ('user', 'system_user'))) AND party_id = ?
    `).all(party_type, party_type, party_id) as any[];

    vouchers.forEach(v => {
      let debit = 0;
      let credit = 0;
      if (v.type === "receipt") {
        credit = v.amount;
      } else {
        debit = v.amount;
      }

      transactions.push({
        date: v.created_at.slice(0, 10),
        datetime: v.created_at,
        description: `سند ${v.type === "receipt" ? "قبض" : "صرف"} رقم ${v.voucher_number}`,
        debit,
        credit,
        source: "voucher",
        source_id: v.id,
        currency: v.currency || "SAR",
        notes: v.notes ?? "",
      });
    });

    // Manual Ledger Entries
    const manualEntries = db.prepare(`
      SELECT id, entry_date, description, debit, credit, notes, created_at
      FROM manual_ledger_entries
      WHERE (party_type = ? OR (party_type IN ('user', 'system_user') AND ? IN ('user', 'system_user'))) AND party_id = ?
    `).all(party_type, party_type, party_id) as any[];

    manualEntries.forEach(me => {
      transactions.push({
        date: me.entry_date,
        datetime: me.created_at,
        description: me.description,
        debit: me.debit,
        credit: me.credit,
        source: "manual",
        source_id: me.id,
        currency: "SAR",
        notes: me.notes ?? "",
      });
    });

    // Compute Currency Breakdown Summaries for ALL transactions
    const currencySummaries: Record<string, { totalDebit: number; totalCredit: number; balance: number }> = {
      SAR: { totalDebit: 0, totalCredit: 0, balance: 0 },
      YER: { totalDebit: 0, totalCredit: 0, balance: 0 },
      USD: { totalDebit: 0, totalCredit: 0, balance: 0 }
    };

    transactions.forEach(t => {
      const cur = (t.currency || "SAR").toUpperCase();
      if (!currencySummaries[cur]) {
        currencySummaries[cur] = { totalDebit: 0, totalCredit: 0, balance: 0 };
      }
      const debitVal = Number(t.debit || 0);
      const creditVal = Number(t.credit || 0);
      currencySummaries[cur].totalDebit += debitVal;
      currencySummaries[cur].totalCredit += creditVal;
      const change = (party_type === "customer") ? (debitVal - creditVal) : (creditVal - debitVal);
      currencySummaries[cur].balance += change;
    });

    transactions.sort((a, b) => a.date.localeCompare(b.date));

    // Filter transactions by currency if requested and not "all"
    let targetTransactions = transactions;
    if (currency && currency !== "all") {
      targetTransactions = transactions.filter(t => (t.currency || "SAR").toUpperCase() === currency.toUpperCase());
    }

    let previousBalance = 0;
    let runningBalance = 0;
    const filteredTransactions: any[] = [];

    targetTransactions.forEach(t => {
      const change = (party_type === "customer")
        ? (t.debit - t.credit)
        : (t.credit - t.debit);

      if (start_date && t.date < start_date) {
        previousBalance += change;
      } else if (end_date && t.date > end_date) {
        // Excluded from range
      } else {
        runningBalance = (filteredTransactions.length === 0 ? previousBalance : runningBalance) + change;
        filteredTransactions.push({
          ...t,
          running_balance: runningBalance,
        });
      }
    });

    let pilgrimsCount = 0;
    let bookingsCount = 0;
    let visaCount = 0;

    if (party_type === "customer") {
      try {
        const pCountRes = db.prepare(`
          SELECT COUNT(DISTINCT passenger_id) as c 
          FROM (
            SELECT passenger_id FROM travel_bookings WHERE customer_id = ?
            UNION 
            SELECT passenger_id FROM travel_visas WHERE customer_id = ?
          )
        `).get(party_id, party_id) as any;
        pilgrimsCount = pCountRes ? pCountRes.c : 0;

        const bCountRes = db.prepare(`
          SELECT COUNT(*) as c FROM travel_bookings WHERE customer_id = ?
        `).get(party_id) as any;
        bookingsCount = bCountRes ? bCountRes.c : 0;

        const vCountRes = db.prepare(`
          SELECT COUNT(*) as c FROM travel_visas WHERE customer_id = ?
        `).get(party_id) as any;
        visaCount = vCountRes ? vCountRes.c : 0;
      } catch (err) {
        console.error("Error counting pilgrims for customer statement:", err);
      }
    }

    res.json({
      party: partyInfo,
      selectedCurrency: currency || "all",
      currencySummaries,
      previousBalance,
      currentBalance: runningBalance || previousBalance,
      transactions: filteredTransactions,
      pilgrimsCount,
      bookingsCount,
      visaCount
    });

  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


/* ─── 7. Bank Accounts Management (إدارة الحسابات البنكية) ─── */
router.get("/accounting/bank-accounts", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = db.prepare("SELECT * FROM bank_accounts ORDER BY id ASC").all();
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/accounting/bank-accounts", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { bank_name, account_number, iban, swift, balance, currency, notes } = req.body;
  if (!bank_name || !account_number) {
    res.status(400).json({ error: "اسم البنك ورقم الحساب حقول إجبارية" });
    return;
  }
  try {
    const r = db.prepare(`
      INSERT INTO bank_accounts (bank_name, account_number, iban, swift, balance, currency, notes, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(bank_name, account_number, iban ?? "", swift ?? "", balance ?? 0.0, currency ?? "ريال", notes ?? "");

    const created = db.prepare("SELECT * FROM bank_accounts WHERE id = ?").get(r.lastInsertRowid);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/accounting/bank-accounts/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { bank_name, account_number, iban, swift, currency, notes, active } = req.body;
  try {
    db.prepare(`
      UPDATE bank_accounts
      SET bank_name = ?, account_number = ?, iban = ?, swift = ?, currency = ?, notes = ?, active = ?
      WHERE id = ?
    `).run(bank_name, account_number, iban, swift, currency, notes, active ?? 1, req.params.id);

    const updated = db.prepare("SELECT * FROM bank_accounts WHERE id = ?").get(req.params.id);
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


/* ─── 8. Inter-Account Transfers (التحويل بين الصناديق والبنوك) ─── */
router.get("/accounting/transfers", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = db.prepare("SELECT * FROM inter_account_transfers ORDER BY id DESC").all();
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/accounting/transfers", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  const { transfer_date, from_type, from_id, to_type, to_id, amount, notes } = req.body;

  const numAmount = Number(amount);
  if (!from_type || !from_id || !to_type || !to_id || !numAmount || numAmount <= 0) {
    res.status(400).json({ error: "يرجى تحديد جهة المصدر والوجهة والمبلغ المحول بشكل صحيح" });
    return;
  }

  if (from_type === to_type && Number(from_id) === Number(to_id)) {
    res.status(400).json({ error: "لا يمكن التحويل لنفس الحساب أو الخزينة!" });
    return;
  }

  try {
    let fromName = "";
    let toName = "";

    // Fetch From Name & Check Balance
    if (from_type === "safe") {
      const s = db.prepare("SELECT name, balance FROM safes WHERE id = ?").get(from_id) as any;
      if (!s) return res.status(400).json({ error: "خزينة المصدر غير موجودة" });
      fromName = s.name;
    } else {
      const b = db.prepare("SELECT bank_name, account_number FROM bank_accounts WHERE id = ?").get(from_id) as any;
      if (!b) return res.status(400).json({ error: "البنك المصدر غير موجود" });
      fromName = `${b.bank_name} (${b.account_number})`;
    }

    // Fetch To Name
    if (to_type === "safe") {
      const s = db.prepare("SELECT name FROM safes WHERE id = ?").get(to_id) as any;
      if (!s) return res.status(400).json({ error: "خزينة المستلم غير موجودة" });
      toName = s.name;
    } else {
      const b = db.prepare("SELECT bank_name, account_number FROM bank_accounts WHERE id = ?").get(to_id) as any;
      if (!b) return res.status(400).json({ error: "البنك المستلم غير موجود" });
      toName = `${b.bank_name} (${b.account_number})`;
    }

    const countRow = db.prepare("SELECT COUNT(*) as c FROM inter_account_transfers").get() as { c: number };
    const transferNum = `TRF-${String(countRow.c + 1).padStart(5, "0")}`;

    // Update balances
    if (from_type === "safe") {
      db.prepare("UPDATE safes SET balance = balance - ? WHERE id = ?").run(numAmount, from_id);
    } else {
      db.prepare("UPDATE bank_accounts SET balance = balance - ? WHERE id = ?").run(numAmount, from_id);
    }

    if (to_type === "safe") {
      db.prepare("UPDATE safes SET balance = balance + ? WHERE id = ?").run(numAmount, to_id);
    } else {
      db.prepare("UPDATE bank_accounts SET balance = balance + ? WHERE id = ?").run(numAmount, to_id);
    }

    // Double Entry Journal Creation (Debit Receiving Asset, Credit Sending Asset)
    let journalId: number | null = null;
    try {
      journalId = createDoubleEntryJournal(
        transfer_date || new Date().toISOString().slice(0, 10),
        `تحويل مالي بين الحسابات (${transferNum}): من ${fromName} إلى ${toName}`,
        "transfer",
        0,
        [
          { account_code: "11100", debit: numAmount, credit: 0, description: `إيداع إلى ${toName}` },
          { account_code: "11100", debit: 0, credit: numAmount, description: `سحب من ${fromName}` }
        ]
      );
    } catch (e) {}

    const r = db.prepare(`
      INSERT INTO inter_account_transfers (
        transfer_number, transfer_date, from_type, from_id, from_name,
        to_type, to_id, to_name, amount, notes, journal_entry_id, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      transferNum,
      transfer_date || new Date().toISOString().slice(0, 10),
      from_type,
      from_id,
      fromName,
      to_type,
      to_id,
      toName,
      numAmount,
      notes ?? "",
      journalId,
      user?.name || "مدير النظام"
    );

    const created = db.prepare("SELECT * FROM inter_account_transfers WHERE id = ?").get(r.lastInsertRowid);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


/* ─── 9. Fixed Assets & Depreciation (الأصول الثابتة والإهلاك) ─── */
router.get("/accounting/fixed-assets", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const assets = db.prepare("SELECT * FROM fixed_assets ORDER BY id DESC").all();
    res.json(assets);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/accounting/fixed-assets", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { name, category, purchase_date, purchase_cost, salvage_value, useful_life_years, location, responsible_person } = req.body;

  if (!name || !category || !purchase_date || !purchase_cost) {
    res.status(400).json({ error: "اسم الأصل، الفئة، تاريخ الشراء، وتكلفة الشراء حقول إجبارية" });
    return;
  }

  try {
    const countRow = db.prepare("SELECT COUNT(*) as c FROM fixed_assets").get() as { c: number };
    const assetCode = `AST-${String(countRow.c + 1).padStart(3, "0")}`;

    const cost = Number(purchase_cost);
    const salvage = Number(salvage_value || 0);
    const years = Number(useful_life_years || 5);

    const r = db.prepare(`
      INSERT INTO fixed_assets (
        asset_code, name, category, purchase_date, purchase_cost, salvage_value,
        useful_life_years, accumulated_depreciation, net_book_value, location, responsible_person
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 0.0, ?, ?, ?)
    `).run(
      assetCode, name, category, purchase_date, cost, salvage, years, cost, location ?? "المقر الرئيسي", responsible_person ?? "مدير الفرع"
    );

    // Record asset acquisition journal entry
    try {
      createDoubleEntryJournal(
        purchase_date,
        `شراء أصل ثابت جديد: ${name} (${assetCode})`,
        "asset_purchase",
        r.lastInsertRowid,
        [
          { account_code: "10000", debit: cost, credit: 0, description: `إضافة أصل ثابت - ${name}` },
          { account_code: "11100", debit: 0, credit: cost, description: `دفع قيمة الأصل ${name}` }
        ]
      );
    } catch (e) {}

    const created = db.prepare("SELECT * FROM fixed_assets WHERE id = ?").get(r.lastInsertRowid);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/accounting/run-depreciation", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const activeAssets = db.prepare("SELECT * FROM fixed_assets WHERE status = 'active'").all() as any[];
    const today = new Date().toISOString().slice(0, 10);
    let totalDepreciated = 0;
    const details = [];

    for (const asset of activeAssets) {
      const depreciableAmount = asset.purchase_cost - asset.salvage_value;
      if (depreciableAmount <= 0) continue;

      // Annual depreciation / 12 for monthly depreciation run
      const annualDepr = depreciableAmount / asset.useful_life_years;
      const monthlyDepr = Math.round(annualDepr / 12);

      if (asset.net_book_value <= asset.salvage_value) continue;

      const actualDepr = Math.min(monthlyDepr, asset.net_book_value - asset.salvage_value);
      const newAccumulated = asset.accumulated_depreciation + actualDepr;
      const newBookValue = asset.purchase_cost - newAccumulated;

      db.prepare(`
        UPDATE fixed_assets
        SET accumulated_depreciation = ?, net_book_value = ?
        WHERE id = ?
      `).run(newAccumulated, newBookValue, asset.id);

      db.prepare(`
        INSERT INTO asset_depreciations (
          fixed_asset_id, asset_name, period_date, depreciation_amount,
          accumulated_total, net_book_value_after, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        asset.id, asset.name, today, actualDepr, newAccumulated, newBookValue, "إهلاك شهري آلي"
      );

      totalDepreciated += actualDepr;
      details.push({ asset: asset.name, amount: actualDepr });
    }

    if (totalDepreciated > 0) {
      try {
        createDoubleEntryJournal(
          today,
          `قيد احتساب الإهلاك الدوري للأصول الثابتة`,
          "depreciation",
          0,
          [
            { account_code: "60000", debit: totalDepreciated, credit: 0, description: "مصروف إهلاك الأصول الثابتة" },
            { account_code: "10000", debit: 0, credit: totalDepreciated, description: "مجمع إهلاك الأصول الثابتة" }
          ]
        );
      } catch (e) {}
    }

    res.json({
      message: "تم احتساب وقيد إهلاك الأصول الثابتة لهذا الشهر بنجاح",
      totalDepreciated,
      processedAssets: details.length
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


/* ─── 10. Recurring Expenses (المصروفات المتكررة) ─── */
router.get("/accounting/recurring-expenses", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = db.prepare("SELECT * FROM recurring_expenses ORDER BY id DESC").all();
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/accounting/recurring-expenses", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { title, category, amount, frequency, next_due_date, notes } = req.body;
  if (!title || !category || !amount || !next_due_date) {
    res.status(400).json({ error: "العنوان، الفئة، المبلغ وتاريخ الاستحقاق حقول إجبارية" });
    return;
  }
  try {
    const r = db.prepare(`
      INSERT INTO recurring_expenses (title, category, amount, frequency, next_due_date, notes, active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(title, category, Number(amount), frequency || "monthly", next_due_date, notes ?? "");

    const created = db.prepare("SELECT * FROM recurring_expenses WHERE id = ?").get(r.lastInsertRowid);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/accounting/recurring-expenses/:id/generate", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rec = db.prepare("SELECT * FROM recurring_expenses WHERE id = ?").get(req.params.id) as any;
    if (!rec) {
      res.status(404).json({ error: "المصروف المتكرر غير موجود" });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const numAmount = Number(rec.amount);

    // Insert into expenses
    db.prepare(`
      INSERT INTO expenses (category, amount, expense_date, notes, is_recurring)
      VALUES (?, ?, ?, ?, 1)
    `).run(rec.category, numAmount, today, `مصروف متكرر: ${rec.title}`);

    // Create payment voucher
    const countRow = db.prepare("SELECT COUNT(*) as c FROM vouchers").get() as { c: number };
    const nextNum = String(countRow.c + 1);

    db.prepare(`
      INSERT INTO vouchers (voucher_number, type, party_type, party_id, party_name, amount, payment_against)
      VALUES (?, 'payment', 'general', 0, ?, ?, ?)
    `).run(nextNum, rec.title, numAmount, `سداد مصروف دوري متكرر: ${rec.title}`);

    // Calculate next due date
    const d = new Date(rec.next_due_date);
    if (rec.frequency === "monthly") d.setMonth(d.getMonth() + 1);
    else if (rec.frequency === "quarterly") d.setMonth(d.getMonth() + 3);
    else if (rec.frequency === "yearly") d.setFullYear(d.getFullYear() + 1);

    db.prepare("UPDATE recurring_expenses SET next_due_date = ? WHERE id = ?").run(d.toISOString().slice(0, 10), rec.id);

    res.json({ message: "تم توليد وقيد المصروف المتكرر وسند الصرف بنجاح" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


/* ─── 11. Cost Centers & Fiscal Periods (مراكز التكلفة والفترات) ─── */
router.get("/accounting/cost-centers", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = db.prepare("SELECT * FROM cost_centers ORDER BY code ASC").all();
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/accounting/cost-centers", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { code, name, notes } = req.body;
  if (!code || !name) {
    res.status(400).json({ error: "الرمز والاسم مطلوبان" });
    return;
  }
  try {
    const r = db.prepare("INSERT INTO cost_centers (code, name, notes, active) VALUES (?, ?, ?, 1)").run(code, name, notes ?? "");
    res.status(201).json(db.prepare("SELECT * FROM cost_centers WHERE id = ?").get(r.lastInsertRowid));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/accounting/fiscal-periods", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = db.prepare("SELECT * FROM fiscal_periods ORDER BY id DESC").all();
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/accounting/fiscal-periods", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { name, start_date, end_date, fiscal_year } = req.body;
  if (!name || !start_date || !end_date) {
    res.status(400).json({ error: "اسم الفترة وتاريخ البداية والنهاية مطلوبان" });
    return;
  }
  try {
    const period_code = req.body.period_code || `FP-${Date.now().toString().slice(-6)}`;
    const info = db.prepare(`
      INSERT INTO fiscal_periods (period_code, name, start_date, end_date, fiscal_year, status)
      VALUES (?, ?, ?, ?, ?, 'open')
    `).run(period_code, name, start_date, end_date, fiscal_year || "2026");
    res.json({ id: info.lastInsertRowid, message: "تم إنشاء الفترة المالية الجديدة بنجاح" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/accounting/fiscal-periods/:id/close", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  try {
    db.prepare(`
      UPDATE fiscal_periods
      SET status = 'closed', closed_at = datetime('now', 'localtime'), closed_by = ?
      WHERE id = ?
    `).run(user?.name || "مدير النظام", req.params.id);

    res.json({ message: "تم إغلاق الفترة المالية وقفل عمليات التعديل عليها بنجاح" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


/* ─── 12. Core Financial Statements (قائمة الدخل، الميزانية، التدفقات) ─── */
router.get("/accounting/reports/income-statement", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const viewGranularity = (req.query.view_granularity || "movement") as string;
    const startDate = (req.query.start_date || "") as string;
    const endDate = (req.query.end_date || "") as string;

    // Fetch all relevant journal lines
    let query = `
      SELECT 
        l.account_code,
        a.name as account_name,
        a.type as account_type,
        a.parent_code,
        ap.name as parent_name,
        l.debit,
        l.credit,
        l.description,
        e.entry_date,
        e.source_type,
        e.source_id,
        COALESCE(cc.name, 'بدون مركز') as cost_center_name
      FROM journal_entry_lines l
      JOIN journal_entries e ON e.id = l.entry_id
      JOIN accounts a ON a.code = l.account_code
      LEFT JOIN accounts ap ON ap.code = a.parent_code
      LEFT JOIN cost_centers cc ON cc.id = l.cost_center_id
      WHERE (a.type IN ('revenue', 'cogs', 'expense') OR a.code LIKE '4%' OR a.code LIKE '5%')
    `;

    const params: any[] = [];
    if (startDate) {
      query += ` AND e.entry_date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND e.entry_date <= ?`;
      params.push(endDate);
    }

    const lines = db.prepare(query).all(...params) as any[];

    // Calculate totals for response summary
    let totalRevenues = 0;
    let cogsTotal = 0;
    let totalExpenses = 0;

    lines.forEach(l => {
      if (l.account_code.startsWith('4')) {
        // Revenues: Net credit (credit - debit)
        totalRevenues += (l.credit - l.debit);
      } else if (l.account_code.startsWith('5') && !l.account_code.startsWith('55') && l.account_type !== 'expense') {
        // COGS/Costs: Net debit (debit - credit)
        cogsTotal += (l.debit - l.credit);
      } else {
        // Operating Expenses: Net debit (debit - credit)
        totalExpenses += (l.debit - l.credit);
      }
    });

    const grossProfit = totalRevenues - cogsTotal;
    const netProfit = grossProfit - totalExpenses;

    // Group dynamically by selected granularity
    const groups: { [key: string]: { id: string; name: string; revenue: number; cost: number; net: number; count: number } } = {};

    lines.forEach(l => {
      let groupKey = "";
      let groupName = "";

      if (viewGranularity === "movement" || viewGranularity === "analytical_only" || viewGranularity === "analytical") {
        groupKey = l.account_code;
        groupName = `${l.account_code} - ${l.account_name}`;
      } else if (viewGranularity === "account_type") {
        groupKey = l.account_type === "revenue" ? "1" : l.account_type === "cogs" ? "2" : "3";
        groupName = l.account_type === "revenue" ? "حسابات الإيرادات والمبيعات" : l.account_type === "cogs" ? "تكاليف الخدمات والمبيعات (COGS)" : "المصروفات العمومية والتشغيلية";
      } else if (viewGranularity === "movement_name") {
        if (l.source_type === "flight_booking" || l.source_type === "booking" || l.account_code.startsWith("41") || l.account_code.startsWith("51")) {
          groupKey = "flight"; groupName = "حركة حجز تذاكر الطيران وعمولاتها";
        } else if (l.source_type === "hotel" || l.account_code.startsWith("42") || l.account_code.startsWith("52")) {
          groupKey = "hotel"; groupName = "حركة حجوزات الفنادق والمنتجعات";
        } else if (l.source_type === "visa" || l.account_code.startsWith("43") || l.account_code.startsWith("53")) {
          groupKey = "visa"; groupName = "حركة معاملات الفيز والتأشيرات والعمرة";
        } else if (l.source_type === "bus_booking" || l.account_code.startsWith("44") || l.account_code.startsWith("54")) {
          groupKey = "bus"; groupName = "حركة وتذاكر النقل البري والباصات";
        } else {
          groupKey = "other"; groupName = "مصروفات تشغيلية وسندات متنوعة";
        }
      } else if (viewGranularity === "party" || viewGranularity === "beneficiary" || viewGranularity === "account_party") {
        let entityName = "عام / جهات متنوعة";
        if (l.description) {
          const match = l.description.match(/(العميل|المسافر|فندق|شركة النقل|سداد من|لصالح)\s*:\s*([^\-\,\#\s][^\-\,\#]+)/);
          if (match && match[2]) entityName = match[2].trim();
        }
        groupKey = entityName;
        groupName = entityName;
      } else if (viewGranularity === "cost_center" || viewGranularity === "center_account") {
        groupKey = l.cost_center_name;
        groupName = `مركز تكلفة: ${l.cost_center_name}`;
      } else if (viewGranularity === "main_account") {
        groupKey = l.parent_code || "40000";
        groupName = l.parent_name ? `${l.parent_code} - ${l.parent_name}` : "إيرادات ومصروفات رئيسية أخرى";
      } else {
        const prefix = l.account_code.substring(0, 3);
        groupKey = prefix;
        groupName = l.parent_name ? `${prefix}.. - تصنيف رئيسي (${l.parent_name})` : `تصنيف حسابات (${prefix})`;
      }

      if (!groups[groupKey]) {
        groups[groupKey] = { id: groupKey, name: groupName, revenue: 0, cost: 0, net: 0, count: 0 };
      }

      const isRev = l.account_code.startsWith('4');
      const val = isRev ? (l.credit - l.debit) : (l.debit - l.credit);

      if (isRev) {
        groups[groupKey].revenue += val;
      } else {
        groups[groupKey].cost += val;
      }
      groups[groupKey].net = groups[groupKey].revenue - groups[groupKey].cost;
      groups[groupKey].count += 1;
    });

    const breakdown = Object.values(groups).sort((a, b) => b.revenue - a.revenue);

    res.json({
      totalRevenues,
      cogsTotal,
      grossProfit,
      expensesList: breakdown.filter(item => item.cost > 0 && item.revenue === 0).map(item => ({ category: item.name, total: item.cost })),
      breakdown,
      totalExpenses,
      netProfit,
      marginPercent: totalRevenues > 0 ? ((netProfit / totalRevenues) * 100).toFixed(1) : "0.0"
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/accounting/reports/balance-sheet", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const cashInSafes = (db.prepare("SELECT COALESCE(SUM(balance), 0) as t FROM safes WHERE active = 1").get() as any).t;
    const cashInBanks = (db.prepare("SELECT COALESCE(SUM(balance), 0) as t FROM bank_accounts WHERE active = 1").get() as any).t;
    const receivables = (db.prepare("SELECT COALESCE(SUM(balance), 0) as t FROM customers").get() as any).t;
    
    const inventoryValuation = (db.prepare(`
      SELECT COALESCE(SUM(stock * cost), 0) as t FROM products WHERE active = 1
    `).get() as any).t;

    const currentAssets = cashInSafes + cashInBanks + receivables + inventoryValuation;

    const fixedAssetsCost = (db.prepare("SELECT COALESCE(SUM(purchase_cost), 0) as t FROM fixed_assets WHERE status = 'active'").get() as any).t;
    const accumDepreciation = (db.prepare("SELECT COALESCE(SUM(accumulated_depreciation), 0) as t FROM fixed_assets WHERE status = 'active'").get() as any).t;
    const netFixedAssets = fixedAssetsCost - accumDepreciation;

    const totalAssets = currentAssets + netFixedAssets;

    const payables = (db.prepare("SELECT COALESCE(SUM(balance), 0) as t FROM suppliers").get() as any).t;
    const currentLiabilities = payables;

    const capital = (db.prepare("SELECT COALESCE(balance, 5000000) as t FROM accounts WHERE code = '31000'").get() as any)?.t || 5000000;
    
    // Net profit calculation
    const salesTotal = (db.prepare("SELECT COALESCE(SUM(total), 0) as t FROM orders WHERE status IS NULL OR status != 'cancelled'").get() as any).t;
    const cogsTotal = (db.prepare("SELECT COALESCE(SUM(i.quantity * COALESCE(p.cost, i.unit_price * 0.5)), 0) as t FROM order_items i JOIN orders o ON o.id = i.order_id LEFT JOIN products p ON p.id = i.product_id WHERE o.status IS NULL OR o.status != 'cancelled'").get() as any).t;
    const expTotal = (db.prepare("SELECT COALESCE(SUM(amount), 0) as t FROM expenses").get() as any).t;
    const netIncome = (salesTotal - cogsTotal) - expTotal;

    const retainedEarnings = totalAssets - currentLiabilities - capital - netIncome;
    const totalEquity = capital + retainedEarnings + netIncome;

    res.json({
      currentAssets: { cashInSafes, cashInBanks, receivables, inventoryValuation, total: currentAssets },
      fixedAssets: { fixedAssetsCost, accumDepreciation, netFixedAssets },
      totalAssets,
      liabilities: { payables, total: currentLiabilities },
      equity: { capital, retainedEarnings, netIncome, total: totalEquity },
      totalLiabilitiesAndEquity: currentLiabilities + totalEquity,
      isBalanced: Math.abs(totalAssets - (currentLiabilities + totalEquity)) < 1.0
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/accounting/reports/cash-flow", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const cashSales = (db.prepare("SELECT COALESCE(SUM(total), 0) as t FROM orders WHERE payment_method = 'cash'").get() as any).t;
    const cardSales = (db.prepare("SELECT COALESCE(SUM(total), 0) as t FROM orders WHERE payment_method = 'card'").get() as any).t;
    const customerCollections = (db.prepare("SELECT COALESCE(SUM(amount), 0) as t FROM vouchers WHERE type = 'receipt' AND party_type = 'customer'").get() as any).t;
    
    const operatingInflows = cashSales + cardSales + customerCollections;

    const supplierPayments = (db.prepare("SELECT COALESCE(SUM(amount), 0) as t FROM vouchers WHERE type = 'payment' AND party_type = 'supplier'").get() as any).t;
    const operationalExpenses = (db.prepare("SELECT COALESCE(SUM(amount), 0) as t FROM expenses").get() as any).t;
    const employeeSalaries = (db.prepare("SELECT COALESCE(SUM(amount), 0) as t FROM vouchers WHERE type = 'payment' AND party_type = 'employee'").get() as any).t;

    const operatingOutflows = supplierPayments + operationalExpenses + employeeSalaries;
    const netOperatingCashFlow = operatingInflows - operatingOutflows;

    const fixedAssetPurchases = (db.prepare("SELECT COALESCE(SUM(purchase_cost), 0) as t FROM fixed_assets").get() as any).t;
    const netInvestingCashFlow = -fixedAssetPurchases;

    const netCashFlow = netOperatingCashFlow + netInvestingCashFlow;

    res.json({
      operatingInflows,
      operatingOutflows,
      netOperatingCashFlow,
      netInvestingCashFlow,
      netCashFlow
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
