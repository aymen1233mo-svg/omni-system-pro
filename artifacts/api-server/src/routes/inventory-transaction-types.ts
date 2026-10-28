import { Router } from "express";
import { db } from "../lib/sqlite";

const router = Router();

// ==========================================
// 1. STOCK ADJUSTMENT TYPES (أنواع تسوية المخزون)
// ==========================================

// GET /api/inventory-types/adjustments
router.get("/inventory-types/adjustments", (req, res) => {
  try {
    const list = db.prepare("SELECT * FROM stock_adjustment_types ORDER BY type_number ASC").all();
    const maxNumberRow = db.prepare("SELECT MAX(type_number) as maxNum FROM stock_adjustment_types").get() as any;
    const nextNumber = (maxNumberRow?.maxNum || 0) + 1;
    res.json({ success: true, data: list, nextNumber });
  } catch (error: any) {
    console.error("Error fetching adjustment types:", error);
    res.status(500).json({ error: error.message || "Failed to fetch adjustment types" });
  }
});

// POST /api/inventory-types/adjustments
router.post("/inventory-types/adjustments", (req, res) => {
  try {
    const { type_number, name, foreign_name, active } = req.body;
    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "اسم نوع التسوية مطلوب" });
    }

    let num = Number(type_number);
    if (!num || isNaN(num)) {
      const maxRow = db.prepare("SELECT MAX(type_number) as maxNum FROM stock_adjustment_types").get() as any;
      num = (maxRow?.maxNum || 0) + 1;
    }

    const stmt = db.prepare(`
      INSERT INTO stock_adjustment_types (type_number, name, foreign_name, active)
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(num, name.trim(), foreign_name ? foreign_name.trim() : "", active !== undefined ? (active ? 1 : 0) : 1);

    const created = db.prepare("SELECT * FROM stock_adjustment_types WHERE id = ?").get(info.lastInsertRowid);
    res.json({ success: true, message: "تم إضافة نوع التسوية بنجاح", data: created });
  } catch (error: any) {
    console.error("Error creating adjustment type:", error);
    res.status(500).json({ error: error.message || "فشل إضافة نوع التسوية" });
  }
});

// PUT /api/inventory-types/adjustments/:id
router.put("/inventory-types/adjustments/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { type_number, name, foreign_name, active } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "اسم نوع التسوية مطلوب" });
    }

    db.prepare(`
      UPDATE stock_adjustment_types
      SET type_number = ?, name = ?, foreign_name = ?, active = ?
      WHERE id = ?
    `).run(Number(type_number), name.trim(), foreign_name ? foreign_name.trim() : "", active ? 1 : 0, Number(id));

    const updated = db.prepare("SELECT * FROM stock_adjustment_types WHERE id = ?").get(Number(id));
    res.json({ success: true, message: "تم تعديل نوع التسوية بنجاح", data: updated });
  } catch (error: any) {
    console.error("Error updating adjustment type:", error);
    res.status(500).json({ error: error.message || "فشل تعديل نوع التسوية" });
  }
});

// DELETE /api/inventory-types/adjustments/:id
router.delete("/inventory-types/adjustments/:id", (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM stock_adjustment_types WHERE id = ?").run(Number(id));
    res.json({ success: true, message: "تم حذف نوع التسوية بنجاح" });
  } catch (error: any) {
    console.error("Error deleting adjustment type:", error);
    res.status(500).json({ error: error.message || "فشل حذف نوع التسوية" });
  }
});


// ==========================================
// 2. STOCK ISSUE TYPES (أنواع الصرف المخزني)
// ==========================================

// GET /api/inventory-types/issues
router.get("/inventory-types/issues", (req, res) => {
  try {
    const list = db.prepare("SELECT * FROM stock_issue_types ORDER BY type_number ASC").all();
    const maxNumberRow = db.prepare("SELECT MAX(type_number) as maxNum FROM stock_issue_types").get() as any;
    const nextNumber = (maxNumberRow?.maxNum || 0) + 1;
    res.json({ success: true, data: list, nextNumber });
  } catch (error: any) {
    console.error("Error fetching issue types:", error);
    res.status(500).json({ error: error.message || "Failed to fetch issue types" });
  }
});

// POST /api/inventory-types/issues
router.post("/inventory-types/issues", (req, res) => {
  try {
    const { type_number, name, foreign_name, is_restaurant, active } = req.body;
    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "اسم نوع أمر الصرف مطلوب" });
    }

    let num = Number(type_number);
    if (!num || isNaN(num)) {
      const maxRow = db.prepare("SELECT MAX(type_number) as maxNum FROM stock_issue_types").get() as any;
      num = (maxRow?.maxNum || 0) + 1;
    }

    const stmt = db.prepare(`
      INSERT INTO stock_issue_types (type_number, name, foreign_name, is_restaurant, active)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      num,
      name.trim(),
      foreign_name ? foreign_name.trim() : "",
      is_restaurant ? 1 : 0,
      active !== undefined ? (active ? 1 : 0) : 1
    );

    const created = db.prepare("SELECT * FROM stock_issue_types WHERE id = ?").get(info.lastInsertRowid);
    res.json({ success: true, message: "تم إضافة نوع أمر الصرف بنجاح", data: created });
  } catch (error: any) {
    console.error("Error creating issue type:", error);
    res.status(500).json({ error: error.message || "فشل إضافة نوع أمر الصرف" });
  }
});

// PUT /api/inventory-types/issues/:id
router.put("/inventory-types/issues/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { type_number, name, foreign_name, is_restaurant, active } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "اسم نوع أمر الصرف مطلوب" });
    }

    db.prepare(`
      UPDATE stock_issue_types
      SET type_number = ?, name = ?, foreign_name = ?, is_restaurant = ?, active = ?
      WHERE id = ?
    `).run(
      Number(type_number),
      name.trim(),
      foreign_name ? foreign_name.trim() : "",
      is_restaurant ? 1 : 0,
      active ? 1 : 0,
      Number(id)
    );

    const updated = db.prepare("SELECT * FROM stock_issue_types WHERE id = ?").get(Number(id));
    res.json({ success: true, message: "تم تعديل نوع أمر الصرف بنجاح", data: updated });
  } catch (error: any) {
    console.error("Error updating issue type:", error);
    res.status(500).json({ error: error.message || "فشل تعديل نوع أمر الصرف" });
  }
});

// DELETE /api/inventory-types/issues/:id
router.delete("/inventory-types/issues/:id", (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM stock_issue_types WHERE id = ?").run(Number(id));
    res.json({ success: true, message: "تم حذف نوع أمر الصرف بنجاح" });
  } catch (error: any) {
    console.error("Error deleting issue type:", error);
    res.status(500).json({ error: error.message || "فشل حذف نوع أمر الصرف" });
  }
});


// ==========================================
// 3. STOCK RECEIPT TYPES (أنواع التوريد المخزني)
// ==========================================

// GET /api/inventory-types/receipts
router.get("/inventory-types/receipts", (req, res) => {
  try {
    const list = db.prepare("SELECT * FROM stock_receipt_types ORDER BY type_number ASC").all();
    const maxNumberRow = db.prepare("SELECT MAX(type_number) as maxNum FROM stock_receipt_types").get() as any;
    const nextNumber = (maxNumberRow?.maxNum || 0) + 1;
    res.json({ success: true, data: list, nextNumber });
  } catch (error: any) {
    console.error("Error fetching receipt types:", error);
    res.status(500).json({ error: error.message || "Failed to fetch receipt types" });
  }
});

// POST /api/inventory-types/receipts
router.post("/inventory-types/receipts", (req, res) => {
  try {
    const { type_number, name, foreign_name, active } = req.body;
    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "اسم نوع أمر التوريد مطلوب" });
    }

    let num = Number(type_number);
    if (!num || isNaN(num)) {
      const maxRow = db.prepare("SELECT MAX(type_number) as maxNum FROM stock_receipt_types").get() as any;
      num = (maxRow?.maxNum || 0) + 1;
    }

    const stmt = db.prepare(`
      INSERT INTO stock_receipt_types (type_number, name, foreign_name, active)
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(num, name.trim(), foreign_name ? foreign_name.trim() : "", active !== undefined ? (active ? 1 : 0) : 1);

    const created = db.prepare("SELECT * FROM stock_receipt_types WHERE id = ?").get(info.lastInsertRowid);
    res.json({ success: true, message: "تم إضافة نوع أمر التوريد بنجاح", data: created });
  } catch (error: any) {
    console.error("Error creating receipt type:", error);
    res.status(500).json({ error: error.message || "فشل إضافة نوع أمر التوريد" });
  }
});

// PUT /api/inventory-types/receipts/:id
router.put("/inventory-types/receipts/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { type_number, name, foreign_name, active } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "اسم نوع أمر التوريد مطلوب" });
    }

    db.prepare(`
      UPDATE stock_receipt_types
      SET type_number = ?, name = ?, foreign_name = ?, active = ?
      WHERE id = ?
    `).run(Number(type_number), name.trim(), foreign_name ? foreign_name.trim() : "", active ? 1 : 0, Number(id));

    const updated = db.prepare("SELECT * FROM stock_receipt_types WHERE id = ?").get(Number(id));
    res.json({ success: true, message: "تم تعديل نوع أمر التوريد بنجاح", data: updated });
  } catch (error: any) {
    console.error("Error updating receipt type:", error);
    res.status(500).json({ error: error.message || "فشل تعديل نوع أمر التوريد" });
  }
});

// DELETE /api/inventory-types/receipts/:id
router.delete("/inventory-types/receipts/:id", (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM stock_receipt_types WHERE id = ?").run(Number(id));
    res.json({ success: true, message: "تم حذف نوع أمر التوريد بنجاح" });
  } catch (error: any) {
    console.error("Error deleting receipt type:", error);
    res.status(500).json({ error: error.message || "فشل حذف نوع أمر التوريد" });
  }
});


// ==========================================
// 4. STOCK REQUISITION TYPES (أنواع الطلبات المخزنية)
// ==========================================

// GET /api/inventory-types/requisitions
router.get("/inventory-types/requisitions", (req, res) => {
  try {
    const list = db.prepare("SELECT * FROM stock_requisition_types ORDER BY type_number ASC").all();
    const maxNumberRow = db.prepare("SELECT MAX(type_number) as maxNum FROM stock_requisition_types").get() as any;
    const nextNumber = (maxNumberRow?.maxNum || 0) + 1;
    res.json({ success: true, data: list, nextNumber });
  } catch (error: any) {
    console.error("Error fetching requisition types:", error);
    res.status(500).json({ error: error.message || "Failed to fetch requisition types" });
  }
});

// POST /api/inventory-types/requisitions
router.post("/inventory-types/requisitions", (req, res) => {
  try {
    const { type_number, name, foreign_name, requisition_effect_type, active } = req.body;
    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "اسم نوع الطلب مطلوب" });
    }

    let num = Number(type_number);
    if (!num || isNaN(num)) {
      const maxRow = db.prepare("SELECT MAX(type_number) as maxNum FROM stock_requisition_types").get() as any;
      num = (maxRow?.maxNum || 0) + 1;
    }

    const effect = ["issue", "transfer", "all"].includes(requisition_effect_type) ? requisition_effect_type : "all";

    const stmt = db.prepare(`
      INSERT INTO stock_requisition_types (type_number, name, foreign_name, requisition_effect_type, active)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      num,
      name.trim(),
      foreign_name ? foreign_name.trim() : "",
      effect,
      active !== undefined ? (active ? 1 : 0) : 1
    );

    const created = db.prepare("SELECT * FROM stock_requisition_types WHERE id = ?").get(info.lastInsertRowid);
    res.json({ success: true, message: "تم إضافة نوع الطلب بنجاح", data: created });
  } catch (error: any) {
    console.error("Error creating requisition type:", error);
    res.status(500).json({ error: error.message || "فشل إضافة نوع الطلب" });
  }
});

// PUT /api/inventory-types/requisitions/:id
router.put("/inventory-types/requisitions/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { type_number, name, foreign_name, requisition_effect_type, active } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "اسم نوع الطلب مطلوب" });
    }

    const effect = ["issue", "transfer", "all"].includes(requisition_effect_type) ? requisition_effect_type : "all";

    db.prepare(`
      UPDATE stock_requisition_types
      SET type_number = ?, name = ?, foreign_name = ?, requisition_effect_type = ?, active = ?
      WHERE id = ?
    `).run(
      Number(type_number),
      name.trim(),
      foreign_name ? foreign_name.trim() : "",
      effect,
      active ? 1 : 0,
      Number(id)
    );

    const updated = db.prepare("SELECT * FROM stock_requisition_types WHERE id = ?").get(Number(id));
    res.json({ success: true, message: "تم تعديل نوع الطلب بنجاح", data: updated });
  } catch (error: any) {
    console.error("Error updating requisition type:", error);
    res.status(500).json({ error: error.message || "فشل تعديل نوع الطلب" });
  }
});

// DELETE /api/inventory-types/requisitions/:id
router.delete("/inventory-types/requisitions/:id", (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM stock_requisition_types WHERE id = ?").run(Number(id));
    res.json({ success: true, message: "تم حذف نوع الطلب بنجاح" });
  } catch (error: any) {
    console.error("Error deleting requisition type:", error);
    res.status(500).json({ error: error.message || "فشل حذف نوع الطلب" });
  }
});


// ==========================================
// 5. SUMMARY OF ALL TYPES
// ==========================================
router.get("/inventory-types/all", (req, res) => {
  try {
    const adjustments = db.prepare("SELECT * FROM stock_adjustment_types ORDER BY type_number ASC").all();
    const issues = db.prepare("SELECT * FROM stock_issue_types ORDER BY type_number ASC").all();
    const receipts = db.prepare("SELECT * FROM stock_receipt_types ORDER BY type_number ASC").all();
    const requisitions = db.prepare("SELECT * FROM stock_requisition_types ORDER BY type_number ASC").all();

    res.json({
      success: true,
      data: {
        adjustments,
        issues,
        receipts,
        requisitions
      }
    });
  } catch (error: any) {
    console.error("Error fetching all inventory transaction types:", error);
    res.status(500).json({ error: error.message || "Failed to fetch all transaction types" });
  }
});

export default router;
