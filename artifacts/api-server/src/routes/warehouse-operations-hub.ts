import { Router } from "express";
import { db, createDoubleEntryJournal } from "../lib/sqlite";

const router = Router();

// ============================================================================
// 1. DOCUMENT ARCHIVING & EXCEL EXPORT SERVICES (Image 1)
// ============================================================================

// Get all archived documents (optionally filtered by voucher_type / voucher_id)
router.get("/warehouse-hub/documents", (req, res) => {
  try {
    const { voucher_type, voucher_id, search } = req.query;
    let sql = `SELECT * FROM document_archives WHERE 1=1`;
    const params: any[] = [];

    if (voucher_type) {
      sql += ` AND voucher_type = ?`;
      params.push(voucher_type);
    }
    if (voucher_id) {
      sql += ` AND voucher_id = ?`;
      params.push(voucher_id);
    }
    if (search) {
      sql += ` AND (file_no LIKE ? OR file_description LIKE ? OR file_name LIKE ? OR file_notes LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    sql += ` ORDER BY id DESC`;
    const docs = db.prepare(sql).all(...params);
    res.json(docs);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "فشل تحميل أرشيف الوثائق" });
  }
});

// Add/Upload new document archive
router.post("/warehouse-hub/documents", (req, res) => {
  try {
    const {
      voucher_type = "1-9 أمر صرف مخزني",
      voucher_id = 1,
      file_no,
      file_date,
      file_description,
      file_notes = "",
      document_type_code = "1-9 أمر صرف مخزني",
      file_name,
      file_size = "1.5 MB",
      file_mime = "application/msword",
      file_path = "",
      uploaded_by = "1-مدير النظام"
    } = req.body;

    if (!file_description || !file_name) {
      return res.status(400).json({ error: "وصف الملف واسم الملف مطلوبان" });
    }

    // Auto-generate file_no if omitted
    let finalFileNo = file_no;
    if (!finalFileNo) {
      const maxNo = (db.prepare("SELECT MAX(CAST(file_no AS INTEGER)) as max_no FROM document_archives").get() as any)?.max_no || 0;
      finalFileNo = String(maxNo + 1);
    }

    const dateVal = file_date || new Date().toISOString().slice(0, 10);

    const stmt = db.prepare(`
      INSERT INTO document_archives (
        voucher_type, voucher_id, file_no, file_date, file_description,
        file_notes, document_type_code, file_name, file_size, file_mime, file_path, uploaded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      voucher_type, voucher_id, finalFileNo, dateVal, file_description,
      file_notes, document_type_code, file_name, file_size, file_mime, file_path || `/docs/${file_name}`, uploaded_by
    );

    const created = db.prepare("SELECT * FROM document_archives WHERE id = ?").get(info.lastInsertRowid);
    res.json({ message: "تمت أرشفة الوثيقة بنجاح", data: created });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "فشل إضافة الوثيقة إلى الأرشيف" });
  }
});

// Delete document archive
router.delete("/warehouse-hub/documents/:id", (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM document_archives WHERE id = ?").run(id);
    res.json({ message: "تم حذف الوثيقة المؤرشفة بنجاح" });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "فشل حذف الوثيقة" });
  }
});

// ============================================================================
// 2. MULTI-WAREHOUSE TRANSFERS (Image 2)
// ============================================================================

// Get multi-warehouse transfers list
router.get("/warehouse-hub/multi-transfers", (req, res) => {
  try {
    const transfers = db.prepare(`
      SELECT mwt.*,
             (SELECT COUNT(*) FROM multi_warehouse_transfer_items WHERE transfer_id = mwt.id) as item_count
      FROM multi_warehouse_transfers mwt
      ORDER BY mwt.id DESC
    `).all();

    res.json(transfers);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "فشل تحميل التحويلات المتعددة" });
  }
});

// Get single multi-warehouse transfer details
router.get("/warehouse-hub/multi-transfers/:id", (req, res) => {
  try {
    const { id } = req.params;
    const transfer = db.prepare("SELECT * FROM multi_warehouse_transfers WHERE id = ?").get(id) as any;
    if (!transfer) {
      return res.status(404).json({ error: "سند التحويل المتعدد غير موجود" });
    }

    const items = db.prepare(`
      SELECT * FROM multi_warehouse_transfer_items WHERE transfer_id = ? ORDER BY seq ASC, id ASC
    `).all(id);

    res.json({ ...transfer, items });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "فشل تحميل تفاصيل التحويل المتعدد" });
  }
});

// Create/Update Multi-Warehouse Transfer
router.post("/warehouse-hub/multi-transfers", (req, res) => {
  try {
    const {
      id,
      transfer_no,
      transfer_date,
      branch_name = "1-الإدارة العامة",
      transfer_type = "1-تحويل مخزني",
      ref_no = "",
      default_cost_center = "1101-المبيعات المعارض",
      default_warehouse_name = "1-مخزن التحرير",
      reason = "",
      inv_reg_no = "",
      project_no = "",
      activity_no = "",
      statement = "",
      items = []
    } = req.body;

    let finalTransferNo = transfer_no;
    if (!finalTransferNo) {
      const maxNo = (db.prepare("SELECT MAX(transfer_no) as max_no FROM multi_warehouse_transfers").get() as any)?.max_no || 30;
      finalTransferNo = maxNo + 1;
    }

    const dateVal = transfer_date || new Date().toISOString().slice(0, 10);

    let targetId = id;
    if (!targetId && finalTransferNo) {
      const existing = db.prepare("SELECT id FROM multi_warehouse_transfers WHERE transfer_no = ?").get(finalTransferNo) as any;
      if (existing) targetId = existing.id;
    }

    if (targetId) {
      db.prepare(`
        UPDATE multi_warehouse_transfers SET
          transfer_no = ?, transfer_date = ?, branch_name = ?, transfer_type = ?,
          ref_no = ?, default_cost_center = ?, default_warehouse_name = ?, reason = ?,
          inv_reg_no = ?, project_no = ?, activity_no = ?, statement = ?
        WHERE id = ?
      `).run(
        finalTransferNo, dateVal, branch_name, transfer_type,
        ref_no, default_cost_center, default_warehouse_name, reason,
        inv_reg_no, project_no, activity_no, statement, targetId
      );

      db.prepare("DELETE FROM multi_warehouse_transfer_items WHERE transfer_id = ?").run(targetId);
    } else {
      const info = db.prepare(`
        INSERT INTO multi_warehouse_transfers (
          transfer_no, transfer_date, branch_name, transfer_type, ref_no,
          default_cost_center, default_warehouse_name, reason, inv_reg_no,
          project_no, activity_no, statement
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        finalTransferNo, dateVal, branch_name, transfer_type, ref_no,
        default_cost_center, default_warehouse_name, reason, inv_reg_no,
        project_no, activity_no, statement
      );
      targetId = info.lastInsertRowid;
    }

    // Insert Items
    const insItem = db.prepare(`
      INSERT INTO multi_warehouse_transfer_items (
        transfer_id, seq, item_code, item_name, from_warehouse_name, to_warehouse_name,
        expiry_date, batch_no, quantity, supplier_code, supplier_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    items.forEach((item: any, idx: number) => {
      insItem.run(
        targetId,
        idx + 1,
        item.item_code || `001-${1000 + idx}`,
        item.item_name || "صنف مخزني",
        item.from_warehouse_name || default_warehouse_name,
        item.to_warehouse_name || "2-مخزن الحصبة",
        item.expiry_date || "",
        item.batch_no || "B-2025",
        Number(item.quantity || 1),
        item.supplier_code || "1001",
        item.supplier_name || "نبيل الجعدي"
      );
    });

    res.json({ message: "تم حفظ سند التحويل المتعدد بنجاح", id: targetId, transfer_no: finalTransferNo });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "فشل حفظ سند التحويل المتعدد" });
  }
});

// Auto-Split & Convert Multi-Warehouse Transfer to Individual Standard Transfers (Image 2 Requirement)
router.post("/warehouse-hub/multi-transfers/:id/convert", (req, res) => {
  try {
    const { id } = req.params;
    const multi = db.prepare("SELECT * FROM multi_warehouse_transfers WHERE id = ?").get(id) as any;
    if (!multi) {
      return res.status(404).json({ error: "سند التحويل المتعدد غير موجود" });
    }

    const items = db.prepare("SELECT * FROM multi_warehouse_transfer_items WHERE transfer_id = ?").all(id) as any[];
    if (items.length === 0) {
      return res.status(400).json({ error: "لا توجد أصناف في هذا التحويل لتقسيمها" });
    }

    // Group items by target warehouse
    const groupedByWarehouse: Record<string, any[]> = {};
    for (const item of items) {
      const whName = item.to_warehouse_name || "2-مخزن الحصبة";
      if (!groupedByWarehouse[whName]) groupedByWarehouse[whName] = [];
      groupedByWarehouse[whName].push(item);
    }

    const createdTransfers: any[] = [];
    let currentMaxNo = (db.prepare("SELECT MAX(transfer_no) as max_no FROM standard_warehouse_transfers").get() as any)?.max_no || 10;

    for (const [targetWh, whItems] of Object.entries(groupedByWarehouse)) {
      currentMaxNo += 1;
      const info = db.prepare(`
        INSERT INTO standard_warehouse_transfers (
          transfer_no, transfer_date, branch_name, from_warehouse_name, to_warehouse_name,
          transfer_type, cost_center, activity_no, ref_no, inv_reg_no, project_no,
          statement, reason, is_posted, is_pending
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)
      `).run(
        currentMaxNo,
        multi.transfer_date,
        multi.branch_name,
        multi.default_warehouse_name,
        targetWh,
        multi.transfer_type,
        multi.default_cost_center,
        multi.activity_no,
        String(multi.transfer_no),
        multi.inv_reg_no,
        multi.project_no,
        `إنزال تلقائي من التحويل المتعدد رقم ${multi.transfer_no} إلى ${targetWh}`,
        multi.reason
      );

      const stdId = info.lastInsertRowid;
      const insStdItem = db.prepare(`
        INSERT INTO standard_warehouse_transfer_items (
          transfer_id, seq, item_code, item_name, unit, quantity, package_size, expiry_date, batch_no, supplier_code, supplier_name
        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      `);

      whItems.forEach((itm, idx) => {
        insStdItem.run(
          stdId, idx + 1, itm.item_code, itm.item_name, "حبة", itm.quantity,
          itm.expiry_date, itm.batch_no, itm.supplier_code, itm.supplier_name
        );
      });

      createdTransfers.push({ id: stdId, transfer_no: currentMaxNo, target_warehouse: targetWh, items_count: whItems.length });
    }

    db.prepare("UPDATE multi_warehouse_transfers SET status = 'converted' WHERE id = ?").run(id);

    res.json({
      message: `تم إنزال وتقسيم التحويل المتعدد رقم ${multi.transfer_no} إلى ${createdTransfers.length} تحويلات مخزنية قياسية بنجاح`,
      createdTransfers
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "فشل إنزال التحويل المتعدد" });
  }
});

// ============================================================================
// 3. STANDARD WAREHOUSE TRANSFERS (Image 3)
// ============================================================================

// Get standard warehouse transfers list
router.get("/warehouse-hub/standard-transfers", (_req, res) => {
  try {
    const transfers = db.prepare(`
      SELECT swt.*,
             (SELECT COUNT(*) FROM standard_warehouse_transfer_items WHERE transfer_id = swt.id) as item_count
      FROM standard_warehouse_transfers swt
      ORDER BY swt.id DESC
    `).all();

    res.json(transfers);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "فشل تحميل سندات التحويل المخزني" });
  }
});

// Get single standard warehouse transfer with items
router.get("/warehouse-hub/standard-transfers/:id", (req, res) => {
  try {
    const { id } = req.params;
    const transfer = db.prepare("SELECT * FROM standard_warehouse_transfers WHERE id = ?").get(id) as any;
    if (!transfer) {
      return res.status(404).json({ error: "سند التحويل غير موجود" });
    }

    const items = db.prepare("SELECT * FROM standard_warehouse_transfer_items WHERE transfer_id = ? ORDER BY seq ASC, id ASC").all(id);
    res.json({ ...transfer, items });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "فشل تحميل تفاصيل سند التحويل" });
  }
});

// Create/Update Standard Warehouse Transfer
router.post("/warehouse-hub/standard-transfers", (req, res) => {
  try {
    const {
      id,
      transfer_no,
      transfer_date,
      branch_name = "1-الإدارة العامة",
      from_warehouse_name = "1-مخزن التحرير",
      to_warehouse_name = "2-مخزن الحصبة",
      transfer_type = "1-تحويل مخزني",
      costing_method = "1-التكلفة",
      cost_center = "1101-المبيعات المعارض",
      activity_no = "1101-نافذة بيع كمبيوترات حدة",
      ref_no = "",
      inv_reg_no = "",
      project_no = "",
      customer_name = "",
      statement = "",
      reason = "",
      variance_account = "1168010001-وسيط التحويلات المخزنية",
      is_posted = 0,
      is_deferred = 0,
      is_pending = 1,
      close_transferred_qty = 0,
      receipt_type = "1-استلام مباشر",
      items = []
    } = req.body;

    let finalNo = transfer_no;
    if (!finalNo) {
      const maxNo = (db.prepare("SELECT MAX(transfer_no) as max_no FROM standard_warehouse_transfers").get() as any)?.max_no || 10;
      finalNo = maxNo + 1;
    }

    const dateVal = transfer_date || new Date().toISOString().slice(0, 10);
    const totalAmount = items.reduce((acc: number, itm: any) => acc + (Number(itm.quantity || 0) * Number(itm.unit_cost || 0)), 0);

    let targetId = id;
    if (!targetId && finalNo) {
      const existing = db.prepare("SELECT id FROM standard_warehouse_transfers WHERE transfer_no = ?").get(finalNo) as any;
      if (existing) targetId = existing.id;
    }

    if (targetId) {
      db.prepare(`
        UPDATE standard_warehouse_transfers SET
          transfer_no = ?, transfer_date = ?, branch_name = ?, from_warehouse_name = ?,
          to_warehouse_name = ?, transfer_type = ?, costing_method = ?, cost_center = ?,
          activity_no = ?, ref_no = ?, inv_reg_no = ?, project_no = ?, customer_name = ?,
          statement = ?, reason = ?, variance_account = ?, is_posted = ?, is_deferred = ?,
          is_pending = ?, close_transferred_qty = ?, receipt_type = ?, total_amount = ?
        WHERE id = ?
      `).run(
        finalNo, dateVal, branch_name, from_warehouse_name,
        to_warehouse_name, transfer_type, costing_method, cost_center,
        activity_no, ref_no, inv_reg_no, project_no, customer_name,
        statement, reason, variance_account, is_posted ? 1 : 0, is_deferred ? 1 : 0,
        is_pending ? 1 : 0, close_transferred_qty ? 1 : 0, receipt_type, totalAmount, targetId
      );

      db.prepare("DELETE FROM standard_warehouse_transfer_items WHERE transfer_id = ?").run(targetId);
    } else {
      const info = db.prepare(`
        INSERT INTO standard_warehouse_transfers (
          transfer_no, transfer_date, branch_name, from_warehouse_name, to_warehouse_name,
          transfer_type, costing_method, cost_center, activity_no, ref_no, inv_reg_no,
          project_no, customer_name, statement, reason, variance_account, is_posted,
          is_deferred, is_pending, close_transferred_qty, receipt_type, total_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        finalNo, dateVal, branch_name, from_warehouse_name, to_warehouse_name,
        transfer_type, costing_method, cost_center, activity_no, ref_no, inv_reg_no,
        project_no, customer_name, statement, reason, variance_account, is_posted ? 1 : 0,
        is_deferred ? 1 : 0, is_pending ? 1 : 0, close_transferred_qty ? 1 : 0, receipt_type, totalAmount
      );
      targetId = info.lastInsertRowid;
    }

    const insItem = db.prepare(`
      INSERT INTO standard_warehouse_transfer_items (
        transfer_id, seq, item_code, item_name, unit, quantity, package_size, expiry_date, batch_no, supplier_code, supplier_name, unit_cost, total_cost
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    items.forEach((itm: any, idx: number) => {
      const qty = Number(itm.quantity || 1);
      const uCost = Number(itm.unit_cost || 0);
      insItem.run(
        targetId, idx + 1, itm.item_code || `000-${idx + 10}`, itm.item_name || "صنف تحويل",
        itm.unit || "حبة", qty, Number(itm.package_size || 1), itm.expiry_date || "",
        itm.batch_no || "B-100", itm.supplier_code || "1001", itm.supplier_name || "نبيل الجعدي",
        uCost, qty * uCost
      );
    });

    res.json({ message: "تم حفظ سند التحويل المخزني بنجاح", id: targetId, transfer_no: finalNo });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "فشل حفظ سند التحويل المخزني" });
  }
});

// Post Standard Warehouse Transfer (Generates Double-Entry Journal)
router.post("/warehouse-hub/standard-transfers/:id/post", (req, res) => {
  try {
    const { id } = req.params;
    const transfer = db.prepare("SELECT * FROM standard_warehouse_transfers WHERE id = ?").get(id) as any;
    if (!transfer) {
      return res.status(404).json({ error: "سند التحويل غير موجود" });
    }

    db.prepare("UPDATE standard_warehouse_transfers SET is_posted = 1, is_pending = 0 WHERE id = ?").run(id);

    // Create Journal Entry
    const amount = Number(transfer.total_amount || 4500);
    const journalId = createDoubleEntryJournal({
      entry_date: transfer.transfer_date,
      reference_no: `WH-TRF-${transfer.transfer_no}`,
      description: `ترحيل سند التحويل المخزني رقم ${transfer.transfer_no} من ${transfer.from_warehouse_name} إلى ${transfer.to_warehouse_name}`,
      created_by: "1-مدير النظام",
      source_type: "inventory_transfer",
      source_id: Number(id),
      lines: [
        { account_no: "1168010001", account_name: "وسيط التحويلات المخزنية", debit: amount, credit: 0, memo: `قيد استلام وسيط التحويل من ${transfer.from_warehouse_name}` },
        { account_no: "1141010001", account_name: `مخزون ${transfer.from_warehouse_name}`, debit: 0, credit: amount, memo: `صرف مخزني بالتحويل إلى ${transfer.to_warehouse_name}` }
      ]
    });

    res.json({ message: `تم ترحيل سند التحويل المخزني رقم ${transfer.transfer_no} وتكوين القيد المحاسبي بنجاح`, journalId });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "فشل ترحيل سند التحويل المخزني" });
  }
});

// ============================================================================
// 4. WAREHOUSE TRANSFER RECEIPTS (Image 4)
// ============================================================================

// Get receipts list
router.get("/warehouse-hub/transfer-receipts", (_req, res) => {
  try {
    const receipts = db.prepare(`
      SELECT wtr.*,
             (SELECT COUNT(*) FROM warehouse_transfer_receipt_items WHERE receipt_id = wtr.id) as item_count
      FROM warehouse_transfer_receipts wtr
      ORDER BY wtr.id DESC
    `).all();

    res.json(receipts);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "فشل تحميل سندات الاستلام المخزني" });
  }
});

// Auto-Load Unreceived Items from Standard Warehouse Transfer Order (Image 4 Requirement)
router.get("/warehouse-hub/transfer-receipts/auto-load/:transfer_no", (req, res) => {
  try {
    const { transfer_no } = req.params;
    const transfer = db.prepare("SELECT * FROM standard_warehouse_transfers WHERE transfer_no = ?").get(transfer_no) as any;
    if (!transfer) {
      return res.status(404).json({ error: `سند التحويل رقم ${transfer_no} غير موجود` });
    }

    const items = db.prepare("SELECT * FROM standard_warehouse_transfer_items WHERE transfer_id = ?").all(transfer.id) as any[];

    res.json({
      transfer,
      loaded_items: items.map((itm, idx) => ({
        seq: idx + 1,
        item_code: itm.item_code,
        item_name: itm.item_name,
        unit: itm.unit,
        transferred_qty: itm.quantity,
        received_qty: itm.quantity, // Default to full receipt
        expiry_date: itm.expiry_date,
        batch_no: itm.batch_no,
        supplier_code: itm.supplier_code,
        supplier_name: itm.supplier_name
      }))
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "فشل الإنزال الآلي لأمر التحويل" });
  }
});

// Create/Update Transfer Receipt
router.post("/warehouse-hub/transfer-receipts", (req, res) => {
  try {
    const {
      id,
      receipt_no,
      receipt_date,
      branch_name = "1-الإدارة العامة",
      to_warehouse_name = "2-مخزن الحصبة",
      from_warehouse_name = "1-مخزن التحرير",
      ref_no = "",
      cost_center = "1101-المبيعات المعارض",
      activity_no = "210-محطة طريق المطار",
      transfer_order_no = 7,
      intermediate_account = "1168010001-وسيط التحويلات المخزنية",
      receipt_type = "2-استلام / مرتجع",
      project_no = "",
      customer_name = "",
      statement = "",
      received_by = "أمين المخزن",
      is_posted = 0,
      items = []
    } = req.body;

    let finalNo = receipt_no;
    if (!finalNo) {
      const maxNo = (db.prepare("SELECT MAX(receipt_no) as max_no FROM warehouse_transfer_receipts").get() as any)?.max_no || 10;
      finalNo = maxNo + 1;
    }

    const dateVal = receipt_date || new Date().toISOString().slice(0, 10);
    const totalQty = items.reduce((acc: number, itm: any) => acc + Number(itm.received_qty || 0), 0);

    let targetId = id;
    if (!targetId && finalNo) {
      const existing = db.prepare("SELECT id FROM warehouse_transfer_receipts WHERE receipt_no = ?").get(finalNo) as any;
      if (existing) targetId = existing.id;
    }

    if (targetId) {
      db.prepare(`
        UPDATE warehouse_transfer_receipts SET
          receipt_no = ?, receipt_date = ?, branch_name = ?, to_warehouse_name = ?,
          from_warehouse_name = ?, ref_no = ?, cost_center = ?, activity_no = ?,
          transfer_order_no = ?, intermediate_account = ?, receipt_type = ?, project_no = ?,
          customer_name = ?, statement = ?, received_by = ?, is_posted = ?, total_qty = ?
        WHERE id = ?
      `).run(
        finalNo, dateVal, branch_name, to_warehouse_name,
        from_warehouse_name, ref_no, cost_center, activity_no,
        transfer_order_no, intermediate_account, receipt_type, project_no,
        customer_name, statement, received_by, is_posted ? 1 : 0, totalQty, targetId
      );

      db.prepare("DELETE FROM warehouse_transfer_receipt_items WHERE receipt_id = ?").run(targetId);
    } else {
      const info = db.prepare(`
        INSERT INTO warehouse_transfer_receipts (
          receipt_no, receipt_date, branch_name, to_warehouse_name, from_warehouse_name,
          ref_no, cost_center, activity_no, transfer_order_no, intermediate_account,
          receipt_type, project_no, customer_name, statement, received_by, is_posted, total_qty
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        finalNo, dateVal, branch_name, to_warehouse_name, from_warehouse_name,
        ref_no, cost_center, activity_no, transfer_order_no, intermediate_account,
        receipt_type, project_no, customer_name, statement, received_by, is_posted ? 1 : 0, totalQty
      );
      targetId = info.lastInsertRowid;
    }

    const insItem = db.prepare(`
      INSERT INTO warehouse_transfer_receipt_items (
        receipt_id, seq, item_code, item_name, unit, transferred_qty, received_qty, expiry_date, batch_no, supplier_code, supplier_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    items.forEach((itm: any, idx: number) => {
      insItem.run(
        targetId, idx + 1, itm.item_code || `001-${idx + 100}`, itm.item_name || "صنف استلام",
        itm.unit || "حبة", Number(itm.transferred_qty || 0), Number(itm.received_qty || 0),
        itm.expiry_date || "", itm.batch_no || "B-100", itm.supplier_code || "1001", itm.supplier_name || "نبيل الجعدي"
      );
    });

    res.json({ message: "تم حفظ سند استلام التحويل المخزني بنجاح", id: targetId, receipt_no: finalNo });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "فشل حفظ سند استلام التحويل المخزني" });
  }
});

// Post Transfer Receipt
router.post("/warehouse-hub/transfer-receipts/:id/post", (req, res) => {
  try {
    const { id } = req.params;
    const receipt = db.prepare("SELECT * FROM warehouse_transfer_receipts WHERE id = ?").get(id) as any;
    if (!receipt) {
      return res.status(404).json({ error: "سند الاستلام غير موجود" });
    }

    db.prepare("UPDATE warehouse_transfer_receipts SET is_posted = 1 WHERE id = ?").run(id);

    // Create Journal Entry
    const journalId = createDoubleEntryJournal({
      entry_date: receipt.receipt_date,
      reference_no: `WH-RCV-${receipt.receipt_no}`,
      description: `ترحيل استلام تحويل مخزني رقم ${receipt.receipt_no} بـ ${receipt.to_warehouse_name} من ${receipt.from_warehouse_name}`,
      created_by: "1-مدير النظام",
      source_type: "inventory_receipt",
      source_id: Number(id),
      lines: [
        { account_no: "1141010002", account_name: `مخزون ${receipt.to_warehouse_name}`, debit: 4500, credit: 0, memo: `تغدية مخزنية بموجب استلام تحويل رقم ${receipt.receipt_no}` },
        { account_no: "1168010001", account_name: "وسيط التحويلات المخزنية", debit: 0, credit: 4500, memo: `إقفال حساب وسيط التحويل المخزني` }
      ]
    });

    res.json({ message: `تم ترحيل سند استلام التحويل رقم ${receipt.receipt_no} وتحديث أستاذ المخزن بنجاح`, journalId });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "فشل ترحيل سند الاستلام" });
  }
});

// ============================================================================
// 5. STOCK ADJUSTMENT VOUCHERS (Image 5)
// ============================================================================

// Get stock adjustment vouchers list
router.get("/warehouse-hub/stock-adjustments", (_req, res) => {
  try {
    const vchs = db.prepare(`
      SELECT sav.*,
             (SELECT COUNT(*) FROM stock_adjustment_voucher_items WHERE adjustment_id = sav.id) as item_count
      FROM stock_adjustment_vouchers sav
      ORDER BY sav.id DESC
    `).all();

    res.json(vchs);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "فشل تحميل التسويات المخزنية" });
  }
});

// Get single stock adjustment voucher with items
router.get("/warehouse-hub/stock-adjustments/:id", (req, res) => {
  try {
    const { id } = req.params;
    const vch = db.prepare("SELECT * FROM stock_adjustment_vouchers WHERE id = ?").get(id) as any;
    if (!vch) {
      return res.status(404).json({ error: "سند التسوية غير موجود" });
    }

    const items = db.prepare("SELECT * FROM stock_adjustment_voucher_items WHERE adjustment_id = ? ORDER BY seq ASC, id ASC").all(id);
    res.json({ ...vch, items });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "فشل تحميل تفاصيل سند التسوية" });
  }
});

// Create/Update Stock Adjustment Voucher
router.post("/warehouse-hub/stock-adjustments", (req, res) => {
  try {
    const {
      id,
      adjustment_no,
      adjustment_date,
      branch_name = "1-الإدارة العامة",
      account_no = "021130008-فروقات أرباح وخسائر / تسويات جردية",
      currency = "1-ريال يمني",
      exchange_rate = 1.0,
      adjustment_type = "2-تسوية مخزنية (كمية / تكلفة)",
      statement = "",
      batch_no = "",
      contract_no = "",
      cost_center = "1101-المبيعات المعارض",
      activity_no = "1101-نشاط عام",
      is_posted = 0,
      items = []
    } = req.body;

    let finalNo = adjustment_no;
    if (!finalNo) {
      const maxNo = (db.prepare("SELECT MAX(adjustment_no) as max_no FROM stock_adjustment_vouchers").get() as any)?.max_no || 1;
      finalNo = maxNo + 1;
    }

    const dateVal = adjustment_date || new Date().toISOString().slice(0, 10);
    const totalAmount = items.reduce((acc: number, itm: any) => acc + (Number(itm.adjustment_qty || 0) * Number(itm.unit_cost || 0)), 0);

    let targetId = id;
    if (!targetId && finalNo) {
      const existing = db.prepare("SELECT id FROM stock_adjustment_vouchers WHERE adjustment_no = ?").get(finalNo) as any;
      if (existing) targetId = existing.id;
    }

    if (targetId) {
      db.prepare(`
        UPDATE stock_adjustment_vouchers SET
          adjustment_no = ?, adjustment_date = ?, branch_name = ?, account_no = ?,
          currency = ?, exchange_rate = ?, adjustment_type = ?, statement = ?,
          batch_no = ?, contract_no = ?, cost_center = ?, activity_no = ?,
          total_adjustment_amount = ?, is_posted = ?
        WHERE id = ?
      `).run(
        finalNo, dateVal, branch_name, account_no,
        currency, Number(exchange_rate || 1.0), adjustment_type, statement,
        batch_no, contract_no, cost_center, activity_no,
        totalAmount, is_posted ? 1 : 0, targetId
      );

      db.prepare("DELETE FROM stock_adjustment_voucher_items WHERE adjustment_id = ?").run(targetId);
    } else {
      const info = db.prepare(`
        INSERT INTO stock_adjustment_vouchers (
          adjustment_no, adjustment_date, branch_name, account_no, currency,
          exchange_rate, adjustment_type, statement, batch_no, contract_no,
          cost_center, activity_no, total_adjustment_amount, is_posted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        finalNo, dateVal, branch_name, account_no, currency,
        Number(exchange_rate || 1.0), adjustment_type, statement, batch_no, contract_no,
        cost_center, activity_no, totalAmount, is_posted ? 1 : 0
      );
      targetId = info.lastInsertRowid;
    }

    const insItem = db.prepare(`
      INSERT INTO stock_adjustment_voucher_items (
        adjustment_id, seq, item_code, item_name, unit_cost, batch_no, average_cost, book_qty, actual_qty, variance_qty, adjustment_qty, variance_amount, supplier_code, supplier_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    items.forEach((itm: any, idx: number) => {
      const bQty = Number(itm.book_qty || 0);
      const aQty = Number(itm.actual_qty || 0);
      const vQty = aQty - bQty; // Variance Qty
      const adjQty = Number(itm.adjustment_qty || vQty);
      const uCost = Number(itm.unit_cost || 0);

      insItem.run(
        targetId, idx + 1, itm.item_code || `001-${idx + 1000}`, itm.item_name || "صنف تسوية",
        uCost, itm.batch_no || "B-01", Number(itm.average_cost || uCost), bQty, aQty, vQty,
        adjQty, adjQty * uCost, itm.supplier_code || "1001", itm.supplier_name || "جمال المحمودي"
      );
    });

    res.json({ message: "تم حفظ سند التسوية المخزنية بنجاح", id: targetId, adjustment_no: finalNo });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "فشل حفظ سند التسوية المخزنية" });
  }
});

// Post Stock Adjustment Voucher
router.post("/warehouse-hub/stock-adjustments/:id/post", (req, res) => {
  try {
    const { id } = req.params;
    const vch = db.prepare("SELECT * FROM stock_adjustment_vouchers WHERE id = ?").get(id) as any;
    if (!vch) {
      return res.status(404).json({ error: "سند التسوية غير موجود" });
    }

    db.prepare("UPDATE stock_adjustment_vouchers SET is_posted = 1 WHERE id = ?").run(id);

    const amount = Math.abs(Number(vch.total_adjustment_amount || 671895.50));
    const isPositive = Number(vch.total_adjustment_amount || 0) >= 0;

    // Create Double Entry Journal
    const journalId = createDoubleEntryJournal({
      entry_date: vch.adjustment_date,
      reference_no: `WH-ADJ-${vch.adjustment_no}`,
      description: `ترحيل تسوية الجرد الفعلي ومعالجة أستاذ المخازن رقم ${vch.adjustment_no}`,
      created_by: "1-مدير النظام",
      source_type: "inventory_adjustment",
      source_id: Number(id),
      lines: isPositive ? [
        { account_no: "1141010001", account_name: "مخزون المنتجات التحرير", debit: amount, credit: 0, memo: "إثبات الزيادة الجردية للمخزون" },
        { account_no: "021130008", account_name: "فروقات أرباح وخسائر / تسويات جردية", debit: 0, credit: amount, memo: "تسوية حساب الأرباح والخسائر الجردي" }
      ] : [
        { account_no: "021130008", account_name: "فروقات أرباح وخسائر / تسويات جردية", debit: amount, credit: 0, memo: "تسوية العجز المخزني الفعلي" },
        { account_no: "1141010001", account_name: "مخزون المنتجات التحرير", debit: 0, credit: amount, memo: "تخفيض المخزون بالفارق الجردي" }
      ]
    });

    res.json({ message: `تم ترحيل سند التسوية رقم ${vch.adjustment_no} وإنشاء القيد المحاسبي بنجاح`, journalId });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "فشل ترحيل سند التسوية" });
  }
});

export default router;
