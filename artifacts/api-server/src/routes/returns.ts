import { Router } from "express";
import { db, logAudit, createDoubleEntryJournal, deleteJournalBySource } from "../lib/sqlite";
import { getAuthUser } from "./auth";
import { getCustomerAccountCode } from "./customers";
import { recordSafeOrBankMovement } from "../lib/erp-accounting-sync";

const router = Router();

function requireAuth(req: any, res: any): any {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return null; }
  return user;
}

function requireAdmin(req: any, res: any): boolean {
  const user = getAuthUser(req);
  if (!user || (user.role !== "admin" && user.role !== "developer")) {
    res.status(403).json({ error: "غير مصرح للمشرفين فقط" });
    return false;
  }
  return true;
}

// Get all returns
router.get("/returns", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { startDate, endDate, search } = req.query as any;
  let sql = `
    SELECT r.*, u.name as cashier_name, c.name as customer_name, app.name as approver_name
    FROM returns r
    LEFT JOIN users u ON u.id=r.user_id
    LEFT JOIN customers c ON c.id=r.customer_id
    LEFT JOIN users app ON app.id=r.approved_by
    WHERE 1=1
  `;
  const params: any[] = [];
  if (startDate) { sql += " AND DATE(r.created_at)>=?"; params.push(startDate); }
  if (endDate) { sql += " AND DATE(r.created_at)<=?"; params.push(endDate); }
  if (search) { sql += " AND (r.return_number LIKE ? OR r.invoice_number LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }
  sql += " ORDER BY r.created_at DESC";
  
  try {
    const rows = db.prepare(sql).all(...params) as any[];
    const result = rows.map(r => {
      const items = db.prepare("SELECT * FROM return_items WHERE return_id=?").all(r.id);
      return { ...r, items };
    });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get returns analytics by category (linking categories with returns)
router.get("/returns/categories-analytics", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const rows = db.prepare(`
      SELECT 
        c.id, 
        c.name, 
        c.color,
        COALESCE(c.cost, 0) as cost, 
        COALESCE(c.revenue, 0) as revenue,
        COALESCE(SUM(ri.total), 0) as total_returned_amount,
        COALESCE(SUM(ri.quantity), 0) as total_returned_qty
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      LEFT JOIN return_items ri ON ri.product_id = p.id
      LEFT JOIN returns r ON r.id = ri.return_id AND r.status = 'approved'
      GROUP BY c.id
      ORDER BY c.name
    `).all();
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get a single return
router.get("/returns/:id", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const row = db.prepare(`
      SELECT r.*, u.name as cashier_name, c.name as customer_name, app.name as approver_name
      FROM returns r
      LEFT JOIN users u ON u.id=r.user_id
      LEFT JOIN customers c ON c.id=r.customer_id
      LEFT JOIN users app ON app.id=r.approved_by
      WHERE r.id=?
    `).get(req.params.id) as any;
    if (!row) { res.status(404).json({ error: "المرتجع غير موجود" }); return; }
    row.items = db.prepare("SELECT * FROM return_items WHERE return_id=?").all(row.id);
    res.json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Create a return (with automatic manager approval checks)
router.post("/returns", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { 
    invoice_number, order_id, reason, payment_method, customer_id, notes, items, requires_approval,
    branch_id, warehouse_id, return_type, safe_id, currency, exchange_rate, cost_center,
    delegate_id, driver_id, region_id, reference_number, commission_rate, attachments_count,
    is_suspended, is_posted, subtotal, discount, tax, additional_charges, entry_device
  } = req.body;

  if (!invoice_number || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "رقم الفاتورة والمنتجات المرتجعة مطلوبة" });
    return;
  }

  try {
    // Resolve Order ID & exact invoice number if searching by simple integer like "1" or "2"
    const toEnglishDigits = (str: string) => str.replace(/[٠-٩]/g, d => '0123456789'[d.charCodeAt(0) - 0x0660]);
    const invStr = toEnglishDigits(String(invoice_number).trim());
    const cleanInv = invStr.replace(/^(inv|ord|#|ref|فاتورة|رقم)-?/i, "").replace(/^0+/, "") || invStr;

    let resolvedOrderId = order_id ? Number(order_id) : null;
    let targetOrder: any = null;

    if (resolvedOrderId) {
      targetOrder = db.prepare("SELECT * FROM orders WHERE id=?").get(resolvedOrderId) as any;
    }

    if (!targetOrder && invStr) {
      targetOrder = db.prepare(`
        SELECT * FROM orders 
        WHERE invoice_number = ? 
           OR TRIM(invoice_number) = ?
           OR CAST(id AS TEXT) = ?
           OR CAST(id AS TEXT) = ?
           OR invoice_number LIKE ?
        ORDER BY 
          CASE 
            WHEN invoice_number = ? THEN 0
            WHEN CAST(id AS TEXT) = ? THEN 1
            ELSE 2
          END,
          created_at DESC
        LIMIT 1
      `).get(invStr, cleanInv, invStr, cleanInv, `%${cleanInv}`, invStr, cleanInv) as any;

      if (targetOrder) {
        resolvedOrderId = targetOrder.id;
      }
    }

    const effectiveInvoiceNumber = targetOrder?.invoice_number ?? invoice_number;
    const effectiveCustomerId = customer_id ?? targetOrder?.customer_id ?? null;
    const effectiveSafeId = safe_id ?? targetOrder?.safe_id ?? 1;

    const total_refund = items.reduce((sum: number, item: any) => sum + (item.unit_price * item.quantity), 0);
    const defaultTax = (tax !== undefined && tax !== null)
      ? Number(tax)
      : (targetOrder && Number(targetOrder.total) > 0
          ? Math.round((Number(targetOrder.tax || 0) * (total_refund / Number(targetOrder.total))) * 100) / 100
          : 0);
    const defaultSubtotal = (subtotal !== undefined && subtotal !== null)
      ? Number(subtotal)
      : Math.max(0, Math.round((total_refund - defaultTax) * 100) / 100);
    const effectivePaymentMethod = payment_method ?? targetOrder?.payment_method ?? "cash";

    // Check if manager approval is required (Cashiers require approval for returns above 5,000, or if requested)
    const isAdmin = user.role === "admin" || user.role === "developer";
    const status = (requires_approval || (!isAdmin && total_refund > 5000)) ? "pending_approval" : "approved";
    
    const approved_by = status === "approved" ? user.id : null;
    const approved_at = status === "approved" ? new Date().toISOString() : null;

    const r = db.prepare(`
      INSERT INTO returns (
        return_number, invoice_number, order_id, reason, total_refund, payment_method, customer_id, user_id, notes, status, approved_by, approved_at,
        branch_id, warehouse_id, return_type, safe_id, currency, exchange_rate, cost_center, delegate_id, driver_id, region_id, reference_number,
        commission_rate, attachments_count, is_suspended, is_posted, subtotal, discount, tax, additional_charges, entry_device
      )
      VALUES (
        (SELECT 'RET-' || CAST(COALESCE(MAX(CAST(SUBSTR(return_number, 5) AS INTEGER)), 1000) + 1 AS TEXT) FROM returns),
        ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
      )
    `).run(
      effectiveInvoiceNumber,
      resolvedOrderId,
      reason ?? null,
      total_refund,
      effectivePaymentMethod,
      effectiveCustomerId,
      user.id,
      notes ?? null,
      status,
      approved_by,
      approved_at,
      branch_id ?? 1,
      warehouse_id ?? 1,
      return_type ?? (effectivePaymentMethod === "credit" ? "مردود مبيعات آجلة" : "مردود مبيعات نقدي"),
      effectiveSafeId,
      currency ?? "ريال",
      exchange_rate ?? 1.0,
      cost_center ?? "101",
      delegate_id ?? null,
      driver_id ?? null,
      region_id ?? null,
      reference_number ?? null,
      commission_rate ?? 0.0,
      attachments_count ?? 0,
      is_suspended ? 1 : 0,
      is_posted ?? 1 ? 1 : 0,
      defaultSubtotal,
      discount ?? 0,
      defaultTax,
      additional_charges ?? 0,
      entry_device ?? "WORKSTATION-01"
    );

    const returnId = r.lastInsertRowid;
    const returnData = db.prepare("SELECT return_number FROM returns WHERE id=?").get(returnId) as { return_number: string };
    const returnNum = returnData.return_number;

    const insertItem = db.prepare(`
      INSERT INTO return_items (return_id, product_id, product_name, quantity, unit_price, total, item_code, unit, invoice_number, original_quantity)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `);

    let totalCostOfReturnedItems = 0;

    for (const item of items) {
      insertItem.run(
        returnId, 
        item.product_id ?? null, 
        item.product_name ?? item.productName, 
        item.quantity, 
        item.unit_price ?? item.unitPrice, 
        (item.unit_price ?? item.unitPrice) * item.quantity,
        item.item_code ?? item.itemCode ?? (item.product_id ? `ITM-${item.product_id}` : null),
        item.unit ?? "حبة",
        invoice_number,
        item.original_quantity ?? item.originalQuantity ?? item.quantity
      );
      
      // Stock update and COGS compilation ONLY if approved right away
      if (status === "approved" && item.product_id) {
        const prod = db.prepare("SELECT stock, cost FROM products WHERE id=?").get(item.product_id) as any;
        const prevStock = Number(prod?.stock ?? 0);
        const newStock = prevStock + Number(item.quantity || 0);
        db.prepare("UPDATE products SET stock = ? WHERE id=?").run(newStock, item.product_id);
        try {
          db.prepare(`
            INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason, reference_id, user_name)
            VALUES (?, 'in', ?, ?, ?, ?, ?, ?)
          `).run(item.product_id, item.quantity, prevStock, newStock, `مرتجع مبيعات #${returnNum}`, returnId, user.name);
        } catch {}
        
        if (prod && prod.cost) {
          totalCostOfReturnedItems += Number(prod.cost) * Number(item.quantity);
        }
      }
    }

    // Generate accounting double entry if approved
    if (status === "approved") {
      try {
        const tax_refund = defaultTax;
        const subtotal_refund = defaultSubtotal;

        // Check if returned order is an employee meal order or supplier credit order
        let isEmployeeMeal = false;
        let empRow = null;
        let origOrder = targetOrder;
        if (!origOrder && (resolvedOrderId || effectiveInvoiceNumber)) {
          try {
            origOrder = db.prepare("SELECT * FROM orders WHERE id=? OR (order_id IS NULL AND invoice_number IS NOT NULL AND invoice_number=?) ORDER BY created_at DESC LIMIT 1").get(resolvedOrderId ?? -1, effectiveInvoiceNumber ?? "") as any;
          } catch {}
        }
        if (origOrder) {
          try {
            if (origOrder.note && origOrder.note.includes("وجبة موظف")) {
              const empNameMatch = origOrder.note.match(/وجبة موظف:\s*([^(]+)/);
              const empName = empNameMatch ? empNameMatch[1].trim() : origOrder.note.replace("وجبة موظف:", "").trim();
              if (empName) {
                empRow = db.prepare("SELECT * FROM hr_employees WHERE name = ? OR TRIM(name) = ?").get(empName, empName) as any;
                if (empRow) isEmployeeMeal = true;
              }
            }
            if (!isEmployeeMeal && origOrder.employee_id) {
              empRow = db.prepare("SELECT * FROM hr_employees WHERE id = ?").get(origOrder.employee_id) as any;
              if (empRow) isEmployeeMeal = true;
            }
          } catch (oErr) {
            console.warn("Error looking up original order on return:", oErr);
          }
        }

        const isSupplierCredit = Boolean(origOrder?.supplier_id && !origOrder?.customer_id);
        const isCreditReturn = isEmployeeMeal || isSupplierCredit || effectivePaymentMethod === "credit" || (origOrder && origOrder.payment_method === "credit");
        const effectiveMethod = isCreditReturn ? "credit" : effectivePaymentMethod;

        const creditAccountCode = isEmployeeMeal && empRow
          ? (empRow.account_code || getEmployeeSubAccountCode(db, empRow.id, empRow.name))
          : isSupplierCredit
            ? "21100"
            : (isCreditReturn
              ? getCustomerAccountCode(effectiveCustomerId)
              : (effectiveMethod === "card" || effectiveMethod === "bank" ? "11200" : "11100"));

        // 1. Sales Return & VAT Reverse
        createDoubleEntryJournal(
          new Date().toISOString().slice(0, 10),
          `مرتجع مبيعات رقم ${returnNum} لفاتورة ${effectiveInvoiceNumber}`,
          "return",
          Number(returnId),
          [
            { account_code: "42000", debit: subtotal_refund, credit: 0, description: `مردودات ومسموحات مبيعات فاتورة ${effectiveInvoiceNumber}` },
            ...(tax_refund > 0 ? [{ account_code: "21300", debit: tax_refund, credit: 0, description: `عكس ضريبة القيمة المضافة للمخرجات لمرتجع ${returnNum}` }] : []),
            { account_code: creditAccountCode, debit: 0, credit: total_refund, description: `رد قيمة المرتجع ${isEmployeeMeal ? `لحساب الموظف (${empRow?.name})` : isSupplierCredit ? `لحساب المورد` : isCreditReturn ? `لحساب العميل` : `عبر ${effectiveMethod}`}` }
          ]
        );

        // 2. COGS & Stock Adjustment (Debit Stock Asset, Credit COGS Expense)
        if (totalCostOfReturnedItems > 0) {
          createDoubleEntryJournal(
            new Date().toISOString().slice(0, 10),
            `تسوية تكلفة البضاعة المباعة والمخزون لمرتجع ${returnNum}`,
            "return",
            Number(returnId),
            [
              { account_code: "11300", debit: totalCostOfReturnedItems, credit: 0, description: `إعادة البضاعة للمخزون السلعي (${returnNum})` },
              { account_code: "51000", debit: 0, credit: totalCostOfReturnedItems, description: `تخفيض تكلفة البضاعة المباعة (${returnNum})` }
            ]
          );
        }

        if (isEmployeeMeal && empRow) {
          const empAccCode = empRow.account_code || getEmployeeSubAccountCode(db, empRow.id, empRow.name);
          db.prepare("UPDATE hr_employees SET balance = COALESCE(balance, 0) + ? WHERE id=?").run(total_refund, empRow.id);
          db.prepare("UPDATE accounts SET balance = COALESCE(balance, 0) + ? WHERE code=?").run(total_refund, empAccCode);
        } else if (isSupplierCredit && origOrder?.supplier_id) {
          db.prepare("UPDATE suppliers SET balance = COALESCE(balance, 0) - ? WHERE id=?").run(total_refund, origOrder.supplier_id);
        } else if (isCreditReturn && effectiveCustomerId) {
          db.prepare("UPDATE customers SET balance = MAX(0, COALESCE(balance, 0) - ?) WHERE id=?").run(total_refund, effectiveCustomerId);
        }

        // Mark original order status as 'returned'
        if (resolvedOrderId) {
          try {
            db.prepare("UPDATE orders SET status = 'returned' WHERE id=?").run(resolvedOrderId);
          } catch (oErr: any) {
            console.error("Error updating order status on return:", oErr.message);
          }
        } else if (effectiveInvoiceNumber) {
          try {
            db.prepare("UPDATE orders SET status = 'returned' WHERE invoice_number=?").run(effectiveInvoiceNumber);
          } catch (oErr: any) {
            console.error("Error updating order status on return:", oErr.message);
          }
        }

        // Revert & remove meal deduction if this invoice was an employee/customer meal deduction
        if (resolvedOrderId || effectiveInvoiceNumber) {
          try {
            const meals = resolvedOrderId
              ? (db.prepare("SELECT * FROM meal_deductions WHERE order_id=?").all(resolvedOrderId) as any[])
              : (db.prepare("SELECT * FROM meal_deductions WHERE invoice_number IS NOT NULL AND invoice_number=? AND invoice_number!=''").all(effectiveInvoiceNumber ?? "") as any[]);
            for (const meal of meals) {
              try { deleteJournalBySource("meal_deduction", meal.id); } catch {}
              if (Number(meal.amount) <= total_refund) {
                db.prepare("DELETE FROM meal_deductions WHERE id=?").run(meal.id);
              } else {
                db.prepare("UPDATE meal_deductions SET amount = MAX(0, amount - ?) WHERE id=?").run(total_refund, meal.id);
              }
            }
          } catch (mErr: any) {
            console.error("Error removing meal deduction on return:", mErr.message);
          }
        }

        if (!isCreditReturn && !isEmployeeMeal && (effectiveMethod === "cash" || effectiveMethod === "card" || effectiveMethod === "bank")) {
          recordSafeOrBankMovement(db, {
            type: "out",
            amount: total_refund,
            method: effectiveMethod,
            safeId: Number(effectiveSafeId) || 1,
            description: `صرف مقابل مرتجع مبيعات رقم ${returnNum}`,
            referenceType: "return",
            referenceId: Number(returnId),
            userId: user.id,
          });
        }

      } catch (jeErr: any) {
        console.error("Accounting journal error during return creation:", jeErr.message);
      }
    }

    logAudit(user.id, user.name, "تسجيل مرتجع", `تسجيل مرتجع رقم ${returnNum} لفاتورة ${invoice_number} بقيمة ${total_refund} [حالة: ${status}]`);

    const created = db.prepare(`
      SELECT r.*, u.name as cashier_name FROM returns r
      LEFT JOIN users u ON u.id=r.user_id WHERE r.id=?
    `).get(returnId) as any;
    created.items = db.prepare("SELECT * FROM return_items WHERE return_id=?").all(returnId);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Approve a pending return
router.post("/returns/:id/approve", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);

  try {
    const returnRow = db.prepare("SELECT * FROM returns WHERE id=?").get(req.params.id) as any;
    if (!returnRow) { res.status(404).json({ error: "المرتجع غير موجود" }); return; }
    if (returnRow.status === "approved") { res.status(400).json({ error: "المرتجع معتمد ومكتمل مسبقاً" }); return; }

    const items = db.prepare("SELECT * FROM return_items WHERE return_id=?").all(returnRow.id) as any[];
    let totalCostOfReturnedItems = 0;

    // 1. Restock items & compute cost
    for (const item of items) {
      if (item.product_id) {
        db.prepare("UPDATE products SET stock = COALESCE(stock, 0) + ? WHERE id=?").run(item.quantity, item.product_id);
        const prod = db.prepare("SELECT cost FROM products WHERE id=?").get(item.product_id) as any;
        if (prod && prod.cost) {
          totalCostOfReturnedItems += Number(prod.cost) * Number(item.quantity);
        }
      }
    }

    // 2. Mark as approved
    db.prepare("UPDATE returns SET status='approved', approved_by=?, approved_at=datetime('now') WHERE id=?").run(user.id, returnRow.id);

    // 3. Balanced Ledger Entries
    try {
      const total_refund = returnRow.total_refund;
      const tax_refund = Math.round(total_refund * 0.15 / 1.15);
      const subtotal_refund = total_refund - tax_refund;

      const creditAccountCode = returnRow.payment_method === "credit" ? "11200" : "11100";

      // Sales & Tax reverse
      createDoubleEntryJournal(
        new Date().toISOString().slice(0, 10),
        `مرتجع مبيعات رقم ${returnRow.return_number} لفاتورة ${returnRow.invoice_number}`,
        "return",
        returnRow.id,
        [
          { account_code: "41000", debit: subtotal_refund, credit: 0, description: `إلغاء جزء من إيرادات المبيعات لفاتورة ${returnRow.invoice_number}` },
          { account_code: "21000", debit: tax_refund, credit: 0, description: `عكس ضريبة القيمة المضافة المحتسبة` },
          { account_code: creditAccountCode, debit: 0, credit: total_refund, description: `إرجاع القيمة للعميل عبر ${returnRow.payment_method}` }
        ]
      );

      // COGS Adjustment
      if (totalCostOfReturnedItems > 0) {
        createDoubleEntryJournal(
          new Date().toISOString().slice(0, 10),
          `تسوية تكلفة البضاعة المباعة والمخزون لمرتجع ${returnRow.return_number}`,
          "return",
          returnRow.id,
          [
            { account_code: "11300", debit: totalCostOfReturnedItems, credit: 0, description: `إعادة المواد للمخزون والسلع` },
            { account_code: "51000", debit: 0, credit: totalCostOfReturnedItems, description: `تخفيض تكلفة المبيعات للفترة` }
          ]
        );
      }

      // 3. Update customer balance if credit
      if (returnRow.payment_method === "credit" && returnRow.customer_id) {
        db.prepare("UPDATE customers SET balance = balance - ? WHERE id=?").run(returnRow.total_refund, returnRow.customer_id);
      }

      // 4. Update Safe Balance if cash or card
      if (returnRow.payment_method === "cash" || returnRow.payment_method === "card") {
        const effectiveSafeId = returnRow.safe_id ?? 1;
        db.prepare("UPDATE safes SET balance = balance - ? WHERE id=?").run(returnRow.total_refund, effectiveSafeId);
      }
    } catch (jeErr: any) {
      console.error("Accounting journal error during return approval:", jeErr.message);
    }

    logAudit(user.id, user.name, "اعتماد مرتجع", `تم اعتماد المرتجع رقم ${returnRow.return_number} بقيمة ${returnRow.total_refund} وإعادة البضائع للمخازن`);
    res.json({ success: true, status: "approved" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Delete return
router.delete("/returns/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);

  try {
    const row = db.prepare("SELECT * FROM returns WHERE id=?").get(req.params.id) as any;
    if (!row) { res.status(404).json({ error: "غير موجود" }); return; }
    
    const returnItems = db.prepare("SELECT * FROM return_items WHERE return_id=?").all(row.id) as any[];
    
    // Revert stock updates only if previously approved
    if (row.status === "approved") {
      for (const item of returnItems) {
        if (item.product_id) {
          db.prepare("UPDATE products SET stock = MAX(0, COALESCE(stock, 0) - ?) WHERE id=?").run(item.quantity, item.product_id);
        }
      }
    }

    db.prepare("DELETE FROM returns WHERE id=?").run(req.params.id);
    logAudit(user.id, user.name, "حذف مرتجع", `حذف مرتجع رقم ${row.return_number}`);
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/returns-summary", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + "-01";
  
  try {
    const todayStats = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(total_refund),0) as total FROM returns WHERE DATE(created_at)=?").get(today) as any;
    const monthStats = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(total_refund),0) as total FROM returns WHERE DATE(created_at)>=?").get(monthStart) as any;
    const totalCount = (db.prepare("SELECT COUNT(*) as c FROM returns").get() as any).c;
    res.json({
      todayCount: todayStats.count,
      todayTotal: todayStats.total,
      monthCount: monthStats.count,
      monthTotal: monthStats.total,
      totalCount,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});



/* ── ملخص صناديق الكاشيرين ── */
router.get("/cashier-boxes", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { date } = req.query as any;
  const filterDate = date ?? new Date().toISOString().slice(0, 10);

  try {
    let cashiers = db.prepare(`
      SELECT u.id, u.name, u.role,
        COALESCE(SUM(o.total),0) as orders_total,
        COUNT(o.id) as orders_count
      FROM users u
      LEFT JOIN orders o ON o.user_id=u.id AND DATE(o.created_at)=?
      WHERE u.active=1
      GROUP BY u.id, u.name, u.role
      ORDER BY u.name
    `).all(filterDate) as any[];

    const user = getAuthUser(req);
    if (user && user.role !== "developer") {
      cashiers = cashiers.filter(c => c.role !== "developer");
    }

    const returns_ = db.prepare(`
      SELECT o.user_id,
        COALESCE(SUM(r.total_refund),0) as returns_total,
        COUNT(r.id) as returns_count
      FROM returns r
      LEFT JOIN orders o ON o.id=r.order_id
      WHERE DATE(r.created_at)=?
      GROUP BY o.user_id
    `).all(filterDate) as any[];

    const returnsMap = new Map(returns_.map(r => [r.user_id, r]));

    const mainTotal = cashiers.reduce((s, c) => s + c.orders_total, 0);
    const mainReturns = returns_.reduce((s, r) => s + r.returns_total, 0);

    res.json({
      date: filterDate,
      mainBox: { total: mainTotal, returnsTotal: mainReturns, net: mainTotal - mainReturns },
      cashiers: cashiers.map(c => {
        const ret = returnsMap.get(c.id);
        return {
          userId: c.id,
          name: c.name,
          ordersTotal: c.orders_total,
          ordersCount: c.orders_count,
          returnsTotal: ret?.returns_total ?? 0,
          returnsCount: ret?.returns_count ?? 0,
          net: c.orders_total - (ret?.returns_total ?? 0),
        };
      }),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
