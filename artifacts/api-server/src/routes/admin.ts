import { Router } from "express";
import { db, getSessionUser } from "../lib/sqlite";
import { getAuthUser } from "./auth";

const router = Router();

router.post("/admin/reset-database", (req, res) => {
  const user = getAuthUser(req);
  if (!user || user.role !== "developer") {
    return res.status(403).json({ error: "غير مصرح - هذه العملية للمطور فقط" });
  }

  try {
    db.transaction(() => {
      // List of tables to clear (Wipe data but keep schema)
      const tablesToClear = [
        "orders",
        "order_items",
        "customers",
        "products",
        "categories",
        "stock_movements",
        "hr_employees",
        "hr_salaries",
        "hr_attendance",
        "hr_loans",
        "hr_tools",
        "hr_tools_movements",
        "hr_entitlements",
        "hr_leaves",
        "hr_custodies",
        "hr_penalties",
        "hr_overtime",
        "hr_temp_employees",
        "hr_notes",
        "returns",
        "return_items",
        "meal_deductions",
        "vouchers",
        "manual_ledger_entries",
        "suppliers",
        "purchase_orders",
        "purchase_order_items",
        "cash_shifts",
        "expenses",
        "audit_logs",
        "journal_entries",
        "journal_entry_lines",
        "purchase_requests",
        "purchase_request_items",
        "purchase_rfqs",
        "goods_receipt_notes",
        "goods_receipt_items",
        "purchase_invoices",
        "purchase_invoice_items",
        "supplier_payments",
        "supplier_contracts",
        "supplier_evaluations",
        "stock_waste_records",
        "stock_issue_vouchers",
        "stock_return_vouchers",
        "stock_transfers",
        "stocktakes",
        "warehouse_stocks",
        "erp_sessions"
      ];

      for (const table of tablesToClear) {
        try {
          db.exec(`DELETE FROM ${table}`);
          // Reset autoincrement
          db.exec(`DELETE FROM sqlite_sequence WHERE name='${table}'`);
        } catch (e) {
          console.warn(`Could not clear table ${table}:`, e);
        }
      }

      // Keep important users (admin and developer)
      db.exec("DELETE FROM users WHERE username NOT IN ('admin', 'developer')");
      db.exec("DELETE FROM sqlite_sequence WHERE name='users'");
      
      // Keep essential settings but we could reset them to default if needed
      // db.exec("DELETE FROM settings");
      
      // Optionally reset stock in products if we kept products (but we cleared them above)
    })();

    res.json({ message: "تم تصفير قاعدة البيانات بنجاح والبدء من الصفر" });
  } catch (error: any) {
    res.status(500).json({ error: "حدث خطأ أثناء تصفير قاعدة البيانات: " + error.message });
  }
});

export default router;
