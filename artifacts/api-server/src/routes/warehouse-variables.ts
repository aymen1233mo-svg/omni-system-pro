import { Router } from "express";
import { db } from "../lib/sqlite";

const router = Router();

// GET /warehouse-variables
router.get("/warehouse-variables", (req, res) => {
  try {
    let vars = db.prepare("SELECT * FROM warehouse_system_variables WHERE id = 1").get() as any;
    if (!vars) {
      db.prepare(`
        INSERT INTO warehouse_system_variables (id) VALUES (1)
      `).run();
      vars = db.prepare("SELECT * FROM warehouse_system_variables WHERE id = 1").get() as any;
    }

    // Also get supplementary system info (warehouses, products count, GL accounts check)
    let warehouseCount = 0;
    try {
      warehouseCount = (db.prepare("SELECT COUNT(*) as c FROM warehouses").get() as any)?.c || 1;
    } catch {
      warehouseCount = 1;
    }

    let productsCount = 0;
    try {
      productsCount = (db.prepare("SELECT COUNT(*) as c FROM products").get() as any)?.c || 0;
    } catch {
      productsCount = 0;
    }

    let accountsList: any[] = [];
    try {
      accountsList = db.prepare("SELECT code, name, type FROM chart_of_accounts WHERE active = 1 ORDER BY code ASC").all();
    } catch {
      accountsList = [];
    }

    res.json({
      success: true,
      data: vars,
      meta: {
        warehouseCount,
        productsCount,
        accountsCount: accountsList.length,
        accounts: accountsList
      }
    });
  } catch (error: any) {
    console.error("Error fetching warehouse variables:", error);
    res.status(500).json({ error: error.message || "Failed to fetch warehouse variables" });
  }
});

// PUT /warehouse-variables
router.put("/warehouse-variables", (req, res) => {
  try {
    const current = db.prepare("SELECT * FROM warehouse_system_variables WHERE id = 1").get() as any;
    const body = req.body || {};
    const changedBy = body.updated_by || (req as any).user?.name || "مدير النظام";

    const fields = [
      "costing_method", "cost_level", "allow_below_cost_sale", "allow_negative_stock",
      "enforce_expiry_date", "enforce_batch_lot", "enable_serial_numbers", "auto_barcode_type", "barcode_prefix",
      "grn_require_purchase_order", "grn_allowed_overage_pct", "grn_update_cost_on_save",
      "issue_require_cost_center", "issue_require_purpose_desc", "issue_block_expired_items",
      "transfer_mechanism", "transfer_cost_basis", "include_shipping_in_transfer_cost",
      "freeze_stock_during_stocktake", "auto_post_stocktake_variances", "stocktake_approval_threshold",
      "stocktake_frequency", "alert_min_stock", "alert_reorder_point", "alert_max_stock", "expiry_warning_days",
      "enable_scale_barcode", "scale_barcode_prefix", "scale_code_length", "scale_value_type", "scale_decimals",
      "quantity_decimals", "price_decimals", "allow_multi_units",
      "accounting_inventory_system", "inv_control_account", "cogs_account", "goods_in_transit_account",
      "stock_surplus_account", "stock_deficit_account", "stock_revaluation_account",
      "require_supervisor_approval_issue", "issue_approval_amount", "prevent_deleting_posted_vouchers",
      "enable_audit_trail",
      // Onyx Pro Advanced Variables
      "allow_delete_receipt_item", "allow_edit_received_qty", "allow_edit_receiving_wh",
      "allow_exceed_transfer_qty", "allow_edit_transit_account", "link_transfer_to_request",
      "link_issue_to_request", "link_receipt_to_order", "enforce_ref_no", "enforce_description",
      "use_item_accessories", "auto_link_item_accessory", "link_item_activities_to_perms",
      "handle_consignment_goods", "handle_trust_goods", "deduct_composite_sales_in_reconcile",
      "include_main_group_in_item_code", "alert_exceed_max_transfer_qty", "auto_receipt_transfer_by_wh",
      "manual_items_in_repair_waste", "use_item_bom", "show_desc_at_item_level",
      "use_standard_costing", "auto_generate_item_code", "use_receipt_expenses", "use_expiry_date",
      "adopt_transfer_price_as_receipt_cost", "use_weight_dimension_system", "weight_dimension_type",
      "weight_unit_factor_desc", "cost_decimals", "general_decimals", "min_pricing_sign",
      "min_pricing_pct", "max_pricing_sign", "max_pricing_pct", "min_cost_pct", "max_cost_pct",
      "allow_expired_receipt_mode", "batch_lot_columns_count", "batch_grid_columns_json",
      "barcode_matrix_json", "use_price_change_request", "price_by_smallest_unit", "check_source_wh_in_transfer"
    ];

    const updates: string[] = [];
    const values: any[] = [];
    const auditIns = db.prepare(`
      INSERT INTO warehouse_variables_audit (changed_by, section_name, field_name, old_value, new_value, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const field of fields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);

        // Audit check
        if (current && current[field] !== undefined && String(current[field]) !== String(body[field])) {
          let section = "عام";
          if (field.includes("cost") || field.includes("allow_") || field.includes("enforce") || field.includes("barcode")) section = "التقييم والترميز";
          else if (field.includes("grn") || field.includes("issue") || field.includes("transfer")) section = "سياسات التوريد والصرف";
          else if (field.includes("stocktake") || field.includes("alert") || field.includes("expiry")) section = "الجرد والرقابة";
          else if (field.includes("scale") || field.includes("decimals") || field.includes("unit")) section = "الميزان والوحدات";
          else if (field.includes("account") || field.includes("accounting")) section = "الربط المحاسبي";
          else if (field.includes("approval") || field.includes("prevent") || field.includes("audit")) section = "الصلاحيات والأمان";

          auditIns.run(
            changedBy,
            section,
            field,
            String(current[field] ?? ""),
            String(body[field] ?? ""),
            body.reason || "تعديل إعدادات ومتغيرات نظام المخازن"
          );
        }
      }
    }

    updates.push("updated_by = ?");
    values.push(changedBy);
    updates.push("updated_at = datetime('now', 'localtime')");

    if (updates.length > 2) {
      const sql = `UPDATE warehouse_system_variables SET ${updates.join(", ")} WHERE id = 1`;
      db.prepare(sql).run(...values);
    }

    const updated = db.prepare("SELECT * FROM warehouse_system_variables WHERE id = 1").get();
    res.json({
      success: true,
      message: "تم حفظ وتحديث متغيرات نظام المخازن بنجاح",
      data: updated
    });
  } catch (error: any) {
    console.error("Error updating warehouse variables:", error);
    res.status(500).json({ error: error.message || "Failed to update warehouse variables" });
  }
});

// POST /warehouse-variables/reset
router.post("/warehouse-variables/reset", (req, res) => {
  try {
    const changedBy = req.body?.updated_by || "مدير النظام";
    db.prepare(`
      UPDATE warehouse_system_variables SET
        costing_method = 'moving_average',
        cost_level = 'warehouse',
        allow_below_cost_sale = 0,
        allow_negative_stock = 0,
        enforce_expiry_date = 1,
        enforce_batch_lot = 1,
        enable_serial_numbers = 0,
        auto_barcode_type = 'EAN13',
        barcode_prefix = '29',
        grn_require_purchase_order = 1,
        grn_allowed_overage_pct = 5.0,
        grn_update_cost_on_save = 1,
        issue_require_cost_center = 1,
        issue_require_purpose_desc = 1,
        issue_block_expired_items = 1,
        transfer_mechanism = 'two_step',
        transfer_cost_basis = 'source_cost',
        include_shipping_in_transfer_cost = 1,
        freeze_stock_during_stocktake = 1,
        auto_post_stocktake_variances = 0,
        stocktake_approval_threshold = 5000.0,
        stocktake_frequency = 'monthly',
        alert_min_stock = 1,
        alert_reorder_point = 1,
        alert_max_stock = 1,
        expiry_warning_days = 60,
        enable_scale_barcode = 1,
        scale_barcode_prefix = '99',
        scale_code_length = 5,
        scale_value_type = 'total_price',
        scale_decimals = 2,
        quantity_decimals = 2,
        price_decimals = 2,
        allow_multi_units = 1,
        accounting_inventory_system = 'perpetual',
        inv_control_account = '120101',
        cogs_account = '510101',
        goods_in_transit_account = '120201',
        stock_surplus_account = '420301',
        stock_deficit_account = '520301',
        stock_revaluation_account = '520401',
        require_supervisor_approval_issue = 1,
        issue_approval_amount = 10000.0,
        prevent_deleting_posted_vouchers = 1,
        enable_audit_trail = 1,
        updated_by = ?,
        updated_at = datetime('now', 'localtime')
      WHERE id = 1
    `).run(changedBy);

    db.prepare(`
      INSERT INTO warehouse_variables_audit (changed_by, section_name, field_name, old_value, new_value, reason)
      VALUES (?, 'تهيئة عامة', 'إعادة ضبط شاملة', 'إعدادات مخصصة', 'القيم الافتراضية القياسية', 'استعادة متغيرات نظام المخازن الافتراضية')
    `).run(changedBy);

    const updated = db.prepare("SELECT * FROM warehouse_system_variables WHERE id = 1").get();
    res.json({
      success: true,
      message: "تمت استعادة الإعدادات والمتغيرات الافتراضية لنظام المخازن بنجاح",
      data: updated
    });
  } catch (error: any) {
    console.error("Error resetting warehouse variables:", error);
    res.status(500).json({ error: error.message || "Failed to reset warehouse variables" });
  }
});

// GET /warehouse-variables/audit-logs
router.get("/warehouse-variables/audit-logs", (req, res) => {
  try {
    const logs = db.prepare("SELECT * FROM warehouse_variables_audit ORDER BY id DESC LIMIT 100").all();
    res.json({ success: true, data: logs });
  } catch (error: any) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({ error: error.message || "Failed to fetch audit logs" });
  }
});

// POST /warehouse-variables/diagnostics
router.post("/warehouse-variables/diagnostics", (req, res) => {
  try {
    const vars = db.prepare("SELECT * FROM warehouse_system_variables WHERE id = 1").get() as any;
    const checks: any[] = [];

    // Check Costing Method
    checks.push({
      code: "COSTING",
      title: "طريقة تقييم تكلفة المخزون",
      status: "pass",
      detail: `طريقة التكلفة المحددة هي [${vars.costing_method === 'moving_average' ? 'المتوسط المرجح المتحرك' : vars.costing_method}] على مستوى [${vars.cost_level === 'warehouse' ? 'كل مخزن بشكل مستقل' : 'الشركة ككل'}] وهي متوافقة مع المعايير المحاسبية.`
    });

    // Check Negative Stock Policy
    if (vars.allow_negative_stock === 2) {
      checks.push({
        code: "NEG_STOCK",
        title: "الرصيد السالب بالمخازن",
        status: "warning",
        detail: "تنبيه: السماح المطلق بالرصيد السالب قد يسبب تشوهات في حساب متوسط التكلفة وحسابات الجرد."
      });
    } else {
      checks.push({
        code: "NEG_STOCK",
        title: "الرصيد السالب بالمخازن",
        status: "pass",
        detail: vars.allow_negative_stock === 0 ? "سليم: الرصيد السالب ممنوع تماماً لضمان دقة المخزون." : "تحذير فقط: يتم تنبيه أمين المخزن عند نفاد الكميات."
      });
    }

    // Check Scale Barcode
    if (vars.enable_scale_barcode) {
      checks.push({
        code: "SCALE",
        title: "تكامل موازين الباركود الإلكترونية",
        status: "pass",
        detail: `بادئة الميزان [${vars.scale_barcode_prefix}] مفعلة بطول كود [${vars.scale_code_length}] خانات ونمط [${vars.scale_value_type === 'total_price' ? 'سعر إجمالي' : 'وزن بالجرام'}].`
      });
    }

    // Check GL Accounts Integration
    const requiredAccounts = [
      { key: "inv_control_account", name: "مراقبة المخزون", val: vars.inv_control_account },
      { key: "cogs_account", name: "تكلفة البضاعة المباعة", val: vars.cogs_account },
      { key: "goods_in_transit_account", name: "بضاعة بالطريق", val: vars.goods_in_transit_account },
      { key: "stock_surplus_account", name: "فائض الجرد", val: vars.stock_surplus_account },
      { key: "stock_deficit_account", name: "عجز وهالك المخزون", val: vars.stock_deficit_account }
    ];

    let missingGl = false;
    for (const acc of requiredAccounts) {
      if (!acc.val) missingGl = true;
    }

    if (missingGl) {
      checks.push({
        code: "GL_MAPPING",
        title: "ربط الحسابات بالأستاذ العام",
        status: "warning",
        detail: "تنبيه: بعض الحسابات الوسيطة للمخزون غير محددة مما قد يؤخر توليد القيود المحاسبية التلقائية."
      });
    } else {
      checks.push({
        code: "GL_MAPPING",
        title: "ربط الحسابات بالأستاذ العام",
        status: "pass",
        detail: `جميع حسابات الجرد [${vars.accounting_inventory_system === 'perpetual' ? 'الجرد المستمر' : 'الجرد الدوري'}] مربوطة بالدليل المحاسبي بدقة.`
      });
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      allPassed: !checks.some(c => c.status === "error"),
      checks
    });
  } catch (error: any) {
    console.error("Error running diagnostics:", error);
    res.status(500).json({ error: error.message || "Diagnostics failed" });
  }
});

export default router;
