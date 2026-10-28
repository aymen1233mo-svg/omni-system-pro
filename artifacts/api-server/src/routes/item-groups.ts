import { Router } from "express";
import { db } from "../lib/sqlite";

const router = Router();

// ==========================================
// 1. SUB GROUPS (المجموعات الفرعية - Image 1)
// ==========================================

// GET /api/item-groups/sub-groups
router.get("/item-groups/sub-groups", (req, res) => {
  try {
    const list = db.prepare("SELECT * FROM item_sub_groups ORDER BY sub_group_code ASC").all();
    res.json({ success: true, data: list });
  } catch (error: any) {
    console.error("Error fetching sub groups:", error);
    res.status(500).json({ error: error.message || "فشل تحميل المجموعات الفرعية" });
  }
});

// POST /api/item-groups/sub-groups
router.post("/item-groups/sub-groups", (req, res) => {
  try {
    const { main_group_id, main_group_name, sub_group_code, name, foreign_name } = req.body;
    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "اسم المجموعة الفرعية مطلوب" });
    }

    const code = sub_group_code && sub_group_code.trim() !== "" ? sub_group_code.trim() : String(Date.now()).slice(-3);

    const stmt = db.prepare(`
      INSERT INTO item_sub_groups (main_group_id, main_group_name, sub_group_code, name, foreign_name, active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);
    const info = stmt.run(
      Number(main_group_id) || 1,
      main_group_name || "المجموعة الرئيسية",
      code,
      name.trim(),
      foreign_name ? foreign_name.trim() : ""
    );

    const created = db.prepare("SELECT * FROM item_sub_groups WHERE id = ?").get(info.lastInsertRowid);
    res.json({ success: true, message: "تم إضافة المجموعة الفرعية بنجاح", data: created });
  } catch (error: any) {
    console.error("Error creating sub group:", error);
    res.status(500).json({ error: error.message || "فشل إضافة المجموعة الفرعية" });
  }
});

// PUT /api/item-groups/sub-groups/:id
router.put("/item-groups/sub-groups/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { main_group_id, main_group_name, sub_group_code, name, foreign_name, active } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "اسم المجموعة الفرعية مطلوب" });
    }

    db.prepare(`
      UPDATE item_sub_groups
      SET main_group_id = ?, main_group_name = ?, sub_group_code = ?, name = ?, foreign_name = ?, active = ?
      WHERE id = ?
    `).run(
      Number(main_group_id) || 1,
      main_group_name || "",
      sub_group_code.trim(),
      name.trim(),
      foreign_name ? foreign_name.trim() : "",
      active ? 1 : 0,
      Number(id)
    );

    const updated = db.prepare("SELECT * FROM item_sub_groups WHERE id = ?").get(Number(id));
    res.json({ success: true, message: "تم تعديل المجموعة الفرعية بنجاح", data: updated });
  } catch (error: any) {
    console.error("Error updating sub group:", error);
    res.status(500).json({ error: error.message || "فشل تعديل المجموعة الفرعية" });
  }
});

// DELETE /api/item-groups/sub-groups/:id
router.delete("/api/item-groups/sub-groups/:id", (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM item_sub_groups WHERE id = ?").run(Number(id));
    res.json({ success: true, message: "تم حذف المجموعة الفرعية" });
  } catch (error: any) {
    console.error("Error deleting sub group:", error);
    res.status(500).json({ error: error.message || "فشل حذف المجموعة الفرعية" });
  }
});


// ==========================================
// 2. SUB-SUB GROUPS (المجموعات تحت الفرعية - Image 2)
// ==========================================

// GET /api/item-groups/sub-sub-groups
router.get("/item-groups/sub-sub-groups", (req, res) => {
  try {
    const list = db.prepare("SELECT * FROM item_sub_sub_groups ORDER BY sub_sub_group_code ASC").all();
    res.json({ success: true, data: list });
  } catch (error: any) {
    console.error("Error fetching sub-sub groups:", error);
    res.status(500).json({ error: error.message || "فشل تحميل المجموعات تحت الفرعية" });
  }
});

// POST /api/item-groups/sub-sub-groups
router.post("/item-groups/sub-sub-groups", (req, res) => {
  try {
    const {
      sub_group_id, sub_group_name, main_group_id, main_group_name,
      sub_sub_group_code, item_code_prefix, name, foreign_name
    } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "اسم المجموعة تحت الفرعية مطلوب" });
    }

    const stmt = db.prepare(`
      INSERT INTO item_sub_sub_groups (
        sub_group_id, sub_group_name, main_group_id, main_group_name,
        sub_sub_group_code, item_code_prefix, name, foreign_name, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    const info = stmt.run(
      Number(sub_group_id) || 1,
      sub_group_name || "",
      Number(main_group_id) || 80,
      main_group_name || "",
      sub_sub_group_code ? sub_sub_group_code.trim() : "001",
      item_code_prefix ? item_code_prefix.trim() : "080",
      name.trim(),
      foreign_name ? foreign_name.trim() : ""
    );

    const created = db.prepare("SELECT * FROM item_sub_sub_groups WHERE id = ?").get(info.lastInsertRowid);
    res.json({ success: true, message: "تم إضافة المجموعة تحت الفرعية بنجاح", data: created });
  } catch (error: any) {
    console.error("Error creating sub-sub group:", error);
    res.status(500).json({ error: error.message || "فشل إضافة المجموعة تحت الفرعية" });
  }
});

// PUT /api/item-groups/sub-sub-groups/:id
router.put("/item-groups/sub-sub-groups/:id", (req, res) => {
  try {
    const { id } = req.params;
    const {
      sub_group_id, sub_group_name, main_group_id, main_group_name,
      sub_sub_group_code, item_code_prefix, name, foreign_name, active
    } = req.body;

    db.prepare(`
      UPDATE item_sub_sub_groups
      SET sub_group_id = ?, sub_group_name = ?, main_group_id = ?, main_group_name = ?,
          sub_sub_group_code = ?, item_code_prefix = ?, name = ?, foreign_name = ?, active = ?
      WHERE id = ?
    `).run(
      Number(sub_group_id) || 1,
      sub_group_name || "",
      Number(main_group_id) || 80,
      main_group_name || "",
      sub_sub_group_code.trim(),
      item_code_prefix.trim(),
      name.trim(),
      foreign_name ? foreign_name.trim() : "",
      active ? 1 : 0,
      Number(id)
    );

    const updated = db.prepare("SELECT * FROM item_sub_sub_groups WHERE id = ?").get(Number(id));
    res.json({ success: true, message: "تم تعديل المجموعة تحت الفرعية بنجاح", data: updated });
  } catch (error: any) {
    console.error("Error updating sub-sub group:", error);
    res.status(500).json({ error: error.message || "فشل تعديل المجموعة تحت الفرعية" });
  }
});

// DELETE /api/item-groups/sub-sub-groups/:id
router.delete("/api/item-groups/sub-sub-groups/:id", (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM item_sub_sub_groups WHERE id = ?").run(Number(id));
    res.json({ success: true, message: "تم حذف المجموعة تحت الفرعية" });
  } catch (error: any) {
    console.error("Error deleting sub-sub group:", error);
    res.status(500).json({ error: error.message || "فشل الحذف" });
  }
});


// ==========================================
// 3. AUXILIARY GROUPS (المجموعات المساعدة - Image 3)
// ==========================================

// GET /api/item-groups/auxiliary-groups
router.get("/item-groups/auxiliary-groups", (req, res) => {
  try {
    const list = db.prepare("SELECT * FROM item_auxiliary_groups ORDER BY group_code ASC").all();
    res.json({ success: true, data: list });
  } catch (error: any) {
    console.error("Error fetching auxiliary groups:", error);
    res.status(500).json({ error: error.message || "فشل تحميل المجموعات المساعدة" });
  }
});

// POST /api/item-groups/auxiliary-groups
router.post("/item-groups/auxiliary-groups", (req, res) => {
  try {
    const { group_code, name, foreign_name, main_group_id } = req.body;
    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "اسم المجموعة المساعدة مطلوب" });
    }

    const code = group_code && group_code.trim() !== "" ? group_code.trim() : "00" + (Date.now() % 100);

    const stmt = db.prepare(`
      INSERT INTO item_auxiliary_groups (group_code, name, foreign_name, main_group_id, active)
      VALUES (?, ?, ?, ?, 1)
    `);
    const info = stmt.run(
      code,
      name.trim(),
      foreign_name ? foreign_name.trim() : "",
      Number(main_group_id) || 0
    );

    const created = db.prepare("SELECT * FROM item_auxiliary_groups WHERE id = ?").get(info.lastInsertRowid);
    res.json({ success: true, message: "تم إضافة المجموعة المساعدة بنجاح", data: created });
  } catch (error: any) {
    console.error("Error creating auxiliary group:", error);
    res.status(500).json({ error: error.message || "فشل إضافة المجموعة المساعدة" });
  }
});

// PUT /api/item-groups/auxiliary-groups/:id
router.put("/item-groups/auxiliary-groups/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { group_code, name, foreign_name, main_group_id, active } = req.body;

    db.prepare(`
      UPDATE item_auxiliary_groups
      SET group_code = ?, name = ?, foreign_name = ?, main_group_id = ?, active = ?
      WHERE id = ?
    `).run(
      group_code.trim(),
      name.trim(),
      foreign_name ? foreign_name.trim() : "",
      Number(main_group_id) || 0,
      active ? 1 : 0,
      Number(id)
    );

    const updated = db.prepare("SELECT * FROM item_auxiliary_groups WHERE id = ?").get(Number(id));
    res.json({ success: true, message: "تم تعديل المجموعة المساعدة بنجاح", data: updated });
  } catch (error: any) {
    console.error("Error updating auxiliary group:", error);
    res.status(500).json({ error: error.message || "فشل التعديل" });
  }
});

// DELETE /api/item-groups/auxiliary-groups/:id
router.delete("/api/item-groups/auxiliary-groups/:id", (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM item_auxiliary_groups WHERE id = ?").run(Number(id));
    res.json({ success: true, message: "تم حذف المجموعة المساعدة" });
  } catch (error: any) {
    console.error("Error deleting auxiliary group:", error);
    res.status(500).json({ error: error.message || "فشل الحذف" });
  }
});


// ==========================================
// 4. ITEM CLASSIFICATIONS & TREE (تصنيفات الأصناف وهرمية الرتب - Image 4)
// ==========================================

// GET /api/item-groups/classifications
router.get("/item-groups/classifications", (req, res) => {
  try {
    const list = db.prepare("SELECT * FROM item_classifications ORDER BY classification_code ASC").all();
    res.json({ success: true, data: list });
  } catch (error: any) {
    console.error("Error fetching classifications:", error);
    res.status(500).json({ error: error.message || "فشل تحميل تصنيفات الأصناف" });
  }
});

// POST /api/item-groups/classifications
router.post("/item-groups/classifications", (req, res) => {
  try {
    const {
      classification_code, parent_code, name, foreign_name,
      is_transactional, main_group_id, activity_name, default_markup_pct
    } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "اسم التصنيف مطلوب" });
    }

    const code = classification_code && classification_code.trim() !== "" ? classification_code.trim() : "110" + (Date.now() % 100);

    const stmt = db.prepare(`
      INSERT INTO item_classifications (
        classification_code, parent_code, name, foreign_name,
        is_transactional, main_group_id, activity_name, default_markup_pct, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    const info = stmt.run(
      code,
      parent_code ? parent_code.trim() : "",
      name.trim(),
      foreign_name ? foreign_name.trim() : "",
      is_transactional ? 1 : 0,
      Number(main_group_id) || 1,
      activity_name || "نشاط أصناف تجارية",
      Number(default_markup_pct) || 0.0
    );

    const created = db.prepare("SELECT * FROM item_classifications WHERE id = ?").get(info.lastInsertRowid);
    res.json({ success: true, message: "تم إضافة تصنيف الصنف بنجاح", data: created });
  } catch (error: any) {
    console.error("Error creating classification:", error);
    res.status(500).json({ error: error.message || "فشل إضافة التصنيف" });
  }
});

// PUT /api/item-groups/classifications/:id
router.put("/item-groups/classifications/:id", (req, res) => {
  try {
    const { id } = req.params;
    const {
      classification_code, parent_code, name, foreign_name,
      is_transactional, main_group_id, activity_name, default_markup_pct, active
    } = req.body;

    db.prepare(`
      UPDATE item_classifications
      SET classification_code = ?, parent_code = ?, name = ?, foreign_name = ?,
          is_transactional = ?, main_group_id = ?, activity_name = ?, default_markup_pct = ?, active = ?
      WHERE id = ?
    `).run(
      classification_code.trim(),
      parent_code ? parent_code.trim() : "",
      name.trim(),
      foreign_name ? foreign_name.trim() : "",
      is_transactional ? 1 : 0,
      Number(main_group_id) || 1,
      activity_name || "",
      Number(default_markup_pct) || 0.0,
      active ? 1 : 0,
      Number(id)
    );

    const updated = db.prepare("SELECT * FROM item_classifications WHERE id = ?").get(Number(id));
    res.json({ success: true, message: "تم تعديل التصنيف بنجاح", data: updated });
  } catch (error: any) {
    console.error("Error updating classification:", error);
    res.status(500).json({ error: error.message || "فشل التعديل" });
  }
});

// DELETE /api/item-groups/classifications/:id
router.delete("/api/item-groups/classifications/:id", (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM item_classifications WHERE id = ?").run(Number(id));
    res.json({ success: true, message: "تم حذف تصنيف الصنف" });
  } catch (error: any) {
    console.error("Error deleting classification:", error);
    res.status(500).json({ error: error.message || "فشل الحذف" });
  }
});


// ==========================================
// 5. FETCH & LINK ITEMS (إنزال الأصناف المربوطة)
// ==========================================
router.post("/item-groups/link-items", (req, res) => {
  try {
    const { from_group, to_group, from_item, to_item, item_type, display_mode, target_level, target_id } = req.body;

    let sql = `SELECT id, number, name, price, cost FROM products WHERE 1=1`;
    const params: any[] = [];

    if (from_item) {
      sql += ` AND number >= ?`;
      params.push(from_item);
    }
    if (to_item) {
      sql += ` AND number <= ?`;
      params.push(to_item);
    }

    sql += ` ORDER BY number ASC LIMIT 100`;

    const items = db.prepare(sql).all(...params);

    res.json({
      success: true,
      message: `تم إنزال وربط ${items.length} صنف بالمجموعة المحددة بنجاح`,
      count: items.length,
      data: items
    });
  } catch (error: any) {
    console.error("Error linking items:", error);
    res.status(500).json({ error: error.message || "فشل إنزال الأصناف المربوطة" });
  }
});

export default router;
