import { Router } from "express";
import { db, syncCustomerAccounts, syncSupplierAccounts, createDoubleEntryJournal, logAudit } from "../lib/sqlite";
import { runErpAccountingSync, getCustomerSubAccountCode, recordSafeOrBankMovement } from "../lib/erp-accounting-sync";
import { getAuthUser } from "./auth";

const router = Router();

// Ensure required tables exist to prevent any SQL logic errors
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      quote_number TEXT,
      date TEXT,
      total_amount REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      net_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'draft',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS quotation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER,
      product_id INTEGER,
      product_name TEXT,
      unit_name TEXT,
      quantity REAL DEFAULT 1,
      unit_price REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      total REAL DEFAULT 0
    );
  `);
} catch (tableInitErr) {
  console.warn("Table init warning in customers.ts:", tableInitErr);
}

// ==========================================
// 1. OFFICES & AGENCIES LIST (المكاتب والوكالات)
// ==========================================
router.get("/travel/offices", (req, res) => {
  const offices = db.prepare(`SELECT * FROM travel_partner_offices WHERE active = 1 ORDER BY id ASC`).all();
  res.json(offices);
});

router.post("/travel/offices", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { name, name_en, office_type, city, phone, email, contact_person, notes } = req.body;
  if (!name || !name.trim()) { res.status(400).json({ error: "اسم المكتب أو الوكالة مطلوب" }); return; }

  const cleanName = name.trim();

  // Create account in Chart of Accounts under 11200 (الذمم المدينة - مكاتب ووكلاء وشركاء)
  const getNextSubCode = () => {
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

  const accountCode = getNextSubCode();
  try {
    db.prepare(`
      INSERT INTO accounts (code, name, type, parent_code, balance, active, is_parent, auto_add, level)
      VALUES (?, ?, 'asset', '11200', 0, 1, 0, 1, 3)
    `).run(accountCode, cleanName);
  } catch (err) {
    console.error("Error creating account for office in chart of accounts:", err);
  }

  const stmt = db.prepare(`
    INSERT INTO travel_partner_offices (name, name_en, office_type, city, phone, email, contact_person, notes, account_code, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  const r = stmt.run(
    cleanName, name_en || null, office_type || 'partner_agency', city || null, phone || null, email || null,
    contact_person || null, notes || null, accountCode
  );
  try { syncSupplierAccounts(); } catch {}
  const newOffice = db.prepare("SELECT * FROM travel_partner_offices WHERE id = ?").get(r.lastInsertRowid);
  res.status(201).json(newOffice);
});

// ==========================================
// 2. CUSTOMERS (العملاء مع التبعية للمكتب)
// ==========================================
router.get("/customers", (req, res) => {
  try {
    const { type, search, affiliation_type, office_id } = req.query;
    let sql = `
      SELECT c.*, c.created_at as createdAt,
             COALESCE((SELECT COUNT(*) FROM orders WHERE customer_id = c.id AND COALESCE(status, '') != 'cancelled'), 0) as orders_count,
             COALESCE((SELECT COUNT(*) FROM warehouse_sales_invoices WHERE customer_id = c.id AND status != 'cancelled'), 0) as warehouse_invoices_count,
             COALESCE((SELECT COUNT(*) FROM quotations WHERE customer_id = c.id), 0) as quotations_count,
             (COALESCE((SELECT COUNT(*) FROM sales_returns WHERE customer_id = c.id), 0) + COALESCE((SELECT COUNT(*) FROM returns WHERE customer_id = c.id), 0)) as returns_count,
             (
               COALESCE((SELECT SUM(total) FROM orders WHERE customer_id = c.id AND COALESCE(status, '') NOT IN ('cancelled', 'returned')), 0) +
               COALESCE((SELECT SUM(total_amount) FROM warehouse_sales_invoices WHERE customer_id = c.id AND status != 'cancelled'), 0)
             ) as total_invoices_amount,
             (
               COALESCE((SELECT SUM(CASE WHEN payment_method = 'credit' THEN 0 ELSE total END) FROM orders WHERE customer_id = c.id AND COALESCE(status, '') NOT IN ('cancelled', 'returned')), 0) +
               COALESCE((SELECT SUM(paid_amount) FROM warehouse_sales_invoices WHERE customer_id = c.id AND status != 'cancelled'), 0)
             ) as total_paid_amount,
             MAX(0, (
               COALESCE((SELECT SUM(CASE WHEN payment_method = 'credit' THEN total ELSE 0 END) FROM orders WHERE customer_id = c.id AND COALESCE(status, '') NOT IN ('cancelled', 'returned')), 0) -
               COALESCE((SELECT SUM(total_refund) FROM returns WHERE customer_id = c.id AND (status IS NULL OR status = 'approved')), 0) -
               COALESCE((SELECT SUM(amount) FROM vouchers WHERE customer_id = c.id AND type = 'receipt'), 0) +
               COALESCE((SELECT SUM(remaining_amount) FROM warehouse_sales_invoices WHERE customer_id = c.id AND status != 'cancelled'), 0)
             )) as remaining_debt,
             (
               SELECT MAX(dt) FROM (
                 SELECT MAX(created_at) as dt FROM orders WHERE customer_id = c.id
                 UNION ALL
                 SELECT MAX(invoice_date) as dt FROM warehouse_sales_invoices WHERE customer_id = c.id
               )
             ) as last_invoice_date,
             CASE 
               WHEN c.affiliation_type = 'agency' THEN 0 
               ELSE COALESCE(SUM(CASE WHEN COALESCE(o.status, '') NOT IN ('cancelled', 'returned') THEN o.total ELSE 0 END), 0) +
                    COALESCE((SELECT SUM(total_amount) FROM warehouse_sales_invoices WHERE customer_id = c.id AND status != 'cancelled'), 0)
             END as totalPurchases,
             (SELECT COUNT(*) FROM travel_passengers WHERE customer_id = c.id) as passengersCount,
             (SELECT COUNT(*) FROM travel_bookings WHERE customer_id = c.id) as bookingsCount
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (type) {
      sql += ` AND c.customer_type = ?`;
      params.push(type);
    }
    if (affiliation_type) {
      sql += ` AND c.affiliation_type = ?`;
      params.push(affiliation_type);
    }
    if (office_id) {
      sql += ` AND c.office_id = ?`;
      params.push(office_id);
    }
    if (search) {
      sql += ` AND (c.name LIKE ? OR c.name_en LIKE ? OR c.phone LIKE ? OR c.customer_number LIKE ? OR c.passport_number LIKE ? OR c.national_id LIKE ? OR c.office_name LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s, s);
    }

    sql += ` GROUP BY c.id ORDER BY c.id DESC`;
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err: any) {
    console.error("Error in GET /customers:", err);
    try {
      const basicRows = db.prepare("SELECT c.*, c.created_at as createdAt FROM customers c ORDER BY c.id DESC").all();
      res.json(basicRows);
    } catch (fallbackErr: any) {
      res.status(500).json({ error: err?.message || "فشل جلب قائمة العملاء" });
    }
  }
});

router.post("/customers", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    customer_number, name, name_en, phone, alternate_phone, email, address, nationality, country,
    dob, gender, national_id, passport_number, passport_issue_date, passport_expiry_date,
    employer, notes, customer_type,
    affiliation_type, office_id, office_name, office_phone, account_code
  } = req.body;

  if (!name) { res.status(400).json({ error: "اسم العميل مطلوب" }); return; }

  // Prevent adding customers with names matching employees
  const isEmp = db.prepare("SELECT id FROM hr_employees WHERE TRIM(name) = ?").get(String(name).trim()) as any;
  if (isEmp) {
    res.status(400).json({ error: "لا يمكن إضافة الموظف كعميل؛ الموظف مسجل بالفعل في شؤون الموظفين ويملك حساباً خاصاً." });
    return;
  }

  const custNum = customer_number?.trim() || `CUST-${Date.now().toString().slice(-5)}`;
  const affType = affiliation_type || 'direct';

  let finalAccountCode = account_code || null;
  let finalOfficeId = office_id ? Number(office_id) : null;
  let finalOfficeName = office_name || null;

  const isAgencyAffiliated = affType === 'agency' || 
                             affType === 'indirect' || 
                             customer_type === 'indirect' || 
                             customer_type === 'agent_customer' || 
                             customer_type === 'sub_customer' || 
                             (finalOfficeId != null && finalOfficeId > 1) || 
                             (finalOfficeName && finalOfficeName.trim() !== '' && !finalOfficeName.includes('الرئيسي'));

  if (!isAgencyAffiliated) {
    finalOfficeId = finalOfficeId || 1;
    finalOfficeName = finalOfficeName || "المركز الرئيسي - الإدارة العامة للمبيعات";
  }

  if (isAgencyAffiliated) {
    if (finalOfficeId) {
      const office = db.prepare("SELECT id, name, account_code FROM travel_partner_offices WHERE id = ?").get(finalOfficeId) as any;
      if (office) {
        finalOfficeName = office.name;
        finalAccountCode = office.account_code || getPartnerOfficeAccountCode(finalOfficeId) || "11200";
      }
    } else if (finalAccountCode) {
      const matchedOff = db.prepare("SELECT id, name FROM travel_partner_offices WHERE account_code = ?").get(finalAccountCode) as any;
      if (matchedOff) {
        finalOfficeId = matchedOff.id;
        finalOfficeName = matchedOff.name;
      } else {
        const accInfo = db.prepare("SELECT name FROM accounts WHERE code = ?").get(finalAccountCode) as any;
        if (accInfo) {
          finalOfficeName = accInfo.name;
        }
      }
    } else if (finalOfficeName) {
      const matchedOff = db.prepare("SELECT id, name, account_code FROM travel_partner_offices WHERE name = ?").get(finalOfficeName) as any;
      if (matchedOff) {
        finalOfficeId = matchedOff.id;
        finalAccountCode = matchedOff.account_code || getPartnerOfficeAccountCode(matchedOff.id) || "11200";
      } else {
        finalAccountCode = "11200";
      }
    } else {
      finalAccountCode = "11200";
    }

    // SECURITY & ACCOUNTING INTEGRITY ENFORCEMENT:
    // Strictly prevent and purge any individual account in `accounts` table for this sub-customer
    try {
      const rogueAccounts = db.prepare("SELECT code FROM accounts WHERE TRIM(name) = ?").all(name.trim()) as any[];
      for (const rogue of rogueAccounts) {
        if (rogue.code !== finalAccountCode) {
          db.prepare("UPDATE journal_entry_lines SET account_code = ? WHERE account_code = ?").run(finalAccountCode, rogue.code);
          db.prepare("DELETE FROM accounts WHERE code = ?").run(rogue.code);
        }
      }
      db.prepare("DELETE FROM account_customers WHERE customer_id IN (SELECT id FROM customers WHERE TRIM(name) = ?)").run(name.trim());
    } catch (cleanErr) {
      console.error("Cleanup rogue account error:", cleanErr);
    }
  }

  const stmt = db.prepare(`
    INSERT INTO customers (
      customer_number, name, name_en, phone, alternate_phone, email, address, nationality, country,
      dob, gender, national_id, passport_number, passport_issue_date, passport_expiry_date,
      employer, notes, customer_type,
      affiliation_type, office_id, office_name, office_phone, account_code
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const r = stmt.run(
    custNum, name, name_en || null, phone || null, alternate_phone || null, email || null, address || null,
    nationality || null, country || null, dob || null, gender || null, national_id || null,
    passport_number || null, passport_issue_date || null, passport_expiry_date || null,
    employer || null, notes || null, customer_type || 'individual',
    affType, finalOfficeId, finalOfficeName, office_phone || null, finalAccountCode
  );

  if (!isAgencyAffiliated) {
    try {
      const subCode = getCustomerSubAccountCode(db as any, Number(r.lastInsertRowid), name);
      if (subCode) {
        db.prepare("UPDATE customers SET account_code = ? WHERE id = ?").run(subCode, r.lastInsertRowid);
      }
    } catch {}
  }

  try { syncCustomerAccounts(); } catch {}
  const cust = db.prepare("SELECT *, 0 as totalPurchases, created_at as createdAt FROM customers WHERE id=?").get(r.lastInsertRowid);
  res.status(201).json(cust);
});

router.put("/customers/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    customer_number, name, name_en, phone, alternate_phone, email, address, nationality, country,
    dob, gender, national_id, passport_number, passport_issue_date, passport_expiry_date,
    employer, notes, customer_type,
    affiliation_type, office_id, office_name, office_phone, account_code
  } = req.body;

  if (name) {
    const isEmp = db.prepare("SELECT id FROM hr_employees WHERE TRIM(name) = ?").get(String(name).trim()) as any;
    if (isEmp) {
      res.status(400).json({ error: "لا يمكن استخدام هذا الاسم؛ الموظف مسجل بالفعل في شؤون الموظفين ويملك حساباً خاصاً." });
      return;
    }
  }

  const affType = affiliation_type || 'direct';
  let finalAccountCode = account_code || null;
  let finalOfficeId = office_id ? Number(office_id) : null;
  let finalOfficeName = office_name || null;

  const isAgencyAffiliated = affType === 'agency' || 
                             affType === 'indirect' || 
                             customer_type === 'indirect' || 
                             customer_type === 'agent_customer' || 
                             customer_type === 'sub_customer' || 
                             (finalOfficeId != null && finalOfficeId > 1) || 
                             (finalOfficeName && finalOfficeName.trim() !== '' && !finalOfficeName.includes('الرئيسي'));

  if (!isAgencyAffiliated) {
    finalOfficeId = finalOfficeId || 1;
    finalOfficeName = finalOfficeName || "المركز الرئيسي - الإدارة العامة للمبيعات";
    try {
      finalAccountCode = getCustomerSubAccountCode(db as any, Number(req.params.id), name) || finalAccountCode;
    } catch {}
  }

  if (isAgencyAffiliated) {
    if (finalOfficeId) {
      const office = db.prepare("SELECT id, name, account_code FROM travel_partner_offices WHERE id = ?").get(finalOfficeId) as any;
      if (office) {
        finalOfficeName = office.name;
        finalAccountCode = office.account_code || getPartnerOfficeAccountCode(finalOfficeId) || "11200";
      }
    } else if (finalAccountCode) {
      const matchedOff = db.prepare("SELECT id, name FROM travel_partner_offices WHERE account_code = ?").get(finalAccountCode) as any;
      if (matchedOff) {
        finalOfficeId = matchedOff.id;
        finalOfficeName = matchedOff.name;
      }
    } else if (finalOfficeName) {
      const matchedOff = db.prepare("SELECT id, name, account_code FROM travel_partner_offices WHERE name = ?").get(finalOfficeName) as any;
      if (matchedOff) {
        finalOfficeId = matchedOff.id;
        finalAccountCode = matchedOff.account_code || getPartnerOfficeAccountCode(matchedOff.id) || "11200";
      } else {
        finalAccountCode = "11200";
      }
    } else {
      finalAccountCode = "11200";
    }

    // SECURITY & ACCOUNTING INTEGRITY ENFORCEMENT:
    // Strictly prevent and purge any individual account in `accounts` table for this sub-customer
    try {
      const prevCust = db.prepare("SELECT account_code, name FROM customers WHERE id = ?").get(req.params.id) as any;
      if (prevCust && prevCust.account_code && prevCust.account_code !== finalAccountCode) {
        db.prepare("UPDATE journal_entry_lines SET account_code = ? WHERE account_code = ?").run(finalAccountCode, prevCust.account_code);
        db.prepare("DELETE FROM accounts WHERE code = ?").run(prevCust.account_code);
      }
      const rogueAccounts = db.prepare("SELECT code FROM accounts WHERE TRIM(name) = ?").all(name.trim()) as any[];
      for (const rogue of rogueAccounts) {
        if (rogue.code !== finalAccountCode) {
          db.prepare("UPDATE journal_entry_lines SET account_code = ? WHERE account_code = ?").run(finalAccountCode, rogue.code);
          db.prepare("DELETE FROM accounts WHERE code = ?").run(rogue.code);
        }
      }
      db.prepare("DELETE FROM account_customers WHERE customer_id = ?").run(req.params.id);
    } catch (cleanErr) {
      console.error("Cleanup rogue account error in PUT:", cleanErr);
    }
  }

  db.prepare(`
    UPDATE customers SET
      customer_number=?, name=?, name_en=?, phone=?, alternate_phone=?, email=?, address=?, nationality=?, country=?,
      dob=?, gender=?, national_id=?, passport_number=?, passport_issue_date=?, passport_expiry_date=?,
      employer=?, notes=?, customer_type=?,
      affiliation_type=?, office_id=?, office_name=?, office_phone=?, account_code=?
    WHERE id=?
  `).run(
    customer_number || null, name, name_en || null, phone || null, alternate_phone || null, email || null, address || null,
    nationality || null, country || null, dob || null, gender || null, national_id || null,
    passport_number || null, passport_issue_date || null, passport_expiry_date || null,
    employer || null, notes || null, customer_type || 'individual',
    affType, finalOfficeId, finalOfficeName, office_phone || null, finalAccountCode,
    req.params.id
  );

  try { syncCustomerAccounts(); } catch {}
  const cust = db.prepare(`SELECT c.*, c.created_at as createdAt FROM customers c WHERE c.id=?`).get(req.params.id);
  res.json(cust);
});

router.delete("/customers/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }
  db.prepare("DELETE FROM customers WHERE id=?").run(req.params.id);
  try { runErpAccountingSync(db as any); } catch {}
  res.status(204).send();
});

// Pay / settle customer credit balance (تحصيل دفعة من العميل)
router.post("/customers/:id/pay", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const customerId = Number(req.params.id);
  const { amount, payment_method, notes, safe_id, bank_account_id } = req.body;
  const paidAmt = Number(amount);

  if (!paidAmt || paidAmt <= 0) {
    res.status(400).json({ error: "المبلغ المحصل يجب أن يكون أكبر من صفر" });
    return;
  }

  try {
    const cust = db.prepare("SELECT * FROM customers WHERE id = ?").get(customerId) as any;
    if (!cust) {
      res.status(404).json({ error: "العميل غير موجود" });
      return;
    }

    const custAccCode = getCustomerSubAccountCode(db as any, cust.id, cust.name);
    const method = (payment_method || "cash").toLowerCase();
    const isBank = method === "bank" || method === "bank_transfer" || method === "card" || method === "credit_card";
    const debitAccCode = isBank ? "11200" : "11100";
    const todayStr = new Date().toISOString().slice(0, 10);

    // 1. Update customer balance
    const newBalance = Math.max(0, Number(cust.balance || 0) - paidAmt);
    db.prepare("UPDATE customers SET balance = ? WHERE id = ?").run(newBalance, cust.id);

    // 2. Insert receipt voucher
    const vCount = (db.prepare("SELECT COUNT(*) as c FROM vouchers").get() as any)?.c || 0;
    const vNum = `RV-${String(vCount + 1).padStart(5, "0")}`;
    const vRes = db.prepare(`
      INSERT INTO vouchers (voucher_number, type, date, amount, payment_method, account_name, description, customer_id, safe_id, user_id)
      VALUES (?, 'receipt', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      vNum,
      todayStr,
      paidAmt,
      isBank ? "bank" : "cash",
      cust.name,
      notes || `سند قبض تحصيل دفعة من حساب العميل ${cust.name}`,
      cust.id,
      safe_id || 1,
      user.id
    );

    // 3. Double-entry journal (Debit Safe 11100 or Bank 11200, Credit Customer 114XX)
    createDoubleEntryJournal(
      todayStr,
      `سند قبض رقم ${vNum} - تحصيل دفعة من العميل ${cust.name}`,
      "voucher",
      vRes.lastInsertRowid as number,
      [
        {
          account_code: debitAccCode,
          debit: paidAmt,
          credit: 0,
          description: `تحصيل دفعة من العميل ${cust.name} (${isBank ? "البنك" : "الصندوق الرئيسي"})`
        },
        {
          account_code: custAccCode,
          debit: 0,
          credit: paidAmt,
          description: `تخفيض مديونية العميل ${cust.name} (${custAccCode})`
        }
      ],
      { reference_no: vNum, doc_type: "سند قبض عميل", entry_class: "مبيعات" }
    );

    // 4. Update Safe or Bank balance & log safe transaction
    recordSafeOrBankMovement(db as any, {
      method: isBank ? "bank" : "cash",
      amount: paidAmt,
      direction: "in",
      statement: `قبض سداد مديونية من العميل ${cust.name} (#${vNum})`,
      reference_number: vNum,
      safe_id: safe_id || 1,
      bank_account_id: bank_account_id || null,
      user_id: user.id,
      user_name: user.name
    });

    try { runErpAccountingSync(db as any); } catch {}
    logAudit(user.id, user.name, "تحصيل دفعة عميل", `تحصيل مبلغ ${paidAmt} من العميل ${cust.name} سند #${vNum}`);
    res.status(201).json({
      success: true,
      voucher_number: vNum,
      customer_id: cust.id,
      new_balance: newBalance,
      account_code: custAccCode
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export function getPartnerOfficeAccountCode(officeId: any): string {
  if (!officeId) return "11200";
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
      return String(maxNum + 1);
    };

    const createPartnerOfficeAccount = (name: string): string => {
      const existing = db.prepare("SELECT code FROM accounts WHERE parent_code = '11200' AND name = ?").get(name) as any;
      if (existing?.code) return existing.code;
      const code = getNextSubCode112();
      db.prepare(`
        INSERT INTO accounts (code, name, type, parent_code, balance, active, is_parent, auto_add, level)
        VALUES (?, ?, 'asset', '11200', 0, 1, 0, 1, 3)
      `).run(code, name);
      return code;
    };

    const po = db.prepare("SELECT id, account_code, name FROM travel_partner_offices WHERE id = ? OR name = ?").get(officeId, String(officeId)) as any;
    if (po) {
      if (po.account_code) {
        const acc = db.prepare("SELECT code, type, parent_code FROM accounts WHERE code = ?").get(po.account_code) as any;
        if (acc && acc.parent_code === '11200') {
          return po.account_code;
        }
      }
      const poName = po.name || `مكتب وسيط #${po.id}`;
      const code = createPartnerOfficeAccount(poName);
      db.prepare("UPDATE travel_partner_offices SET account_code = ? WHERE id = ?").run(code, po.id);
      return code;
    }
  } catch (e) {
    console.error("Error in getPartnerOfficeAccountCode:", e);
  }
  return "11200";
}

export function getCustomerAccountCode(customerId: any): string {
  if (!customerId) return "11200";
  try {
    let cust = db.prepare("SELECT id, account_code, name, affiliation_type, office_id FROM customers WHERE id = ? OR name = ?").get(customerId, String(customerId)) as any;
    
    // If not found in customers, check if customerId is a passenger in travel_passengers
    if (!cust) {
      const pax = db.prepare("SELECT customer_id FROM travel_passengers WHERE id = ?").get(customerId) as any;
      if (pax && pax.customer_id) {
        cust = db.prepare("SELECT id, account_code, name, affiliation_type, office_id FROM customers WHERE id = ?").get(pax.customer_id) as any;
      }
    }

    if (cust) {
      // RULE: Customers belonging to an agency/intermediary office must post to the office's account under 11200 (ذمم مدينة)!
      const isIndirect = cust.affiliation_type === 'agency' || 
                         cust.affiliation_type === 'indirect' || 
                         cust.customer_type === 'indirect' || 
                         cust.customer_type === 'agent_customer' || 
                         cust.customer_type === 'sub_customer' || 
                         (cust.office_id != null && Number(cust.office_id) > 1) || 
                         (cust.partner_office_id != null && Number(cust.partner_office_id) > 1) || 
                         (cust.office_name && String(cust.office_name).trim() !== '' && !String(cust.office_name).includes('الرئيسي'));

      if (isIndirect) {
        const offId = cust.office_id || cust.partner_office_id;
        if (offId) {
          const officeCode = getPartnerOfficeAccountCode(offId);
          if (officeCode) {
            if (cust.account_code !== officeCode) {
              db.prepare("UPDATE customers SET account_code = ? WHERE id = ?").run(officeCode, cust.id);
            }
            return officeCode;
          }
        }
        if (cust.office_name) {
          const offByName = db.prepare("SELECT id, account_code FROM travel_partner_offices WHERE name = ?").get(cust.office_name) as any;
          if (offByName) {
            const officeCode = offByName.account_code || getPartnerOfficeAccountCode(offByName.id);
            if (officeCode) {
              if (cust.account_code !== officeCode) {
                db.prepare("UPDATE customers SET account_code = ? WHERE id = ?").run(officeCode, cust.id);
              }
              return officeCode;
            }
          }
        }
        if (cust.account_code && cust.account_code.startsWith("112")) return cust.account_code;
        return "11200"; // Default partner agency account
      }

      // Direct customers -> use 114XX under 11400 (ذمم العملاء / المدينون)
      return getCustomerSubAccountCode(db as any, cust.id, cust.name);
    }
    const acc = db.prepare("SELECT code FROM accounts WHERE code = ? OR id = ? OR name = ?").get(String(customerId), customerId, String(customerId)) as any;
    if (acc && acc.code) return acc.code;
  } catch (e) {
    console.error("Error in getCustomerAccountCode:", e);
  }
  return "11400";
}

export function getSupplierAccountCode(supplierId: any): string {
  if (!supplierId) return "21100";
  try {
    // If supplierId is a partner office, redirect to 11200 (ذمم مدينة)
    const po = db.prepare("SELECT id, account_code, name FROM travel_partner_offices WHERE id = ? OR name = ?").get(supplierId, String(supplierId)) as any;
    if (po) {
      return getPartnerOfficeAccountCode(po.id);
    }

    // Helper to calculate the next sub-account code under '21100'
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

    // Helper to insert a new account in chart of accounts under '21100'
    const createAccount = (name: string): string => {
      const code = getNextSubCode();
      db.prepare(`
        INSERT INTO accounts (code, name, type, parent_code, balance, active, is_parent, auto_add, level)
        VALUES (?, ?, 'liability', '21100', 0, 1, 0, 1, 3)
      `).run(code, name);
      return code;
    };

    // 1. If supplierId is already an account code format (e.g. 4+ digits)
    if (typeof supplierId === "string" && supplierId.length >= 4 && /^\d+$/.test(supplierId)) {
      const directCode = db.prepare("SELECT code FROM accounts WHERE code = ?").get(supplierId) as any;
      if (directCode?.code) return directCode.code;
    }

    // 2. Specific supplier tables lookup FIRST by ID or name
    const tc = db.prepare("SELECT id, account_code, name, name as company_name FROM travel_transport_companies WHERE id = ? OR name = ?").get(supplierId, String(supplierId)) as any;
    if (tc) {
      if (tc.account_code) return tc.account_code;
      const tcName = tc.company_name || tc.name || `شركة نقل بري #${tc.id}`;
      const code = createAccount(tcName);
      db.prepare("UPDATE travel_transport_companies SET account_code = ? WHERE id = ?").run(code, tc.id);
      return code;
    }

    const ts = db.prepare("SELECT id, account_code, name FROM travel_suppliers WHERE id = ? OR name = ?").get(supplierId, String(supplierId)) as any;
    if (ts) {
      if (ts.account_code) return ts.account_code;
      const tsName = ts.name || `مورد سفر #${ts.id}`;
      const code = createAccount(tsName);
      db.prepare("UPDATE travel_suppliers SET account_code = ? WHERE id = ?").run(code, ts.id);
      return code;
    }

    const sup = db.prepare("SELECT id, account_code, name FROM suppliers WHERE id = ? OR name = ?").get(supplierId, String(supplierId)) as any;
    if (sup) {
      if (sup.account_code) return sup.account_code;
      const sName = sup.name || `مورد #${sup.id}`;
      const code = createAccount(sName);
      db.prepare("UPDATE suppliers SET account_code = ? WHERE id = ?").run(code, sup.id);
      return code;
    }

    const h = db.prepare("SELECT id, account_code, name_ar, name_en FROM travel_hotels_db WHERE id = ? OR name_ar = ? OR name_en = ?").get(supplierId, String(supplierId), String(supplierId)) as any;
    if (h) {
      if (h.account_code) return h.account_code;
      const hName = h.name_ar || h.name_en || `فندق #${h.id}`;
      const code = createAccount(hName);
      db.prepare("UPDATE travel_hotels_db SET account_code = ? WHERE id = ?").run(code, h.id);
      return code;
    }

    // 3. Lookup by account name
    const accByName = db.prepare("SELECT code FROM accounts WHERE name = ?").get(String(supplierId)) as any;
    if (accByName?.code) return accByName.code;

    // 4. Lookup by account code or ID
    const acc = db.prepare("SELECT code FROM accounts WHERE code = ? OR id = ?").get(String(supplierId), supplierId) as any;
    if (acc && acc.code) return acc.code;

    // 5. Dynamic auto-creation for supplier agent string name
    const nameStr = String(supplierId).trim();
    if (nameStr && isNaN(Number(nameStr)) && nameStr.length > 1) {
      const code = createAccount(nameStr);
      return code;
    }
  } catch (e) {
    console.error("Error in getSupplierAccountCode:", e);
  }
  return "21100";
}

router.get("/travel/sub-accounts/:parentCode", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { parentCode } = req.params;
  try {
    // Return direct sub-accounts of parentCode, or the parentCode account itself if no sub-accounts exist
    const subAccounts = db.prepare(`
      SELECT id, code, name, type, parent_code 
      FROM accounts 
      WHERE parent_code = ? OR code = ?
      ORDER BY code ASC
    `).all(parentCode, parentCode);
    res.json(subAccounts);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Comprehensive Sales, Warehouse & Financial Profile for a Customer
router.get("/customers/:id/sales-profile", (req, res) => {
  try {
    const custId = Number(req.params.id);
    const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(custId) as any;
    if (!customer) {
      res.status(404).json({ error: "العميل غير موجود" });
      return;
    }

    const custAccountCode = getCustomerAccountCode(custId);
    const accountInfo = db.prepare("SELECT * FROM accounts WHERE code = ?").get(custAccountCode) as any;

    // 1. POS Orders
    let posOrders: any[] = [];
    try {
      posOrders = db.prepare(`
        SELECT o.*,
               (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as items_count
        FROM orders o
        WHERE o.customer_id = ?
        ORDER BY o.id DESC
      `).all(custId) as any[];
    } catch {}

    // 2. Warehouse Sales Invoices (both warehouse_sales_invoices and inventory_sales_invoices)
    let warehouseInvoices: any[] = [];
    try {
      const wsi = db.prepare(`
        SELECT w.*, wh.name as warehouse_name,
               (SELECT COUNT(*) FROM warehouse_sales_invoice_items WHERE invoice_id = w.id) as items_count
        FROM warehouse_sales_invoices w
        LEFT JOIN warehouses wh ON wh.id = w.warehouse_id
        WHERE w.customer_id = ? OR (w.account_code = ? AND ? != '11400' AND ? != '11200')
        ORDER BY w.id DESC
      `).all(custId, custAccountCode, custAccountCode, custAccountCode) as any[];

      for (const inv of wsi) {
        try {
          inv.items = db.prepare("SELECT * FROM warehouse_sales_invoice_items WHERE invoice_id = ? ORDER BY seq ASC").all(inv.id);
        } catch { inv.items = []; }
      }
      warehouseInvoices = wsi;
    } catch {}

    // 3. Quotations
    let quotations: any[] = [];
    try {
      quotations = db.prepare(`
        SELECT q.*,
               (SELECT COUNT(*) FROM quotation_items WHERE quotation_id = q.id) as items_count
        FROM quotations q
        WHERE q.customer_id = ?
        ORDER BY q.id DESC
      `).all(custId) as any[];
    } catch {}

    // 4. Sales Returns (both warehouse and POS returns)
    let salesReturns: any[] = [];
    try {
      const sr1 = db.prepare(`
        SELECT sr.*,
               (SELECT COUNT(*) FROM sales_return_items WHERE return_id = sr.id) as items_count
        FROM sales_returns sr
        WHERE sr.customer_id = ?
        ORDER BY sr.id DESC
      `).all(custId) as any[];

      const sr2 = db.prepare(`
        SELECT r.id, r.return_number, r.total_refund as total_amount, r.created_at as return_date, r.reason, r.status,
               (SELECT COUNT(*) FROM return_items WHERE return_id = r.id) as items_count
        FROM returns r
        WHERE r.customer_id = ?
        ORDER BY r.id DESC
      `).all(custId) as any[];

      salesReturns = [...sr1, ...sr2];
    } catch {}

    // 5. Financial Vouchers & Ledger Statement
    let vouchers: any[] = [];
    let statement: any[] = [];
    try {
      const lines = db.prepare(`
        SELECT jel.*, je.entry_number, je.date, je.description as entry_description,
               je.reference_type, je.reference_id, je.voucher_type
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.id = jel.journal_entry_id
        WHERE jel.account_code = ?
        ORDER BY je.date ASC, je.id ASC, jel.id ASC
      `).all(custAccountCode) as any[];

      let runningBalance = 0;
      statement = lines.map((l: any) => {
        const debit = Number(l.debit || 0);
        const credit = Number(l.credit || 0);
        runningBalance += debit - credit;
        return {
          id: l.id,
          entry_id: l.journal_entry_id,
          entry_number: l.entry_number,
          date: l.date,
          description: l.description || l.entry_description,
          reference_type: l.reference_type,
          reference_id: l.reference_id,
          voucher_type: l.voucher_type,
          debit,
          credit,
          balance: runningBalance,
        };
      });

      vouchers = lines.filter((l: any) =>
        l.voucher_type === 'receipt' || l.voucher_type === 'payment' ||
        l.reference_type === 'customer_payment' || l.reference_type === 'voucher'
      );
    } catch {}

    const totalPosSales = posOrders.reduce((s, o) => s + Number(o.total || 0), 0);
    const totalWarehouseSales = warehouseInvoices
      .filter((w: any) => w.status !== 'cancelled')
      .reduce((s, w) => s + Number(w.total_amount || 0), 0);
    const totalSalesAmount = totalPosSales + totalWarehouseSales;

    const totalPosPaid = posOrders.reduce((s, o) => s + (o.payment_method === 'credit' ? Number(o.paid_amount || 0) : Number(o.total || 0)), 0);
    const totalWarehousePaid = warehouseInvoices
      .filter((w: any) => w.status !== 'cancelled')
      .reduce((s, w) => s + Number(w.paid_amount || 0), 0);
    const totalPaidAmount = totalPosPaid + totalWarehousePaid;

    const totalReturnsAmount = salesReturns.reduce((s, r) => s + Number(r.total_amount || r.total || 0), 0);
    const currentLedgerBalance = statement.length > 0 ? statement[statement.length - 1].balance : Math.max(0, totalSalesAmount - totalPaidAmount - totalReturnsAmount);

    res.json({
      customer: {
        ...customer,
        account_code: custAccountCode,
        account_name: accountInfo?.name || customer.name,
      },
      posOrders,
      warehouseInvoices,
      quotations,
      salesReturns,
      vouchers,
      statement,
      summary: {
        pos_orders_count: posOrders.length,
        warehouse_invoices_count: warehouseInvoices.length,
        quotations_count: quotations.length,
        returns_count: salesReturns.length,
        total_sales_amount: totalSalesAmount,
        total_paid_amount: totalPaidAmount,
        total_returns_amount: totalReturnsAmount,
        remaining_balance: currentLedgerBalance,
      }
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

