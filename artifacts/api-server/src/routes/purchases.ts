import { Router } from "express";
import { db, logAudit, createDoubleEntryJournal } from "../lib/sqlite";
import { runErpAccountingSync, recordSafeOrBankMovement } from "../lib/erp-accounting-sync";
import { getAuthUser } from "./auth";
import { getBusinessDate } from "../lib/business-day";

const router = Router();

function getSupplierSubAccountCode(supplierId?: number | null, supplierName?: string | null): string {
  try { runErpAccountingSync(db); } catch {}
  if (supplierId) {
    const row = db.prepare("SELECT account_code FROM suppliers WHERE id = ?").get(supplierId) as any;
    if (row?.account_code) return row.account_code;
  }
  if (supplierName) {
    const row = db.prepare("SELECT account_code FROM suppliers WHERE name = ?").get(supplierName.trim()) as any;
    if (row?.account_code) return row.account_code;
  }
  return "21100";
}

function getPaymentAccountCode(method?: string | null, customCode?: string | null): string {
  if (customCode && db.prepare("SELECT id FROM accounts WHERE code = ?").get(customCode)) {
    return customCode;
  }
  const m = (method || "cash").toLowerCase();
  if (m === "bank" || m === "bank_transfer" || m === "check" || m === "cheque" || m === "credit_card" || m === "card") {
    return "11200";
  }
  return "11100";
}

function requireAuth(req: any, res: any): any {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "غير مصرح" });
    return null;
  }
  return user;
}

// ─────────────────────────────────────────────────────────────
// 1. DASHBOARD & OVERVIEW INDICATORS (لوحة تحكم المشتريات)
// ─────────────────────────────────────────────────────────────
router.get("/purchases/dashboard", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const today = getBusinessDate("purchases");
    const thisMonth = today.slice(0, 7);
    const thisYear = today.slice(0, 4);

    // Purchase Totals
    const todayPurchases = (db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total FROM purchase_invoices WHERE invoice_date LIKE ?
    `).get(`${today}%`) as any).total;

    const monthPurchases = (db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total FROM purchase_invoices WHERE invoice_date LIKE ?
    `).get(`${thisMonth}%`) as any).total;

    const yearPurchases = (db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total FROM purchase_invoices WHERE invoice_date LIKE ?
    `).get(`${thisYear}%`) as any).total;

    // Counts
    const poCount = (db.prepare(`SELECT COUNT(*) as c FROM purchase_orders`).get() as any).c;
    const pendingPrCount = (db.prepare(`SELECT COUNT(*) as c FROM purchase_requests WHERE status IN ('pending_approval', 'review', 'draft')`).get() as any).c;
    const openPoCount = (db.prepare(`SELECT COUNT(*) as c FROM purchase_orders WHERE status IN ('pending', 'under_review', 'approved', 'sent', 'in_transit', 'partially_received')`).get() as any).c;
    const completedPoCount = (db.prepare(`SELECT COUNT(*) as c FROM purchase_orders WHERE status IN ('received', 'completed')`).get() as any).c;

    const totalReturns = (db.prepare(`SELECT COALESCE(SUM(total_amount), 0) as total FROM purchase_returns`).get() as any).total;
    const supplierPayables = (db.prepare(`SELECT COALESCE(SUM(remaining_amount), 0) as total FROM purchase_invoices WHERE payment_status != 'paid'`).get() as any).total;
    const supplierTotalPaid = (db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM supplier_payments`).get() as any).total;

    // Top Suppliers
    const topSuppliers = db.prepare(`
      SELECT s.id, s.name, COUNT(pi.id) as invoice_count, COALESCE(SUM(pi.total), 0) as total_purchases
      FROM suppliers s
      LEFT JOIN purchase_invoices pi ON pi.supplier_id = s.id
      GROUP BY s.id
      ORDER BY total_purchases DESC
      LIMIT 5
    `).all();

    // Top Purchased Items
    const topItems = db.prepare(`
      SELECT p.id, p.name, COALESCE(SUM(item.quantity), 0) as total_qty, COALESCE(SUM(item.total), 0) as total_cost
      FROM products p
      JOIN purchase_invoice_items item ON item.product_id = p.id
      GROUP BY p.id
      ORDER BY total_qty DESC
      LIMIT 5
    `).all();

    // Items with Price Surge
    const priceSurges = db.prepare(`
      SELECT p.id, p.name, p.cost as current_cost,
        (SELECT pii.unit_price FROM purchase_invoice_items pii JOIN purchase_invoices pi ON pi.id = pii.invoice_id WHERE pii.product_id = p.id ORDER BY pi.invoice_date DESC LIMIT 1 OFFSET 1) as prev_cost
      FROM products p
      WHERE prev_cost IS NOT NULL AND current_cost > prev_cost
      LIMIT 5
    `).all().map((i: any) => ({
      ...i,
      diff: i.current_cost - (i.prev_cost || 0),
      percentage: i.prev_cost ? Math.round(((i.current_cost - i.prev_cost) / i.prev_cost) * 100) : 0
    }));

    // Items needing reorder
    const itemsNeedingReorder = db.prepare(`
      SELECT id, name, stock, min_stock, cost
      FROM products
      WHERE COALESCE(stock, 0) <= COALESCE(min_stock, 10) AND active = 1
      ORDER BY stock ASC
      LIMIT 8
    `).all();

    res.json({
      todayPurchases,
      monthPurchases,
      yearPurchases,
      poCount,
      pendingPrCount,
      openPoCount,
      completedPoCount,
      totalReturns,
      supplierPayables,
      supplierTotalPaid,
      topSuppliers,
      topItems,
      priceSurges,
      itemsNeedingReorder
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 2. PURCHASE REQUESTS (طلبات الشراء)
// ─────────────────────────────────────────────────────────────
router.get("/purchases/requests", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const requests = db.prepare(`
      SELECT pr.*, b.name as branch_name, w.name as warehouse_name
      FROM purchase_requests pr
      LEFT JOIN branches b ON b.id = pr.branch_id
      LEFT JOIN warehouses w ON w.id = pr.warehouse_id
      ORDER BY pr.created_at DESC
    `).all();

    const result = requests.map((pr: any) => ({
      ...pr,
      items: db.prepare("SELECT * FROM purchase_request_items WHERE pr_id = ?").all(pr.id)
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/purchases/requests", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { requester_name, department, branch_id, warehouse_id, request_date, need_date, priority, reason, items, notes } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "يجب اختيار صنف واحد على الأقل في طلب الشراء" });
    return;
  }

  try {
    const countRow = db.prepare("SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM purchase_requests").get() as { next_id: number };
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const prNumber = `PR-${String(countRow?.next_id || 1).padStart(5, "0")}-${randSuffix.toString().slice(-2)}`;

    const r = db.prepare(`
      INSERT INTO purchase_requests (pr_number, requester_name, department, branch_id, warehouse_id, request_date, need_date, priority, reason, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_approval', ?)
    `).run(
      prNumber,
      requester_name?.trim() || user.name || "المستودع",
      department || "المخازن",
      branch_id ? Number(branch_id) : 1,
      warehouse_id ? Number(warehouse_id) : 1,
      request_date || new Date().toISOString().slice(0, 10),
      need_date || null,
      priority || "عادي",
      reason || "استكمال حد المخزون والاحتياج",
      notes || null
    );

    const prId = r.lastInsertRowid;

    const insertItem = db.prepare(`
      INSERT INTO purchase_request_items (pr_id, product_id, product_name, unit, requested_qty, need_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const it of items) {
      const prodName = (it.product_name || (it.product_id ? (db.prepare("SELECT name FROM products WHERE id = ?").get(it.product_id) as any)?.name : null) || "صنف مستودعي").trim();
      insertItem.run(
        prId,
        it.product_id ? Number(it.product_id) : null,
        prodName,
        it.unit || "كجم",
        Number(it.requested_qty) || 1,
        it.need_date || need_date || null,
        it.notes || null
      );
    }

    logAudit(user.id, user.name, "طلب شراء", `إنشاء طلب شراء رقم ${prNumber}`);
    res.status(201).json({ id: prId, pr_number: prNumber, status: "pending_approval" });
  } catch (err: any) {
    console.error("Error creating PR:", err);
    res.status(500).json({ error: "فشل في إنشاء طلب الشراء: " + err.message });
  }
});

router.post("/purchases/requests/:id/status", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { status, notes } = req.body;
  const prId = req.params.id;

  try {
    db.prepare(`
      UPDATE purchase_requests
      SET status = ?, approved_by = ?, approval_date = ?, notes = COALESCE(?, notes), updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      status,
      user.name,
      new Date().toISOString().slice(0, 10),
      notes || null,
      prId
    );

    logAudit(user.id, user.name, "تحديث طلب شراء", `تحديث حالة طلب الشراء #${prId} إلى ${status}`);
    res.json({ success: true, status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 3. AUTO PURCHASE REORDER ALERTS (طلب الشراء التلقائي)
// ─────────────────────────────────────────────────────────────
router.get("/purchases/auto-reorder", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const lowStockItems = db.prepare(`
      SELECT p.id as product_id, p.name as product_name, p.stock as current_stock,
             COALESCE(p.min_stock, 10) as min_stock, (COALESCE(p.min_stock, 10) * 3) as max_stock,
             p.cost as last_unit_cost,
             (SELECT s.name FROM suppliers s JOIN purchase_orders po ON po.supplier_id = s.id JOIN purchase_order_items poi ON poi.purchase_order_id = po.id WHERE poi.product_id = p.id ORDER BY po.created_at DESC LIMIT 1) as preferred_supplier
      FROM products p
      WHERE COALESCE(p.stock, 0) <= COALESCE(p.min_stock, 10) AND p.active = 1
      ORDER BY p.stock ASC
    `).all();

    const suggestions = lowStockItems.map((item: any) => {
      const suggestedQty = Math.max(10, item.max_stock - item.current_stock);
      return {
        ...item,
        suggested_qty: suggestedQty,
        estimated_total: suggestedQty * (item.last_unit_cost || 0),
        reason: `المخزون الحالي (${item.current_stock}) أقل من/يساوي الحد الأدنى (${item.min_stock})`
      };
    });

    res.json(suggestions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/purchases/auto-reorder/create-pr", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "اختر الأصناف المراد توليد طلب شراء تلقائي لها" });
    return;
  }

  try {
    const countRow = db.prepare("SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM purchase_requests").get() as { next_id: number };
    const randSuffix = Math.floor(100 + Math.random() * 900);
    const prNumber = `PR-AUTO-${String(countRow?.next_id || 1).padStart(4, "0")}-${randSuffix}`;

    const r = db.prepare(`
      INSERT INTO purchase_requests (pr_number, requester_name, department, branch_id, warehouse_id, request_date, priority, reason, status, notes)
      VALUES (?, ?, 'المخازن', 1, 1, ?, 'عالي', 'توليد تلقائي بناءً على تنبيهات الحد الأدنى للمخزون', 'pending_approval', 'طلب آلي ذكي')
    `).run(prNumber, user.name || "النظام", new Date().toISOString().slice(0, 10));

    const prId = r.lastInsertRowid;
    const insertItem = db.prepare(`
      INSERT INTO purchase_request_items (pr_id, product_id, product_name, unit, requested_qty, notes)
      VALUES (?, ?, ?, 'كجم', ?, 'إعادة إمداد تلقائية')
    `);

    for (const it of items) {
      const prodName = it.product_name || "صنف ذكي";
      insertItem.run(prId, it.product_id ? Number(it.product_id) : null, prodName, Number(it.suggested_qty) || 10);
    }

    logAudit(user.id, user.name, "طلب شراء آلي", `توليد طلب شراء تلقائي رقم ${prNumber}`);
    res.status(201).json({ id: prId, pr_number: prNumber, count: items.length });
  } catch (err: any) {
    console.error("Error auto creating PR:", err);
    res.status(500).json({ error: "فشل في توليد طلب الشراء الآلي: " + err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 4. QUOTATIONS & RFQ COMPARISON (عروض الأسعار ومقارنة العروض)
// ─────────────────────────────────────────────────────────────
router.get("/purchases/rfqs", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const rfqs = db.prepare(`
      SELECT r.*, s.phone as supplier_phone, s.rating as supplier_rating
      FROM purchase_rfqs r
      LEFT JOIN suppliers s ON s.id = r.supplier_id
      ORDER BY r.created_at DESC
    `).all();

    res.json(rfqs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/purchases/rfqs", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { pr_id, item_name, quantity, unit, supplier_id, supplier_name, unit_price, lead_time_days, payment_terms, quality_rating, min_order_qty, notes } = req.body;

  if (!item_name || !supplier_name || !unit_price) {
    res.status(400).json({ error: "اسم الصنف، المورد، وسعر الوحدة معلومات إجبارية" });
    return;
  }

  try {
    const countRow = db.prepare("SELECT COUNT(*) as c FROM purchase_rfqs").get() as { c: number };
    const rfqNum = `RFQ-${String(countRow.c + 1).padStart(5, "0")}`;
    const qty = quantity || 1;
    const price = unit_price || 0;
    const total = qty * price;

    const r = db.prepare(`
      INSERT INTO purchase_rfqs (rfq_number, pr_id, item_name, quantity, unit, supplier_id, supplier_name, unit_price, lead_time_days, total_price, quality_rating, payment_terms, min_order_qty, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(
      rfqNum,
      pr_id || null,
      item_name,
      qty,
      unit || "كجم",
      supplier_id || null,
      supplier_name,
      price,
      lead_time_days || 1,
      total,
      quality_rating || 5.0,
      payment_terms || "نقداً",
      min_order_qty || 1,
      notes || null
    );

    logAudit(user.id, user.name, "عرض سعر", `تسجيل عرض سعر من ${supplier_name} للصنف ${item_name}`);
    res.status(201).json({ id: r.lastInsertRowid, rfq_number: rfqNum, total_price: total });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/purchases/rfqs/:id/accept", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const rfqId = req.params.id;

  try {
    const quote = db.prepare("SELECT * FROM purchase_rfqs WHERE id = ?").get(rfqId) as any;
    if (!quote) {
      res.status(404).json({ error: "عرض السعر غير موجود" });
      return;
    }

    db.prepare("UPDATE purchase_rfqs SET status = 'accepted' WHERE id = ?").run(rfqId);
    if (quote.item_name) {
      db.prepare("UPDATE purchase_rfqs SET status = 'rejected' WHERE item_name = ? AND id != ? AND status = 'pending'").run(quote.item_name, rfqId);
    }

    logAudit(user.id, user.name, "اعتماد عرض سعر", `قبول عرض السعر رقم ${quote.rfq_number} للمورد ${quote.supplier_name}`);
    res.json({ success: true, acceptedQuote: quote });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 5. PURCHASE ORDERS (أوامر الشراء)
// ─────────────────────────────────────────────────────────────
router.get("/purchases/orders", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const orders = db.prepare(`
      SELECT po.*, s.name as supplier_name, s.phone as supplier_phone, b.name as branch_name, w.name as warehouse_name
      FROM purchase_orders po
      LEFT JOIN suppliers s ON s.id = po.supplier_id
      LEFT JOIN branches b ON b.id = po.branch_id
      LEFT JOIN warehouses w ON w.id = po.warehouse_id
      ORDER BY po.created_at DESC
    `).all();

    const result = orders.map((p: any) => ({
      ...p,
      items: db.prepare("SELECT * FROM purchase_order_items WHERE purchase_order_id = ?").all(p.id)
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/purchases/orders", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { supplier_id, pr_id, branch_id, warehouse_id, order_date, expected_delivery_date, items, discount, tax, shipping_cost, payment_terms, delivery_terms, notes } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "عناصر أمر الشراء مطلوبة" });
    return;
  }

  try {
    const subtotal = items.reduce((sum: number, it: any) => sum + ((Number(it.unit_price) || 0) * (Number(it.quantity) || Number(it.ordered_qty) || 1)), 0);
    const disc = Number(discount) || 0;
    const taxVal = tax !== undefined ? Number(tax) : (subtotal * 0.15);
    const ship = Number(shipping_cost) || 0;
    const total = subtotal - disc + taxVal + ship;

    const countRow = db.prepare("SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM purchase_orders").get() as { next_id: number };
    const randSuffix = Math.floor(100 + Math.random() * 900);
    const poNum = `PO-${String(countRow?.next_id || 1).padStart(5, "0")}-${randSuffix}`;

    // Determine approval tier based on total
    let approvalTier = "branch"; // < 500,000
    if (total >= 2000000) {
      approvalTier = "executive"; // > 2,000,000
    } else if (total >= 500000) {
      approvalTier = "system"; // 500k - 2M
    }

    const initialStatus = approvalTier === "branch" ? "approved" : "pending_approval";
    const actualSupplierId = supplier_id && !isNaN(Number(supplier_id)) ? Number(supplier_id) : null;
    const actualPrId = pr_id && !isNaN(Number(pr_id)) ? Number(pr_id) : null;

    const r = db.prepare(`
      INSERT INTO purchase_orders (po_number, pr_id, supplier_id, branch_id, warehouse_id, order_date, expected_delivery_date, status, subtotal, discount, tax, shipping_cost, total, payment_terms, delivery_terms, approval_tier, approved_by, approved_at, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      poNum,
      actualPrId,
      actualSupplierId,
      branch_id ? Number(branch_id) : 1,
      warehouse_id ? Number(warehouse_id) : 1,
      order_date || getBusinessDate("purchases"),
      expected_delivery_date || null,
      initialStatus,
      subtotal,
      disc,
      taxVal,
      ship,
      total,
      payment_terms || "30 يوم",
      delivery_terms || "تسليم بالمستودع الرئيسي",
      approvalTier,
      initialStatus === "approved" ? user.name : null,
      initialStatus === "approved" ? new Date().toISOString().slice(0, 10) : null,
      notes || null
    );

    const poId = r.lastInsertRowid;

    const insertItem = db.prepare(`
      INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, total)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const it of items) {
      const prodId = it.product_id && !isNaN(Number(it.product_id)) ? Number(it.product_id) : null;
      const prodName = (it.product_name || (prodId ? (db.prepare("SELECT name FROM products WHERE id = ?").get(prodId) as any)?.name : null) || "صنف أمر الشراء").trim();
      const qty = Number(it.quantity) || Number(it.ordered_qty) || 1;
      const price = Number(it.unit_price) || 0;
      insertItem.run(poId, prodId, prodName, qty, price, qty * price);
    }

    if (actualPrId) {
      try {
        db.prepare("UPDATE purchase_requests SET status = 'converted_to_po' WHERE id = ?").run(actualPrId);
      } catch {}
    }

    logAudit(user.id, user.name, "أمر شراء", `إنشاء أمر شراء رقم ${poNum} بمبلغ ${total}`);
    res.status(201).json({ id: poId, po_number: poNum, total, status: initialStatus, approval_tier: approvalTier });
  } catch (err: any) {
    console.error("Error creating PO:", err);
    res.status(500).json({ error: "فشل في إنشاء أمر الشراء: " + err.message });
  }
});

router.post("/purchases/orders/:id/approve", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { status } = req.body; // 'approved' or 'rejected'
  const poId = req.params.id;

  try {
    db.prepare(`
      UPDATE purchase_orders
      SET status = ?, approved_by = ?, approved_at = ?
      WHERE id = ?
    `).run(status, user.name, new Date().toISOString().slice(0, 10), poId);

    logAudit(user.id, user.name, "موافقة أمر شراء", `اعتماد أمر الشراء #${poId} بحالة ${status}`);
    res.json({ success: true, status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 6. GOODS RECEIVING (GRN) & QUALITY INSPECTION (استلام المشتريات وفحص الجودة)
// ─────────────────────────────────────────────────────────────
router.get("/purchases/grn", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const grns = db.prepare(`
      SELECT g.*, po.po_number, s.name as supplier_name, b.name as branch_name, w.name as warehouse_name
      FROM goods_receipt_notes g
      LEFT JOIN purchase_orders po ON po.id = g.po_id
      LEFT JOIN suppliers s ON s.id = g.supplier_id
      LEFT JOIN branches b ON b.id = g.branch_id
      LEFT JOIN warehouses w ON w.id = g.warehouse_id
      ORDER BY g.created_at DESC
    `).all();

    const result = grns.map((g: any) => ({
      ...g,
      items: db.prepare("SELECT * FROM goods_receipt_items WHERE grn_id = ?").all(g.id)
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/purchases/grn", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { po_id, supplier_id, supplier_name, branch_id, warehouse_id, delivery_note_ref, items, notes } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "بيانات الاستلام وفحص الجودة مطلوبة" });
    return;
  }

  try {
    const countRow = db.prepare("SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM goods_receipt_notes").get() as { next_id: number };
    const randSuffix = Math.floor(100 + Math.random() * 900);
    const grnNum = `GRN-${String(countRow?.next_id || 1).padStart(5, "0")}-${randSuffix}`;

    const actualPoId = (po_id && po_id !== "direct" && !isNaN(Number(po_id))) ? Number(po_id) : null;
    const actualSupplierId = (supplier_id && !isNaN(Number(supplier_id))) ? Number(supplier_id) : null;
    
    let supName = (supplier_name || "").trim();
    if (!supName && actualSupplierId) {
      supName = (db.prepare("SELECT name FROM suppliers WHERE id = ?").get(actualSupplierId) as any)?.name || "";
    }
    if (!supName && actualPoId) {
      const poObj = db.prepare("SELECT s.name as s_name FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = ?").get(actualPoId) as any;
      supName = poObj?.s_name || "";
    }
    if (!supName) {
      supName = "مورد عام";
    }

    const allPassed = items.every((it: any) => (Number(it.rejected_qty) || 0) === 0);

    const r = db.prepare(`
      INSERT INTO goods_receipt_notes (grn_number, po_id, supplier_id, supplier_name, branch_id, warehouse_id, received_date, delivery_note_ref, received_by, qc_passed, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      grnNum,
      actualPoId,
      actualSupplierId,
      supName,
      branch_id ? Number(branch_id) : 1,
      warehouse_id ? Number(warehouse_id) : 1,
      new Date().toISOString().slice(0, 10),
      delivery_note_ref || null,
      user.name || "أمين المستودع",
      allPassed ? 1 : 0,
      notes || null
    );

    const grnId = r.lastInsertRowid;

    const insertItem = db.prepare(`
      INSERT INTO goods_receipt_items (grn_id, product_id, product_name, ordered_qty, received_qty, accepted_qty, rejected_qty, rejection_reason, temperature, expiry_date, batch_number, quality_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let isPartial = false;

    for (const it of items) {
      const prodId = it.product_id && !isNaN(Number(it.product_id)) ? Number(it.product_id) : null;
      const prodName = (it.product_name || (prodId ? (db.prepare("SELECT name FROM products WHERE id = ?").get(prodId) as any)?.name : null) || "صنف مستلم").trim();
      const ordered = Number(it.ordered_qty) || Number(it.quantity) || 1;
      const rec = Number(it.received_qty) ?? ordered;
      const rej = Number(it.rejected_qty) || 0;
      const acc = Number(it.accepted_qty) ?? Math.max(0, rec - rej);
      const temp = (it.temperature !== undefined && it.temperature !== "" && !isNaN(Number(it.temperature))) ? Number(it.temperature) : null;

      insertItem.run(
        grnId,
        prodId,
        prodName,
        ordered,
        rec,
        acc,
        rej,
        it.rejection_reason || null,
        temp,
        it.expiry_date || null,
        it.batch_number || null,
        rej > 0 ? "مطابق جزئياً مع وجود مرفوضات" : "مطابق بالمواصفات"
      );

      // Check if partially received compared to PO
      if (rec < ordered) {
        isPartial = true;
      }

      // Automatically update PO item received_qty if actualPoId exists
      if (actualPoId && prodId) {
        try {
          db.prepare(`
            UPDATE purchase_order_items
            SET received_qty = COALESCE(received_qty, 0) + ?
            WHERE purchase_order_id = ? AND product_id = ?
          `).run(acc, actualPoId, prodId);
        } catch {}
      }
    }

    if (actualPoId) {
      try {
        db.prepare("UPDATE purchase_orders SET status = ? WHERE id = ?").run(
          isPartial ? "partially_received" : "received",
          actualPoId
        );
      } catch {}
    }

    logAudit(user.id, user.name, "استلام مشتريات", `إنشاء سند استلام مشتريات رقم ${grnNum}`);
    res.status(201).json({ id: grnId, grn_number: grnNum, is_partial: isPartial });
  } catch (err: any) {
    console.error("Error creating GRN:", err);
    res.status(500).json({ error: "فشل في تسجيل سند الاستلام: " + err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 7. PURCHASE INVOICES (فواتير المشتريات والربط بالمخزون والحسابات)
// ─────────────────────────────────────────────────────────────
router.get("/purchases/invoices", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const invoices = db.prepare(`
      SELECT pi.*, s.name as supplier_name, s.phone as supplier_phone, po.po_number
      FROM purchase_invoices pi
      LEFT JOIN suppliers s ON s.id = pi.supplier_id
      LEFT JOIN purchase_orders po ON po.id = pi.po_id
      ORDER BY pi.created_at DESC
    `).all();

    const result = invoices.map((inv: any) => ({
      ...inv,
      items: db.prepare("SELECT * FROM purchase_invoice_items WHERE invoice_id = ?").all(inv.id)
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/purchases/invoices", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { supplier_id, supplier_name, po_id, grn_id, supplier_invoice_ref, invoice_date, due_date, branch_id, warehouse_id, items, discount, tax, shipping_cost, additional_expenses, paid_amount, payment_method, is_direct_purchase, notes } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "عناصر فاتورة المشتريات مطلوبة" });
    return;
  }

  try {
    const subtotal = items.reduce((sum: number, it: any) => sum + ((Number(it.unit_price) || 0) * (Number(it.quantity) || 1)), 0);
    const disc = Number(discount) || 0;
    const taxVal = tax !== undefined ? Number(tax) : (subtotal * 0.15);
    const ship = Number(shipping_cost) || 0;
    const extra = Number(additional_expenses) || 0;
    const total = subtotal - disc + taxVal + ship + extra;

    const paid = Number(paid_amount) || 0;
    const remaining = Math.max(0, total - paid);
    let paymentStatus = "unpaid";
    if (paid >= total) {
      paymentStatus = "paid";
    } else if (paid > 0) {
      paymentStatus = "partially_paid";
    }

    const countRow = db.prepare("SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM purchase_invoices").get() as { next_id: number };
    const randSuffix = Math.floor(100 + Math.random() * 900);
    const invNum = `PINV-${String(countRow?.next_id || 1).padStart(5, "0")}-${randSuffix}`;

    const actualSupplierId = supplier_id && !isNaN(Number(supplier_id)) ? Number(supplier_id) : null;
    const actualPoId = po_id && po_id !== "direct" && !isNaN(Number(po_id)) ? Number(po_id) : null;
    const actualGrnId = grn_id && !isNaN(Number(grn_id)) ? Number(grn_id) : null;

    let supName = (supplier_name || "").trim();
    if (!supName && actualSupplierId) {
      supName = (db.prepare("SELECT name FROM suppliers WHERE id = ?").get(actualSupplierId) as any)?.name || "";
    }
    if (!supName) {
      supName = "مورد نقدي عام";
    }

    const r = db.prepare(`
      INSERT INTO purchase_invoices (invoice_number, supplier_invoice_ref, po_id, grn_id, supplier_id, supplier_name, branch_id, warehouse_id, invoice_date, due_date, subtotal, discount, tax, shipping_cost, additional_expenses, total, paid_amount, remaining_amount, payment_status, payment_method, is_direct_purchase, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      invNum,
      supplier_invoice_ref || null,
      actualPoId,
      actualGrnId,
      actualSupplierId,
      supName,
      branch_id ? Number(branch_id) : 1,
      warehouse_id ? Number(warehouse_id) : 1,
      invoice_date || getBusinessDate("purchases"),
      due_date || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      subtotal,
      disc,
      taxVal,
      ship,
      extra,
      total,
      paid,
      remaining,
      paymentStatus,
      payment_method || "credit",
      is_direct_purchase ? 1 : 0,
      notes || null
    );

    const invId = r.lastInsertRowid;

    const insertItem = db.prepare(`
      INSERT INTO purchase_invoice_items (invoice_id, product_id, product_name, unit, quantity, unit_price, discount, tax, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Update Stock & Item cost automatically
    for (const it of items) {
      const prodId = it.product_id && !isNaN(Number(it.product_id)) ? Number(it.product_id) : null;
      const prodName = (it.product_name || (prodId ? (db.prepare("SELECT name FROM products WHERE id = ?").get(prodId) as any)?.name : null) || "صنف الفاتورة").trim();
      const qty = Number(it.quantity) || 1;
      const price = Number(it.unit_price) || 0;
      const itemDisc = Number(it.discount) || 0;
      const itemTax = it.tax !== undefined ? Number(it.tax) : 0;
      const itemTotal = (qty * price) - itemDisc + itemTax;

      insertItem.run(
        invId,
        prodId,
        prodName,
        it.unit || "كجم",
        qty,
        price,
        itemDisc,
        itemTax,
        itemTotal
      );

      if (prodId) {
        try {
          // Fetch current stock
          const prod = db.prepare("SELECT stock FROM products WHERE id = ?").get(prodId) as any;
          const prevStock = prod?.stock || 0;
          const newStock = prevStock + qty;

          db.prepare("UPDATE products SET stock = ?, cost = ? WHERE id = ?").run(newStock, price, prodId);

          // Record stock movement
          db.prepare(`
            INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason, reference_id, user_id, user_name)
            VALUES (?, 'in', ?, ?, ?, ?, ?, ?, ?)
          `).run(prodId, qty, prevStock, newStock, `فاتورة شراء #${invNum}`, invId, user.id, user.name);
        } catch {}
      }
    }

    // Update supplier balance
    if (actualSupplierId && remaining > 0) {
      try {
        db.prepare("UPDATE suppliers SET balance = COALESCE(balance, 0) + ? WHERE id = ?").run(remaining, actualSupplierId);
      } catch {}
    }

    // Ensure supplier sub-account exists in Chart of Accounts
    const supplierAccCode = actualSupplierId ? getSupplierSubAccountCode(actualSupplierId, supName) : "21100";
    const payAccCode = getPaymentAccountCode(payment_method, req.body.payment_account_code);
    const invDateStr = invoice_date || new Date().toISOString().slice(0, 10);
    const netInventoryAmount = Math.max(0, total - taxVal);

    // Create double-entry accounting journal for the Purchase Invoice
    try {
      const journalLines: { account_code: string; debit: number; credit: number; description?: string }[] = [];
      if (netInventoryAmount > 0) {
        journalLines.push({
          account_code: "11300",
          debit: netInventoryAmount,
          credit: 0,
          description: `توريد بضاعة للمخزن (المخزون السلعي) - فاتورة مشتريات ${invNum}`
        });
      }
      if (taxVal > 0) {
        journalLines.push({
          account_code: "11500",
          debit: taxVal,
          credit: 0,
          description: `ضريبة القيمة المضافة للمشتريات (مدخلات) - فاتورة ${invNum}`
        });
      }

      if (actualSupplierId) {
        // Credit Supplier Sub-Account for full invoice amount
        journalLines.push({
          account_code: supplierAccCode,
          debit: 0,
          credit: total,
          description: `استحقاق فاتورة مشتريات رقم ${invNum} للمورد ${supName}`
        });
      } else {
        // Direct cash/bank purchase without supplier record
        journalLines.push({
          account_code: remaining > 0 ? "21100" : payAccCode,
          debit: 0,
          credit: total,
          description: `سداد فاتورة مشتريات مباشرة رقم ${invNum} - ${supName}`
        });
      }

      if (journalLines.length >= 2) {
        createDoubleEntryJournal(
          invDateStr,
          `فاتورة مشتريات رقم ${invNum} - المورد: ${supName}`,
          "purchase",
          invId as number,
          journalLines,
          { reference_no: invNum, doc_type: "فاتورة مشتريات", entry_class: "مشتريات" }
        );
      }

      // If immediate full or partial payment was made on a supplier invoice, record the payment voucher and its journal entry
      if (actualSupplierId && paid > 0) {
        const payMaxRow = db.prepare("SELECT COALESCE(MAX(id), 0) as m FROM supplier_payments").get() as { m: number };
        let paySeq = (payMaxRow?.m || 0) + 1;
        let autoPayNum = `SPAY-${String(paySeq).padStart(5, "0")}`;
        while (db.prepare("SELECT 1 FROM supplier_payments WHERE payment_number = ?").get(autoPayNum)) {
          paySeq++;
          autoPayNum = `SPAY-${String(paySeq).padStart(5, "0")}`;
        }
        const payRes = db.prepare(`
          INSERT INTO supplier_payments (payment_number, supplier_id, supplier_name, invoice_id, payment_date, amount, payment_method, reference_number, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          autoPayNum,
          actualSupplierId,
          supName,
          invId,
          invDateStr,
          paid,
          payment_method === "credit" ? "cash" : (payment_method || "cash"),
          invNum,
          `دفعة مسددة مع فاتورة المشتريات رقم ${invNum}`
        );

        createDoubleEntryJournal(
          invDateStr,
          `سند صرف سداد دفعة فاتورة مشتريات ${invNum} للمورد ${supName} (#${autoPayNum})`,
          "voucher",
          payRes.lastInsertRowid as number,
          [
            {
              account_code: supplierAccCode,
              debit: paid,
              credit: 0,
              description: `سداد دفعة من فاتورة المشتريات ${invNum} للمورد ${supName}`
            },
            {
              account_code: payAccCode,
              debit: 0,
              credit: paid,
              description: `صرف مقابل فاتورة المشتريات ${invNum} (${payAccCode === "11200" ? "البنك" : "الصندوق الرئيسي"})`
            }
          ],
          { reference_no: autoPayNum, doc_type: "سند صرف مورد", entry_class: "مشتريات" }
        );

        recordSafeOrBankMovement(db as any, {
          method: payAccCode === "11200" ? "bank" : "cash",
          amount: paid,
          direction: "out",
          statement: `سداد دفعة فاتورة مشتريات رقم ${invNum} للمورد ${supName}`,
          reference_number: autoPayNum,
          user_id: user.id,
          user_name: user.name
        });
      } else if (!actualSupplierId && paid > 0) {
        recordSafeOrBankMovement(db as any, {
          method: payAccCode === "11200" ? "bank" : "cash",
          amount: paid,
          direction: "out",
          statement: `سداد فاتورة مشتريات مباشرة رقم ${invNum} - ${supName}`,
          reference_number: invNum,
          user_id: user.id,
          user_name: user.name
        });
      }
    } catch (journalErr: any) {
      console.error("Accounting journal failed:", journalErr.message);
    }

    try { runErpAccountingSync(db); } catch {}
    logAudit(user.id, user.name, "فاتورة مشتريات", `تسجيل فاتورة مشتريات رقم ${invNum} بمبلغ ${total}`);
    res.status(201).json({ id: invId, invoice_number: invNum, total, remaining, account_code: supplierAccCode });
  } catch (err: any) {
    console.error("Error creating purchase invoice:", err);
    res.status(500).json({ error: "فشل في تسجيل فاتورة المشتريات: " + err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 8. SUPPLIER PAYMENTS & LEDGER (دفعات الموردين وكشف الحساب)
// ─────────────────────────────────────────────────────────────
router.get("/purchases/payments", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const payments = db.prepare(`
      SELECT p.*, s.name as supplier_name, pi.invoice_number
      FROM supplier_payments p
      JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN purchase_invoices pi ON pi.id = p.invoice_id
      ORDER BY p.created_at DESC
    `).all();

    res.json(payments);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/purchases/payments", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { supplier_id, invoice_id, payment_date, amount, payment_method, check_number, bank_name, reference_number, notes } = req.body;

  if (!supplier_id || !amount || amount <= 0) {
    res.status(400).json({ error: "المورد والمبلغ المدفوع إجباريان" });
    return;
  }

  try {
    const supplier = db.prepare("SELECT * FROM suppliers WHERE id = ?").get(supplier_id) as any;
    if (!supplier) {
      res.status(404).json({ error: "المورد غير موجود" });
      return;
    }

    const payMaxRow = db.prepare("SELECT COALESCE(MAX(id), 0) as m FROM supplier_payments").get() as { m: number };
    let paySeq = (payMaxRow?.m || 0) + 1;
    let payNum = `SPAY-${String(paySeq).padStart(5, "0")}`;
    while (db.prepare("SELECT 1 FROM supplier_payments WHERE payment_number = ?").get(payNum)) {
      paySeq++;
      payNum = `SPAY-${String(paySeq).padStart(5, "0")}`;
    }

    const r = db.prepare(`
      INSERT INTO supplier_payments (payment_number, supplier_id, supplier_name, invoice_id, payment_date, amount, payment_method, check_number, bank_name, reference_number, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payNum,
      supplier_id,
      supplier.name,
      invoice_id || null,
      payment_date || getBusinessDate("purchases"),
      amount,
      payment_method || "cash",
      check_number || null,
      bank_name || null,
      reference_number || null,
      notes || null
    );

    // Deduct from supplier balance
    db.prepare("UPDATE suppliers SET balance = MAX(0, COALESCE(balance, 0) - ?) WHERE id = ?").run(amount, supplier_id);

    // If linked to specific invoice, update invoice paid/remaining
    if (invoice_id) {
      const inv = db.prepare("SELECT * FROM purchase_invoices WHERE id = ?").get(invoice_id) as any;
      if (inv) {
        const newPaid = inv.paid_amount + amount;
        const newRem = Math.max(0, inv.total - newPaid);
        const newStatus = newRem === 0 ? "paid" : "partially_paid";
        db.prepare("UPDATE purchase_invoices SET paid_amount = ?, remaining_amount = ?, payment_status = ? WHERE id = ?").run(newPaid, newRem, newStatus, invoice_id);
      }
    }

    // Double-entry accounting
    const supplierAccCode = getSupplierSubAccountCode(Number(supplier_id), supplier.name);
    const cashOrBank = getPaymentAccountCode(payment_method, req.body.payment_account_code);
    try {
      createDoubleEntryJournal(
        payment_date || new Date().toISOString().slice(0, 10),
        `سند صرف سداد دفعة للمورد ${supplier.name} سند #${payNum}`,
        "voucher",
        r.lastInsertRowid as number,
        [
          { account_code: supplierAccCode, debit: Number(amount), credit: 0, description: `تخفيض حساب المورد ${supplier.name} (${supplierAccCode})` },
          { account_code: cashOrBank, debit: 0, credit: Number(amount), description: `سداد مستحقات مورد (${cashOrBank === "11200" ? "البنوك والحسابات الجارية" : "الصندوق الرئيسي والخزينة"})` }
        ],
        { reference_no: payNum, doc_type: "سند صرف مورد", entry_class: "مشتريات" }
      );
      recordSafeOrBankMovement(db as any, {
        method: cashOrBank === "11200" ? "bank" : "cash",
        amount: Number(amount),
        direction: "out",
        statement: `سند صرف سداد دفعة للمورد ${supplier.name} (#${payNum})`,
        reference_number: payNum,
        user_id: user.id,
        user_name: user.name
      });
    } catch {}

    try { runErpAccountingSync(db); } catch {}
    logAudit(user.id, user.name, "دفعة مورد", `سداد دفعة للمورد ${supplier.name} بمبلغ ${amount}`);
    res.status(201).json({ id: r.lastInsertRowid, payment_number: payNum, account_code: supplierAccCode });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 9. PURCHASE RETURNS (مرتجعات المشتريات)
// ─────────────────────────────────────────────────────────────
router.get("/purchases/returns", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const returns = db.prepare(`
      SELECT pr.*, s.name as supplier_name, pi.invoice_number
      FROM purchase_returns pr
      LEFT JOIN suppliers s ON s.id = pr.supplier_id
      LEFT JOIN purchase_invoices pi ON pi.id = pr.invoice_id
      ORDER BY pr.created_at DESC
    `).all();

    const result = returns.map((ret: any) => ({
      ...ret,
      items: db.prepare("SELECT * FROM purchase_return_items WHERE return_id = ?").all(ret.id)
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/purchases/returns", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { supplier_id, invoice_id, return_date, reason, items, notes } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "عناصر المرتجع مطلوبة" });
    return;
  }

  try {
    const totalAmount = items.reduce((sum: number, it: any) => sum + ((it.unit_price || 0) * (it.quantity || 1)), 0);

    const countRow = db.prepare("SELECT COUNT(*) as c FROM purchase_returns").get() as { c: number };
    const retNum = `PRET-${String(countRow.c + 1).padStart(5, "0")}`;

    const supplier = supplier_id ? db.prepare("SELECT name FROM suppliers WHERE id = ?").get(supplier_id) as any : null;
    const supName = supplier?.name || "مورد عام";

    const r = db.prepare(`
      INSERT INTO purchase_returns (return_number, supplier_id, supplier_name, invoice_id, return_date, total_amount, status, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, ?)
    `).run(
      retNum,
      supplier_id || null,
      supName,
      invoice_id || null,
      return_date || getBusinessDate("purchases"),
      totalAmount,
      notes || reason || "مرتجع مشتريات للمورد",
      user.name
    );

    const retId = r.lastInsertRowid;
    const insertItem = db.prepare(`
      INSERT INTO purchase_return_items (return_id, product_id, product_name, quantity, unit_price, total_price)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const it of items) {
      const qty = it.quantity || 1;
      const price = it.unit_price || 0;
      insertItem.run(retId, it.product_id || null, it.product_name, qty, price, qty * price);

      // Reduce product stock automatically
      if (it.product_id) {
        const prod = db.prepare("SELECT stock FROM products WHERE id = ?").get(it.product_id) as any;
        const prevStock = prod?.stock || 0;
        const newStock = Math.max(0, prevStock - qty);
        db.prepare("UPDATE products SET stock = ? WHERE id = ?").run(newStock, it.product_id);

        try {
          db.prepare(`
            INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason, reference_id, user_id, user_name)
            VALUES (?, 'out', ?, ?, ?, ?, ?, ?, ?)
          `).run(it.product_id, qty, prevStock, newStock, `مرتجع مشتريات #${retNum}`, retId, user.id, user.name);
        } catch {}
      }
    }

    // Deduct supplier balance
    if (supplier_id) {
      db.prepare("UPDATE suppliers SET balance = MAX(0, COALESCE(balance, 0) - ?) WHERE id = ?").run(totalAmount, supplier_id);
    }

    // Double-entry accounting for returns (Debits Supplier Sub-Account 211XX, Credits Inventory 11300)
    const supplierAccCode = supplier_id ? getSupplierSubAccountCode(Number(supplier_id), supName) : "11100";
    try {
      createDoubleEntryJournal(
        return_date || new Date().toISOString().slice(0, 10),
        `مرتجع مشتريات رقم ${retNum} - المورد: ${supName}`,
        "voucher",
        retId as number,
        [
          { account_code: supplierAccCode, debit: totalAmount, credit: 0, description: `إشعار خصم مرتجع مشتريات وتخفيض مديونية المورد ${supName}` },
          { account_code: "11300", debit: 0, credit: totalAmount, description: `إخراج بضاعة مرتجعة من المخزون السلعي (#${retNum})` }
        ],
        { reference_no: retNum, doc_type: "مرتجع مشتريات", entry_class: "مشتريات" }
      );
    } catch (journalErr: any) {
      console.error("Accounting journal failed for purchase returns:", journalErr.message);
    }

    try { runErpAccountingSync(db); } catch {}
    logAudit(user.id, user.name, "مرتجع مشتريات", `إنشاء مرتجع مشتريات رقم ${retNum} بمبلغ ${totalAmount}`);
    res.status(201).json({ id: retId, return_number: retNum, total_amount: totalAmount, account_code: supplierAccCode });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 10. SUPPLIER CONTRACTS (عقود واتفاقيات الموردين)
// ─────────────────────────────────────────────────────────────
router.get("/purchases/contracts", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const contracts = db.prepare(`
      SELECT c.*, s.phone as supplier_phone
      FROM supplier_contracts c
      JOIN suppliers s ON s.id = c.supplier_id
      ORDER BY c.end_date ASC
    `).all();

    res.json(contracts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/purchases/contracts", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { supplier_id, title, start_date, end_date, agreed_amount, payment_terms, notes } = req.body;

  if (!supplier_id || !title || !start_date || !end_date) {
    res.status(400).json({ error: "المورد، عنوان العقد، وتاريخ البداية والنهاية معلومات مطلوبة" });
    return;
  }

  try {
    const supplier = db.prepare("SELECT name FROM suppliers WHERE id = ?").get(supplier_id) as any;
    const countRow = db.prepare("SELECT COUNT(*) as c FROM supplier_contracts").get() as { c: number };
    const cntNum = `CNT-${String(countRow.c + 1).padStart(5, "0")}`;

    const r = db.prepare(`
      INSERT INTO supplier_contracts (contract_number, supplier_id, supplier_name, title, start_date, end_date, agreed_amount, payment_terms, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `).run(
      cntNum,
      supplier_id,
      supplier?.name || "مورد",
      title,
      start_date,
      end_date,
      agreed_amount || 0,
      payment_terms || "30 يوم",
      notes || null
    );

    logAudit(user.id, user.name, "عقد مورد", `إنشاء عقد توريد جديد رقم ${cntNum}`);
    res.status(201).json({ id: r.lastInsertRowid, contract_number: cntNum });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 11. PRICE TRENDS & SUPPLIER EVALUATIONS (مقارنة أسعار الشراء وتحليل الموردين)
// ─────────────────────────────────────────────────────────────
router.get("/purchases/analytics/price-trends", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const trends = db.prepare(`
      SELECT p.id as product_id, p.name as product_name, p.cost as current_price,
        (
          SELECT pii.unit_price
          FROM purchase_invoice_items pii
          JOIN purchase_invoices pi ON pi.id = pii.invoice_id
          WHERE pii.product_id = p.id
          ORDER BY pi.invoice_date DESC
          LIMIT 1 OFFSET 1
        ) as previous_price,
        (
          SELECT pi.supplier_name
          FROM purchase_invoice_items pii
          JOIN purchase_invoices pi ON pi.id = pii.invoice_id
          WHERE pii.product_id = p.id
          ORDER BY pi.invoice_date DESC
          LIMIT 1
        ) as latest_supplier
      FROM products p
      WHERE p.active = 1
      ORDER BY p.name ASC
    `).all().map((t: any) => {
      const curr = t.current_price || 0;
      const prev = t.previous_price || curr;
      const diff = curr - prev;
      const pct = prev > 0 ? ((diff / prev) * 100) : 0;
      return {
        ...t,
        previous_price: prev,
        price_diff: diff,
        percentage_change: Number(pct.toFixed(1)),
        is_surge: pct > 5
      };
    });

    res.json(trends);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 12. PROCUREMENT REPORTS (تقارير المشتريات والموردين)
// ─────────────────────────────────────────────────────────────
router.get("/purchases/reports", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { type, from_date, to_date, supplier_id, branch_id } = req.query as any;

  try {
    if (type === "daily") {
      const today = new Date().toISOString().slice(0, 10);
      const data = db.prepare(`
        SELECT pi.*, s.name as supplier_name, b.name as branch_name
        FROM purchase_invoices pi
        LEFT JOIN suppliers s ON s.id = pi.supplier_id
        LEFT JOIN branches b ON b.id = pi.branch_id
        WHERE pi.invoice_date LIKE ? OR pi.invoice_date = ?
        ORDER BY pi.id DESC
      `).all(`${today}%`, today);
      return res.json(data);
    }

    if (type === "by_period") {
      const start = from_date || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const end = to_date || new Date().toISOString().slice(0, 10);
      const data = db.prepare(`
        SELECT pi.*, s.name as supplier_name, b.name as branch_name
        FROM purchase_invoices pi
        LEFT JOIN suppliers s ON s.id = pi.supplier_id
        LEFT JOIN branches b ON b.id = pi.branch_id
        WHERE pi.invoice_date BETWEEN ? AND ?
        ORDER BY pi.invoice_date DESC
      `).all(start, end);
      return res.json(data);
    }

    if (type === "by_supplier") {
      const data = db.prepare(`
        SELECT s.id, s.name, s.phone, s.balance,
               COUNT(pi.id) as invoice_count,
               COALESCE(SUM(pi.total), 0) as total_purchases,
               COALESCE(SUM(pi.paid_amount), 0) as total_paid,
               COALESCE(SUM(pi.remaining_amount), 0) as total_remaining
         FROM suppliers s
         LEFT JOIN purchase_invoices pi ON pi.supplier_id = s.id
         GROUP BY s.id
         ORDER BY total_purchases DESC
      `).all();
      return res.json(data);
    }

    if (type === "by_item") {
      const data = db.prepare(`
        SELECT p.id, p.name as item_name,
               COALESCE(SUM(pii.quantity), 0) as total_qty,
               AVG(pii.unit_price) as avg_price,
               MIN(pii.unit_price) as min_price,
               MAX(pii.unit_price) as max_price,
               COALESCE(SUM(pii.total), 0) as total_cost
        FROM products p
        JOIN purchase_invoice_items pii ON pii.product_id = p.id
        GROUP BY p.id
        ORDER BY total_cost DESC
      `).all();
      return res.json(data);
    }

    if (type === "by_branch") {
      const data = db.prepare(`
        SELECT b.id, b.name as branch_name,
               COUNT(pi.id) as invoice_count,
               COALESCE(SUM(pi.total), 0) as total_purchases,
               COALESCE(SUM(pi.paid_amount), 0) as total_paid,
               COALESCE(SUM(pi.remaining_amount), 0) as total_remaining
        FROM branches b
        LEFT JOIN purchase_invoices pi ON pi.branch_id = b.id
        GROUP BY b.id
        ORDER BY total_purchases DESC
      `).all();
      return res.json(data);
    }

    if (type === "credit") {
      const data = db.prepare(`
        SELECT pi.*, s.name as supplier_name, b.name as branch_name
        FROM purchase_invoices pi
        LEFT JOIN suppliers s ON s.id = pi.supplier_id
        LEFT JOIN branches b ON b.id = pi.branch_id
        WHERE pi.payment_status IN ('unpaid', 'partially_paid') OR pi.remaining_amount > 0
        ORDER BY pi.invoice_date DESC
      `).all();
      return res.json(data);
    }

    if (type === "payables") {
      const data = db.prepare(`
        SELECT s.id, s.name as supplier_name, s.phone, s.balance as total_due,
               COUNT(pi.id) as unpaid_invoices_count
        FROM suppliers s
        LEFT JOIN purchase_invoices pi ON pi.supplier_id = s.id AND pi.payment_status != 'paid'
        GROUP BY s.id
        HAVING s.balance > 0 OR total_due > 0
        ORDER BY total_due DESC
      `).all();
      return res.json(data);
    }

    if (type === "supplier_statement") {
      const supId = parseInt(supplier_id) || 1;
      const invoices = db.prepare(`
        SELECT 'فاتورة شراء' as type_name, invoice_number as ref_no, invoice_date as date, total as debit, 0.0 as credit, notes
        FROM purchase_invoices
        WHERE supplier_id = ?
      `).all(supId);

      const payments = db.prepare(`
        SELECT 'سند صرف دفعة' as type_name, payment_number as ref_no, payment_date as date, 0.0 as debit, amount as credit, notes
        FROM supplier_payments
        WHERE supplier_id = ?
      `).all(supId);

      const returns = db.prepare(`
        SELECT 'مرتجع مشتريات' as type_name, return_number as ref_no, return_date as date, 0.0 as debit, total_amount as credit, notes
        FROM purchase_returns
        WHERE supplier_id = ?
      `).all(supId);

      const merged = [...invoices, ...payments, ...returns].sort((a, b) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

      return res.json(merged);
    }

    if (type === "price_analysis") {
      const data = db.prepare(`
        SELECT p.id, p.name as item_name, p.cost as current_cost,
               COALESCE(AVG(pii.unit_price), p.cost) as average_purchase_price,
               COALESCE(MIN(pii.unit_price), p.cost) as minimum_purchase_price,
               COALESCE(MAX(pii.unit_price), p.cost) as maximum_purchase_price,
               COUNT(pii.id) as purchases_count
        FROM products p
        LEFT JOIN purchase_invoice_items pii ON pii.product_id = p.id
        GROUP BY p.id
        ORDER BY current_cost DESC
      `).all();
      return res.json(data);
    }

    if (type === "most_purchased") {
      const data = db.prepare(`
        SELECT p.id, p.name as item_name,
               COALESCE(SUM(pii.quantity), 0) as total_qty,
               COALESCE(SUM(pii.total), 0) as total_cost
        FROM products p
        JOIN purchase_invoice_items pii ON pii.product_id = p.id
        GROUP BY p.id
        ORDER BY total_qty DESC
        LIMIT 15
      `).all();
      return res.json(data);
    }

    if (type === "debt_aging") {
      const data = db.prepare(`
        SELECT s.id, s.name as supplier_name, s.balance as total_balance,
               COALESCE(SUM(CASE WHEN JULIANDAY('now') - JULIANDAY(pi.invoice_date) <= 30 THEN pi.remaining_amount ELSE 0 END), 0) as age_0_30,
               COALESCE(SUM(CASE WHEN JULIANDAY('now') - JULIANDAY(pi.invoice_date) BETWEEN 31 AND 60 THEN pi.remaining_amount ELSE 0 END), 0) as age_31_60,
               COALESCE(SUM(CASE WHEN JULIANDAY('now') - JULIANDAY(pi.invoice_date) BETWEEN 61 AND 90 THEN pi.remaining_amount ELSE 0 END), 0) as age_61_90,
               COALESCE(SUM(CASE WHEN JULIANDAY('now') - JULIANDAY(pi.invoice_date) > 90 THEN pi.remaining_amount ELSE 0 END), 0) as age_above_90
        FROM suppliers s
        LEFT JOIN purchase_invoices pi ON pi.supplier_id = s.id AND pi.payment_status != 'paid'
        GROUP BY s.id
      `).all();
      return res.json(data);
    }

    // Default: General purchases report
    const general = db.prepare(`
      SELECT pi.*, s.name as supplier_name
      FROM purchase_invoices pi
      LEFT JOIN suppliers s ON s.id = pi.supplier_id
      ORDER BY pi.invoice_date DESC
    `).all();

    res.json(general);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Backward compatible basic purchases route
router.get("/purchases", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const purchases = db.prepare(`
    SELECT po.*, s.name as supplier_name
    FROM purchase_orders po
    LEFT JOIN suppliers s ON s.id = po.supplier_id
    ORDER BY po.created_at DESC
  `).all();
  const result = purchases.map((p: any) => ({
    ...p,
    items: db.prepare("SELECT * FROM purchase_order_items WHERE purchase_order_id=?").all(p.id)
  }));
  res.json(result);
});

export default router;

