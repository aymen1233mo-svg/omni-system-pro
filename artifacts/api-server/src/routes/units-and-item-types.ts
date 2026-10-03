import { Router } from "express";
import { db } from "../lib/sqlite";

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════
// 1. UNITS OF MEASUREMENT (وحدات القياس والتحويلات)
// ═══════════════════════════════════════════════════════════════════════════

// GET /units-of-measurement
router.get("/units-of-measurement", (req, res) => {
  try {
    const units = db.prepare(`
      SELECT * FROM units_of_measurement ORDER BY id ASC
    `).all() as any[];

    // Fetch conversions for each unit
    const conversions = db.prepare(`
      SELECT * FROM unit_conversions ORDER BY id ASC
    `).all() as any[];

    const enriched = units.map(u => ({
      ...u,
      conversions: conversions.filter(c => c.unit_id === u.id)
    }));

    res.json({
      success: true,
      data: enriched,
      conversions
    });
  } catch (error: any) {
    console.error("Error fetching units of measurement:", error);
    res.status(500).json({ error: error.message || "فشل تحميل وحدات القياس" });
  }
});

// POST /units-of-measurement
router.post("/units-of-measurement", (req, res) => {
  try {
    const {
      code, name, default_package, is_package_locked,
      unit_type, category, conversion_factor, base_unit, notes,
      conversions
    } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: "يرجى إدخال رمز واسم الوحدة بشكل صحيح" });
    }

    const ins = db.prepare(`
      INSERT INTO units_of_measurement (
        code, name, default_package, is_package_locked,
        unit_type, category, conversion_factor, base_unit, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      code.trim(),
      name.trim(),
      Number(default_package) || 1.0,
      is_package_locked ? 1 : 0,
      unit_type || "numerical",
      category || "weight",
      Number(conversion_factor) || 1.0,
      base_unit || "",
      notes || ""
    );

    const newUnitId = ins.lastInsertRowid as number;

    // Insert conversions if provided
    if (Array.isArray(conversions) && conversions.length > 0) {
      const insConv = db.prepare(`
        INSERT INTO unit_conversions (unit_id, from_unit, to_unit, factor, operation)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const c of conversions) {
        if (c.to_unit && c.factor) {
          insConv.run(newUnitId, c.from_unit || code, c.to_unit, Number(c.factor), c.operation || "multiply");
        }
      }
    }

    const created = db.prepare("SELECT * FROM units_of_measurement WHERE id = ?").get(newUnitId);
    res.status(201).json({
      success: true,
      message: "تمت إضافة وحدة القياس بنجاح",
      data: created
    });
  } catch (error: any) {
    console.error("Error creating unit of measurement:", error);
    res.status(500).json({ error: error.message || "فشل حفظ وحدة القياس" });
  }
});

// PUT /units-of-measurement/:id
router.put("/units-of-measurement/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      code, name, default_package, is_package_locked,
      unit_type, category, conversion_factor, base_unit, notes,
      conversions
    } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: "يرجى إدخال رمز واسم الوحدة" });
    }

    db.prepare(`
      UPDATE units_of_measurement SET
        code = ?,
        name = ?,
        default_package = ?,
        is_package_locked = ?,
        unit_type = ?,
        category = ?,
        conversion_factor = ?,
        base_unit = ?,
        notes = ?,
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      code.trim(),
      name.trim(),
      Number(default_package) || 1.0,
      is_package_locked ? 1 : 0,
      unit_type || "numerical",
      category || "weight",
      Number(conversion_factor) || 1.0,
      base_unit || "",
      notes || "",
      id
    );

    // Update conversions
    if (Array.isArray(conversions)) {
      db.prepare("DELETE FROM unit_conversions WHERE unit_id = ?").run(id);
      const insConv = db.prepare(`
        INSERT INTO unit_conversions (unit_id, from_unit, to_unit, factor, operation)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const c of conversions) {
        if (c.to_unit && c.factor) {
          insConv.run(id, c.from_unit || code, c.to_unit, Number(c.factor), c.operation || "multiply");
        }
      }
    }

    const updated = db.prepare("SELECT * FROM units_of_measurement WHERE id = ?").get(id);
    res.json({
      success: true,
      message: "تم تحديث وحدة القياس بنجاح",
      data: updated
    });
  } catch (error: any) {
    console.error("Error updating unit of measurement:", error);
    res.status(500).json({ error: error.message || "فشل تحديث وحدة القياس" });
  }
});

// DELETE /units-of-measurement/:id
router.delete("/units-of-measurement/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    const unit = db.prepare("SELECT * FROM units_of_measurement WHERE id = ?").get(id) as any;
    if (!unit) {
      return res.status(404).json({ error: "وحدة القياس غير موجودة" });
    }

    // Integrity check: Check if products use this unit
    const productUsage = db.prepare(`
      SELECT COUNT(*) as c FROM products WHERE unit = ? OR unit = ?
    `).get(unit.name, unit.code) as { c: number };

    if (productUsage.c > 0) {
      return res.status(400).json({
        error: `لا يمكن حذف وحدة القياس (${unit.name}) لأنها مستخدمة حالياً في (${productUsage.c}) صنف مخزني!`
      });
    }

    db.prepare("DELETE FROM unit_conversions WHERE unit_id = ?").run(id);
    db.prepare("DELETE FROM units_of_measurement WHERE id = ?").run(id);

    res.json({
      success: true,
      message: "تم حذف وحدة القياس بنجاح"
    });
  } catch (error: any) {
    console.error("Error deleting unit of measurement:", error);
    res.status(500).json({ error: error.message || "فشل حذف وحدة القياس" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. ITEM TYPES (أنواع الأصناف وتصنيفاتها)
// ═══════════════════════════════════════════════════════════════════════════

// GET /item-types
router.get("/item-types", (req, res) => {
  try {
    const types = db.prepare(`
      SELECT * FROM item_types ORDER BY type_number ASC
    `).all() as any[];

    // Count product usage for each item type
    const enriched = types.map(t => {
      let usageCount = 0;
      try {
        usageCount = (db.prepare(`
          SELECT COUNT(*) as c FROM products WHERE item_type = ? OR item_type = ? OR item_type = ?
        `).get(t.code, t.name, String(t.type_number)) as any)?.c || 0;
      } catch {}
      return {
        ...t,
        usage_count: usageCount
      };
    });

    res.json({
      success: true,
      data: enriched
    });
  } catch (error: any) {
    console.error("Error fetching item types:", error);
    res.status(500).json({ error: error.message || "فشل تحميل أنواع الأصناف" });
  }
});

// POST /item-types
router.post("/item-types", (req, res) => {
  try {
    const {
      type_number, code, name, foreign_name,
      main_group_id, main_group_name,
      sub_group_id, sub_group_name,
      sub_sub_group_id, sub_sub_group_name,
      auxiliary_group_id, auxiliary_group_name,
      active
    } = req.body;

    if (!type_number || !name) {
      return res.status(400).json({ error: "يرجى إدخال رقم نوع الصنف واسم النوع" });
    }

    const ins = db.prepare(`
      INSERT INTO item_types (
        type_number, code, name, foreign_name,
        main_group_id, main_group_name,
        sub_group_id, sub_group_name,
        sub_sub_group_id, sub_sub_group_name,
        auxiliary_group_id, auxiliary_group_name,
        active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      Number(type_number),
      (code || String(type_number)).trim(),
      name.trim(),
      (foreign_name || "").trim(),
      Number(main_group_id) || 1,
      main_group_name || "001 مجموعة عامة",
      Number(sub_group_id) || 1,
      sub_group_name || "المجموعة الفرعية 1",
      Number(sub_sub_group_id) || 1,
      sub_sub_group_name || "تحت الفرعية 1",
      Number(auxiliary_group_id) || 1,
      auxiliary_group_name || "المساعدة 1",
      active === undefined || active === null || active ? 1 : 0
    );

    const created = db.prepare("SELECT * FROM item_types WHERE id = ?").get(ins.lastInsertRowid);
    res.status(201).json({
      success: true,
      message: "تمت إضافة نوع الصنف بنجاح",
      data: created
    });
  } catch (error: any) {
    console.error("Error creating item type:", error);
    res.status(500).json({ error: error.message || "فشل حفظ نوع الصنف" });
  }
});

// PUT /item-types/:id
router.put("/item-types/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      type_number, code, name, foreign_name,
      main_group_id, main_group_name,
      sub_group_id, sub_group_name,
      sub_sub_group_id, sub_sub_group_name,
      auxiliary_group_id, auxiliary_group_name,
      active
    } = req.body;

    if (!type_number || !name) {
      return res.status(400).json({ error: "يرجى إدخال رقم نوع الصنف واسم النوع" });
    }

    db.prepare(`
      UPDATE item_types SET
        type_number = ?,
        code = ?,
        name = ?,
        foreign_name = ?,
        main_group_id = ?,
        main_group_name = ?,
        sub_group_id = ?,
        sub_group_name = ?,
        sub_sub_group_id = ?,
        sub_sub_group_name = ?,
        auxiliary_group_id = ?,
        auxiliary_group_name = ?,
        active = ?,
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      Number(type_number),
      (code || String(type_number)).trim(),
      name.trim(),
      (foreign_name || "").trim(),
      Number(main_group_id) || 1,
      main_group_name || "001 مجموعة عامة",
      Number(sub_group_id) || 1,
      sub_group_name || "المجموعة الفرعية 1",
      Number(sub_sub_group_id) || 1,
      sub_sub_group_name || "تحت الفرعية 1",
      Number(auxiliary_group_id) || 1,
      auxiliary_group_name || "المساعدة 1",
      active ? 1 : 0,
      id
    );

    const updated = db.prepare("SELECT * FROM item_types WHERE id = ?").get(id);
    res.json({
      success: true,
      message: "تم تحديث نوع الصنف بنجاح",
      data: updated
    });
  } catch (error: any) {
    console.error("Error updating item type:", error);
    res.status(500).json({ error: error.message || "فشل تحديث نوع الصنف" });
  }
});

// DELETE /item-types/:id (Enforcing Onyx Pro constraint from Image 2: لا يسمح بحذف وحدات الأنواع إذا كانت مستخدمة في شاشة بيانات الصنف)
router.delete("/item-types/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    const itemType = db.prepare("SELECT * FROM item_types WHERE id = ?").get(id) as any;
    if (!itemType) {
      return res.status(404).json({ error: "نوع الصنف غير موجود" });
    }

    // Check usage in products table
    const productUsage = db.prepare(`
      SELECT COUNT(*) as c FROM products 
      WHERE item_type = ? OR item_type = ? OR item_type = ?
    `).get(itemType.code, itemType.name, String(itemType.type_number)) as { c: number };

    if (productUsage.c > 0) {
      return res.status(400).json({
        error: `قاعدة الأمان: لا يسمح بحذف نوع الصنف (${itemType.name}) لأنه مستخدم ومربوط بـ (${productUsage.c}) صنف في شاشة بيانات الأصناف!`
      });
    }

    db.prepare("DELETE FROM item_types WHERE id = ?").run(id);

    res.json({
      success: true,
      message: "تم حذف نوع الصنف بنجاح"
    });
  } catch (error: any) {
    console.error("Error deleting item type:", error);
    res.status(500).json({ error: error.message || "فشل حذف نوع الصنف" });
  }
});

export default router;
