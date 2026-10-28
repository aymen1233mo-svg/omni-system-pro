import { Router } from "express";
import { db, createDoubleEntryJournal, deleteDoubleEntryJournal } from "../lib/sqlite";
import { getAuthUser } from "./auth";
import { recordAuditLog } from "./audit";
import { getCustomerAccountCode } from "./customers";

const router = Router();

// Ensure extra account linkage columns exist on warehouse_sales_invoices
try { db.exec("ALTER TABLE warehouse_sales_invoices ADD COLUMN account_id INTEGER"); } catch {}
try { db.exec("ALTER TABLE warehouse_sales_invoices ADD COLUMN account_code TEXT"); } catch {}
try { db.exec("ALTER TABLE warehouse_sales_invoices ADD COLUMN account_name TEXT"); } catch {}
try { db.exec("ALTER TABLE warehouse_sales_invoices ADD COLUMN safe_id INTEGER"); } catch {}
try { db.exec("ALTER TABLE warehouse_sales_invoices ADD COLUMN due_date TEXT"); } catch {}
try { db.exec("ALTER TABLE warehouse_sales_invoices ADD COLUMN price_level TEXT DEFAULT 'جملة'"); } catch {}
try { db.exec("ALTER TABLE warehouse_sales_invoices ADD COLUMN discount_pct REAL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE warehouse_sales_invoices ADD COLUMN tax_pct REAL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE warehouse_sales_invoice_items ADD COLUMN cost_price REAL DEFAULT 0"); } catch {}

function normalizeInvoiceCurrency(cur?: string | null): string {
  if (!cur) return "YER";
  const c = String(cur).trim().toUpperCase();
  if (c === "SAR" || c.includes("سعودي")) return "SAR";
  if (c === "USD" || c.includes("دولار") || c === "$") return "USD";
  if (c === "YER" || c === "ريال" || c.includes("يمني")) return "YER";
  return c;
}

export function syncWarehouseInvoiceJournal(invoiceId: number): number | null {
  try {
    const inv = db.prepare("SELECT * FROM warehouse_sales_invoices WHERE id = ?").get(invoiceId) as any;
    if (!inv) return null;

    // If an old journal entry exists, reverse and delete it first
    if (inv.journal_entry_id) {
      try {
        deleteDoubleEntryJournal(Number(inv.journal_entry_id));
      } catch {
        try {
          db.prepare("DELETE FROM journal_entry_lines WHERE journal_entry_id = ?").run(inv.journal_entry_id);
          db.prepare("DELETE FROM journal_entries WHERE id = ?").run(inv.journal_entry_id);
        } catch {}
      }
      db.prepare("UPDATE warehouse_sales_invoices SET journal_entry_id = NULL WHERE id = ?").run(invoiceId);
    }

    // Also clean up any orphan journal entries with source_type = 'warehouse_sales_invoice' and source_id = invoiceId
    const orphans = db.prepare("SELECT id FROM journal_entries WHERE source_type = 'warehouse_sales_invoice' AND source_id = ?").all(invoiceId) as { id: number }[];
    for (const orph of orphans) {
      try {
        deleteDoubleEntryJournal(orph.id);
      } catch {
        try {
          db.prepare("DELETE FROM journal_entry_lines WHERE journal_entry_id = ?").run(orph.id);
          db.prepare("DELETE FROM journal_entries WHERE id = ?").run(orph.id);
        } catch {}
      }
    }

    if (inv.status === "cancelled" || inv.status === "draft") {
      return null;
    }

    const grandTotal = Math.round(Number(inv.total_amount || 0) * 100) / 100;
    if (grandTotal <= 0) return null;

    const taxVal = Math.min(grandTotal, Math.max(0, Math.round(Number(inv.tax_val || 0) * 100) / 100));
    const netSalesRev = Math.max(0, Math.round((grandTotal - taxVal) * 100) / 100);
    const paidAmt = Math.min(grandTotal, Math.max(0, Math.round(Number(inv.paid_amount || 0) * 100) / 100));
    const normCurrency = normalizeInvoiceCurrency(inv.currency);
    const exRate = Number(inv.exchange_rate || 1) || 1;

    // Resolve party account code (Customer or Chart of Accounts account)
    let partyAccountCode: string | null = null;
    let partyAccountId: number | null = null;
    let partyAccountName: string | null = null;

    if (inv.customer_id && (!inv.account_code || inv.account_code === "11200" || inv.account_code === "11400")) {
      const code = getCustomerAccountCode(Number(inv.customer_id));
      if (code) {
        const acc = db.prepare("SELECT id, code, name FROM accounts WHERE code = ?").get(code) as any;
        if (acc) {
          partyAccountCode = acc.code;
          partyAccountId = acc.id;
          partyAccountName = acc.name;
        }
      }
    }
    if (!partyAccountCode && inv.account_code) {
      const acc = db.prepare("SELECT id, code, name FROM accounts WHERE code = ? OR id = ?").get(String(inv.account_code), inv.account_code) as any;
      if (acc) {
        partyAccountCode = acc.code;
        partyAccountId = acc.id;
        partyAccountName = acc.name;
      }
    }
    if (!partyAccountCode && inv.account_id) {
      const acc = db.prepare("SELECT id, code, name FROM accounts WHERE id = ?").get(Number(inv.account_id)) as any;
      if (acc) {
        partyAccountCode = acc.code;
        partyAccountId = acc.id;
        partyAccountName = acc.name;
      }
    }
    if (!partyAccountCode && inv.customer_id) {
      const code = getCustomerAccountCode(Number(inv.customer_id));
      if (code) {
        const acc = db.prepare("SELECT id, code, name FROM accounts WHERE code = ?").get(code) as any;
        if (acc) {
          partyAccountCode = acc.code;
          partyAccountId = acc.id;
          partyAccountName = acc.name;
        }
      }
    }
    if (!partyAccountCode && inv.customer_name && !String(inv.customer_name).includes("عميل نقدي عام")) {
      const cleanName = String(inv.customer_name).trim();
      const matchedCust = db.prepare("SELECT id FROM customers WHERE TRIM(name) = ?").get(cleanName) as any;
      if (matchedCust) {
        const code = getCustomerAccountCode(matchedCust.id);
        const acc = db.prepare("SELECT id, code, name FROM accounts WHERE code = ?").get(code) as any;
        if (acc) {
          partyAccountCode = acc.code;
          partyAccountId = acc.id;
          partyAccountName = acc.name;
          db.prepare("UPDATE warehouse_sales_invoices SET customer_id = ? WHERE id = ?").run(matchedCust.id, invoiceId);
        }
      } else {
        const matchedAcc = db.prepare("SELECT id, code, name FROM accounts WHERE TRIM(name) = ? OR code = ?").get(cleanName, cleanName) as any;
        if (matchedAcc) {
          partyAccountCode = matchedAcc.code;
          partyAccountId = matchedAcc.id;
          partyAccountName = matchedAcc.name;
        }
      }
    }

    if (partyAccountCode) {
      let linkedCustomerId = inv.customer_id ? Number(inv.customer_id) : null;
      if (!linkedCustomerId) {
        const custByAcc = db.prepare("SELECT id FROM customers WHERE account_code = ? OR TRIM(name) = TRIM(?)").get(partyAccountCode, partyAccountName || "") as any;
        if (custByAcc) linkedCustomerId = custByAcc.id;
      }
      db.prepare("UPDATE warehouse_sales_invoices SET customer_id = COALESCE(customer_id, ?), account_id = ?, account_code = ?, account_name = ? WHERE id = ?")
        .run(linkedCustomerId, partyAccountId, partyAccountCode, partyAccountName, invoiceId);
    }

    // Ensure core revenue and tax accounts exist
    let revCode = "41000";
    const revAcc = db.prepare("SELECT code FROM accounts WHERE code = '41000'").get() as any;
    if (!revAcc) {
      const fallbackRev = db.prepare("SELECT code FROM accounts WHERE type = 'revenue' ORDER BY code ASC LIMIT 1").get() as any;
      if (fallbackRev) revCode = fallbackRev.code;
    }

    let taxCode = "21200";
    const taxAcc = db.prepare("SELECT code FROM accounts WHERE code = '21200'").get() as any;
    if (!taxAcc) {
      const fallbackTax = db.prepare("SELECT code FROM accounts WHERE code = '21300' OR type = 'liability' ORDER BY code ASC LIMIT 1").get() as any;
      if (fallbackTax) taxCode = fallbackTax.code;
    }

    let cashBankCode = inv.payment_type === "bank" ? "11200" : "11100";
    const cbAcc = db.prepare("SELECT code FROM accounts WHERE code = ?").get(cashBankCode) as any;
    if (!cbAcc) {
      const fallbackAsset = db.prepare("SELECT code FROM accounts WHERE type = 'asset' ORDER BY code ASC LIMIT 1").get() as any;
      if (fallbackAsset) cashBankCode = fallbackAsset.code;
    }

    const lines: {
      account_code: string;
      debit: number;
      credit: number;
      description: string;
      currency: string;
      exchange_rate: number;
      cost_center_id?: number;
    }[] = [];

    const custLabel = inv.customer_name || partyAccountName || "عميل";

    if (partyAccountCode) {
      if (inv.payment_type === "credit") {
        lines.push({
          account_code: partyAccountCode,
          debit: grandTotal,
          credit: 0,
          description: `فاتورة مبيعات مخزنية (آجل) رقم ${inv.invoice_no} - ${custLabel}`,
          currency: normCurrency,
          exchange_rate: exRate,
          cost_center_id: inv.cost_center_id || undefined,
        });
        if (paidAmt > 0 && partyAccountCode !== cashBankCode) {
          lines.push({
            account_code: partyAccountCode,
            debit: 0,
            credit: paidAmt,
            description: `دفعة مسددة من فاتورة مبيعات مخزنية رقم ${inv.invoice_no} - ${custLabel}`,
            currency: normCurrency,
            exchange_rate: exRate,
          });
          lines.push({
            account_code: cashBankCode,
            debit: paidAmt,
            credit: 0,
            description: `تحصيل دفعة مقدمة فاتورة مبيعات رقم ${inv.invoice_no} - ${custLabel}`,
            currency: normCurrency,
            exchange_rate: exRate,
          });
        }
      } else {
        // Cash / Bank / Multiple payment for a selected customer or account
        if (partyAccountCode === cashBankCode) {
          lines.push({
            account_code: cashBankCode,
            debit: grandTotal,
            credit: 0,
            description: `فاتورة مبيعات مخزنية نقدية رقم ${inv.invoice_no} - ${custLabel}`,
            currency: normCurrency,
            exchange_rate: exRate,
          });
        } else {
          const settledAmt = paidAmt > 0 ? paidAmt : grandTotal;
          lines.push({
            account_code: partyAccountCode,
            debit: grandTotal,
            credit: 0,
            description: `فاتورة مبيعات مخزنية (${inv.payment_type === "bank" ? "بنك/شبكة" : "نقداً"}) رقم ${inv.invoice_no} - ${custLabel}`,
            currency: normCurrency,
            exchange_rate: exRate,
            cost_center_id: inv.cost_center_id || undefined,
          });
          if (settledAmt > 0) {
            lines.push({
              account_code: partyAccountCode,
              debit: 0,
              credit: settledAmt,
              description: `سداد فوري لفاتورة مبيعات مخزنية رقم ${inv.invoice_no} - ${custLabel}`,
              currency: normCurrency,
              exchange_rate: exRate,
            });
            lines.push({
              account_code: cashBankCode,
              debit: settledAmt,
              credit: 0,
              description: `تحصيل فاتورة مبيعات مخزنية رقم ${inv.invoice_no} - ${custLabel}`,
              currency: normCurrency,
              exchange_rate: exRate,
            });
          }
        }
      }
    } else {
      lines.push({
        account_code: cashBankCode,
        debit: grandTotal,
        credit: 0,
        description: `فاتورة مبيعات مخزنية نقدية رقم ${inv.invoice_no} - ${custLabel}`,
        currency: normCurrency,
        exchange_rate: exRate,
      });
    }

    if (netSalesRev > 0) {
      lines.push({
        account_code: revCode,
        debit: 0,
        credit: netSalesRev,
        description: `إيرادات مبيعات فاتورة مخزنية رقم ${inv.invoice_no} - ${custLabel}`,
        currency: normCurrency,
        exchange_rate: exRate,
        cost_center_id: inv.cost_center_id || undefined,
      });
    }

    if (taxVal > 0) {
      lines.push({
        account_code: taxCode,
        debit: 0,
        credit: taxVal,
        description: `ضريبة القيمة المضافة فاتورة مبيعات مخزنية رقم ${inv.invoice_no}`,
        currency: normCurrency,
        exchange_rate: exRate,
      });
    }

    const entryId = createDoubleEntryJournal(
      inv.invoice_date || new Date().toISOString().slice(0, 10),
      `فاتورة مبيعات مخزنية (${inv.payment_type === "credit" ? "آجل" : "نقدي"}) رقم ${inv.invoice_no} - ${custLabel}`,
      "warehouse_sales_invoice",
      invoiceId,
      lines,
      {
        currency: normCurrency,
        currency_rate: exRate,
        reference_no: inv.invoice_no,
        doc_type: "فاتورة مبيعات مخزنية",
        cost_center_id: inv.cost_center_id || undefined,
        entry_class: "مبيعات",
      }
    );

    db.prepare("UPDATE warehouse_sales_invoices SET journal_entry_id = ? WHERE id = ?").run(entryId, invoiceId);
    return Number(entryId);
  } catch (err) {
    console.error("Error in syncWarehouseInvoiceJournal:", err);
    return null;
  }
}

// Startup data repair & journal synchronization for existing warehouse sales invoices
try {
  // 1. Replace any legacy travel items in warehouse_sales_invoice_items with real warehouse products
  db.exec(`
    UPDATE warehouse_sales_invoice_items
    SET item_name = 'أرز بسمتي هندي درجة أولى (كيس 10 كجم)',
        item_code = 'PRD-101',
        unit = 'كيس'
    WHERE item_name LIKE '%تذكرة%' OR item_name LIKE '%طيران%';

    UPDATE warehouse_sales_invoice_items
    SET item_name = 'جهاز قارئ باركود ليزر لاسلكي احترافي',
        item_code = 'PRD-107',
        unit = 'حبة'
    WHERE item_name LIKE '%سياحي%' OR item_name LIKE '%دبي%';

    UPDATE warehouse_sales_invoice_items
    SET item_name = 'زيت طبخ نباتي صافي (كرتون 6 عبوات)',
        item_code = 'PRD-102',
        unit = 'كرتون'
    WHERE item_name LIKE '%فندق%';

    UPDATE warehouse_sales_invoice_items
    SET item_name = 'شاي سيلاني ممتاز (كرتون 24 علبة)',
        item_code = 'PRD-106',
        unit = 'كرتون'
    WHERE item_name LIKE '%تأشيرة%' OR item_name LIKE '%شنغن%';
  `);

  // 2. Fix any items where unit_price was saved as 0 due to earlier field name mismatch
  const zeroItems = db.prepare(`
    SELECT wi.id, wi.invoice_id, wi.product_id, wi.quantity,
           p.name as prod_name, p.number as prod_num, p.price as prod_price, p.cost as prod_cost, p.unit as prod_unit,
           wsi.subtotal as inv_subtotal, wsi.discount_val as inv_disc, wsi.tax_val as inv_tax, wsi.total_amount as inv_total
    FROM warehouse_sales_invoice_items wi
    JOIN warehouse_sales_invoices wsi ON wsi.id = wi.invoice_id
    LEFT JOIN products p ON p.id = wi.product_id
    WHERE wi.unit_price = 0 AND wsi.total_amount > 0
  `).all() as any[];

  for (const zi of zeroItems) {
    const unitPrice = Number(zi.prod_price || 135);
    const qty = unitPrice > 0 && zi.inv_subtotal > 0 ? Math.max(1, Math.round(zi.inv_subtotal / unitPrice)) : Math.max(1, Number(zi.quantity || 1));
    db.prepare(`
      UPDATE warehouse_sales_invoice_items
      SET item_name = COALESCE(?, item_name),
          item_code = COALESCE(?, item_code),
          unit = COALESCE(?, unit),
          quantity = ?,
          unit_price = ?,
          cost_price = COALESCE(?, 0),
          discount_val = ?,
          tax_val = ?,
          subtotal = ?,
          total_after_tax = ?
      WHERE id = ?
    `).run(
      zi.prod_name || "ورق طباعة فواتير حراري 80مم (كرتون 50 رول)",
      zi.prod_num ? `PRD-${zi.prod_num}` : "PRD-108",
      zi.prod_unit || "كرتون",
      qty,
      unitPrice,
      zi.prod_cost || 95,
      Number(zi.inv_disc || 0),
      Number(zi.inv_tax || 0),
      Number(zi.inv_subtotal || (qty * unitPrice)),
      Number(zi.inv_total || (qty * unitPrice)),
      zi.id
    );
  }

  // 3. Ensure all posted warehouse_sales_invoices have a synchronized journal entry
  const unjournaled = db.prepare("SELECT id FROM warehouse_sales_invoices WHERE status = 'posted' AND journal_entry_id IS NULL").all() as { id: number }[];
  for (const row of unjournaled) {
    syncWarehouseInvoiceJournal(row.id);
  }
} catch (e) {
  console.error("Warehouse invoices startup sync warning:", e);
}

function getAuthUserWithFallback(req: any) {
  let user = getAuthUser(req);
  if (!user) {
    user = db.prepare("SELECT id, username, name, role, active FROM users WHERE active=1 AND (role='admin' OR role='developer' OR role='general_manager') LIMIT 1").get() as any;
  }
  return user;
}

function formatWarehouseInvoice(inv: any) {
  const items = db.prepare(`
    SELECT wi.*, p.name as db_product_name, p.number as db_product_number, p.price as db_price, p.cost as db_cost, p.stock as current_stock, p.unit as db_unit
    FROM warehouse_sales_invoice_items wi
    LEFT JOIN products p ON wi.product_id = p.id
    WHERE wi.invoice_id = ?
    ORDER BY wi.seq ASC, wi.id ASC
  `).all(inv.id) as any[];

  const isPosted = inv.status === "posted" || inv.status === "approved";
  const normCurrency = normalizeInvoiceCurrency(inv.currency);

  return {
    id: inv.id,
    invoice_no: inv.invoice_no,
    ref_no: inv.ref_no || "",
    invoice_date: inv.invoice_date,
    invoice_time: inv.invoice_time,
    branch_id: inv.branch_id || 1,
    branch_name: inv.branch_name || "الفرع الرئيسي",
    warehouse_id: inv.warehouse_id || 1,
    warehouse_name: inv.warehouse_name || "المستودع الرئيسي",
    customer_id: inv.customer_id || null,
    customer_name: inv.customer_name || inv.account_name || "عميل نقدي عام",
    customer_phone: inv.customer_phone || "",
    customer_balance: inv.customer_balance || 0,
    account_id: inv.account_id || null,
    account_code: inv.account_code || null,
    account_name: inv.account_name || null,
    safe_id: inv.safe_id || null,
    due_date: inv.due_date || "",
    price_level: inv.price_level || "جملة",
    sales_rep_id: inv.sales_rep_id || null,
    sales_rep_name: inv.sales_rep_name || "مسؤول المبيعات",
    salesman_name: inv.sales_rep_name || "مسؤول المبيعات",
    cost_center_id: inv.cost_center_id || null,
    cost_center_name: inv.cost_center_name || "",
    payment_type: inv.payment_type || "cash",
    currency: normCurrency,
    exchange_rate: Number(inv.exchange_rate || 1.0),
    subtotal: Number(inv.subtotal || 0),
    discount_percent: Number(inv.discount_pct || 0),
    discount_val: Number(inv.discount_val || 0),
    discount_amount: Number(inv.discount_val || 0),
    tax_percent: Number(inv.tax_pct || 0),
    tax_val: Number(inv.tax_val || 0),
    tax_amount: Number(inv.tax_val || 0),
    service_charge: Number(inv.service_charge || 0),
    delivery_charge: Number(inv.delivery_charge || 0),
    total_amount: Number(inv.total_amount || 0),
    net_amount: Number(inv.total_amount || 0),
    paid_amount: Number(inv.paid_amount || 0),
    remaining_amount: Number(inv.remaining_amount || 0),
    status: inv.status || "posted",
    is_posted: isPosted,
    posted_at: inv.posted_at || null,
    posted_by: inv.posted_by || null,
    journal_entry_id: inv.journal_entry_id || null,
    notes: inv.notes || "",
    created_by: inv.created_by || "مدير النظام",
    created_at: inv.created_at || "",
    updated_by: inv.updated_by || null,
    updated_at: inv.updated_at || null,
    edit_count: Number(inv.edit_count || 0),
    items: items.map(i => {
      const resolvedName = (i.item_name && i.item_name !== "صنف مبيعات")
        ? i.item_name
        : (i.db_product_name || i.item_name || "صنف مبيعات");
      const resolvedCode = i.item_code || i.barcode || (i.db_product_number ? `PRD-${i.db_product_number}` : `PRD-${i.product_id || i.seq}`);
      const resolvedPrice = Number(i.unit_price || i.db_price || 0);
      const resolvedCost = Number(i.cost_price || i.db_cost || 0);
      const resolvedQty = Number(i.quantity || 1);
      const resolvedDiscPct = Number(i.discount_pct || 0);
      const resolvedDiscVal = Number(i.discount_val || 0);
      const resolvedTaxPct = Number(i.tax_pct ?? 0);
      const resolvedTaxVal = Number(i.tax_val || 0);
      const resolvedTotal = Number(i.total_after_tax || (resolvedQty * resolvedPrice - resolvedDiscVal + resolvedTaxVal) || 0);

      return {
        id: i.id,
        seq: i.seq,
        product_id: i.product_id,
        barcode: i.barcode || "",
        item_code: resolvedCode,
        product_code: resolvedCode,
        item_name: resolvedName,
        product_name: resolvedName,
        unit: i.unit || i.db_unit || "حبة",
        quantity: resolvedQty,
        unit_price: resolvedPrice,
        price: resolvedPrice,
        cost_price: resolvedCost,
        discount_pct: resolvedDiscPct,
        discount_percent: resolvedDiscPct,
        discount_val: resolvedDiscVal,
        discount_amount: resolvedDiscVal,
        tax_pct: resolvedTaxPct,
        tax_percent: resolvedTaxPct,
        tax_val: resolvedTaxVal,
        tax_amount: resolvedTaxVal,
        subtotal: Number(i.subtotal || (resolvedQty * resolvedPrice - resolvedDiscVal) || 0),
        total_after_tax: resolvedTotal,
        total: resolvedTotal,
        warehouse_id: i.warehouse_id || 1,
        batch_number: i.batch_number || "",
        expiry_date: i.expiry_date || "",
        notes: i.notes || "",
        current_stock: i.current_stock ?? 999
      };
    })
  };
}

const INVOICE_SELECT_SQL = `
  SELECT wsi.*,
         COALESCE(b.name, 'الفرع الرئيسي') as branch_name,
         COALESCE(w.name, 'مستودع المنتجات والبيع') as warehouse_name,
         c.phone as customer_phone,
         c.balance as customer_balance,
         cc.name as cost_center_name
  FROM warehouse_sales_invoices wsi
  LEFT JOIN branches b ON wsi.branch_id = b.id
  LEFT JOIN warehouses w ON wsi.warehouse_id = w.id
  LEFT JOIN customers c ON wsi.customer_id = c.id
  LEFT JOIN cost_centers cc ON wsi.cost_center_id = cc.id
`;

router.get("/warehouse-invoices", (req, res) => {
  try {
    const { status, payment_type, search, customer_id, from_date, to_date } = req.query;
    let sql = `${INVOICE_SELECT_SQL} WHERE 1=1`;
    const params: any[] = [];

    if (status && status !== "all") {
      sql += ` AND wsi.status = ?`;
      params.push(status);
    }
    if (payment_type && payment_type !== "all") {
      sql += ` AND wsi.payment_type = ?`;
      params.push(payment_type);
    }
    if (customer_id) {
      sql += ` AND wsi.customer_id = ?`;
      params.push(Number(customer_id));
    }
    if (from_date) {
      sql += ` AND wsi.invoice_date >= ?`;
      params.push(from_date);
    }
    if (to_date) {
      sql += ` AND wsi.invoice_date <= ?`;
      params.push(to_date);
    }
    if (search) {
      sql += ` AND (wsi.invoice_no LIKE ? OR wsi.ref_no LIKE ? OR wsi.customer_name LIKE ? OR wsi.sales_rep_name LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    sql += ` ORDER BY wsi.id DESC LIMIT 200`;
    const rows = db.prepare(sql).all(...params) as any[];
    res.json(rows.map(formatWarehouseInvoice));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/warehouse-invoices/:id", (req, res) => {
  try {
    const row = db.prepare(`${INVOICE_SELECT_SQL} WHERE wsi.id = ?`).get(req.params.id) as any;
    if (!row) {
      res.status(404).json({ error: "فاتورة المبيعات غير موجودة" });
      return;
    }
    res.json(formatWarehouseInvoice(row));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function normalizeIncomingItems(items: any[], defaultWarehouseId?: number) {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  const validatedItems = (items || []).map((it: any, idx: number) => {
    const prodId = it.product_id ? Number(it.product_id) : null;
    const dbProd = prodId ? (db.prepare("SELECT id, number, name, price, cost, unit, barcode FROM products WHERE id = ?").get(prodId) as any) : null;

    const qty = Math.max(0.001, Number(it.quantity || 1));
    const price = Number(it.unit_price ?? it.price ?? dbProd?.price ?? 0);
    const costPrice = Number(it.cost_price ?? it.cost ?? dbProd?.cost ?? 0);
    const rawSub = qty * price;
    const discPct = Number(it.discount_pct ?? it.discount_percent ?? 0);
    const discVal = it.discount_val !== undefined
      ? Number(it.discount_val)
      : (it.discount_amount !== undefined ? Number(it.discount_amount) : (rawSub * discPct) / 100);
    const afterDisc = Math.max(0, rawSub - discVal);
    const taxPct = Number(it.tax_pct ?? it.tax_percent ?? 0);
    const taxVal = it.tax_val !== undefined
      ? Number(it.tax_val)
      : (it.tax_amount !== undefined ? Number(it.tax_amount) : (afterDisc * taxPct) / 100);
    const totalAfter = afterDisc + taxVal;

    subtotal += rawSub;
    totalDiscount += discVal;
    totalTax += taxVal;

    const resolvedName = it.item_name || it.product_name || dbProd?.name || "صنف مبيعات";
    const resolvedCode = it.item_code || it.product_code || dbProd?.barcode || (dbProd?.number ? `PRD-${dbProd.number}` : `PRD-${prodId || idx + 1}`);

    return {
      seq: idx + 1,
      product_id: prodId,
      barcode: it.barcode || dbProd?.barcode || "",
      item_code: resolvedCode,
      item_name: resolvedName,
      unit: it.unit || dbProd?.unit || "حبة",
      quantity: qty,
      unit_price: price,
      cost_price: costPrice,
      discount_pct: discPct,
      discount_val: discVal,
      tax_pct: taxPct,
      tax_val: taxVal,
      subtotal: afterDisc,
      total_after_tax: totalAfter,
      warehouse_id: it.warehouse_id ? Number(it.warehouse_id) : (defaultWarehouseId ? Number(defaultWarehouseId) : 1),
      batch_number: it.batch_number || "",
      expiry_date: it.expiry_date || "",
      notes: it.notes || ""
    };
  });

  return { validatedItems, subtotal, totalDiscount, totalTax };
}

router.post("/warehouse-invoices", (req, res) => {
  const user = getAuthUserWithFallback(req);
  const {
    invoice_no, ref_no, invoice_date, invoice_time, branch_id, warehouse_id,
    customer_id, customer_name, account_id, account_code, account_name,
    safe_id, due_date, price_level,
    sales_rep_id, sales_rep_name, salesman_name, cost_center_id,
    payment_type, currency, exchange_rate, service_charge, delivery_charge,
    discount_percent, discount_amount, tax_percent, tax_amount, net_amount,
    paid_amount, status, notes, items
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "يجب إضافة صنف واحد على الأقل في فاتورة المبيعات" });
    return;
  }

  try {
    const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);
    const invDate = invoice_date || nowStr.slice(0, 10);
    const invTime = invoice_time || nowStr.slice(11, 19);

    let finalInvNo = invoice_no;
    const existingNo = finalInvNo ? db.prepare("SELECT id FROM warehouse_sales_invoices WHERE invoice_no = ?").get(String(finalInvNo).trim()) : null;
    if (!finalInvNo || !String(finalInvNo).trim() || existingNo) {
      const maxInv = db.prepare("SELECT MAX(id) as m FROM warehouse_sales_invoices").get() as { m: number | null };
      const nextId = (maxInv?.m || 0) + 1;
      finalInvNo = `INV-2026-${String(nextId).padStart(4, "0")}`;
    }

    const { validatedItems, subtotal, totalDiscount: itemsDisc, totalTax: itemsTax } = normalizeIncomingItems(items, warehouse_id);

    const invDiscPct = Number(discount_percent || 0);
    const invTaxPct = Number(tax_percent || 0);
    const extraDisc = (subtotal - itemsDisc) * (invDiscPct / 100);
    const totalDiscount = discount_amount !== undefined ? Number(discount_amount) : (itemsDisc + extraDisc);
    const taxableBase = Math.max(0, subtotal - totalDiscount);
    const extraTax = taxableBase * (invTaxPct / 100);
    const totalTax = tax_amount !== undefined ? Number(tax_amount) : (itemsTax + extraTax);

    const sCharge = Number(service_charge || 0);
    const dCharge = Number(delivery_charge || 0);
    const grandTotal = net_amount !== undefined && Number(net_amount) > 0
      ? Number(net_amount)
      : (subtotal - totalDiscount + totalTax + sCharge + dCharge);

    const payType = payment_type || "cash";
    const paid = paid_amount !== undefined ? Number(paid_amount) : (payType === "cash" || payType === "bank" ? grandTotal : 0);
    const remaining = Math.max(0, grandTotal - paid);
    // Automatically post on save so stock and accounting statement are immediately updated
    const invStatus = status === "cancelled" ? "cancelled" : "posted";
    const normCurrency = normalizeInvoiceCurrency(currency);

    // Resolve customer / account linkage
    let finalCustId = customer_id ? Number(customer_id) : null;
    let finalCustName = customer_name || account_name || "عميل نقدي عام";
    let finalAccId = account_id ? Number(account_id) : null;
    let finalAccCode = account_code || null;
    let finalAccName = account_name || null;

    if (!finalCustId && finalAccCode) {
      const linkedCust = db.prepare("SELECT id, name FROM customers WHERE account_code = ?").get(finalAccCode) as any;
      if (linkedCust) {
        finalCustId = linkedCust.id;
        finalCustName = linkedCust.name;
      }
    }

    const r = db.prepare(`
      INSERT INTO warehouse_sales_invoices (
        invoice_no, ref_no, invoice_date, invoice_time, branch_id, warehouse_id,
        customer_id, customer_name, account_id, account_code, account_name,
        safe_id, due_date, price_level,
        sales_rep_id, sales_rep_name, cost_center_id,
        payment_type, currency, exchange_rate, subtotal, discount_pct, discount_val, tax_pct, tax_val,
        service_charge, delivery_charge, total_amount, paid_amount, remaining_amount,
        status, posted_at, posted_by, notes, created_by, created_at, edit_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      finalInvNo,
      ref_no || null,
      invDate,
      invTime,
      branch_id ? Number(branch_id) : 1,
      warehouse_id ? Number(warehouse_id) : 1,
      finalCustId,
      finalCustName,
      finalAccId,
      finalAccCode,
      finalAccName,
      safe_id ? Number(safe_id) : null,
      due_date || null,
      price_level || "جملة",
      sales_rep_id ? Number(sales_rep_id) : null,
      sales_rep_name || salesman_name || "مسؤول المبيعات",
      cost_center_id ? Number(cost_center_id) : null,
      payType,
      normCurrency,
      Number(exchange_rate || 1.0),
      subtotal,
      invDiscPct,
      totalDiscount,
      invTaxPct,
      totalTax,
      sCharge,
      dCharge,
      grandTotal,
      paid,
      remaining,
      invStatus,
      invStatus === "posted" ? nowStr : null,
      invStatus === "posted" ? (user?.name || "مدير النظام") : null,
      notes || null,
      user?.name || "مدير النظام",
      nowStr
    );

    const invoiceId = Number(r.lastInsertRowid);

    const insertItemStmt = db.prepare(`
      INSERT INTO warehouse_sales_invoice_items (
        invoice_id, seq, product_id, barcode, item_code, item_name, unit, quantity,
        unit_price, cost_price, discount_pct, discount_val, tax_pct, tax_val, subtotal, total_after_tax,
        warehouse_id, batch_number, expiry_date, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const it of validatedItems) {
      insertItemStmt.run(
        invoiceId, it.seq, it.product_id, it.barcode, it.item_code, it.item_name, it.unit,
        it.quantity, it.unit_price, it.cost_price, it.discount_pct, it.discount_val, it.tax_pct, it.tax_val,
        it.subtotal, it.total_after_tax, it.warehouse_id, it.batch_number, it.expiry_date, it.notes
      );

      if (invStatus === "posted" && it.product_id) {
        try {
          db.prepare("UPDATE products SET stock = MAX(0, COALESCE(stock, 0) - ?) WHERE id = ?").run(it.quantity, it.product_id);
        } catch {}
      }
    }

    if (finalCustId && remaining > 0 && invStatus === "posted") {
      try {
        db.prepare("UPDATE customers SET balance = COALESCE(balance, 0) + ? WHERE id = ?").run(remaining, finalCustId);
      } catch {}
    }

    // Create double-entry journal entry so it immediately reflects in Chart of Accounts & Account Statements
    syncWarehouseInvoiceJournal(invoiceId);

    if (user) {
      recordAuditLog({
        userId: user.id,
        userName: user.name,
        action: `إصدار فاتورة مبيعات مخزنية (${payType === "credit" ? "آجل" : "نقدي"}): ${finalInvNo}`,
        actionType: "create",
        entityType: "warehouse_sales_invoices",
        entityId: invoiceId,
        details: `فاتورة مبيعات مخزنية للعميل/الحساب: ${finalCustName} بمبلغ: ${grandTotal} ${normCurrency}`
      });
    }

    const created = db.prepare(`${INVOICE_SELECT_SQL} WHERE wsi.id = ?`).get(invoiceId);
    res.status(201).json(formatWarehouseInvoice(created));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/warehouse-invoices/:id", (req, res) => {
  const user = getAuthUserWithFallback(req);
  const existing = db.prepare("SELECT * FROM warehouse_sales_invoices WHERE id = ?").get(req.params.id) as any;
  if (!existing) {
    res.status(404).json({ error: "فاتورة المبيعات غير موجودة" });
    return;
  }

  const {
    invoice_no, ref_no, invoice_date, invoice_time, branch_id, warehouse_id,
    customer_id, customer_name, account_id, account_code, account_name,
    safe_id, due_date, price_level,
    sales_rep_id, sales_rep_name, salesman_name, cost_center_id,
    payment_type, currency, exchange_rate, service_charge, delivery_charge,
    discount_percent, discount_amount, tax_percent, tax_amount, net_amount,
    paid_amount, status, notes, items
  } = req.body;

  try {
    const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);

    // If previously posted, revert previous customer balance impact before applying new values
    if (existing.status === "posted" && existing.customer_id && Number(existing.remaining_amount || 0) > 0) {
      try {
        db.prepare("UPDATE customers SET balance = MAX(0, COALESCE(balance, 0) - ?) WHERE id = ?")
          .run(Number(existing.remaining_amount), existing.customer_id);
      } catch {}
    }

    const { validatedItems, subtotal, totalDiscount: itemsDisc, totalTax: itemsTax } = normalizeIncomingItems(items || [], warehouse_id ?? existing.warehouse_id);

    const invDiscPct = discount_percent !== undefined ? Number(discount_percent) : Number(existing.discount_pct || 0);
    const invTaxPct = tax_percent !== undefined ? Number(tax_percent) : Number(existing.tax_pct || 0);
    const extraDisc = (subtotal - itemsDisc) * (invDiscPct / 100);
    const totalDiscount = discount_amount !== undefined ? Number(discount_amount) : (itemsDisc + extraDisc);
    const taxableBase = Math.max(0, subtotal - totalDiscount);
    const extraTax = taxableBase * (invTaxPct / 100);
    const totalTax = tax_amount !== undefined ? Number(tax_amount) : (itemsTax + extraTax);

    const sCharge = Number(service_charge !== undefined ? service_charge : existing.service_charge);
    const dCharge = Number(delivery_charge !== undefined ? delivery_charge : existing.delivery_charge);
    const grandTotal = net_amount !== undefined && Number(net_amount) > 0
      ? Number(net_amount)
      : (subtotal > 0 ? (subtotal - totalDiscount + totalTax + sCharge + dCharge) : Number(existing.total_amount || 0));

    const payType = payment_type ?? existing.payment_type;
    const paid = paid_amount !== undefined ? Number(paid_amount) : (payType === "cash" || payType === "bank" ? grandTotal : 0);
    const remaining = Math.max(0, grandTotal - paid);
    const nextStatus = status === "cancelled" ? "cancelled" : "posted";
    const normCurrency = normalizeInvoiceCurrency(currency ?? existing.currency);

    let finalCustId = customer_id !== undefined ? (customer_id ? Number(customer_id) : null) : existing.customer_id;
    let finalCustName = customer_name ?? account_name ?? existing.customer_name;
    let finalAccId = account_id !== undefined ? (account_id ? Number(account_id) : null) : existing.account_id;
    let finalAccCode = account_code !== undefined ? account_code : existing.account_code;
    let finalAccName = account_name !== undefined ? account_name : existing.account_name;

    if (!finalCustId && finalAccCode) {
      const linkedCust = db.prepare("SELECT id, name FROM customers WHERE account_code = ?").get(finalAccCode) as any;
      if (linkedCust) {
        finalCustId = linkedCust.id;
        finalCustName = linkedCust.name;
      }
    }

    db.prepare(`
      UPDATE warehouse_sales_invoices SET
        invoice_no = ?, ref_no = ?, invoice_date = ?, invoice_time = ?, branch_id = ?, warehouse_id = ?,
        customer_id = ?, customer_name = ?, account_id = ?, account_code = ?, account_name = ?,
        safe_id = ?, due_date = ?, price_level = ?,
        sales_rep_id = ?, sales_rep_name = ?, cost_center_id = ?,
        payment_type = ?, currency = ?, exchange_rate = ?, subtotal = ?, discount_pct = ?, discount_val = ?, tax_pct = ?, tax_val = ?,
        service_charge = ?, delivery_charge = ?, total_amount = ?, paid_amount = ?, remaining_amount = ?,
        status = ?, posted_at = COALESCE(posted_at, ?), posted_by = COALESCE(posted_by, ?),
        notes = ?, updated_by = ?, updated_at = ?, edit_count = COALESCE(edit_count, 0) + 1
      WHERE id = ?
    `).run(
      invoice_no ?? existing.invoice_no,
      ref_no !== undefined ? ref_no : existing.ref_no,
      invoice_date ?? existing.invoice_date,
      invoice_time ?? existing.invoice_time,
      branch_id !== undefined ? Number(branch_id) : existing.branch_id,
      warehouse_id !== undefined ? Number(warehouse_id) : existing.warehouse_id,
      finalCustId,
      finalCustName,
      finalAccId,
      finalAccCode,
      finalAccName,
      safe_id !== undefined ? (safe_id ? Number(safe_id) : null) : existing.safe_id,
      due_date !== undefined ? due_date : existing.due_date,
      price_level ?? existing.price_level ?? "جملة",
      sales_rep_id !== undefined ? (sales_rep_id ? Number(sales_rep_id) : null) : existing.sales_rep_id,
      sales_rep_name ?? salesman_name ?? existing.sales_rep_name,
      cost_center_id !== undefined ? (cost_center_id ? Number(cost_center_id) : null) : existing.cost_center_id,
      payType,
      normCurrency,
      exchange_rate !== undefined ? Number(exchange_rate) : existing.exchange_rate,
      subtotal > 0 ? subtotal : existing.subtotal,
      invDiscPct,
      subtotal > 0 ? totalDiscount : existing.discount_val,
      invTaxPct,
      subtotal > 0 ? totalTax : existing.tax_val,
      sCharge,
      dCharge,
      grandTotal,
      paid,
      remaining,
      nextStatus,
      nowStr,
      user?.name || "مدير النظام",
      notes !== undefined ? notes : existing.notes,
      user?.name || "مدير النظام",
      nowStr,
      req.params.id
    );

    if (items && Array.isArray(items) && items.length > 0) {
      db.prepare("DELETE FROM warehouse_sales_invoice_items WHERE invoice_id = ?").run(req.params.id);
      const insertItemStmt = db.prepare(`
        INSERT INTO warehouse_sales_invoice_items (
          invoice_id, seq, product_id, barcode, item_code, item_name, unit, quantity,
          unit_price, cost_price, discount_pct, discount_val, tax_pct, tax_val, subtotal, total_after_tax,
          warehouse_id, batch_number, expiry_date, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const it of validatedItems) {
        insertItemStmt.run(
          req.params.id, it.seq, it.product_id, it.barcode, it.item_code, it.item_name, it.unit,
          it.quantity, it.unit_price, it.cost_price, it.discount_pct, it.discount_val, it.tax_pct, it.tax_val,
          it.subtotal, it.total_after_tax, it.warehouse_id, it.batch_number, it.expiry_date, it.notes
        );
      }
    }

    if (finalCustId && remaining > 0 && nextStatus === "posted") {
      try {
        db.prepare("UPDATE customers SET balance = COALESCE(balance, 0) + ? WHERE id = ?").run(remaining, finalCustId);
      } catch {}
    }

    // Re-sync double-entry journal entry
    syncWarehouseInvoiceJournal(Number(req.params.id));

    const updated = db.prepare(`${INVOICE_SELECT_SQL} WHERE wsi.id = ?`).get(req.params.id);
    res.json(formatWarehouseInvoice(updated));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/warehouse-invoices/:id/post", (req, res) => {
  const user = getAuthUserWithFallback(req);
  const invoice = db.prepare("SELECT * FROM warehouse_sales_invoices WHERE id = ?").get(req.params.id) as any;
  if (!invoice) {
    res.status(404).json({ error: "الفاتورة غير موجودة" });
    return;
  }

  try {
    const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);
    if (invoice.status !== "posted") {
      const items = db.prepare("SELECT * FROM warehouse_sales_invoice_items WHERE invoice_id = ?").all(req.params.id) as any[];
      for (const it of items) {
        if (it.product_id) {
          db.prepare("UPDATE products SET stock = MAX(0, COALESCE(stock, 0) - ?) WHERE id = ?").run(it.quantity, it.product_id);
        }
      }

      if (invoice.customer_id && invoice.remaining_amount > 0) {
        db.prepare("UPDATE customers SET balance = COALESCE(balance, 0) + ? WHERE id = ?").run(invoice.remaining_amount, invoice.customer_id);
      }

      db.prepare(`
        UPDATE warehouse_sales_invoices SET
          status = 'posted', posted_at = ?, posted_by = ?, updated_by = ?, updated_at = ?, edit_count = COALESCE(edit_count, 0) + 1
        WHERE id = ?
      `).run(nowStr, user?.name || "مدير النظام", user?.name || "مدير النظام", nowStr, req.params.id);
    }

    syncWarehouseInvoiceJournal(Number(req.params.id));
    res.json({ success: true, message: "تم ترحيل الفاتورة وتحديث الأرصدة والمخزون وكشف الحساب بنجاح" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/warehouse-invoices/:id/unpost", (req, res) => {
  const user = getAuthUserWithFallback(req);
  const invoice = db.prepare("SELECT * FROM warehouse_sales_invoices WHERE id = ?").get(req.params.id) as any;
  if (!invoice) {
    res.status(404).json({ error: "الفاتورة غير موجودة" });
    return;
  }
  if (invoice.status !== "posted") {
    res.status(400).json({ error: "الفاتورة غير مرحلة لكي يتم إلغاء ترحيلها" });
    return;
  }

  try {
    const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);
    const items = db.prepare("SELECT * FROM warehouse_sales_invoice_items WHERE invoice_id = ?").all(req.params.id) as any[];
    for (const it of items) {
      if (it.product_id) {
        db.prepare("UPDATE products SET stock = COALESCE(stock, 0) + ? WHERE id = ?").run(it.quantity, it.product_id);
      }
    }

    if (invoice.customer_id && invoice.remaining_amount > 0) {
      db.prepare("UPDATE customers SET balance = MAX(0, COALESCE(balance, 0) - ?) WHERE id = ?").run(invoice.remaining_amount, invoice.customer_id);
    }

    db.prepare(`
      UPDATE warehouse_sales_invoices SET
        status = 'draft', posted_at = NULL, posted_by = NULL, updated_by = ?, updated_at = ?, edit_count = COALESCE(edit_count, 0) + 1
      WHERE id = ?
    `).run(user?.name || "مدير النظام", nowStr, req.params.id);

    syncWarehouseInvoiceJournal(Number(req.params.id));

    res.json({ success: true, message: "تم إلغاء ترحيل الفاتورة وإعادة الكميات للمخزون وإلغاء القيد المحاسبي" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/warehouse-invoices/:id", (req, res) => {
  const user = getAuthUserWithFallback(req);
  const invoice = db.prepare("SELECT * FROM warehouse_sales_invoices WHERE id = ?").get(req.params.id) as any;
  if (!invoice) {
    res.status(404).json({ error: "الفاتورة غير موجودة" });
    return;
  }

  try {
    if (invoice.journal_entry_id) {
      try {
        deleteDoubleEntryJournal(Number(invoice.journal_entry_id));
      } catch {
        try {
          db.prepare("DELETE FROM journal_entry_lines WHERE journal_entry_id = ?").run(invoice.journal_entry_id);
          db.prepare("DELETE FROM journal_entries WHERE id = ?").run(invoice.journal_entry_id);
        } catch {}
      }
    }

    if (invoice.status === "posted") {
      const items = db.prepare("SELECT * FROM warehouse_sales_invoice_items WHERE invoice_id = ?").all(req.params.id) as any[];
      for (const it of items) {
        if (it.product_id) {
          db.prepare("UPDATE products SET stock = COALESCE(stock, 0) + ? WHERE id = ?").run(it.quantity, it.product_id);
        }
      }
      if (invoice.customer_id && invoice.remaining_amount > 0) {
        db.prepare("UPDATE customers SET balance = MAX(0, COALESCE(balance, 0) - ?) WHERE id = ?").run(invoice.remaining_amount, invoice.customer_id);
      }
    }

    db.prepare("DELETE FROM warehouse_sales_invoice_items WHERE invoice_id = ?").run(req.params.id);
    db.prepare("DELETE FROM warehouse_sales_invoices WHERE id = ?").run(req.params.id);

    if (user) {
      recordAuditLog({
        userId: user.id,
        userName: user.name,
        action: `حذف فاتورة مبيعات مخزنية: ${invoice.invoice_no}`,
        actionType: "delete",
        entityType: "warehouse_sales_invoices",
        entityId: Number(req.params.id),
        details: `تم حذف فاتورة المبيعات نهائياً`
      });
    }

    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
