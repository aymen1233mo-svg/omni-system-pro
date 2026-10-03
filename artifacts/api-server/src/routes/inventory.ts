import { Router } from "express";
import { db, logAudit, createDoubleEntryJournal } from "../lib/sqlite";
import { getAuthUser } from "./auth";

const router = Router();

// 1. Get complete inventory summary, active requests, returns, and valuation
router.get(["/inventory/summary", "/inventory/products"], (_req, res) => {
  try {
    const products = db.prepare(`
      SELECT p.id, p.number, p.name, p.price, p.cost, p.stock, p.batch_number, p.expiry_date, p.min_stock, c.name as categoryName
      FROM products p LEFT JOIN categories c ON c.id = p.category_id
      ORDER BY p.number
    `).all() as any[];

    let totalStockCount = 0;
    let totalStockCost = 0;
    let totalStockValue = 0;
    const lowStockItems: any[] = [];
    const outOfStockItems: any[] = [];
    const expiredItems: any[] = [];

    const now = new Date().toISOString().slice(0, 10);

    for (const p of products) {
      const stock = p.stock ?? 0;
      const cost = p.cost ?? 0;
      const price = p.price ?? 0;
      const minStock = p.min_stock ?? 10;

      totalStockCount += stock;
      totalStockCost += stock * cost;
      totalStockValue += stock * price;

      if (stock <= 0) {
        outOfStockItems.push(p);
      } else if (stock <= minStock) {
        lowStockItems.push(p);
      }

      if (p.expiry_date && p.expiry_date <= now) {
        expiredItems.push(p);
      }
    }

    const warehouses = db.prepare(`SELECT * FROM warehouses ORDER BY id`).all();
    const issueVouchers = db.prepare(`SELECT * FROM stock_issue_vouchers ORDER BY created_at DESC LIMIT 30`).all();
    const receiptVouchers = db.prepare(`SELECT * FROM stock_receipt_vouchers ORDER BY created_at DESC LIMIT 30`).all();
    const returnVouchers = db.prepare(`SELECT * FROM stock_return_vouchers ORDER BY created_at DESC LIMIT 30`).all();
    const purchaseReturns = db.prepare(`SELECT * FROM purchase_returns ORDER BY created_at DESC LIMIT 30`).all();
    const transfers = db.prepare(`SELECT * FROM stock_transfers ORDER BY created_at DESC LIMIT 30`).all();
    const wasteRecords = db.prepare(`SELECT * FROM stock_waste_records ORDER BY created_at DESC LIMIT 30`).all();
    const internalRequests = db.prepare(`SELECT * FROM internal_stock_requests ORDER BY created_at DESC LIMIT 30`).all();
    const stocktakes = db.prepare(`SELECT * FROM stocktakes ORDER BY created_at DESC LIMIT 30`).all();
    const suppliers = db.prepare(`SELECT id, name, balance FROM suppliers ORDER BY name`).all();
    const auditLogs = db.prepare(`SELECT * FROM audit_logs WHERE action LIKE '%مخزن%' OR action LIKE '%إلغاء%' OR action LIKE '%مرتجع%' OR action LIKE '%توريد%' ORDER BY id DESC LIMIT 50`).all();

    res.json({
      totalItems: products.length,
      totalStockCount,
      totalStockCost,
      totalStockValue,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      expiredCount: expiredItems.length,
      lowStockItems,
      expiredItems,
      products,
      warehouses,
      issueVouchers,
      receiptVouchers,
      returnVouchers,
      purchaseReturns,
      transfers,
      wasteRecords,
      internalRequests,
      stocktakes,
      suppliers,
      auditLogs
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "فشل تحميل ملخص المخزون" });
  }
});

// 2. Stock movements log
router.get("/inventory/movements", (req, res) => {
  try {
    const { productId } = req.query;
    let sql = `
      SELECT m.*, p.name as productName, p.number as productNumber
      FROM stock_movements m
      LEFT JOIN products p ON p.id = m.product_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (productId) {
      sql += " AND m.product_id = ?";
      params.push(productId);
    }
    sql += " ORDER BY m.id DESC LIMIT 200";
    const movements = db.prepare(sql).all(...params);
    res.json(movements);
  } catch (e: any) {
    res.status(500).json({ error: "فشل استرجاع دفتر حركات المخزون" });
  }
});

// 3. Manual Stock Movement / Adjustment
router.post("/inventory/movement", (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "غير مصرح" });
    return;
  }

  const { productId, type, quantity, reason, referenceId } = req.body;
  if (!productId || !type || quantity === undefined) {
    res.status(400).json({ error: "بيانات ناقصة" });
    return;
  }

  const product = db.prepare("SELECT * FROM products WHERE id=?").get(productId) as any;
  if (!product) {
    res.status(404).json({ error: "المنتج غير موجود" });
    return;
  }

  const prevStock = product.stock ?? 0;
  let newStock = prevStock;
  const qty = Number(quantity);

  if (type === "in") {
    newStock = prevStock + qty;
  } else if (type === "out") {
    newStock = Math.max(0, prevStock - qty);
  } else if (type === "adjustment") {
    newStock = qty;
  }

  const diff = newStock - prevStock;

  db.transaction(() => {
    db.prepare("UPDATE products SET stock = ? WHERE id = ?").run(newStock, productId);
    db.prepare(`
      INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason, reference_id, user_id, user_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(productId, type, Math.abs(diff), prevStock, newStock, reason || "تسوية مخزنية يدويّة", referenceId || null, user.id, user.name);

    logAudit(user.id, user.name, "تعديل مخزني يدوي", `تعديل صنف ${product.name}: من ${prevStock} إلى ${newStock} (السبب: ${reason})`);
  })();

  res.json({ success: true, previousStock: prevStock, newStock });
});

// 4. Create Stock Issue Voucher (سند صرف مخزني)
router.post("/inventory/issue-voucher", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { warehouseName, issueType, recipient, notes, items } = req.body;
  const voucherId = "isv-" + Date.now();
  const voucherNum = `ISV-${Math.floor(100000 + Math.random() * 900000)}`;

  db.transaction(() => {
    db.prepare(`
      INSERT INTO stock_issue_vouchers (id, voucher_number, warehouse_name, issue_type, recipient, notes, created_by, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')
    `).run(voucherId, voucherNum, warehouseName || "المخزن الرئيسي", issueType || "kitchen", recipient || "", notes || "", user.name || user.username);

    for (const item of items || []) {
      if (!item.productId || !item.quantity) continue;
      const prod = db.prepare("SELECT * FROM products WHERE id=?").get(item.productId) as any;
      if (prod) {
        const prevStock = prod.stock ?? 0;
        const newStock = Math.max(0, prevStock - Number(item.quantity));
        db.prepare("UPDATE products SET stock = ? WHERE id = ?").run(newStock, item.productId);
        db.prepare(`
          INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason, reference_id, user_id, user_name)
          VALUES (?, 'out', ?, ?, ?, ?, ?, ?, ?)
        `).run(item.productId, Number(item.quantity), prevStock, newStock, `سند صرف ${voucherNum} - ${recipient || issueType}`, voucherNum, user.id, user.name);
      }
    }

    logAudit(user.id, user.name, "إصدار سند صرف مخزني", `سند رقم ${voucherNum} - المستلم: ${recipient}`);
  })();

  res.json({ success: true, voucherNumber: voucherNum });
});

// Create Stock Receipt Voucher (سند توريد مخزني)
router.post("/inventory/receipt-voucher", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { warehouseName, receiptType, supplierName, notes, items } = req.body;
  const voucherId = "rcv-" + Date.now();
  const voucherNum = `RCV-${Math.floor(100000 + Math.random() * 900000)}`;

  db.transaction(() => {
    db.prepare(`
      INSERT INTO stock_receipt_vouchers (id, voucher_number, warehouse_name, receipt_type, supplier_name, notes, created_by, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')
    `).run(voucherId, voucherNum, warehouseName || "المخزن الرئيسي", receiptType || "supplier", supplierName || "", notes || "", user.name || user.username);

    for (const item of items || []) {
      if (!item.productId || !item.quantity) continue;
      const prod = db.prepare("SELECT * FROM products WHERE id=?").get(item.productId) as any;
      if (prod) {
        const prevStock = prod.stock ?? 0;
        const newStock = prevStock + Number(item.quantity);
        db.prepare("UPDATE products SET stock = ? WHERE id = ?").run(newStock, item.productId);
        db.prepare(`
          INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason, reference_id, user_id, user_name)
          VALUES (?, 'in', ?, ?, ?, ?, ?, ?, ?)
        `).run(item.productId, Number(item.quantity), prevStock, newStock, `سند توريد ${voucherNum} - ${supplierName || receiptType}`, voucherNum, user.id, user.name);
      }
    }

    logAudit(user.id, user.name, "إصدار سند توريد مخزني", `سند رقم ${voucherNum} - المورد/الجهة: ${supplierName || receiptType}`);
  })();

  res.json({ success: true, voucherNumber: voucherNum });
});

// 5. Create Purchase Return (مرتجع مشتريات للمورد)
router.post("/inventory/purchase-return", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { supplierId, supplierName, purchaseOrderId, invoiceNumber, notes, items } = req.body;
  if (!supplierName || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "يرجى تحديد المورد وأصناف المرتجع" });
    return;
  }

  const returnNum = `PR-${Math.floor(100000 + Math.random() * 900000)}`;
  let totalAmount = 0;

  db.transaction(() => {
    const insertRet = db.prepare(`
      INSERT INTO purchase_returns (return_number, supplier_id, supplier_name, purchase_order_id, invoice_number, total_amount, notes, created_by)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `).run(returnNum, supplierId || null, supplierName, purchaseOrderId || null, invoiceNumber || null, notes || "", user.name || user.username);

    const returnId = insertRet.lastInsertRowid;

    for (const item of items) {
      const qty = Number(item.quantity || 1);
      const price = Number(item.unitPrice || 0);
      const lineTotal = qty * price;
      totalAmount += lineTotal;

      db.prepare(`
        INSERT INTO purchase_return_items (return_id, product_id, product_name, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(returnId, item.productId || null, item.productName || "صنف مرتجع", qty, price, lineTotal);

      if (item.productId) {
        const prod = db.prepare("SELECT * FROM products WHERE id=?").get(item.productId) as any;
        if (prod) {
          const prevStock = prod.stock ?? 0;
          const newStock = Math.max(0, prevStock - qty);
          db.prepare("UPDATE products SET stock = ? WHERE id = ?").run(newStock, item.productId);
          db.prepare(`
            INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason, reference_id, user_id, user_name)
            VALUES (?, 'out', ?, ?, ?, ?, ?, ?, ?)
          `).run(item.productId, qty, prevStock, newStock, `مرتجع مشتريات للمورد ${supplierName} (سند ${returnNum})`, returnNum, user.id, user.name);
        }
      }
    }

    db.prepare("UPDATE purchase_returns SET total_amount = ? WHERE id = ?").run(totalAmount, returnId);

    // Update supplier liability balance if supplier ID exists
    if (supplierId) {
      db.prepare("UPDATE suppliers SET balance = balance - ? WHERE id = ?").run(totalAmount, supplierId);
    }

    // Record Accounting Entry (Debit Accounts Payable 21100, Credit Inventory 11300)
    try {
      createDoubleEntryJournal(
        new Date().toISOString().slice(0, 10),
        `مرتجع مشتريات للمورد ${supplierName} (سند ${returnNum})`,
        "purchase_return",
        Number(returnId),
        [
          { account_code: "21100", debit: totalAmount, credit: 0, description: `تخفيض حساب المورد ${supplierName}` },
          { account_code: "11300", debit: 0, credit: totalAmount, description: `تخفيض قيمة المخزون من مرتجع المشتريات` }
        ]
      );
    } catch (err) {
      console.warn("Accounting entry for purchase return skipped:", err);
    }

    logAudit(user.id, user.name, "تسجيل مرتجع مشتريات", `مرتجع رقم ${returnNum} للمورد ${supplierName} بقيمة ${totalAmount}`);
  })();

  res.json({ success: true, returnNumber: returnNum, totalAmount });
});

// 6. Create Return Voucher (مرتجع مبيعات / سند إرجاع)
router.post("/inventory/return-voucher", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { warehouseName, returnType, referenceNumber, supplierName, notes, items } = req.body;
  const voucherId = "srv-" + Date.now();
  const voucherNum = `SRV-${Math.floor(100000 + Math.random() * 900000)}`;

  db.transaction(() => {
    db.prepare(`
      INSERT INTO stock_return_vouchers (id, voucher_number, warehouse_name, return_type, reference_number, supplier_name, notes, created_by, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved')
    `).run(voucherId, voucherNum, warehouseName || "المخزن الرئيسي", returnType || "to_supplier", referenceNumber || "", supplierName || "", notes || "", user.name || user.username);

    for (const item of items || []) {
      if (!item.productId || !item.quantity) continue;
      const prod = db.prepare("SELECT * FROM products WHERE id=?").get(item.productId) as any;
      if (prod) {
        const prevStock = prod.stock ?? 0;
        const qty = Number(item.quantity);
        const isToSupplier = returnType === "to_supplier";
        const newStock = isToSupplier ? Math.max(0, prevStock - qty) : prevStock + qty;

        db.prepare("UPDATE products SET stock = ? WHERE id = ?").run(newStock, item.productId);
        db.prepare(`
          INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason, reference_id, user_id, user_name)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(item.productId, isToSupplier ? 'out' : 'in', qty, prevStock, newStock, `سند إرجاع ${voucherNum} (${isToSupplier ? 'مرتجع للمورد' : 'مرتجع للمخزن'})`, voucherNum, user.id, user.name);
      }
    }

    logAudit(user.id, user.name, "إصدار سند إرجاع مخزني", `سند إرجاع رقم ${voucherNum}`);
  })();

  res.json({ success: true, voucherNumber: voucherNum });
});

// 7. Internal Stock Requisition Workflow (طلبات المخزون الداخلية بين الفروع والمستودع)
router.post("/inventory/internal-request", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { requestingDepartment, targetWarehouseId, targetWarehouseName, notes, items } = req.body;
  if (!requestingDepartment || !items || items.length === 0) {
    res.status(400).json({ error: "يرجى تحديد القسم الطالب والأصناف" });
    return;
  }

  const requestNum = `REQ-${Math.floor(100000 + Math.random() * 900000)}`;

  db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO internal_stock_requests (request_number, requesting_department, target_warehouse_id, target_warehouse_name, status, notes, requested_by)
      VALUES (?, ?, ?, ?, 'pending_approval', ?, ?)
    `).run(requestNum, requestingDepartment, targetWarehouseId || 'wh-main', targetWarehouseName || 'المخزن الرئيسي', notes || "", user.name || user.username);

    const reqId = result.lastInsertRowid;

    for (const item of items) {
      db.prepare(`
        INSERT INTO internal_stock_request_items (request_id, product_id, product_name, requested_qty, approved_qty, issued_qty, unit, unit_cost)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(reqId, item.productId || null, item.productName, Number(item.requestedQty || 1), Number(item.requestedQty || 1), 0, item.unit || 'حبة', Number(item.unitCost || 0));
    }

    logAudit(user.id, user.name, "إنشاء طلب صرف داخلي", `طلب رقم ${requestNum} للقسم: ${requestingDepartment}`);
  })();

  res.json({ success: true, requestNumber: requestNum });
});

// Update status of Internal Stock Request (Workflow: approve -> prepare -> issue -> receive -> cancel)
router.post("/inventory/internal-request/:id/status", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { id } = req.params;
  const { action, notes } = req.body;

  const reqObj = db.prepare("SELECT * FROM internal_stock_requests WHERE id = ?").get(id) as any;
  if (!reqObj) {
    res.status(404).json({ error: "طلب المخزون الداخلي غير موجود" });
    return;
  }

  db.transaction(() => {
    if (action === "approve") {
      db.prepare("UPDATE internal_stock_requests SET status = 'approved', approved_by = ?, notes = COALESCE(notes, '') || ' | ' || ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
        .run(user.name, notes || "تمت الموافقة", id);
      logAudit(user.id, user.name, "موافقة طلب مخزن داخلي", `موافقة على طلب رقم ${reqObj.request_number}`);
    } else if (action === "prepare") {
      db.prepare("UPDATE internal_stock_requests SET status = 'preparing', prepared_by = ?, notes = COALESCE(notes, '') || ' | ' || ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
        .run(user.name, notes || "جاري التجهيز", id);
      logAudit(user.id, user.name, "تجهيز طلب مخزن داخلي", `تجهيز الطلب رقم ${reqObj.request_number}`);
    } else if (action === "issue") {
      // Execute stock deduction upon issuing
      const items = db.prepare("SELECT * FROM internal_stock_request_items WHERE request_id = ?").all(id) as any[];
      for (const item of items) {
        if (item.product_id) {
          const prod = db.prepare("SELECT * FROM products WHERE id = ?").get(item.product_id) as any;
          if (prod) {
            const qty = item.approved_qty || item.requested_qty || 1;
            const prevStock = prod.stock ?? 0;
            const newStock = Math.max(0, prevStock - qty);
            db.prepare("UPDATE products SET stock = ? WHERE id = ?").run(newStock, item.product_id);
            db.prepare("UPDATE internal_stock_request_items SET issued_qty = ? WHERE id = ?").run(qty, item.id);
            db.prepare(`
              INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason, reference_id, user_id, user_name)
              VALUES (?, 'out', ?, ?, ?, ?, ?, ?, ?)
            `).run(item.product_id, qty, prevStock, newStock, `صرف طلب داخلي ${reqObj.request_number} لفرع/قسم ${reqObj.requesting_department}`, reqObj.request_number, user.id, user.name);
          }
        }
      }

      db.prepare("UPDATE internal_stock_requests SET status = 'issued', issued_by = ?, notes = COALESCE(notes, '') || ' | ' || ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
        .run(user.name, notes || "تم الصرف بنجاح", id);
      logAudit(user.id, user.name, "صرف طلب مخزن داخلي", `صرف الكميات للطلب رقم ${reqObj.request_number}`);
    } else if (action === "receive") {
      db.prepare("UPDATE internal_stock_requests SET status = 'received', received_by = ?, notes = COALESCE(notes, '') || ' | ' || ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
        .run(user.name, notes || "تم الاستلام وإغلاق الطلب", id);
      logAudit(user.id, user.name, "استلام طلب مخزن داخلي", `إغلاق واستلام طلب رقم ${reqObj.request_number}`);
    } else if (action === "cancel") {
      db.prepare("UPDATE internal_stock_requests SET status = 'cancelled', notes = COALESCE(notes, '') || ' | ملغي: ' || ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
        .run(notes || "إلغاء الطلب", id);
      logAudit(user.id, user.name, "إلغاء طلب مخزن داخلي", `إلغاء طلب رقم ${reqObj.request_number}`);
    }
  })();

  res.json({ success: true });
});

// 8. NON-DELETABLE POLICY: Cancel Approved Operation with Reversing Entries & Audit Trail
router.post("/inventory/cancel-operation", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { operationType, operationId, reason } = req.body;
  if (!operationType || !operationId || !reason) {
    res.status(400).json({ error: "يرجى تقديم نوع العملية، الرقم المرجعي وسبب الإلغاء" });
    return;
  }

  db.transaction(() => {
    let originalRef = "";

    if (operationType === "receipt_voucher") {
      const v = db.prepare("SELECT * FROM stock_receipt_vouchers WHERE id = ? OR voucher_number = ?").get(operationId, operationId) as any;
      if (!v) throw new Error("سند التوريد غير موجود");
      if (v.status === "cancelled") throw new Error("السند ملغي مسبقاً");

      originalRef = v.voucher_number;
      // Reversals: find movements linked to this voucher number and deduct stock
      const movs = db.prepare("SELECT * FROM stock_movements WHERE reference_id = ?").all(v.voucher_number) as any[];
      for (const m of movs) {
        if (m.product_id && m.type === 'in') {
          const prod = db.prepare("SELECT * FROM products WHERE id = ?").get(m.product_id) as any;
          if (prod) {
            const prevStock = prod.stock ?? 0;
            const newStock = Math.max(0, prevStock - m.quantity);
            db.prepare("UPDATE products SET stock = ? WHERE id = ?").run(newStock, m.product_id);
            db.prepare(`
              INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason, reference_id, user_id, user_name)
              VALUES (?, 'out', ?, ?, ?, ?, ?, ?, ?)
            `).run(m.product_id, m.quantity, prevStock, newStock, `حركة عكسية لإلغاء سند التوريد ${v.voucher_number} - السبب: ${reason}`, v.voucher_number, user.id, user.name);
          }
        }
      }

      db.prepare("UPDATE stock_receipt_vouchers SET status = 'cancelled', cancelled_at = datetime('now', 'localtime'), cancelled_by = ?, cancel_reason = ? WHERE id = ? OR voucher_number = ?")
        .run(user.name, reason, operationId, operationId);

    } else if (operationType === "issue_voucher") {
      const v = db.prepare("SELECT * FROM stock_issue_vouchers WHERE id = ? OR voucher_number = ?").get(operationId, operationId) as any;
      if (!v) throw new Error("سند الصرف غير موجود");
      if (v.status === "cancelled") throw new Error("السند ملغي مسبقاً");

      originalRef = v.voucher_number;
      // Reversals: find movements linked to this voucher number and restore stock
      const movs = db.prepare("SELECT * FROM stock_movements WHERE reference_id = ?").all(v.voucher_number) as any[];
      for (const m of movs) {
        if (m.product_id && m.type === 'out') {
          const prod = db.prepare("SELECT * FROM products WHERE id = ?").get(m.product_id) as any;
          if (prod) {
            const prevStock = prod.stock ?? 0;
            const newStock = prevStock + m.quantity;
            db.prepare("UPDATE products SET stock = ? WHERE id = ?").run(newStock, m.product_id);
            db.prepare(`
              INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason, reference_id, user_id, user_name)
              VALUES (?, 'in', ?, ?, ?, ?, ?, ?, ?)
            `).run(m.product_id, m.quantity, prevStock, newStock, `حركة عكسية لإلغاء سند الصرف ${v.voucher_number} - السبب: ${reason}`, v.voucher_number, user.id, user.name);
          }
        }
      }

      db.prepare("UPDATE stock_issue_vouchers SET status = 'cancelled', cancelled_at = datetime('now', 'localtime'), cancelled_by = ?, cancel_reason = ? WHERE id = ? OR voucher_number = ?")
        .run(user.name, reason, operationId, operationId);

    } else if (operationType === "purchase_return") {
      const pr = db.prepare("SELECT * FROM purchase_returns WHERE id = ? OR return_number = ?").get(operationId, operationId) as any;
      if (!pr) throw new Error("مرتجع المشتريات غير موجود");
      if (pr.status === "cancelled") throw new Error("المرتجع ملغي مسبقاً");

      originalRef = pr.return_number;
      const items = db.prepare("SELECT * FROM purchase_return_items WHERE return_id = ?").all(pr.id) as any[];
      for (const item of items) {
        if (item.product_id) {
          const prod = db.prepare("SELECT * FROM products WHERE id = ?").get(item.product_id) as any;
          if (prod) {
            const prevStock = prod.stock ?? 0;
            const newStock = prevStock + item.quantity;
            db.prepare("UPDATE products SET stock = ? WHERE id = ?").run(newStock, item.product_id);
            db.prepare(`
              INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason, reference_id, user_id, user_name)
              VALUES (?, 'in', ?, ?, ?, ?, ?, ?, ?)
            `).run(item.product_id, item.quantity, prevStock, newStock, `حركة عكسية لإلغاء مرتجع مشتريات ${pr.return_number} - السبب: ${reason}`, pr.return_number, user.id, user.name);
          }
        }
      }

      // Re-credit supplier balance if supplier exists
      if (pr.supplier_id) {
        db.prepare("UPDATE suppliers SET balance = balance + ? WHERE id = ?").run(pr.total_amount, pr.supplier_id);
      }

      db.prepare("UPDATE purchase_returns SET status = 'cancelled', cancelled_at = datetime('now', 'localtime'), cancelled_by = ?, cancel_reason = ? WHERE id = ?")
        .run(user.name, reason, pr.id);

    } else if (operationType === "waste") {
      const w = db.prepare("SELECT * FROM stock_waste_records WHERE id = ? OR waste_number = ?").get(operationId, operationId) as any;
      if (!w) throw new Error("سجل التالف غير موجود");

      originalRef = w.waste_number;
      const movs = db.prepare("SELECT * FROM stock_movements WHERE reference_id = ?").all(w.waste_number) as any[];
      for (const m of movs) {
        if (m.product_id) {
          const prod = db.prepare("SELECT * FROM products WHERE id = ?").get(m.product_id) as any;
          if (prod) {
            const prevStock = prod.stock ?? 0;
            const newStock = prevStock + m.quantity;
            db.prepare("UPDATE products SET stock = ? WHERE id = ?").run(newStock, m.product_id);
            db.prepare(`
              INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason, reference_id, user_id, user_name)
              VALUES (?, 'in', ?, ?, ?, ?, ?, ?, ?)
            `).run(m.product_id, m.quantity, prevStock, newStock, `حركة عكسية لإلغاء إثبات التالف ${w.waste_number}`, w.waste_number, user.id, user.name);
          }
        }
      }

      db.prepare("UPDATE stock_waste_records SET status = 'cancelled', cancelled_at = datetime('now', 'localtime'), cancelled_by = ?, cancel_reason = ? WHERE id = ? OR waste_number = ?")
        .run(user.name, reason, operationId, operationId);
    }

    logAudit(user.id, user.name, "إلغاء عملية مخزنية (عكسية)", `تم إلغاء العملية ${originalRef} (نوع: ${operationType}) - السبب: ${reason}`);
  })();

  res.json({ success: true, message: "تم تنفيذ العملية العكسية وإلغاء القيد وتسجيل سجل التدقيق بنجاح" });
});

// 9. Stock Transfers (تحويل بين مخزنين)
router.post("/inventory/transfer", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { fromWarehouse, toWarehouse, notes, items } = req.body;
  const transferId = "trf-" + Date.now();
  const transferNum = `TRF-${Math.floor(100000 + Math.random() * 900000)}`;

  db.transaction(() => {
    db.prepare(`
      INSERT INTO stock_transfers (id, transfer_number, from_warehouse_name, to_warehouse_name, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(transferId, transferNum, fromWarehouse || "المخزن الرئيسي", toWarehouse || "مخزن المطبخ", notes || "", user.name || user.username);

    for (const item of items || []) {
      if (!item.productId || !item.quantity) continue;
      const prod = db.prepare("SELECT * FROM products WHERE id=?").get(item.productId) as any;
      if (prod) {
        const qty = Number(item.quantity);
        db.prepare(`
          INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason, reference_id, user_id, user_name)
          VALUES (?, 'transfer', ?, ?, ?, ?, ?, ?, ?)
        `).run(item.productId, qty, prod.stock ?? 0, prod.stock ?? 0, `تحويل من ${fromWarehouse} إلى ${toWarehouse}`, transferNum, user.id, user.name);
      }
    }

    logAudit(user.id, user.name, "تحويل مخزني", `تحويل رقم ${transferNum} من ${fromWarehouse} إلى ${toWarehouse}`);
  })();

  res.json({ success: true, transferNumber: transferNum });
});

// 10. Record Waste / Damaged Items (إثبات تالف)
router.post("/inventory/waste", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { warehouseName, productId, productName, quantity, unitCost, reason, notes } = req.body;
  const wasteId = "wst-" + Date.now();
  const wasteNum = `WST-${Math.floor(100000 + Math.random() * 900000)}`;
  const qty = Number(quantity || 1);
  const cost = Number(unitCost || 0);

  db.transaction(() => {
    db.prepare(`
      INSERT INTO stock_waste_records (id, waste_number, warehouse_name, product_name, quantity, unit, unit_cost, total_cost, reason, notes, created_at, status)
      VALUES (?, ?, ?, ?, ?, 'حبة', ?, ?, ?, ?, CURRENT_TIMESTAMP, 'approved')
    `).run(wasteId, wasteNum, warehouseName || "المخزن الرئيسي", productName || "صنف تالف", qty, cost, qty * cost, reason || "تالف/منتهي", notes || "");

    if (productId) {
      const prod = db.prepare("SELECT * FROM products WHERE id=?").get(productId) as any;
      if (prod) {
        const prevStock = prod.stock ?? 0;
        const newStock = Math.max(0, prevStock - qty);
        db.prepare("UPDATE products SET stock = ? WHERE id = ?").run(newStock, productId);
        db.prepare(`
          INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason, reference_id, user_id, user_name)
          VALUES (?, 'out', ?, ?, ?, ?, ?, ?, ?)
        `).run(productId, qty, prevStock, newStock, `إثبات تالف ${wasteNum} - ${reason}`, wasteNum, user.id, user.name);
      }
    }

    // Record Accounting Entry for Wastage (Debit Wastage Expense 62000, Credit Inventory 11300)
    try {
      if (qty * cost > 0) {
        createDoubleEntryJournal(
          new Date().toISOString().slice(0, 10),
          `إثبات هالك وتالف مخزني (${productName} - ${wasteNum})`,
          "wastage",
          0,
          [
            { account_code: "62000", debit: qty * cost, credit: 0, description: `مصروف تالف ومفقودات` },
            { account_code: "11300", debit: 0, credit: qty * cost, description: `تخفيض قيمة المخزون الهالك` }
          ]
        );
      }
    } catch {}

    logAudit(user.id, user.name, "إثبات تالف مخزني", `تالف رقم ${wasteNum} - الصنف: ${productName} (الكمية: ${qty})`);
  })();

  res.json({ success: true, wasteNumber: wasteNum });
});

// 11. Stocktake Execution & Discrepancies Settlement (الجرد والتسوية والفروقات)
router.post("/inventory/stocktake", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { warehouseName, notes, items } = req.body;
  const stocktakeNum = `STK-${Math.floor(100000 + Math.random() * 900000)}`;

  db.transaction(() => {
    db.prepare(`
      INSERT INTO stocktakes (id, stocktake_number, warehouse_name, type, status, notes, performed_by)
      VALUES (?, ?, ?, 'شامل', 'completed', ?, ?)
    `).run("stk-" + Date.now(), stocktakeNum, warehouseName || "المخزن الرئيسي", notes || "", user.name || user.username);

    for (const item of items || []) {
      if (!item.productId) continue;
      const prod = db.prepare("SELECT * FROM products WHERE id=?").get(item.productId) as any;
      if (prod) {
        const expected = prod.stock ?? 0;
        const actual = Number(item.actualQty ?? expected);
        const diff = actual - expected;

        if (diff !== 0) {
          db.prepare("UPDATE products SET stock = ? WHERE id = ?").run(actual, item.productId);
          db.prepare(`
            INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason, reference_id, user_id, user_name)
            VALUES (?, 'adjustment', ?, ?, ?, ?, ?, ?, ?)
          `).run(item.productId, Math.abs(diff), expected, actual, `تسوية جردية ${stocktakeNum} (${diff > 0 ? 'فائض +' : 'عجز -'}${Math.abs(diff)})`, stocktakeNum, user.id, user.name);
        }
      }
    }

    logAudit(user.id, user.name, "اعتماد جرد مخزني", `جرد رقم ${stocktakeNum} للمخزن ${warehouseName}`);
  })();

  res.json({ success: true, stocktakeNumber: stocktakeNum });
});

// 12. Advanced Interconnected Inventory Reports Endpoint
router.get("/inventory/reports", (req, res) => {
  try {
    const { startDate, endDate, warehouseName, reportType } = req.query;

    const start = (startDate as string) || "2020-01-01";
    const end = (endDate as string) || "2030-12-31";

    // Item movement log
    const movements = db.prepare(`
      SELECT m.*, p.name as productName, p.number as productNumber, c.name as categoryName
      FROM stock_movements m
      LEFT JOIN products p ON p.id = m.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE m.created_at >= ? AND m.created_at <= ?
      ORDER BY m.id DESC
    `).all(start + " 00:00:00", end + " 23:59:59");

    // Inventory Valuation & Slow/Top Moving analysis
    const products = db.prepare(`
      SELECT p.*, c.name as categoryName,
             COALESCE((SELECT SUM(m.quantity) FROM stock_movements m WHERE m.product_id = p.id AND m.type='out'), 0) as totalOutQuantity
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      ORDER BY totalOutQuantity DESC
    `).all() as any[];

    // Purchase Returns dataset
    const purchaseReturns = db.prepare(`
      SELECT pr.*, pri.product_name, pri.quantity, pri.unit_price, pri.total_price
      FROM purchase_returns pr
      LEFT JOIN purchase_return_items pri ON pri.return_id = pr.id
      WHERE pr.created_at >= ? AND pr.created_at <= ?
      ORDER BY pr.created_at DESC
    `).all(start, end);

    // Stock Receipts dataset
    const stockReceipts = db.prepare(`
      SELECT * FROM stock_receipt_vouchers
      WHERE created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC
    `).all(start, end);

    // Stock Issues dataset
    const stockIssues = db.prepare(`
      SELECT * FROM stock_issue_vouchers
      WHERE created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC
    `).all(start, end);

    // Waste records dataset
    const wasteRecords = db.prepare(`
      SELECT * FROM stock_waste_records
      WHERE created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC
    `).all(start, end);

    // Internal Requests dataset
    const internalRequests = db.prepare(`
      SELECT * FROM internal_stock_requests
      WHERE created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC
    `).all(start, end);

    res.json({
      startDate: start,
      endDate: end,
      movements,
      products,
      purchaseReturns,
      stockReceipts,
      stockIssues,
      wasteRecords,
      internalRequests
    });
  } catch (e: any) {
    res.status(500).json({ error: "فشل استخراج تقارير المخزون الشاملة" });
  }
});

export default router;
